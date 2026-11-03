import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { isApnsConfigured, registerIosDevice, removeIosDevice } from '@/server/services/ios-push.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ token: z.string().trim().min(64).max(200), environment: z.enum(['production', 'sandbox']).default('production') })

async function run(req: NextRequest, fn: (db: Awaited<ReturnType<typeof getDb>>, actor: NonNullable<Awaited<ReturnType<typeof resolveIosActor>>>, input: z.infer<typeof schema>) => Promise<unknown>) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'token' })
    await checkRateLimit(db, { scope: 'ios-push', subject: actor.userId, limit: 30, windowSeconds: 60 * 60 })
    const data = await fn(db, actor, parsed.data)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}

/** POST /api/v1/ios/push — تسجيل رمز جهاز Apple بعد موافقة التلميذ على الإشعارات (active: هل الإرسال مفعّل على الخادم) */
export async function POST(req: NextRequest) {
  return run(req, async (db, actor, input) => ({ ...(await registerIosDevice(db, actor, input)), active: isApnsConfigured() }))
}

/** DELETE /api/v1/ios/push — عند الخروج من الحساب: الجهاز لا يتلقّى إشعارات الحساب بعده */
export async function DELETE(req: NextRequest) {
  return run(req, (db, actor, input) => removeIosDevice(db, actor, input.token))
}
