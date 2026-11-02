/**
 * تطبيق آيفون الأصيل (2 نوفمبر 2026): الدخول برقم الهاتف عبر واجهة الجوال، حذف الحساب من التطبيق،
 * واختيار سنة PLAY. كل المسارات بكوكي الجلسة نفسها، وما يغيّر شيئًا يشترط X-Madrasadz-Client: ios.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { createSession, resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { profiles, users } from '@/server/db/schema'
import { POST as login } from '@/app/api/v1/auth/login/route'
import { POST as deleteAccount } from '@/app/api/v1/ios/account/delete/route'
import { POST as setProfile } from '@/app/api/v1/ios/play/profile/route'
import { GET as subjects } from '@/app/api/v1/ios/play/subjects/route'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let handle: DatabaseHandle

beforeAll(async () => {
  handle = await setupDb()
  vi.mocked(getDb).mockResolvedValue(handle.db)
})
afterAll(async () => handle.close())

function post(path: string, body: unknown, opts: { token?: string; ios?: boolean } = {}) {
  const headers = new Headers({ 'content-type': 'application/json' })
  if (opts.token) headers.set('cookie', `${SESSION_COOKIE}=${opts.token}`)
  if (opts.ios !== false) headers.set('x-madrasadz-client', 'ios')
  return new NextRequest(`https://madrasadz.com${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
}

function get(path: string, token: string) {
  return new NextRequest(`https://madrasadz.com${path}`, { headers: { cookie: `${SESSION_COOKIE}=${token}` } })
}

async function student(phone?: string) {
  const actor = await makeStudent(handle.db, 'تلميذ التطبيق')
  if (phone) await handle.db.update(profiles).set({ phone }).where(eq(profiles.userId, actor.userId))
  const [u] = await handle.db.select({ email: users.email }).from(users).where(eq(users.id, actor.userId))
  const session = await createSession(handle.db, { userId: actor.userId })
  return { actor, email: u!.email, token: session.token }
}

describe('الدخول من التطبيق', () => {
  it('يقبل رقم الهاتف كما يقبل البريد، ويرفض كلمة السر الخاطئة', async () => {
    const s = await student('0661234567')
    const byPhone = await login(post('/api/v1/auth/login', { email: '0661234567', password: 'Student@12345' }, { ios: false }))
    expect(byPhone.status).toBe(200)
    const body = await byPhone.json()
    expect(body.data.role).toBe('STUDENT')
    expect((await resolveActor(handle.db, body.data.token))?.userId).toBe(s.actor.userId)
    const byEmail = await login(post('/api/v1/auth/login', { email: s.email, password: 'Student@12345' }, { ios: false }))
    expect(byEmail.status).toBe(200)
    const wrong = await login(post('/api/v1/auth/login', { email: s.email, password: 'nope' }, { ios: false }))
    expect(wrong.status).toBeGreaterThanOrEqual(400)
  })
})

describe('حذف الحساب من التطبيق', () => {
  it('يشترط ترويسة التطبيق والجلسة وكلمة السر والتأكيد، ثم يلغي كل الجلسات', async () => {
    const s = await student()
    expect((await deleteAccount(post('/api/v1/ios/account/delete', { password: 'Student@12345', confirm: true }, { token: s.token, ios: false }))).status).toBe(403)
    expect((await deleteAccount(post('/api/v1/ios/account/delete', { password: 'Student@12345', confirm: true }))).status).toBe(401)
    expect((await deleteAccount(post('/api/v1/ios/account/delete', { password: 'Student@12345' }, { token: s.token }))).status).toBe(422)
    const wrong = await deleteAccount(post('/api/v1/ios/account/delete', { password: 'wrong', confirm: true }, { token: s.token }))
    expect(wrong.status).toBeGreaterThanOrEqual(400)
    expect(await resolveActor(handle.db, s.token)).not.toBeNull()
    const ok = await deleteAccount(post('/api/v1/ios/account/delete', { password: 'Student@12345', confirm: true }, { token: s.token }))
    expect(ok.status).toBe(200)
    expect(await ok.json()).toEqual({ ok: true, data: { deleted: true } })
    expect(ok.headers.get('cache-control')).toBe('private, no-store')
    expect(await resolveActor(handle.db, s.token)).toBeNull()
  })
})

describe('سنة PLAY من التطبيق', () => {
  it('تعرض المواد السنوات المتاحة، ويُحفظ الاختيار الصحيح ويُرفض الخاطئ', async () => {
    const s = await student()
    const before = await (await subjects(get('/api/v1/ios/play/subjects', s.token))).json()
    expect(before.ok).toBe(true)
    expect(before.data.grades.some((g: { code: string; streams: { code: string }[] }) => g.code === '3AS' && g.streams.some((x) => x.code === 'LIT'))).toBe(true)
    expect((await setProfile(post('/api/v1/ios/play/profile', { gradeCode: '3AS', streamCode: null }, { token: s.token }))).status).toBe(422)
    expect((await setProfile(post('/api/v1/ios/play/profile', { gradeCode: '3AS', streamCode: 'LIT' }, { token: s.token, ios: false }))).status).toBe(403)
    const ok = await setProfile(post('/api/v1/ios/play/profile', { gradeCode: '3AS', streamCode: 'LIT' }, { token: s.token }))
    expect(await ok.json()).toEqual({ ok: true, data: { gradeCode: '3AS', streamCode: 'LIT' } })
    const after = await (await subjects(get('/api/v1/ios/play/subjects', s.token))).json()
    expect(after.data.gradeCode).toBe('3AS')
    expect(after.data.streamCode).toBe('LIT')
  })
})
