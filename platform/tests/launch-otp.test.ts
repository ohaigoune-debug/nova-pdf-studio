import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { otpCodes, orders, profiles, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { isPhoneVerified, requestOtp, verifyOtp } from '@/server/services/otp.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let workspaceId: string
let wilayaId: string
const sent: SmsMessage[] = []
let sequence = 0

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin))
  wilayaId = (await refIds(h.db)).wilayaId!
  setSmsSenderForTests({ name: 'memory', send: async (m) => { sent.push(m) } })
})
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers() })
afterAll(async () => { setSmsSenderForTests(null); await h.close() })

function smsChannel() {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.example.test/never-called')
}

async function course() {
  const c = await createCourse(h.db, admin, { title: `دورة OTP ${++sequence}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب OTP ${sequence}`, priceDzd: 1500, stock: 10, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

const orderInput = (courseId: string, phone: string, otpCode?: string) => ({ courseId, phone, otpCode, wilayaId, commune: 'Guelma', address: 'عنوان تجريبي', deliveryType: 'HOME' as const })

describe('دفعة الانطلاق: بوابة التسجيل ورمز طلب الدورة', () => {
  it('قناة SMS تفرض البوابة لكل حساب جديد حتى مع تاريخ إعداد مستقبلي', async () => {
    smsChannel()
    vi.stubEnv('PHONE_VERIFY_REQUIRED_SINCE', '2100-01-01T00:00:00Z')
    const s = await makeStudent(h.db)
    expect((await phoneGateFor(h.db, s.userId)).required).toBe(true)
    const code = await requestOtp(h.db, { phone: '0771110001', purpose: 'REGISTER', userId: s.userId })
    await verifyOtp(h.db, { phone: '0771110001', purpose: 'REGISTER', code: code.devCode!, userId: s.userId })
    expect((await phoneGateFor(h.db, s.userId)).required).toBe(false)
  })

  it('الحسابات السابقة لبوابة الهاتف تبقى كما هي، وغياب SMS لا يحجب حسابًا جديدًا', async () => {
    const s = await makeStudent(h.db)
    expect((await phoneGateFor(h.db, s.userId)).required).toBe(false)
    await h.db.update(users).set({ createdAt: new Date('2025-01-01T00:00:00Z') }).where(eq(users.id, s.userId))
    smsChannel()
    expect((await phoneGateFor(h.db, s.userId)).required).toBe(false)
  })

  it('طلب الدورة مع قناة SMS يرفض بلا رمز ويقبل الرمز المرتبط بالطالب', async () => {
    smsChannel()
    const c = await course()
    const s = await makeStudent(h.db)
    await expect(placeCourseOrder(h.db, s, orderInput(c.id, '0771110002'))).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    expect(await h.db.select().from(orders).where(eq(orders.userId, s.userId))).toHaveLength(0)
    const code = await requestOtp(h.db, { phone: '0771110002', purpose: 'ORDER', userId: s.userId })
    const order = await placeCourseOrder(h.db, s, orderInput(c.id, '0771110002', code.devCode))
    expect(order.status).toBe('CONFIRMED')
  })

  it('بلا قناة SMS يبقى طلب صاحب الهاتف المؤكد بانتظار التأكيد الهاتفي', async () => {
    const s = await makeStudent(h.db)
    const phone = '0771110009'
    await h.db.update(profiles).set({ phone, phoneVerifiedAt: new Date() }).where(eq(profiles.userId, s.userId))
    const c = await course()
    expect((await placeCourseOrder(h.db, s, orderInput(c.id, phone))).status).toBe('PENDING')
  })

  it('تأكيد هاتف الحساب لا يستبدل رمزًا جديدًا لكل طلب دورة', async () => {
    smsChannel()
    const s = await makeStudent(h.db)
    const phone = '0771110003'
    await h.db.update(profiles).set({ phone, phoneVerifiedAt: new Date() }).where(eq(profiles.userId, s.userId))
    expect((await isPhoneVerified(h.db, s.userId)).verified).toBe(true)
    const c = await course()
    await expect(placeCourseOrder(h.db, s, orderInput(c.id, phone))).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    const code = await requestOtp(h.db, { phone, purpose: 'ORDER', userId: s.userId })
    await placeCourseOrder(h.db, s, orderInput(c.id, phone, code.devCode))
    const next = await course()
    await expect(placeCourseOrder(h.db, s, orderInput(next.id, phone, code.devCode))).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })
})

describe('دفعة الانطلاق: مهلة إعادة الإرسال وحماية الرمز', () => {
  it('لا يمكن تجاوز60ثانية بإعادة الطلب أو بتبديل الحساب؛ عند الحد يسمح بالرمز الجديد', async () => {
    const now = new Date('2026-11-01T12:00:00Z')
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(now)
    const input = { phone: '0771110004', purpose: 'ORDER' as const, userId: student.userId }
    const first = await requestOtp(h.db, input)
    const count = sent.length
    await expect(requestOtp(h.db, input)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    vi.setSystemTime(now.getTime() + 59_999)
    await expect(requestOtp(h.db, { ...input, userId: admin.userId })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    expect(sent).toHaveLength(count)
    vi.setSystemTime(now.getTime() + 60_000)
    const second = await requestOtp(h.db, input)
    expect(sent).toHaveLength(count + 1)
    const rows = await h.db.select().from(otpCodes).where(and(eq(otpCodes.phone, input.phone), eq(otpCodes.purpose, input.purpose)))
    expect(rows).toHaveLength(2)
    expect(rows.filter((r) => r.consumedAt === null)).toHaveLength(1)
    expect(rows.find((r) => r.consumedAt === null)?.createdAt.getTime()).toBe(now.getTime() + 60_000)
    expect(first.devCode).toBeTruthy(); expect(second.devCode).toBeTruthy()
  })

  it('طلبان متزامنان لنفس الهاتف والغرض يرسلان رسالة واحدة', async () => {
    const before = sent.length
    const input = { phone: '0771110005', purpose: 'ORDER' as const, userId: student.userId }
    const results = await Promise.allSettled([requestOtp(h.db, input), requestOtp(h.db, input)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect(sent).toHaveLength(before + 1)
  })

  it('أغراض التسجيل والطلب مستقلة حتى للهاتف نفسه', async () => {
    const phone = '0771110006'
    await requestOtp(h.db, { phone, purpose: 'REGISTER', userId: student.userId })
    await expect(requestOtp(h.db, { phone, purpose: 'ORDER', userId: student.userId })).resolves.toBeTruthy()
  })

  it('رمز طالب لا يؤكد طلب طالب آخر ولا يُستهلك بمحاولته', async () => {
    const phone = '0771110007'
    const code = await requestOtp(h.db, { phone, purpose: 'ORDER', userId: student.userId })
    await expect(verifyOtp(h.db, { phone, purpose: 'ORDER', code: code.devCode!, userId: admin.userId })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    await expect(verifyOtp(h.db, { phone, purpose: 'ORDER', code: code.devCode!, userId: student.userId })).resolves.toEqual({ ok: true })
  })

  it('استهلاك الرمز متزامنًا لا ينجح إلا مرة واحدة', async () => {
    const phone = '0771110008'
    const code = await requestOtp(h.db, { phone, purpose: 'ORDER', userId: student.userId })
    const input = { phone, purpose: 'ORDER' as const, code: code.devCode!, userId: student.userId }
    const results = await Promise.allSettled([verifyOtp(h.db, input), verifyOtp(h.db, input)])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1)
  })
})
