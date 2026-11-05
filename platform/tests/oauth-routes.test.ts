import { generateKeyPairSync, sign as cryptoSign, type KeyObject } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { OAUTH_SIGNUP_COOKIE, OAUTH_STATE_COOKIE } from '@/server/auth/oauth-flow'
import { setOAuthFetchForTests, sha256Hex } from '@/server/auth/oauth-tokens'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { levels, streams, wilayas } from '@/server/db/schema'
import { GET as googleStart } from '@/app/api/auth/oauth/google/start/route'
import { GET as googleCallback } from '@/app/api/auth/oauth/google/callback/route'
import { GET as appleStart } from '@/app/api/auth/oauth/apple/start/route'
import { POST as appleCallback } from '@/app/api/auth/oauth/apple/callback/route'
import { POST as iosApple } from '@/app/api/v1/ios/auth/apple/route'
import { POST as iosTicket } from '@/app/api/v1/ios/auth/ticket/route'
import { POST as iosComplete } from '@/app/api/v1/ios/auth/complete/route'
import { GET as capabilities } from '@/app/api/v1/ios/capabilities/route'
import { setupDb, uniq } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let handle: DatabaseHandle
let rsa: { privateKey: KeyObject; publicKey: KeyObject }
const KID = 'route-kid'
const BASE = 'https://madrasadz.com'

function jwt(payload: Record<string, unknown>) {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: KID })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${header}.${body}.${cryptoSign('RSA-SHA256', Buffer.from(`${header}.${body}`), rsa.privateKey).toString('base64url')}`
}

/** ما سيضعه Google في id_token عند تبادل الرمز التالي */
let nextGoogleClaims: Record<string, unknown> = {}
const tokenRequests: URLSearchParams[] = []

beforeAll(async () => {
  rsa = generateKeyPairSync('rsa', { modulusLength: 2048 })
  handle = await setupDb()
  vi.mocked(getDb).mockResolvedValue(handle.db)
})
afterAll(async () => handle.close())

beforeEach(() => {
  vi.stubEnv('APP_URL', BASE)
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', 'web-client.apps.googleusercontent.com')
  vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', 'web-secret')
  const ec = generateKeyPairSync('ec', { namedCurve: 'P-256' })
  vi.stubEnv('APPLE_TEAM_ID', 'TEAM123456')
  vi.stubEnv('APPLE_SIGNIN_KEY_ID', 'KEY1234567')
  vi.stubEnv('APPLE_SIGNIN_PRIVATE_KEY', ec.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString())
  vi.stubEnv('APPLE_SERVICES_ID', 'com.madrasadz.web')
  setOAuthFetchForTests(async (url, init) => {
    if (url.includes('/certs') || url.endsWith('/auth/keys')) {
      return new Response(JSON.stringify({ keys: [{ ...rsa.publicKey.export({ format: 'jwk' }), kid: KID, alg: 'RS256' }] }))
    }
    if (url === 'https://oauth2.googleapis.com/token') {
      const form = new URLSearchParams(String(init?.body))
      tokenRequests.push(form)
      return new Response(JSON.stringify({ id_token: jwt(nextGoogleClaims) }))
    }
    if (url === 'https://appleid.apple.com/auth/token') return new Response(JSON.stringify({ refresh_token: 'r-apple' }))
    return new Response('{}', { status: 404 })
  })
})
afterEach(() => {
  vi.unstubAllEnvs()
  setOAuthFetchForTests(null)
  tokenRequests.length = 0
})

function cookieFrom(res: Response, name: string): string | null {
  for (const c of res.headers.getSetCookie()) {
    const [pair] = c.split(';')
    const [k, v] = pair!.split('=')
    if (k === name) return v ?? ''
  }
  return null
}

async function googleRoundTrip(opts: { app?: 'ios'; next?: string; claims: (nonce: string) => Record<string, unknown>; tamperState?: boolean }) {
  const q = new URLSearchParams({ ...(opts.app ? { app: opts.app } : {}), ...(opts.next ? { next: opts.next } : {}) })
  const start = googleStart(new NextRequest(`${BASE}/api/auth/oauth/google/start?${q}`))
  expect(start.status).toBe(303)
  const authUrl = new URL(start.headers.get('location')!)
  expect(authUrl.origin).toBe('https://accounts.google.com')
  expect(authUrl.searchParams.get('redirect_uri')).toBe(`${BASE}/api/auth/oauth/google/callback`)
  expect(authUrl.searchParams.get('code_challenge_method')).toBe('S256')
  const state = authUrl.searchParams.get('state')!
  nextGoogleClaims = opts.claims(authUrl.searchParams.get('nonce')!)
  const cookie = cookieFrom(start, OAUTH_STATE_COOKIE)!
  const cb = new URLSearchParams({ code: 'auth-code', state: opts.tamperState ? 'forged' : state })
  return googleCallback(new NextRequest(`${BASE}/api/auth/oauth/google/callback?${cb}`, { headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookie}` } }))
}

const now = () => Math.floor(Date.now() / 1000)
const gClaims = (sub: string, email: string) => (nonce: string) => ({
  iss: 'https://accounts.google.com',
  aud: 'web-client.apps.googleusercontent.com',
  sub,
  email,
  email_verified: true,
  name: 'تلميذ من Google',
  nonce,
  exp: now() + 600,
  iat: now()
})

async function profileBody() {
  const [w] = await handle.db.select().from(wilayas).limit(1)
  const [l] = await handle.db.select().from(levels).limit(1)
  const [s] = await handle.db.select().from(streams).limit(1)
  return { fullName: 'تلميذ من Google', phone: '0551234567', guardianPhone: '0661234567', wilayaId: w!.id, levelId: l!.id, streamId: s!.id }
}

function iosPost(path: string, body: unknown) {
  return new NextRequest(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-madrasadz-client': 'ios' }, body: JSON.stringify(body) })
}

describe('مسار Google في المتصفح', () => {
  it('حساب جديد ⇒ صفحة إكمال الحساب مع كوكي التذكرة؛ وPKCE والعودة صحيحان', async () => {
    const res = await googleRoundTrip({ claims: gClaims(uniq('g'), `${uniq('n')}@gmail.com`) })
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${BASE}/register/complete`)
    expect(cookieFrom(res, OAUTH_SIGNUP_COOKIE)).toBeTruthy()
    expect(cookieFrom(res, OAUTH_STATE_COOKIE)).toBe('')
    expect(tokenRequests[0]?.get('code_verifier')).toBeTruthy()
    expect(tokenRequests[0]?.get('redirect_uri')).toBe(`${BASE}/api/auth/oauth/google/callback`)
  })

  it('state مزوّر ⇒ صفحة الدخول برسالة، دون تبادل أي رمز', async () => {
    const res = await googleRoundTrip({ claims: gClaims('x', 'x@gmail.com'), tamperState: true })
    expect(res.headers.get('location')).toBe(`${BASE}/login?oauth=OAUTH_FAILED`)
    expect(tokenRequests).toHaveLength(0)
  })

  it('nonce مختلف في الرمز ⇒ رفض', async () => {
    const res = await googleRoundTrip({ claims: (n) => ({ ...gClaims('y', 'y@gmail.com')(n), nonce: 'other' }) })
    expect(res.headers.get('location')).toBe(`${BASE}/login?oauth=OAUTH_FAILED`)
  })

  it('غياب المفاتيح ⇒ رسالة «غير مفعّل» ولا تحويل إلى Google', async () => {
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_SECRET', '')
    const res = googleStart(new NextRequest(`${BASE}/api/auth/oauth/google/start`))
    expect(res.headers.get('location')).toBe(`${BASE}/login?oauth=OAUTH_NOT_CONFIGURED`)
  })
})

describe('تطبيق الآيفون', () => {
  it('Google: تسجيل جديد عبر نافذة النظام ⇒ إكمال أصيل ⇒ جلسة؛ ثم دخول ثانٍ بتذكرة مرة واحدة', async () => {
    const sub = uniq('gi')
    const email = `${uniq('ios')}@gmail.com`
    const first = await googleRoundTrip({ app: 'ios', claims: gClaims(sub, email) })
    const back = new URL(first.headers.get('location')!)
    expect(back.protocol).toBe('madrasadz-auth:')
    const signupToken = back.searchParams.get('signup')!
    expect(back.searchParams.get('email')).toBe(email)
    expect(cookieFrom(first, SESSION_COOKIE)).toBeNull()

    const bad = await iosComplete(iosPost('/api/v1/ios/auth/complete', { ...(await profileBody()), signupToken, phone: '123' }))
    expect(bad.status).toBe(422)
    expect((await bad.json()).error.field).toBe('phone')

    const done = await iosComplete(iosPost('/api/v1/ios/auth/complete', { ...(await profileBody()), signupToken }))
    const doneBody = await done.json()
    expect(doneBody.data).toMatchObject({ status: 'signed_in', role: 'STUDENT' })
    expect(await resolveActor(handle.db, doneBody.data.token)).toMatchObject({ role: 'STUDENT' })

    const second = await googleRoundTrip({ app: 'ios', claims: gClaims(sub, email) })
    const ticket = new URL(second.headers.get('location')!).searchParams.get('ticket')!
    const ok = await iosTicket(iosPost('/api/v1/ios/auth/ticket', { ticket }))
    expect((await ok.json()).data.status).toBe('signed_in')
    const again = await iosTicket(iosPost('/api/v1/ios/auth/ticket', { ticket }))
    expect(again.status).toBe(410)
  })

  it('Apple الأصلي: الـnonce المجزّأ والجمهور = معرّف التطبيق ⇒ إكمال الحساب؛ والبريد الوسيط لا يُعرض', async () => {
    const raw = 'raw-nonce-0123456789abcdef'
    const token = jwt({ iss: 'https://appleid.apple.com', aud: 'com.madrasadz.student', sub: uniq('ap'), email: 'abc@privaterelay.appleid.com', email_verified: 'true', nonce: sha256Hex(raw), exp: now() + 600, iat: now() })
    const res = await iosApple(iosPost('/api/v1/ios/auth/apple', { identityToken: token, authorizationCode: 'c1', nonce: raw, fullName: 'تلميذ آيفون' }))
    const body = await res.json()
    expect(body.data).toMatchObject({ status: 'needs_profile', fullName: 'تلميذ آيفون', email: null })

    const wrongNonce = await iosApple(iosPost('/api/v1/ios/auth/apple', { identityToken: token, nonce: 'another-raw-nonce-value', fullName: null }))
    expect(wrongNonce.status).toBe(400)

    const noHeader = await iosApple(new NextRequest(`${BASE}/api/v1/ios/auth/apple`, { method: 'POST', body: JSON.stringify({}) }))
    expect(noHeader.status).toBe(403)
  })

  it('الخادم يعلن الأزرار المفعّلة', async () => {
    expect((await capabilities().json()).data.signIn).toEqual({ google: true, apple: true })
    vi.stubEnv('APPLE_SIGNIN_KEY_ID', '')
    vi.stubEnv('GOOGLE_OAUTH_CLIENT_ID', '')
    expect((await capabilities().json()).data.signIn).toEqual({ google: false, apple: false })
  })
})

describe('مسار Apple في الموقع', () => {
  it('form_post: id_token مع nonce الكوكي ⇒ إكمال الحساب، والاسم من حقل user', async () => {
    const start = appleStart(new NextRequest(`${BASE}/api/auth/oauth/apple/start`))
    const url = new URL(start.headers.get('location')!)
    expect(url.origin).toBe('https://appleid.apple.com')
    expect(url.searchParams.get('response_mode')).toBe('form_post')
    const cookie = cookieFrom(start, OAUTH_STATE_COOKIE)!
    const idToken = jwt({ iss: 'https://appleid.apple.com', aud: 'com.madrasadz.web', sub: uniq('aw'), email: `${uniq('a')}@icloud.com`, email_verified: 'true', nonce: url.searchParams.get('nonce'), exp: now() + 600, iat: now() })
    const form = new URLSearchParams({ state: url.searchParams.get('state')!, id_token: idToken, code: 'c2', user: JSON.stringify({ name: { firstName: 'أسامة', lastName: 'حيقون' } }) })
    const res = await appleCallback(
      new NextRequest(`${BASE}/api/auth/oauth/apple/callback`, { method: 'POST', headers: { cookie: `${OAUTH_STATE_COOKIE}=${cookie}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form.toString() })
    )
    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toBe(`${BASE}/register/complete`)
  })
})
