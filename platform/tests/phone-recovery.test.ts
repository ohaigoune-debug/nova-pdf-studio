import { and, desc, eq, isNull } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { otpCodes, profiles, users } from '@/server/db/schema'
import { createSession, resolveActor } from '@/server/auth/session'
import { verifyPassword } from '@/server/auth/password'
import { setMailerForTests, type MailMessage } from '@/server/lib/mailer'
import { setSmsSenderForTests, SmsError, type SmsMessage } from '@/server/lib/sms'
import { changePassword, requestPasswordReset, resetPassword, verifyPasswordResetToken } from '@/server/services/auth.service'
import { OTP_MAX_ATTEMPTS, requestOtp } from '@/server/services/otp.service'
import { requestPhonePasswordReset, resetPasswordByPhone } from '@/server/services/phone-recovery.service'
import * as sessionService from '@/server/auth/session'
import { makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let n = 0
const sent: SmsMessage[] = []
const emails: MailMessage[] = []
const NEXT = 'Next-password-2026!'
const memorySms = () => setSmsSenderForTests({ name: 'memory', send: async (message) => void sent.push(message) })
const meta = () => ({ ip: `192.0.2.${++n}` })
const phoneNumber = () => `0772${String(++n).padStart(6, '0')}`

beforeAll(async () => {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.test.invalid')
  h = await setupDb()
  memorySms()
  setMailerForTests({ name: 'memory', send: async (message) => void emails.push(message) })
})

afterEach(() => { vi.restoreAllMocks(); memorySms() })
afterAll(async () => { setSmsSenderForTests(null); setMailerForTests(null); vi.unstubAllEnvs(); await h.close() })

async function account(opts: { phone?: string; verified?: boolean } = {}) {
  const actor = await makeStudent(h.db)
  const phone = opts.phone ?? phoneNumber()
  await h.db.update(profiles).set({ phone, phoneVerifiedAt: opts.verified === false ? null : new Date() }).where(eq(profiles.userId, actor.userId))
  return { actor, phone }
}

function codeFor(phone: string) {
  const code = sent.filter((message) => message.to === phone).at(-1)?.variables?.code
  expect(code).toMatch(/^\d{6}$/)
  return code!
}
const challengeFor = async (phone: string) => (await h.db.select().from(otpCodes).where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, 'RECOVER'))).orderBy(desc(otpCodes.createdAt)))[0]
const passwordMatches = async (userId: string, password: string) => verifyPassword(password, (await h.db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)))[0]!.hash)

describe('استعادة كلمة السر عبر هاتف موثّق — قاعدة PGlite ورسائل وهمية', () => {
  it('رمز RECOVER يغيّر كلمة السر ويستهلك الرمز ويلغي كل الجلسات وروابط البريد القديمة', async () => {
    const { actor, phone } = await account()
    const sessions = await Promise.all([createSession(h.db, { userId: actor.userId }), createSession(h.db, { userId: actor.userId })])
    await requestPasswordReset(h.db, actor.email)
    const token = emails.at(-1)!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!
    expect(await verifyPasswordResetToken(h.db, token)).toBeTruthy()
    expect(await requestPhonePasswordReset(h.db, phone, meta())).toEqual({ cooldown: 60 })
    const challenge = await challengeFor(phone)
    expect(challenge).toMatchObject({ purpose: 'RECOVER', userId: actor.userId, consumedAt: null })
    await resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: NEXT }, meta())
    expect(await passwordMatches(actor.userId, NEXT)).toBe(true)
    expect(await passwordMatches(actor.userId, 'Student@12345')).toBe(false)
    for (const session of sessions) expect(await resolveActor(h.db, session.token)).toBeNull()
    expect((await challengeFor(phone))!.consumedAt).not.toBeNull()
    await expect(verifyPasswordResetToken(h.db, token)).rejects.toMatchObject({ code: 'RESET_TOKEN_INVALID' })
    await expect(resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: 'Another-password!' }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })

  it('الخطأ يزيد العدّاد المثبت؛ خمس محاولات تقفل الرمز حتى عند إدخال الصحيح لاحقًا', async () => {
    const { actor, phone } = await account()
    await requestPhonePasswordReset(h.db, phone, meta())
    const correct = codeFor(phone)
    const wrong = correct === '000000' ? '111111' : '000000'
    for (let i = 1; i <= OTP_MAX_ATTEMPTS; i++) {
      await expect(resetPasswordByPhone(h.db, { phone, code: wrong, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
      expect((await challengeFor(phone))!.attempts).toBe(i)
    }
    expect((await challengeFor(phone))!.consumedAt).not.toBeNull()
    // الإخفاقات الخمسة تقفل الاستعادة بالهاتف لهذا الرقم حتى الغد أيضاً (القفل اليومي يسبق فحص الرمز)
    await expect(resetPasswordByPhone(h.db, { phone, code: correct, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_TOO_MANY_ATTEMPTS' })
    expect(await passwordMatches(actor.userId, 'Student@12345')).toBe(true)
  })

  it('الرقم المجهول وغير الموثق والمشترك يعطون نفس الرد العام دون إرسال رمز أو اختيار حساب', async () => {
    const unknown = phoneNumber()
    const unverified = await account({ verified: false })
    const sharedPhone = phoneNumber()
    const first = await account({ phone: sharedPhone })
    const second = await account({ phone: sharedPhone })
    const before = sent.length
    for (const phone of [unknown, unverified.phone, sharedPhone]) {
      expect(await requestPhonePasswordReset(h.db, phone, meta())).toEqual({ cooldown: 60 })
      await expect(resetPasswordByPhone(h.db, { phone, code: '000000', password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    }
    expect(sent).toHaveLength(before)
    expect(await passwordMatches(first.actor.userId, 'Student@12345')).toBe(true)
    expect(await passwordMatches(second.actor.userId, 'Student@12345')).toBe(true)
  })

  it('فشل مزود الرسائل وحدّ إرسال الهاتف لا يكشفان وجود الحساب', async () => {
    const known = await account()
    const unknown = phoneNumber()
    setSmsSenderForTests({ name: 'broken', send: async () => { throw new Error('test failure') } })
    const ip = meta()
    for (let i = 0; i < 4; i++) {
      expect(await requestPhonePasswordReset(h.db, known.phone, ip)).toEqual({ cooldown: 60 })
      expect(await requestPhonePasswordReset(h.db, unknown, meta())).toEqual({ cooldown: 60 })
    }
    expect((await h.db.select().from(otpCodes).where(and(eq(otpCodes.phone, known.phone), isNull(otpCodes.consumedAt))))).toHaveLength(0)
  })

  it('حد طلبات IP نفسه يطبّق قبل معرفة الحساب', async () => {
    const ip = meta()
    const phone = phoneNumber()
    for (let i = 0; i < 5; i++) await requestPhonePasswordReset(h.db, phone, ip)
    await expect(requestPhonePasswordReset(h.db, phone, ip)).rejects.toMatchObject({ code: 'RATE_LIMITED' })
  })

  it('رمز REGISTER أو ORDER لا يستعمل لاستعادة كلمة السر', async () => {
    const { actor, phone } = await account()
    const orderCode = await requestOtp(h.db, { phone, purpose: 'ORDER', userId: actor.userId })
    await expect(resetPasswordByPhone(h.db, { phone, code: orderCode.devCode!, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect(await passwordMatches(actor.userId, 'Student@12345')).toBe(true)
  })

  it('نقل الهاتف لحساب آخر بعد إصدار الرمز لا ينقل حق تغيير كلمة السر', async () => {
    const original = await account()
    await requestPhonePasswordReset(h.db, original.phone, meta())
    const code = codeFor(original.phone)
    await h.db.update(profiles).set({ phone: phoneNumber() }).where(eq(profiles.userId, original.actor.userId))
    const other = await account({ phone: original.phone })
    await expect(resetPasswordByPhone(h.db, { phone: original.phone, code, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect(await passwordMatches(original.actor.userId, 'Student@12345')).toBe(true)
    expect(await passwordMatches(other.actor.userId, 'Student@12345')).toBe(true)
  })

  it('لا يُستخدم رمز غير مربوط بالحساب حتى إن طابق الهاتف', async () => {
    const { actor, phone } = await account()
    const code = await requestOtp(h.db, { phone, purpose: 'RECOVER' })
    await expect(resetPasswordByPhone(h.db, { phone, code: code.devCode!, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect(await passwordMatches(actor.userId, 'Student@12345')).toBe(true)
  })

  it('رمز منتهٍ يُرفض ويُثبت استهلاكه', async () => {
    const { phone } = await account()
    await requestPhonePasswordReset(h.db, phone, meta())
    await h.db.update(otpCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(otpCodes.phone, phone))
    await expect(resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect((await challengeFor(phone))!.consumedAt).not.toBeNull()
  })

  it('إعادتان متزامنتان للرمز نفسه تنجح واحدة فقط', async () => {
    const { actor, phone } = await account()
    await requestPhonePasswordReset(h.db, phone, meta())
    const result = await Promise.allSettled([
      resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: NEXT }, meta()),
      resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: 'Other-password-2026!' }, meta())
    ])
    expect(result.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(result.filter((r) => r.status === 'rejected')).toHaveLength(1)
    expect(await passwordMatches(actor.userId, NEXT)).toBe(true)
  })

  it('فشل إلغاء الجلسات يرجع كلمة السر واستهلاك الرمز معًا', async () => {
    const { actor, phone } = await account()
    const session = await createSession(h.db, { userId: actor.userId })
    await requestPhonePasswordReset(h.db, phone, meta())
    const spy = vi.spyOn(sessionService, 'revokeAllSessions').mockRejectedValueOnce(new Error('injected revoke failure'))
    await expect(resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: NEXT }, meta())).rejects.toThrow('injected revoke failure')
    spy.mockRestore()
    expect(await passwordMatches(actor.userId, 'Student@12345')).toBe(true)
    expect((await challengeFor(phone))!.consumedAt).toBeNull()
    expect(await resolveActor(h.db, session.token)).not.toBeNull()
  })

  it('بوابة SMS التي تتعطل عند التحقق تعيد خطأ الرمز العام دون كشف الحساب', async () => {
    const { phone } = await account()
    setSmsSenderForTests({ name: 'suivisms', send: async () => undefined, sendOtp: async () => ({ id: 'fake-gateway-otp' }), verifyOtp: async () => { throw new SmsError('unreachable', 502) } })
    await requestPhonePasswordReset(h.db, phone, meta())
    await expect(resetPasswordByPhone(h.db, { phone, code: '1234', password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })

  it('استعادة البريد الحالية تبقى عاملة وتُبطل رموز استعادة الهاتف الأقدم', async () => {
    const { actor, phone } = await account()
    await requestPhonePasswordReset(h.db, phone, meta())
    const phoneCode = codeFor(phone)
    await requestPasswordReset(h.db, actor.email)
    const token = emails.at(-1)!.text.match(/token=([A-Za-z0-9_-]+)/)![1]!
    await resetPassword(h.db, token, NEXT)
    expect(await passwordMatches(actor.userId, NEXT)).toBe(true)
    expect((await challengeFor(phone))!.consumedAt).not.toBeNull()
    await expect(resetPasswordByPhone(h.db, { phone, code: phoneCode, password: 'Older-code-password!' }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })

  it('تغيير كلمة السر من الحساب يبطل رمز الاستعادة الصادر قبله', async () => {
    const { actor, phone } = await account()
    await requestPhonePasswordReset(h.db, phone, meta())
    await changePassword(h.db, actor.userId, 'Student@12345', NEXT)
    expect((await challengeFor(phone))!.consumedAt).not.toBeNull()
    await expect(resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: 'Older-code-password!' }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    expect(await passwordMatches(actor.userId, NEXT)).toBe(true)
  })
})
