import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { iosNoStore } from '@/server/services/ios-session.service'
import { verifyOtp } from '@/server/services/otp.service'
import { iosApiError, resolveIosActor } from '../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ phone: z.string().trim().min(9).max(20), code: z.string().trim().min(4).max(8) })

/** POST /api/v1/ios/phone/verify — التحقق من الرمز؛ ينجح فيُعلَّم الهاتف مؤكَّدًا في ملف التلميذ (كما في الموقع) */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    if (actor.role !== 'STUDENT') throw new AppError('FORBIDDEN')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('OTP_INVALID')
    await checkRateLimit(db, { scope: 'otp-verify', subject: actor.userId, limit: 30, windowSeconds: 10 * 60 })
    await verifyOtp(db, { phone: parsed.data.phone, purpose: 'REGISTER', code: parsed.data.code, userId: actor.userId })
    return iosNoStore(NextResponse.json({ ok: true, data: { verified: true } }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
