import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { createSession, resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { profiles, sessions, users } from '@/server/db/schema'
import { sha256 } from '@/server/lib/codes'
import { assertIosOrigin } from '@/server/services/ios-session.service'
import { GET } from '@/app/api/v1/ios/session/route'
import { POST } from '@/app/api/v1/ios/logout/route'
import { makeAdmin, makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let handle: DatabaseHandle

beforeAll(async () => {
  handle = await setupDb()
  vi.mocked(getDb).mockResolvedValue(handle.db)
})

afterAll(async () => handle.close())
afterEach(() => vi.unstubAllEnvs())

function request(path: 'session' | 'logout', token?: string, opts: { origin?: string; bearer?: string; host?: string } = {}) {
  const headers = new Headers()
  if (token) headers.set('cookie', `${SESSION_COOKIE}=${token}`)
  if (opts.origin !== undefined) headers.set('origin', opts.origin)
  if (opts.bearer) headers.set('authorization', `Bearer ${opts.bearer}`)
  if (opts.host) {
    headers.set('host', opts.host)
    headers.set('x-forwarded-host', opts.host)
  }
  return new NextRequest(`https://madrasadz.com/api/v1/ios/${path}`, { method: path === 'logout' ? 'POST' : 'GET', headers })
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('vary')).toBe('Cookie')
  expect(response.headers.has('access-control-allow-origin')).toBe(false)
}

async function accountSession() {
  const actor = await makeStudent(handle.db)
  const session = await createSession(handle.db, { userId: actor.userId })
  return { actor, session }
}

describe('iOS session: existing account, minimal data, cookie scope and phone verification', () => {
  it('returns only an existing student UUID and gate status, without credentials or contact information', async () => {
    vi.stubEnv('SMS_PROVIDER', 'console')
    const { actor, session } = await accountSession()
    const response = await GET(request('session', session.token))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { authenticated: true, user: { id: actor.userId, role: 'STUDENT' }, requiresPhoneVerification: false } })
    expectNoStore(response)
  })

  it('rejects an anonymous request without caching its error', async () => {
    const response = await GET(request('session'))
    expect(response.status).toBe(401)
    expect((await response.json()).error.code).toBe('AUTH_REQUIRED')
    expectNoStore(response)
  })

  it('does not accept a User-Agent, app flag or native Bearer token in place of the WebKit cookie', async () => {
    const { session } = await accountSession()
    const req = request('session', undefined, { bearer: session.token })
    req.headers.set('user-agent', 'Madrasadz-iOS')
    req.headers.set('x-ios-app', '1')
    expect((await GET(req)).status).toBe(401)
  })

  it('rejects invalid, expired and revoked sessions', async () => {
    expect((await GET(request('session', 'not-a-session'))).status).toBe(401)
    const { actor, session } = await accountSession()
    await handle.db.update(sessions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(sessions.tokenHash, sha256(session.token)))
    expect((await GET(request('session', session.token))).status).toBe(401)
    const revoked = await createSession(handle.db, { userId: actor.userId })
    await handle.db.update(sessions).set({ revokedAt: new Date() }).where(eq(sessions.tokenHash, sha256(revoked.token)))
    expect((await GET(request('session', revoked.token))).status).toBe(401)
  })

  it('rejects disabled and deleted accounts even if their cookie has not expired', async () => {
    const disabled = await accountSession()
    await handle.db.update(users).set({ status: 'DISABLED' }).where(eq(users.id, disabled.actor.userId))
    expect((await GET(request('session', disabled.session.token))).status).toBe(401)
    const deleted = await accountSession()
    await handle.db.update(users).set({ deletedAt: new Date() }).where(eq(users.id, deleted.actor.userId))
    expect((await GET(request('session', deleted.session.token))).status).toBe(401)
  })

  it('does not grant native student features to an administrator', async () => {
    const admin = await makeAdmin(handle.db)
    const session = await createSession(handle.db, { userId: admin.userId })
    const response = await GET(request('session', session.token))
    expect(response.status).toBe(403)
    expect((await response.json()).error.code).toBe('FORBIDDEN')
    expectNoStore(response)
  })

  it('reports the existing phone gate for a new account when a webhook SMS channel is configured', async () => {
    vi.stubEnv('SMS_PROVIDER', 'webhook')
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.invalid/test-only')
    const { session } = await accountSession()
    const response = await GET(request('session', session.token))
    expect(response.status).toBe(200)
    expect((await response.json()).data.requiresPhoneVerification).toBe(true)
  })

  it('reports a verified phone as usable without returning its number', async () => {
    vi.stubEnv('SMS_PROVIDER', 'webhook')
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.invalid/test-only')
    const { actor, session } = await accountSession()
    await handle.db.update(profiles).set({ phone: '0550000123', phoneVerifiedAt: new Date() }).where(eq(profiles.userId, actor.userId))
    const response = await GET(request('session', session.token))
    const body = await response.text()
    expect(JSON.parse(body).data.requiresPhoneVerification).toBe(false)
    expect(body).not.toContain('0550000123')
    expect(body).not.toContain(actor.email)
  })

  it('does not create a second identity when the same session is opened again', async () => {
    vi.stubEnv('SMS_PROVIDER', 'console')
    const { actor, session } = await accountSession()
    const before = await handle.db.select({ id: users.id }).from(users)
    for (let i = 0; i < 2; i++) {
      const body = await (await GET(request('session', session.token))).json()
      expect(body.data.user.id).toBe(actor.userId)
    }
    expect(await handle.db.select({ id: users.id }).from(users)).toHaveLength(before.length)
  })

  it('derives the local namespace from the current cookie, never from a supplied account identifier', async () => {
    vi.stubEnv('SMS_PROVIDER', 'console')
    const first = await accountSession()
    const second = await accountSession()
    const forged = new NextRequest(`https://madrasadz.com/api/v1/ios/session?userId=${second.actor.userId}`, {
      headers: { cookie: `${SESSION_COOKIE}=${first.session.token}`, 'x-account-id': second.actor.userId }
    })
    expect((await (await GET(forged)).json()).data.user.id).toBe(first.actor.userId)
    expect((await (await GET(request('session', second.session.token))).json()).data.user.id).toBe(second.actor.userId)
  })
})

describe('iOS logout: server revocation and strict configured-origin CSRF', () => {
  it.each([undefined, 'null', 'https://attacker.example', 'https://madrasadz.com.attacker.example', 'https://madrasadz.com/path', 'http://madrasadz.com'])('rejects Origin %s and preserves the session', async (origin) => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com')
    const { session } = await accountSession()
    const response = await POST(request('logout', session.token, { origin }))
    expect(response.status).toBe(403)
    expectNoStore(response)
    expect(response.headers.has('set-cookie')).toBe(false)
    expect(await resolveActor(handle.db, session.token)).not.toBeNull()
  })

  it('does not trust forged request Host or forwarded headers', async () => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com')
    const { session } = await accountSession()
    const response = await POST(request('logout', session.token, { origin: 'https://attacker.example', host: 'attacker.example' }))
    expect(response.status).toBe(403)
    expect(await resolveActor(handle.db, session.token)).not.toBeNull()
  })

  it('revokes the current session, expires its cookie, and leaves another device signed in', async () => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com')
    const { actor, session } = await accountSession()
    const otherDevice = await createSession(handle.db, { userId: actor.userId })
    const response = await POST(request('logout', session.token, { origin: 'https://madrasadz.com' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, data: { loggedOut: true } })
    expectNoStore(response)
    expect(await resolveActor(handle.db, session.token)).toBeNull()
    expect((await resolveActor(handle.db, otherDevice.token))?.userId).toBe(actor.userId)
    expect(response.headers.get('set-cookie')).toContain(`${SESSION_COOKIE}=;`)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0')
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax')
  })

  it('is safely repeatable, including an absent cookie', async () => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com')
    const { session } = await accountSession()
    expect((await POST(request('logout', session.token, { origin: 'https://madrasadz.com' }))).status).toBe(200)
    expect((await POST(request('logout', session.token, { origin: 'https://madrasadz.com' }))).status).toBe(200)
    expect((await POST(request('logout', undefined, { origin: 'https://madrasadz.com' }))).status).toBe(200)
  })

  it('can revoke an accidental nonstudent browser login without granting it native study access', async () => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com')
    const actor = await makeAdmin(handle.db)
    const session = await createSession(handle.db, { userId: actor.userId })
    expect((await GET(request('session', session.token))).status).toBe(403)
    expect((await POST(request('logout', session.token, { origin: 'https://madrasadz.com' }))).status).toBe(200)
    expect(await resolveActor(handle.db, session.token)).toBeNull()
  })

  it('uses the configured HTTPS origin rather than hardcoding every server to production', () => {
    vi.stubEnv('APP_URL', 'https://preview.example.test/platform')
    expect(() => assertIosOrigin(request('logout', undefined, { origin: 'https://preview.example.test' }))).not.toThrow()
    expect(() => assertIosOrigin(request('logout', undefined, { origin: 'https://madrasadz.com' }))).toThrowError('FORBIDDEN')
  })

  it('fails closed for malformed or insecure production configuration and allows loopback HTTP only in development', () => {
    vi.stubEnv('APP_URL', 'not-a-url')
    expect(() => assertIosOrigin(request('logout', undefined, { origin: 'https://madrasadz.com' }))).toThrowError('FORBIDDEN')
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => assertIosOrigin(request('logout', undefined, { origin: 'http://localhost:3000' }))).toThrowError('FORBIDDEN')
    vi.stubEnv('NODE_ENV', 'test')
    expect(() => assertIosOrigin(request('logout', undefined, { origin: 'http://localhost:3000' }))).not.toThrow()
  })
})
