import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { appleConfig, claimTrue, exchangeAppleCode, sha256Hex, verifyIdToken } from '@/server/auth/oauth-tokens'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { signInWithIdentity } from '@/server/services/oauth.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../_respond'
import { iosMeta, outcomeResponse } from '../_shared'

export const dynamic = 'force-dynamic'

const schema = z.object({
  identityToken: z.string().min(20).max(8000),
  authorizationCode: z.string().max(2000).optional().nullable(),
  /** الـnonce الخام؛ التطبيق أرسل تجزيئه SHA-256 إلى Apple */
  nonce: z.string().min(16).max(200),
  /** الاسم يعطيه Apple للتطبيق في أول دخول فقط */
  fullName: z.string().max(120).optional().nullable()
})

/**
 * POST /api/v1/ios/auth/apple — زر «المتابعة بحساب Apple» الأصلي في تطبيق الآيفون.
 * يشترط ترويسة X-Madrasadz-Client: ios.
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const cfg = appleConfig()
    if (!cfg) throw new AppError('OAUTH_NOT_CONFIGURED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const d = parsed.data
    const db = await getDb()
    const meta = iosMeta(req)
    await checkRateLimit(db, { scope: 'login-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.loginIp })
    const claims = await verifyIdToken('APPLE', d.identityToken, { audiences: [cfg.bundleId], nonce: sha256Hex(d.nonce) })
    const refreshToken = d.authorizationCode ? await exchangeAppleCode(d.authorizationCode, cfg.bundleId) : null
    const outcome = await signInWithIdentity(
      db,
      {
        provider: 'APPLE',
        subject: claims.sub,
        email: claims.email ?? null,
        emailVerified: claims.email ? claimTrue(claims.email_verified) || claims.email_verified === undefined : false,
        fullName: d.fullName ?? null,
        refreshToken
      },
      meta
    )
    return outcomeResponse(outcome)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
