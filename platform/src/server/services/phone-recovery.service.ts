/**
 * استعادة كلمة السر بهاتف موثّق: رد الطلب عام، والرمز مرتبط بالحساب والغرض.
 * رموز البوابة 4 أرقام، فالحماية من التخمين حدود يومية لكل هاتف:
 *   - 5 رموز استعادة في اليوم (تحمي الرصيد وهاتف الضحية من الإغراق)،
 *   - 5 إخفاقات في اليوم ثم تُقفل الاستعادة بالهاتف لهذا الرقم حتى اليوم التالي (حتى الرمز الصحيح يُرفض).
 * حسابات الإدارة والأساتذة والموظفين لا تُستعاد بالهاتف أبداً — بالبريد وحده.
 */
import { and, desc, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { otpCodes, passwordResets, profiles, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { getMailer } from '@/server/lib/mailer'
import { checkRateLimit, isRateLimited, RATE_LIMITS } from '@/server/lib/rate-limit'
import { SmsError } from '@/server/lib/sms'
import { phoneChannels } from './phone-gate.service'
import { normalizePhone, OTP_RATE, OTP_RESEND_COOLDOWN_S, requestOtp, verifyOtp } from './otp.service'
import type { RequestMeta } from './auth.service'

const DAY_S = 24 * 60 * 60
/** رموز الاستعادة المرسلة لكل هاتف في اليوم */
export const PHONE_RESET_DAILY_CODES = 5
/** الإخفاقات المسموحة لكل هاتف في اليوم قبل قفل الاستعادة بالهاتف */
export const PHONE_RESET_DAILY_FAILURES = 5
/** الأدوار التي تُستعاد بالهاتف؛ الإدارة والتدريس والموظفون بالبريد فقط */
export const PHONE_RECOVERY_ROLES = ['STUDENT', 'PARENT', 'PUBLIC'] as const

const failRule = (phone: string) => ({ scope: 'phone-reset-fail', subject: sha256(phone), limit: PHONE_RESET_DAILY_FAILURES, windowSeconds: DAY_S })

/** الهاتف المشترك أو غير الموثّق لا يختار منه النظام حسابًا عشوائيًا. */
function accountByPhone(db: Db, phone: string) {
  return db.select({ userId: users.id, email: users.email })
    .from(profiles).innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.phone, phone), isNotNull(profiles.phoneVerifiedAt), eq(users.status, 'ACTIVE'), isNull(users.deletedAt), inArray(users.role, [...PHONE_RECOVERY_ROLES])))
    .orderBy(users.id).limit(2)
}

const quietOtpErrors = (error: unknown) => error instanceof AppError && ['RATE_LIMITED', 'SMS_SEND_FAILED'].includes(error.code)

export interface PhoneResetOptions {
  /** تأجيل الإرسال إلى ما بعد الرد (after من Next): زمن الرد واحد للرقم المعروف والمجهول. بدونه يُنتظر الإرسال (الاختبارات). */
  defer?: (task: () => Promise<void>) => void
}

/** لا يُعاد userId أو devCode أو وجود الحساب حتى عند فشل المزوّد أو تجاوز حد الهاتف. */
export async function requestPhonePasswordReset(db: Db, rawPhone: string, meta: RequestMeta = {}, opts: PhoneResetOptions = {}): Promise<{ cooldown: number }> {
  const phone = normalizePhone(rawPhone)
  await checkRateLimit(db, { scope: 'phone-reset-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.passwordReset })
  const [accounts, channels] = await Promise.all([accountByPhone(db, phone), phoneChannels(db)])
  try {
    // سقف يومي لكل هاتف قبل أي إرسال، بالرد العام نفسه للرقم المعروف والمجهول
    await checkRateLimit(db, { scope: 'phone-reset-day', subject: sha256(phone), limit: PHONE_RESET_DAILY_CODES, windowSeconds: DAY_S })
    if (await isRateLimited(db, failRule(phone))) return { cooldown: OTP_RESEND_COOLDOWN_S }
    if (accounts.length === 1 && channels.sms) {
      const userId = accounts[0]!.userId
      const send = async () => {
        try {
          await requestOtp(db, { phone, purpose: 'RECOVER', userId, ip: meta.ip })
        } catch (error) {
          if (!quietOtpErrors(error)) throw error
        }
      }
      if (opts.defer) opts.defer(() => send().catch((e) => console.error('[phone-reset] send failed:', e instanceof Error ? e.message : e)))
      else await send()
    } else {
      // نفس حصة الهاتف للرقم المجهول أو الملتبس؛ لا رسالة ولا رمز صالح بلا حساب موثّق.
      await checkRateLimit(db, { scope: 'otp-recover', subject: sha256(phone), ...OTP_RATE })
    }
  } catch (error) {
    if (!quietOtpErrors(error)) throw error
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
  // بعد 5 إخفاقات في اليوم لا يُقبل أي رمز لهذا الهاتف، ولو كان صحيحاً
  if (await isRateLimited(db, failRule(phone))) throw new AppError('OTP_TOO_MANY_ATTEMPTS')

  const outcome = await db.transaction(async (tx) => {
    // قفل الحساب والهاتف ثم التحدّي: إعادة الاستعمال المتزامنة لا تغيّر كلمة السر مرتين.
    const accounts = await accountByPhone(tx, phone).for('update')
    if (accounts.length !== 1) return { invalid: true }
    const userId = accounts[0]!.userId
    const email = accounts[0]!.email
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
    return { invalid: false, email }
  })
  // الرد نفسه لرقم بلا حساب، أو رمز خاطئ/منتهٍ/مستهلك/تجاوز محاولاته — وكل إخفاق يُعدّ للقفل اليومي.
  if (outcome.invalid) {
    await checkRateLimit(db, failRule(phone)).catch(() => undefined)
    throw new AppError('OTP_INVALID')
  }
  await notifyPhoneReset(outcome.email ?? null, phone)
}

/** إشعار صاحب الحساب ببريده: تغيير كلمة السر بالهاتف لا يمرّ دون علمه (لا يُفشل الاستعادة أبداً). */
async function notifyPhoneReset(email: string | null, phone: string): Promise<void> {
  if (!email) return
  const tail = phone.slice(-2)
  try {
    await getMailer().send({
      to: email,
      subject: 'تغيّرت كلمة سر حسابك — مدرسة',
      text: `مرحباً،\n\nتغيّرت كلمة سر حسابك في مدرسة برمز أُرسل إلى هاتفك المنتهي بـ ${tail}، وخرجت كل الأجهزة من الحساب.\n\nإن لم تكن أنت، فاطلب إعادة تعيين كلمة السر بهذا البريد فوراً وتواصل معنا.`,
      html: `<p dir="rtl">مرحباً،</p><p dir="rtl">تغيّرت كلمة سر حسابك في مدرسة برمز أُرسل إلى هاتفك المنتهي بـ ${tail}، وخرجت كل الأجهزة من الحساب.</p><p dir="rtl">إن لم تكن أنت، فاطلب إعادة تعيين كلمة السر بهذا البريد فوراً وتواصل معنا.</p>`
    })
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.error('[mail] phone reset notice failed', err instanceof Error ? err.message : err)
  }
}
