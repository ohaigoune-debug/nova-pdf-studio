import { NextResponse } from 'next/server'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { isDeliveryProvider, recordDeliveryEvent, verifyDeliveryWebhook } from '@/server/services/delivery.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const MAX_BODY = 64 * 1024

/**
 * POST /api/v1/delivery/webhook?provider=generic|yalidine
 * المصادقة: x-webhook-secret = السرّ، أو x-signature = HMAC-SHA256(السرّ, الجسم) hex. السرّ من إعداد
 * `delivery.webhookSecret` (مشفّر) أو DELIVERY_WEBHOOK_SECRET. مكرَّر ⇒ 200 duplicate، طلب مجهول ⇒ 202.
 */
export async function POST(req: Request) {
  try {
    const url = new URL(req.url)
    const provider = url.searchParams.get('provider') ?? 'generic'
    if (!isDeliveryProvider(provider)) throw new AppError('VALIDATION', { field: 'provider' })
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
    const db = await getDb()
    await checkRateLimit(db, { scope: 'delivery-webhook', subject: ip, limit: 120, windowSeconds: 60 })
    const rawBody = await req.text()
    if (rawBody.length > MAX_BODY) throw new AppError('VALIDATION', { field: 'body' })
    const okAuth = await verifyDeliveryWebhook(db, { headerSecret: req.headers.get('x-webhook-secret'), signature: req.headers.get('x-signature'), rawBody })
    if (!okAuth) throw new AppError('AUTH_REQUIRED')
    let payload: unknown
    try {
      payload = rawBody ? JSON.parse(rawBody) : {}
    } catch {
      throw new AppError('VALIDATION', { field: 'json' })
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new AppError('VALIDATION', { field: 'json' })
    const r = await recordDeliveryEvent(db, provider, payload as Record<string, unknown>, { ip })
    if (r.duplicate) return jsonOk({ duplicate: true })
    if (!r.orderId) return NextResponse.json({ ok: true, data: { duplicate: false, eventId: r.eventId, status: r.status, error: r.error } }, { status: 202 })
    return jsonOk({ duplicate: false, eventId: r.eventId, status: r.status, orderId: r.orderId, error: r.error, activated: r.activation ? r.activation.enrolled.length : 0, claims: r.activation ? r.activation.claims.length : 0 })
  } catch (err) {
    return jsonError(err)
  }
}
