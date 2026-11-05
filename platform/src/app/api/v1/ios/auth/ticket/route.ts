import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { redeemLoginHandoff } from '@/server/services/oauth.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../_respond'
import { iosMeta, signedIn } from '../_shared'

export const dynamic = 'force-dynamic'

const schema = z.object({ ticket: z.string().min(20).max(200) })

/**
 * POST /api/v1/ios/auth/ticket — بعد «المتابعة بحساب Google» في نافذة النظام: تعود الصفحة إلى التطبيق
 * بتذكرة صالحة دقيقتين ومرة واحدة (madrasadz-auth://oauth?ticket=…)، فيبدّلها التطبيق هنا برمز جلسته.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const db = await getDb()
    const meta = iosMeta(req)
    await checkRateLimit(db, { scope: 'login-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.loginIp })
    const r = await redeemLoginHandoff(db, parsed.data.ticket, meta)
    return signedIn(r.session, r.role)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
