import { NextResponse, type NextRequest } from 'next/server'
import { GOOGLE_AUTHORIZE_URL, googleConfig } from '@/server/auth/oauth-tokens'
import { callbackUrl, failRedirect, newState, pkceChallenge, setStateCookie } from '@/server/auth/oauth-flow'
import { AppError } from '@/server/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/oauth/google/start?next=/student[&app=ios] — يحوّل إلى صفحة اختيار حساب Google.
 * app=ios: يفتحه تطبيق الآيفون في نافذة النظام، والنتيجة تعود إليه بمخطط madrasadz-auth://
 */
export function GET(req: NextRequest) {
  const app = req.nextUrl.searchParams.get('app') === 'ios' ? 'ios' : null
  const state = newState('GOOGLE', { next: req.nextUrl.searchParams.get('next'), app, pkce: true })
  const cfg = googleConfig()
  if (!cfg) return failRedirect(req, state, new AppError('OAUTH_NOT_CONFIGURED'))
  const url = new URL(GOOGLE_AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: callbackUrl(req, 'GOOGLE'),
    response_type: 'code',
    scope: 'openid email profile',
    state: state.s,
    nonce: state.n,
    code_challenge: pkceChallenge(state.v!),
    code_challenge_method: 'S256',
    prompt: 'select_account'
  }).toString()
  const res = NextResponse.redirect(url.toString(), 303)
  setStateCookie(res, state)
  return res
}
