import { type NextRequest } from 'next/server'
import { claimTrue, exchangeGoogleCode, googleConfig, verifyIdToken } from '@/server/auth/oauth-tokens'
import { callbackUrl, failRedirect, finishOAuth, readState } from '@/server/auth/oauth-flow'
import { AppError } from '@/server/lib/errors'

export const dynamic = 'force-dynamic'

/** GET /api/auth/oauth/google/callback — Google يعود برمز التفويض */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const { state, ok } = readState(req, 'GOOGLE', q.get('state'))
  try {
    if (!state || !ok) throw new AppError('OAUTH_FAILED')
    // ألغى التلميذ اختيار الحساب
    if (q.get('error') || !q.get('code')) throw new AppError('OAUTH_FAILED')
    const cfg = googleConfig()
    if (!cfg) throw new AppError('OAUTH_NOT_CONFIGURED')
    const idToken = await exchangeGoogleCode({ code: q.get('code')!, redirectUri: callbackUrl(req, 'GOOGLE'), codeVerifier: state.v ?? '' })
    const claims = await verifyIdToken('GOOGLE', idToken, { audiences: [cfg.clientId], nonce: state.n })
    return finishOAuth(req, state, {
      provider: 'GOOGLE',
      subject: claims.sub,
      email: claims.email ?? null,
      emailVerified: claimTrue(claims.email_verified),
      fullName: claims.name ?? null
    })
  } catch (err) {
    return failRedirect(req, state, err)
  }
}
