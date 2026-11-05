import { NextResponse, type NextRequest } from 'next/server'
import { APPLE_AUTHORIZE_URL, appleConfig } from '@/server/auth/oauth-tokens'
import { callbackUrl, failRedirect, newState, setStateCookie } from '@/server/auth/oauth-flow'
import { AppError } from '@/server/lib/errors'

export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/oauth/apple/start?next=/student — الدخول بحساب Apple (iCloud) من الموقع وتطبيق أندرويد.
 * تطبيق الآيفون لا يمرّ من هنا: يستعمل زر Apple الأصلي (/api/v1/ios/auth/apple).
 */
export function GET(req: NextRequest) {
  const state = newState('APPLE', { next: req.nextUrl.searchParams.get('next') })
  const cfg = appleConfig()
  if (!cfg?.servicesId) return failRedirect(req, state, new AppError('OAUTH_NOT_CONFIGURED'))
  const url = new URL(APPLE_AUTHORIZE_URL)
  url.search = new URLSearchParams({
    client_id: cfg.servicesId,
    redirect_uri: callbackUrl(req, 'APPLE'),
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name email',
    state: state.s,
    nonce: state.n
  }).toString()
  const res = NextResponse.redirect(url.toString(), 303)
  setStateCookie(res, state)
  return res
}
