import { type NextRequest } from 'next/server'
import { appleConfig, claimTrue, exchangeAppleCode, verifyIdToken } from '@/server/auth/oauth-tokens'
import { callbackUrl, failRedirect, finishOAuth, readState } from '@/server/auth/oauth-flow'
import { AppError } from '@/server/lib/errors'

export const dynamic = 'force-dynamic'

/** الاسم يرسله Apple مرة واحدة فقط (أول دخول)، في حقل user */
function appleName(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null
  try {
    const u = JSON.parse(raw) as { name?: { firstName?: string; lastName?: string } }
    const n = [u.name?.firstName, u.name?.lastName].filter(Boolean).join(' ').trim()
    return n || null
  } catch {
    return null
  }
}

/** POST /api/auth/oauth/apple/callback — Apple يعود بنموذج (form_post) فيه id_token والرمز */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  const field = (k: string) => {
    const v = form?.get(k)
    return typeof v === 'string' ? v : null
  }
  const { state, ok } = readState(req, 'APPLE', field('state'))
  try {
    if (!state || !ok) throw new AppError('OAUTH_FAILED')
    const cfg = appleConfig()
    if (!cfg?.servicesId) throw new AppError('OAUTH_NOT_CONFIGURED')
    const idToken = field('id_token')
    if (field('error') || !idToken) throw new AppError('OAUTH_FAILED')
    const claims = await verifyIdToken('APPLE', idToken, { audiences: [cfg.servicesId], nonce: state.n })
    const code = field('code')
    const refreshToken = code ? await exchangeAppleCode(code, cfg.servicesId, callbackUrl(req, 'APPLE')) : null
    return finishOAuth(req, state, {
      provider: 'APPLE',
      subject: claims.sub,
      email: claims.email ?? null,
      emailVerified: claims.email ? claimTrue(claims.email_verified) || claims.email_verified === undefined : false,
      fullName: appleName(form?.get('user') ?? null),
      refreshToken
    })
  } catch (err) {
    return failRedirect(req, state, err)
  }
}
