import { createHash, createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify, type JsonWebKey } from 'node:crypto'
import type { OAuthProvider } from '@/server/db/schema/auth'
import { AppError } from '@/server/lib/errors'

/**
 * التحقق من رموز الهوية (ID token) لـ Google وApple دون مكتبة خارجية: توقيع RS256 بمفاتيح المزوّد العامة (JWKS)،
 * ثم المُصدِر والجمهور والصلاحية والـnonce. لا يُقبل أي خوارزمية أخرى.
 *
 * المتغيرات (كلها اختيارية؛ غيابها يُخفي الزر المعني):
 *  GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET — عميل «Web application» في Google Cloud.
 *  APPLE_TEAM_ID / APPLE_SIGNIN_KEY_ID / APPLE_SIGNIN_PRIVATE_KEY — مفتاح .p8 بخدمة Sign in with Apple
 *    (يلزم لإلغاء الإذن عند حذف الحساب، وهو شرط Apple؛ لذلك لا يُفعَّل Apple دونه).
 *  APPLE_BUNDLE_ID — معرّف تطبيق الآيفون (الافتراضي com.madrasadz.student).
 *  APPLE_SERVICES_ID — «Services ID» للدخول بـ Apple من الموقع (دونه يبقى Apple في الآيفون وحده).
 */

export interface IdTokenClaims {
  iss: string
  sub: string
  aud: string | string[]
  exp: number
  iat?: number
  nonce?: string
  email?: string
  email_verified?: boolean | string
  is_private_email?: boolean | string
  name?: string
}

interface RsaJwk extends JsonWebKey {
  kid: string
  kty: 'RSA'
  alg?: string
}

const JWKS_URL: Record<OAuthProvider, string> = {
  GOOGLE: 'https://www.googleapis.com/oauth2/v3/certs',
  APPLE: 'https://appleid.apple.com/auth/keys'
}
const ISSUERS: Record<OAuthProvider, string[]> = {
  GOOGLE: ['https://accounts.google.com', 'accounts.google.com'],
  APPLE: ['https://appleid.apple.com']
}
const JWKS_TTL_MS = 6 * 60 * 60 * 1000
const JWKS_MIN_REFETCH_MS = 60 * 1000
const CLOCK_SKEW_S = 120

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>
let fetchImpl: FetchLike = (input, init) => fetch(input, init)
const jwksCache = new Map<OAuthProvider, { keys: RsaJwk[]; fetchedAt: number }>()

/** للاختبارات: يستبدل fetch ويُفرغ ذاكرة المفاتيح */
export function setOAuthFetchForTests(fn: FetchLike | null) {
  fetchImpl = fn ?? ((input, init) => fetch(input, init))
  jwksCache.clear()
}

export function oauthFetch(input: string, init?: RequestInit) {
  return fetchImpl(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(10_000) })
}

// ── الإعدادات ─────────────────────────────────────────────────────────────

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export interface AppleConfig {
  teamId: string
  keyId: string
  privateKey: string
  bundleId: string
  servicesId: string | null
}

export function appleConfig(): AppleConfig | null {
  const teamId = (process.env.APPLE_TEAM_ID ?? process.env.APNS_TEAM_ID)?.trim()
  const keyId = process.env.APPLE_SIGNIN_KEY_ID?.trim()
  // مثل APNS_PRIVATE_KEY: سطر base64 للملف .p8 كاملًا، أو نصّ PEM نفسه (\n حرفيًا مقبول)
  const rawKey = process.env.APPLE_SIGNIN_PRIVATE_KEY?.trim()
  const privateKey = rawKey ? (rawKey.includes('BEGIN') ? rawKey.replace(/\\n/g, '\n') : Buffer.from(rawKey, 'base64').toString('utf8').trim()) : ''
  if (!teamId || !keyId || !privateKey) return null
  return {
    teamId,
    keyId,
    privateKey,
    bundleId: process.env.APPLE_BUNDLE_ID?.trim() || 'com.madrasadz.student',
    servicesId: process.env.APPLE_SERVICES_ID?.trim() || null
  }
}

/** ما يظهر من أزرار: في الموقع (google, appleWeb) وفي تطبيق الآيفون (google, appleIos) */
export function oauthAvailability() {
  const apple = appleConfig()
  return { google: Boolean(googleConfig()), appleWeb: Boolean(apple?.servicesId), appleIos: Boolean(apple) }
}

// ── JWT ───────────────────────────────────────────────────────────────────

function b64urlJson<T>(part: string): T {
  try {
    return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T
  } catch {
    throw new AppError('OAUTH_FAILED')
  }
}

async function loadKeys(provider: OAuthProvider, force: boolean): Promise<RsaJwk[]> {
  const cached = jwksCache.get(provider)
  const age = cached ? Date.now() - cached.fetchedAt : Infinity
  if (cached && (age < JWKS_TTL_MS && !force)) return cached.keys
  if (cached && force && age < JWKS_MIN_REFETCH_MS) return cached.keys
  const res = await oauthFetch(JWKS_URL[provider])
  if (!res.ok) throw new AppError('OAUTH_FAILED')
  const body = (await res.json()) as { keys?: RsaJwk[] }
  const keys = (body.keys ?? []).filter((k) => k.kty === 'RSA' && typeof k.kid === 'string')
  jwksCache.set(provider, { keys, fetchedAt: Date.now() })
  return keys
}

export async function verifyIdToken(
  provider: OAuthProvider,
  token: string,
  opts: { audiences: string[]; nonce?: string | null; now?: Date }
): Promise<IdTokenClaims> {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) throw new AppError('OAUTH_FAILED')
  const header = b64urlJson<{ alg?: string; kid?: string }>(parts[0])
  if (header.alg !== 'RS256' || !header.kid) throw new AppError('OAUTH_FAILED')

  let key = (await loadKeys(provider, false)).find((k) => k.kid === header.kid)
  // المزوّد يدوّر مفاتيحه: kid غير معروف ⇒ إعادة جلب مرة واحدة
  if (!key) key = (await loadKeys(provider, true)).find((k) => k.kid === header.kid)
  if (!key) throw new AppError('OAUTH_FAILED')

  const publicKey = createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' })
  const ok = cryptoVerify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], 'base64url'))
  if (!ok) throw new AppError('OAUTH_FAILED')

  const claims = b64urlJson<IdTokenClaims>(parts[1])
  const nowS = Math.floor((opts.now ?? new Date()).getTime() / 1000)
  if (!ISSUERS[provider].includes(claims.iss)) throw new AppError('OAUTH_FAILED')
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.some((a) => opts.audiences.includes(a))) throw new AppError('OAUTH_FAILED')
  if (typeof claims.exp !== 'number' || claims.exp + CLOCK_SKEW_S < nowS) throw new AppError('OAUTH_FAILED')
  if (typeof claims.iat === 'number' && claims.iat - CLOCK_SKEW_S > nowS) throw new AppError('OAUTH_FAILED')
  if (typeof claims.sub !== 'string' || !claims.sub) throw new AppError('OAUTH_FAILED')
  if (opts.nonce !== undefined && opts.nonce !== null && claims.nonce !== opts.nonce) throw new AppError('OAUTH_FAILED')
  return claims
}

export function claimTrue(v: boolean | string | undefined): boolean {
  return v === true || v === 'true'
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

// ── Google: تبادل الرمز (الموقع) ──────────────────────────────────────────

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'

export async function exchangeGoogleCode(params: { code: string; redirectUri: string; codeVerifier: string }): Promise<string> {
  const cfg = googleConfig()
  if (!cfg) throw new AppError('OAUTH_NOT_CONFIGURED')
  const res = await oauthFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: params.code,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: params.codeVerifier
    })
  })
  const body = (await res.json().catch(() => ({}))) as { id_token?: string }
  if (!res.ok || !body.id_token) throw new AppError('OAUTH_FAILED')
  return body.id_token
}

// ── Apple: سرّ العميل، وتبادل الرمز، وإلغاء الإذن ─────────────────────────

export const APPLE_AUTHORIZE_URL = 'https://appleid.apple.com/auth/authorize'

/** سرّ عميل Apple: JWT بتوقيع ES256 بمفتاح .p8، صالح 5 دقائق */
export function appleClientSecret(cfg: AppleConfig, clientId: string, now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: cfg.keyId })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ iss: cfg.teamId, iat, exp: iat + 300, aud: 'https://appleid.apple.com', sub: clientId })).toString('base64url')
  const signature = cryptoSign('sha256', Buffer.from(`${header}.${payload}`), { key: createPrivateKey(cfg.privateKey), dsaEncoding: 'ieee-p1363' })
  return `${header}.${payload}.${signature.toString('base64url')}`
}

/**
 * يبدّل رمز التفويض برمز تحديث يُحفظ لإلغاء الإذن عند حذف الحساب. فشله لا يمنع الدخول (يُرجع null).
 * clientId = معرّف التطبيق للآيفون، أو Services ID للموقع (مع redirectUri نفسه).
 */
export async function exchangeAppleCode(code: string, clientId: string, redirectUri?: string): Promise<string | null> {
  const cfg = appleConfig()
  if (!cfg || !code) return null
  try {
    const form = new URLSearchParams({ client_id: clientId, client_secret: appleClientSecret(cfg, clientId), code, grant_type: 'authorization_code' })
    if (redirectUri) form.set('redirect_uri', redirectUri)
    const res = await oauthFetch('https://appleid.apple.com/auth/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: form })
    const body = (await res.json().catch(() => ({}))) as { refresh_token?: string }
    return res.ok && body.refresh_token ? `${clientId}:${body.refresh_token}` : null
  } catch {
    return null
  }
}

/** إلغاء إذن Apple (عند حذف الحساب). المخزَّن: «clientId:refreshToken». */
export async function revokeAppleToken(stored: string): Promise<boolean> {
  const cfg = appleConfig()
  const sep = stored.indexOf(':')
  if (!cfg || sep <= 0) return false
  const clientId = stored.slice(0, sep)
  const token = stored.slice(sep + 1)
  try {
    const res = await oauthFetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: appleClientSecret(cfg, clientId), token, token_type_hint: 'refresh_token' })
    })
    return res.ok
  } catch {
    return false
  }
}
