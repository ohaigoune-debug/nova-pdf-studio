import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { iosNoStore } from '@/server/services/ios-session.service'
import { OTP_RESEND_COOLDOWN_S, requestOtp } from '@/server/services/otp.service'
import { iosApiError, resolveIosActor } from '../../_respond'
import { clientIp } from '@/server/lib/client-ip'

export const dynamic = 'force-dynamic'

const schema = z.object({ phone: z.string().trim().min(9).max(20) })

/** POST /api/v1/ios/phone/request — إرسال رمز تأكيد الهاتف (نفس requestOtpAction في الموقع، غرض REGISTER) */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    if (actor.role !== 'STUDENT') throw new AppError('FORBIDDEN')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'phone' })
    await checkRateLimit(db, { scope: 'otp-user', subject: actor.userId, limit: 10, windowSeconds: 60 * 60 })
    const ip = clientIp(req.headers)
    await requestOtp(db, { phone: parsed.data.phone, purpose: 'REGISTER', userId: actor.userId, ip })
    return iosNoStore(NextResponse.json({ ok: true, data: { cooldown: OTP_RESEND_COOLDOWN_S } }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
