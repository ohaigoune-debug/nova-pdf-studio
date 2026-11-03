/**
 * التسجيل وتأكيد الهاتف من داخل تطبيق الآيفون (3 نوفمبر 2026).
 */
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { levels, profiles, streams, users, wilayas } from '@/server/db/schema'
import { SESSION_COOKIE } from '@/server/auth/session'
import { requestOtp } from '@/server/services/otp.service'
import { GET as optionsRoute, POST as registerRoute } from '@/app/api/v1/ios/register/route'
import { GET as phoneRoute } from '@/app/api/v1/ios/phone/route'
import { POST as verifyRoute } from '@/app/api/v1/ios/phone/verify/route'
import { GET as sessionRoute } from '@/app/api/v1/ios/session/route'
import { setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let wilayaId: string
let level3: string
let levelMiddle: string
let lit: string

const register = (body: unknown, ios = true) =>
  registerRoute(new NextRequest('https://madrasadz.com/api/v1/ios/register', { method: 'POST', headers: { 'content-type': 'application/json', ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify(body) }))

const base = () => ({ fullName: 'أمينة بن سالم', email: `amina${Math.random().toString(36).slice(2, 8)}@example.dz`, phone: '0661 23 45 67', guardianPhone: '+213770112233', password: 'Bac2027-strong', wilayaId, levelId: level3, streamId: lit })

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  await seedCurriculum(h.db)
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).limit(1))[0]!.id
  const all = await h.db.select({ id: levels.id, code: levels.code }).from(levels)
  level3 = all.find((l) => l.code === '3AS')!.id
  levelMiddle = all.find((l) => !/AS$/i.test(l.code))!.id
  lit = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'LIT')))[0]!.id
})
afterAll(async () => h.close())

describe('التسجيل من التطبيق', () => {
  it('الخيارات: الولايات والمستويات (الثانوي يشترط شعبة) والشعب', async () => {
    const { data } = await (await optionsRoute(new NextRequest('https://madrasadz.com/api/v1/ios/register'))).json()
    expect(data.wilayas.length).toBeGreaterThan(0)
    expect(data.levels.find((l: { id: string }) => l.id === level3)).toMatchObject({ secondary: true })
    expect(data.streams.some((s: { id: string }) => s.id === lit)).toBe(true)
  })

  it('يرفض دون ترويسة التطبيق، ويسمّي الحقل الخاطئ', async () => {
    expect((await register(base(), false)).status).toBe(403)
    const badPhone = await register({ ...base(), phone: '0123' })
    expect(badPhone.status).toBe(422)
    expect((await badPhone.json()).error).toMatchObject({ code: 'VALIDATION', field: 'phone' })
    const noStream = await register({ ...base(), streamId: '' })
    expect((await noStream.json()).error).toMatchObject({ field: 'streamId' })
    // المتوسط بلا شعبة مقبول
    expect((await register({ ...base(), levelId: levelMiddle, streamId: null })).status).toBe(200)
  })

  it('ينشئ الحساب ويعيد جلسة تعمل في التطبيق؛ البريد المكرّر يُرفض', async () => {
    const body = base()
    const res = await register(body)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toMatchObject({ role: 'STUDENT' })
    const [u] = await h.db.select({ id: users.id }).from(users).where(eq(users.email, body.email))
    const [p] = await h.db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, u!.id))
    expect(p!.phone).toBe('0661234567')
    const cookie = `${SESSION_COOKIE}=${data.token}`
    const session = await (await sessionRoute(new NextRequest('https://madrasadz.com/api/v1/ios/session', { headers: { cookie } }))).json()
    expect(session.data.user.id).toBe(u!.id)
    const again = await register(body)
    expect((await again.json()).error.code).toBe('EMAIL_TAKEN')

    // تأكيد الهاتف من التطبيق
    const phone = (await (await phoneRoute(new NextRequest('https://madrasadz.com/api/v1/ios/phone', { headers: { cookie } }))).json()).data
    expect(phone).toMatchObject({ phone: '0661234567' })
    const otp = await requestOtp(h.db, { phone: '0661234567', purpose: 'REGISTER', userId: u!.id })
    const verify = (code: string, ios = true) => verifyRoute(new NextRequest('https://madrasadz.com/api/v1/ios/phone/verify', { method: 'POST', headers: { cookie, 'content-type': 'application/json', ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify({ phone: '0661234567', code }) }))
    expect((await verify(otp.devCode!, false)).status).toBe(403)
    expect((await verify(otp.devCode!)).status).toBe(200)
    const [after] = await h.db.select({ at: profiles.phoneVerifiedAt }).from(profiles).where(eq(profiles.userId, u!.id))
    expect(after!.at).toBeTruthy()
  })
})
