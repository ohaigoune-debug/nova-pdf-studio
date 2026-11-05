import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import type { OAuthProvider } from '@/server/db/schema/auth'
import { getDb } from '@/server/db/client'
import { homeFor } from '@/lib/role-home'
import type { UserRole } from '@/server/db/schema/enums'
import { isAppError } from '@/server/lib/errors'
import { safeNextPath } from '@/server/lib/safe-next'
import { SESSION_COOKIE } from './session'
import { createLoginHandoff, signInWithIdentity, type VerifiedIdentity } from '@/server/services/oauth.service'
import { revokeSession } from './session'

/**
 * مسار الدخول بـ Google وApple في المتصفح (الموقع وتطبيق أندرويد، وGoogle في الآيفون عبر نافذة النظام):
 *   /api/auth/oauth/{google|apple}/start  →  المزوّد  →  /api/auth/oauth/{google|apple}/callback
 * حالة الطلب (state + nonce + PKCE + الوجهة) في كوكي موقَّع قصير العمر، لا في قاعدة البيانات.
 */

export const OAUTH_STATE_COOKIE = 'madrasa_oauth'
export const OAUTH_SIGNUP_COOKIE = 'madrasa_oauth_signup'
/** مخطط عودة تطبيق الآيفون (ASWebAuthenticationSession يلتقطه دون تسجيله في Info.plist) */
export const IOS_CALLBACK_SCHEME = 'madrasadz-auth'
const STATE_TTL_S = 10 * 60
const SIGNUP_TTL_S = 30 * 60

export interface OAuthState {
  p: OAuthProvider
  s: string
  n: string
  v?: string
  next?: string | null
  app?: 'ios' | null
  exp: number
}

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return s
}

function mac(data: string): string {
  return createHmac('sha256', secret()).update(`oauth-state:${data}`).digest('base64url')
}

export function sealState(state: OAuthState): string {
  const data = Buffer.from(JSON.stringify(state)).toString('base64url')
  return `${data}.${mac(data)}`
}

export function openState(sealed: string | undefined | null, now: Date = new Date()): OAuthState | null {
  if (!sealed) return null
  const [data, sig] = sealed.split('.')
  if (!data || !sig) return null
  const a = Buffer.from(sig)
  const b = Buffer.from(mac(data))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const state = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as OAuthState
    return state.exp > Math.floor(now.getTime() / 1000) ? state : null
  } catch {
    return null
  }
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

export function pkceChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

export function newState(provider: OAuthProvider, opts: { next?: string | null; app?: 'ios' | null; pkce?: boolean }): OAuthState {
  return {
    p: provider,
    s: randomToken(),
    n: randomToken(),
    ...(opts.pkce ? { v: randomToken(48) } : {}),
    next: safeNextPath(opts.next) ?? null,
    app: opts.app ?? null,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_S
  }
}

/** العنوان العام للمنصة (عناوين العودة يجب أن تطابق المسجَّل عند Google وApple حرفيًا) */
export function appBaseUrl(req: NextRequest): string {
  return (process.env.APP_URL ?? req.nextUrl.origin).replace(/\/$/, '')
}

export function callbackUrl(req: NextRequest, provider: OAuthProvider): string {
  return `${appBaseUrl(req)}/api/auth/oauth/${provider.toLowerCase()}/callback`
}

const secure = () => process.env.NODE_ENV === 'production'

/** كوكي الحالة. Apple يعود بطلب POST من نطاقه (form_post)، فيلزم SameSite=None (مع Secure) */
export function setStateCookie(res: NextResponse, state: OAuthState) {
  const crossSitePost = state.p === 'APPLE' && secure()
  res.cookies.set(OAUTH_STATE_COOKIE, sealState(state), {
    httpOnly: true,
    secure: secure(),
    sameSite: crossSitePost ? 'none' : 'lax',
    path: '/api/auth/oauth',
    maxAge: STATE_TTL_S
  })
}

function clearStateCookie(res: NextResponse) {
  res.cookies.set(OAUTH_STATE_COOKIE, '', { httpOnly: true, secure: secure(), path: '/api/auth/oauth', maxAge: 0 })
}

function errorCode(err: unknown): string {
  return isAppError(err) ? err.code : 'OAUTH_FAILED'
}

/** خطأ قبل التحقق أو أثناءه: إلى صفحة الدخول برسالة، أو إلى تطبيق الآيفون */
export function failRedirect(req: NextRequest, state: OAuthState | null, err: unknown): NextResponse {
  const code = errorCode(err)
  const target =
    state?.app === 'ios'
      ? `${IOS_CALLBACK_SCHEME}://oauth?error=${encodeURIComponent(code)}`
      : `${appBaseUrl(req)}/login?oauth=${encodeURIComponent(code)}${state?.next ? `&next=${encodeURIComponent(state.next)}` : ''}`
  const res = NextResponse.redirect(target, 303)
  clearStateCookie(res)
  return res
}

/** بعد التحقق من الهوية: جلسة، أو إكمال الحساب، أو تسليم إلى تطبيق الآيفون */
export async function finishOAuth(req: NextRequest, state: OAuthState, identity: VerifiedIdentity): Promise<NextResponse> {
  const db = await getDb()
  const meta = { userAgent: req.headers.get('user-agent'), ip: (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || null }
  try {
    const outcome = await signInWithIdentity(db, identity, meta)
    let res: NextResponse
    if (state.app === 'ios') {
      if (outcome.kind === 'session') {
        // التطبيق يأخذ جلسته بالتذكرة؛ جلسة المتصفح هذه لا حاجة لها
        await revokeSession(db, outcome.session.token)
        const ticket = await createLoginHandoff(db, outcome.userId, identity.provider)
        res = NextResponse.redirect(`${IOS_CALLBACK_SCHEME}://oauth?ticket=${encodeURIComponent(ticket)}`, 303)
      } else {
        const q = new URLSearchParams({ signup: outcome.token, ...(outcome.fullName ? { name: outcome.fullName } : {}), ...(outcome.email ? { email: outcome.email } : {}) })
        res = NextResponse.redirect(`${IOS_CALLBACK_SCHEME}://oauth?${q.toString()}`, 303)
      }
    } else if (outcome.kind === 'session') {
      res = NextResponse.redirect(`${appBaseUrl(req)}${state.next ?? homeFor(outcome.role as UserRole)}`, 303)
      res.cookies.set(SESSION_COOKIE, outcome.session.token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/', expires: outcome.session.expiresAt })
    } else {
      res = NextResponse.redirect(`${appBaseUrl(req)}/register/complete`, 303)
      res.cookies.set(OAUTH_SIGNUP_COOKIE, outcome.token, { httpOnly: true, sameSite: 'lax', secure: secure(), path: '/', maxAge: SIGNUP_TTL_S })
    }
    clearStateCookie(res)
    return res
  } catch (err) {
    return failRedirect(req, state, err)
  }
}

/** الحالة من الكوكي مع مطابقة state العائد. state يبقى للرسالة حتى عند عدم المطابقة (لمعرفة هل الطلب من الآيفون) */
export function readState(req: NextRequest, provider: OAuthProvider, stateParam: string | null): { state: OAuthState | null; ok: boolean } {
  const state = openState(req.cookies.get(OAUTH_STATE_COOKIE)?.value)
  if (!state || state.p !== provider || !stateParam) return { state, ok: false }
  const a = Buffer.from(state.s)
  const b = Buffer.from(stateParam)
  return { state, ok: a.length === b.length && timingSafeEqual(a, b) }
}
