import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { authorizeCallSecret, handleIncomingCall, touchCallApp } from '@/server/services/call-confirm.service'

export const dynamic = 'force-dynamic'
export const maxDuration = 15

/** حمولة تطبيق NOVA Call نفسها (يُوجَّه التطبيق إلى عنوان مدرسة بدل NOVA) */
const bodySchema = z.object({
  phone: z.string().trim().min(3).max(32),
  /** incoming | outgoing — الواردة وحدها تؤكّد */
  direction: z.enum(['incoming', 'outgoing']).optional(),
  kind: z.enum(['call', 'sms']).optional(),
  text: z.string().max(1000).optional().nullable(),
  app: z.string().max(20).optional(),
  /** 1.2+: وقت المكالمة ووقت الإرسال بساعة الهاتف (ms) */
  at: z.number().int().positive().optional(),
  now: z.number().int().positive().optional()
})

const MAX_DELAY_MS = 7 * 24 * 3_600_000

/** وقت المكالمة بساعة الخادم: يؤخذ من الهاتف فارقُ الزمن بين المكالمة والإرسال فقط، فلا تهمّ ساعة مضبوطة خطأ */
function callTime(body: { at?: number; now?: number }): Date {
  if (!body.at || !body.now) return new Date()
  const delay = Math.min(Math.max(body.now - body.at, 0), MAX_DELAY_MS)
  return new Date(Date.now() - delay)
}

const MESSAGES: Record<string, (r: { orderNumber?: string; customerName?: string }) => string> = {
  confirmed: (r) => `✅ ${r.customerName ?? ''} أكّد الطلب ${r.orderNumber ?? ''}`,
  already_confirmed: (r) => `☑️ الطلب ${r.orderNumber ?? ''} مؤكَّد من قبل`,
  no_order: () => 'لا طلب معلّق لهذا الرقم',
  invalid_phone: () => 'رقم غير مفهوم',
  disabled: () => 'التأكيد بالمكالمة متوقف في الإعدادات'
}

/** فحص الاقتران، ومن NOVA Call 1.2 نبضة كل ساعة (?ping=1&v=<version>) */
export async function GET(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  const db = await getDb()
  const cfg = await authorizeCallSecret(db, secret)
  if (!cfg) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  await touchCallApp(db, new URL(req.url).searchParams.get('v')).catch(() => {})
  return NextResponse.json({ ok: true, workspace: 'مدرسة', number: cfg.number, enabled: cfg.enabled, autoReject: cfg.autoReject })
}

/** هاتف المشرف يبلّغ بمكالمة رنّانة؛ الجواب سريع لأن التطبيق يقرّر خلال ثوانٍ هل يقطع المكالمة المطابقة */
export async function POST(req: Request, ctx: { params: Promise<{ secret: string }> }) {
  const { secret } = await ctx.params
  const db = await getDb()
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
  try {
    await checkRateLimit(db, { scope: 'call-confirm', subject: ip, limit: 120, windowSeconds: 60 })
  } catch {
    return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  }
  const cfg = await authorizeCallSecret(db, secret)
  if (!cfg) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_request' }, { status: 400 })
  }
  await touchCallApp(db, body.app).catch(() => {})
  if (body.direction === 'outgoing') return NextResponse.json({ ok: true, result: 'ignored', reject: false, message: '' })
  try {
    const r = await handleIncomingCall(db, body.phone, { channel: body.kind ?? 'call', text: body.text ?? null, at: callTime(body) })
    return NextResponse.json({ ok: true, ...r, message: MESSAGES[r.result]?.(r) ?? '' })
  } catch (e) {
    console.error('[calls]', e instanceof Error ? e.message : e)
    return NextResponse.json({ ok: false, error: 'server_error', reject: false }, { status: 500 })
  }
}
