/** استعادة كلمة السر بهاتف موثّق: رد الطلب عام، والرمز مرتبط بالحساب والغرض. */
import { and, desc, eq, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { otpCodes, passwordResets, profiles, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit, RATE_LIMITS } from '@/server/lib/rate-limit'
import { SmsError } from '@/server/lib/sms'
import { phoneChannels } from './phone-gate.service'
import { normalizePhone, OTP_RATE, OTP_RESEND_COOLDOWN_S, requestOtp, verifyOtp } from './otp.service'
import type { RequestMeta } from './auth.service'

/** الهاتف المشترك أو غير الموثّق لا يختار منه النظام حسابًا عشوائيًا. */
function accountByPhone(db: Db, phone: string) {
  return db.select({ userId: users.id })
    .from(profiles).innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.phone, phone), isNotNull(profiles.phoneVerifiedAt), eq(users.status, 'ACTIVE'), isNull(users.deletedAt)))
    .orderBy(users.id).limit(2)
}

/** لا يُعاد userId أو devCode أو وجود الحساب حتى عند فشل المزوّد أو تجاوز حد الهاتف. */
export async function requestPhonePasswordReset(db: Db, rawPhone: string, meta: RequestMeta = {}): Promise<{ cooldown: number }> {
  const phone = normalizePhone(rawPhone)
  await checkRateLimit(db, { scope: 'phone-reset-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.passwordReset })
  const [accounts, channels] = await Promise.all([accountByPhone(db, phone), phoneChannels(db)])
  try {
    if (accounts.length === 1 && channels.sms) {
      await requestOtp(db, { phone, purpose: 'RECOVER', userId: accounts[0]!.userId, ip: meta.ip })
    } else {
      // نفس حصة الهاتف للرقم المجهول أو الملتبس؛ لا رسالة ولا رمز صالح بلا حساب موثّق.
      await checkRateLimit(db, { scope: 'otp-recover', subject: sha256(phone), ...OTP_RATE })
    }
  } catch (error) {
    if (!(error instanceof AppError) || !['RATE_LIMITED', 'SMS_SEND_FAILED'].includes(error.code)) throw error
    // حالة الهاتف أو فشل إرساله لا يغيّران الرد العام.
  }
  return { cooldown: OTP_RESEND_COOLDOWN_S }
}

const OTP_FAILURES = ['OTP_INVALID', 'OTP_EXPIRED', 'OTP_TOO_MANY_ATTEMPTS']

export async function resetPasswordByPhone(db: Db, input: { phone: string; code: string; password: string }, meta: RequestMeta = {}): Promise<void> {
  const phone = normalizePhone(input.phone)
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
  await checkRateLimit(db, { scope: 'phone-reset-verify-ip', subject: meta.ip ?? 'unknown', limit: 30, windowSeconds: 10 * 60 })
  await checkRateLimit(db, { scope: 'phone-reset-verify-phone', subject: sha256(phone), limit: 30, windowSeconds: 10 * 60 })

  const outcome = await db.transaction(async (tx) => {
    // قفل الحساب والهاتف ثم التحدّي: إعادة الاستعمال المتزامنة لا تغيّر كلمة السر مرتين.
    const accounts = await accountByPhone(tx, phone).for('update')
    if (accounts.length !== 1) return { invalid: true }
    const userId = accounts[0]!.userId
    const [challenge] = await tx.select({ id: otpCodes.id, userId: otpCodes.userId }).from(otpCodes)
      .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, 'RECOVER'), isNull(otpCodes.consumedAt)))
      .orderBy(desc(otpCodes.createdAt)).limit(1).for('update')
    if (!challenge || challenge.userId !== userId) return { invalid: true }
    try {
      await verifyOtp(tx, { phone, purpose: 'RECOVER', code: input.code, userId })
    } catch (error) {
      // لا نرمي داخل المعاملة: محاولات الرمز الفاشلة وانتهاؤه يجب أن تُثبت.
      if (error instanceof AppError && OTP_FAILURES.includes(error.code)) return { invalid: true }
      if (error instanceof SmsError) return { invalid: true }
      throw error
    }
    const now = new Date()
    await tx.update(users).set({ passwordHash: hashPassword(input.password), updatedAt: now }).where(eq(users.id, userId))
    await revokeAllSessions(tx, userId)
    // رابط بريد صدر قبل استعادة الهاتف لا يبقى طريقًا لتغيير السر بعدها.
    await tx.update(passwordResets).set({ usedAt: now }).where(and(eq(passwordResets.userId, userId), isNull(passwordResets.usedAt)))
    await writeActivity(tx, { userId, event: 'auth.reset.done' })
    return { invalid: false }
  })
  // الرد نفسه لرقم بلا حساب، أو رمز خاطئ/منتهٍ/مستهلك/تجاوز محاولاته.
  if (outcome.invalid) throw new AppError('OTP_INVALID')
}
