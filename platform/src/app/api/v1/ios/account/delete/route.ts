import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { deleteOwnAccount } from '@/server/services/account-deletion.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ password: z.string().min(1).max(200), confirm: z.literal(true) })

/**
 * POST /api/v1/ios/account/delete — حذف التلميذ حسابه من داخل التطبيق (شرط Apple 5.1.1(v)).
 * نفس خدمة الحذف في صفحة الحساب على الموقع: كلمة السر مطلوبة، والتلميذ وحده يحذف حسابه بنفسه.
 * يشترط ترويسة X-Madrasadz-Client: ios (لا يرسلها متصفح عبر نطاق آخر بلا CORS، فلا CSRF بالكوكي).
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    await checkRateLimit(db, { scope: 'account-delete', subject: actor.userId, ...RATE_LIMITS.loginEmail })
    await deleteOwnAccount(db, actor.userId, parsed.data.password)
    const res = NextResponse.json({ ok: true, data: { deleted: true } })
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0, expires: new Date(0) })
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
