import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { otpCodes, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { isPhoneVerified, normalizePhone, requestOtp, verifyOtp } from '@/server/services/otp.service'
import { makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let student: Actor
const sent: SmsMessage[] = []

beforeAll(async () => {
  h = await setupDb()
  student = await makeStudent(h.db)
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sent.push(m) })
})

afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('رموز التحقق بالهاتف (OTP)', () => {
  it('تطبيع الهاتف: فراغات وشُرط ومفتاح الدولة؛ رفض الصيغ الأخرى', () => {
    expect(normalizePhone('05 55 12 34 56')).toBe('0555123456')
    expect(normalizePhone('+213 661-223344')).toBe('0661223344')
    expect(() => normalizePhone('0812345678')).toThrow()
    expect(() => normalizePhone('055512345')).toThrow()
  })

  it('طلب ← تحقق: الرمز يُرسل بالعربية ويُخزَّن hash فقط، والتحقق الناجح يستهلكه', async () => {
    const r = await requestOtp(h.db, { phone: '0770000001', purpose: 'ORDER', userId: student.userId })
    expect(r.devCode).toMatch(/^\d{6}$/)
    expect(sent.at(-1)).toMatchObject({ to: '0770000001' })
    expect(sent.at(-1)!.text).toContain(r.devCode!)
    expect(sent.at(-1)!.text).toContain('مدرسة')
    const [row] = await h.db.select().from(otpCodes).where(eq(otpCodes.phone, '0770000001'))
    expect(row!.codeHash).not.toContain(r.devCode!)
    expect(row!.codeHash).toHaveLength(64)
    await expect(verifyOtp(h.db, { phone: '0770000001', purpose: 'ORDER', code: r.devCode! })).resolves.toEqual({ ok: true })
    // لا يُعاد استعماله
    await expect(verifyOtp(h.db, { phone: '0770000001', purpose: 'ORDER', code: r.devCode! })).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })

  it('خمسة أخطاء تُبطل الرمز حتى لو أُدخل الصحيح بعدها', async () => {
    const r = await requestOtp(h.db, { phone: '0770000002', purpose: 'ORDER' })
    const wrong = r.devCode === '000000' ? '111111' : '000000'
    for (let i = 1; i <= 4; i++) await expect(verifyOtp(h.db, { phone: '0770000002', purpose: 'ORDER', code: wrong })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    await expect(verifyOtp(h.db, { phone: '0770000002', purpose: 'ORDER', code: wrong })).rejects.toMatchObject({ code: 'OTP_TOO_MANY_ATTEMPTS' })
    await expect(verifyOtp(h.db, { phone: '0770000002', purpose: 'ORDER', code: r.devCode! })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    const [row] = await h.db.select().from(otpCodes).where(eq(otpCodes.phone, '0770000002'))
    expect(row!.attempts).toBe(5)
    expect(row!.consumedAt).not.toBeNull()
  })

  it('الرمز المنتهي يُرفض بـ OTP_EXPIRED', async () => {
    const r = await requestOtp(h.db, { phone: '0770000003', purpose: 'ORDER' })
    await h.db.update(otpCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(otpCodes.phone, '0770000003'))
    await expect(verifyOtp(h.db, { phone: '0770000003', purpose: 'ORDER', code: r.devCode! })).rejects.toMatchObject({ code: 'OTP_EXPIRED' })
  })

  it('حدّ الطلبات: 3 رموز لكل هاتف/غرض في 10 دقائق، والغرض الآخر مستقل', async () => {
    for (let i = 0; i < 3; i++) await requestOtp(h.db, { phone: '0770000004', purpose: 'ORDER' })
    await expect(requestOtp(h.db, { phone: '0770000004', purpose: 'ORDER' })).rejects.toMatchObject({ code: 'RATE_LIMITED' })
    await expect(requestOtp(h.db, { phone: '0770000004', purpose: 'REGISTER' })).resolves.toBeTruthy()
    // آخر رمز وحده صالح
    const rows = await h.db.select().from(otpCodes).where(eq(otpCodes.phone, '0770000004'))
    expect(rows.filter((r) => r.purpose === 'ORDER' && r.consumedAt === null)).toHaveLength(1)
  })

  it('غرض REGISTER يعلّم الهاتف مؤكَّداً في ملف المستخدم', async () => {
    expect(await isPhoneVerified(h.db, student.userId)).toEqual({ verified: false, phone: null })
    const r = await requestOtp(h.db, { phone: '0661000005', purpose: 'REGISTER', userId: student.userId })
    await verifyOtp(h.db, { phone: '0661000005', purpose: 'REGISTER', code: r.devCode!, userId: student.userId })
    const [p] = await h.db.select().from(profiles).where(eq(profiles.userId, student.userId))
    expect(p!.phoneVerifiedAt).toBeInstanceOf(Date)
    expect(p!.phone).toBe('0661000005')
    expect(await isPhoneVerified(h.db, student.userId)).toEqual({ verified: true, phone: '0661000005' })
  })

  it('فشل الإرسال يُبطل الرمز ويرمي SMS_SEND_FAILED', async () => {
    setSmsSenderForTests({ name: 'broken', send: async () => { throw new Error('boom') } })
    try {
      await expect(requestOtp(h.db, { phone: '0770000006', purpose: 'ORDER' })).rejects.toMatchObject({ code: 'SMS_SEND_FAILED' })
      const rows = await h.db.select().from(otpCodes).where(eq(otpCodes.phone, '0770000006'))
      expect(rows.every((r) => r.consumedAt !== null)).toBe(true)
    } finally {
      setSmsSenderForTests({ name: 'memory', send: async (m) => void sent.push(m) })
    }
  })
})
