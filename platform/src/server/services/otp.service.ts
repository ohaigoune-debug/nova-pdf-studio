/**
 * رموز التحقق بالهاتف (OTP): عند التسجيل، وعند تأكيد الطلب، وللمطالبة والاسترجاع.
 * لا يُخزَّن الرمز إلا HMAC؛ 6 أرقام، صلاحية 5 دقائق، 5 محاولات ثم يُبطل، و3 رموز كحدّ أقصى لكل هاتف/غرض في 10 دقائق.
 * في بيئة الاختبار فقط يعود الرمز في النتيجة (devCode) — في الإنتاج لا يُعاد أبداً.
 */
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { otpCodes, profiles } from '@/server/db/schema'
import type { OtpPurpose } from '@/server/db/schema/enums'
import { OTP_PURPOSES } from '@/server/db/schema/enums'
import { writeAudit } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError, assertUuid } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { sendSms } from '@/server/lib/sms'

export const OTP_TTL_MS = 5 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RATE = { limit: 3, windowSeconds: 10 * 60 }
export const OTP_RESEND_COOLDOWN_S = 60

const PHONE_RE = /^0[5-7]\d{8}$/

/** يزيل الفراغات والشُّرط ويتحقّق من الصيغة الجزائرية 0[5-7]XXXXXXXX */
export function normalizePhone(raw: string): string {
  const p = (raw ?? '').replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')
  if (!PHONE_RE.test(p)) throw new AppError('VALIDATION', { field: 'phone' })
  return p
}

function hashCode(phone: string, purpose: string, code: string): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error('SESSION_SECRET is not configured')
  return createHmac('sha256', secret).update(`otp:${purpose}:${phone}:${code}`).digest('hex')
}

function assertPurpose(p: string): asserts p is OtpPurpose {
  if (!OTP_PURPOSES.includes(p as OtpPurpose)) throw new AppError('VALIDATION', { field: 'purpose' })
}

export const otpSmsText = (code: string) => `مدرسة: رمز التحقق ${code}. صالح 5 دقائق. لا تشاركه مع أحد.`

export interface RequestOtpInput {
  phone: string
  purpose: OtpPurpose
  userId?: string | null
  ip?: string | null
}

export async function requestOtp(db: Db, input: RequestOtpInput): Promise<{ phone: string; expiresAt: Date; devCode?: string }> {
  assertPurpose(input.purpose)
  const phone = normalizePhone(input.phone)
  if (input.userId) assertUuid(input.userId, 'VALIDATION')
  await checkRateLimit(db, { scope: `otp-${input.purpose.toLowerCase()}`, subject: sha256(phone), ...OTP_RATE })
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  // الرموز السابقة غير المستهلكة لنفس الهاتف/الغرض تُبطل: آخر رمز هو الصالح وحده
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, input.purpose), isNull(otpCodes.consumedAt)))
  const [row] = await db.insert(otpCodes).values({ phone, purpose: input.purpose, userId: input.userId ?? null, codeHash: hashCode(phone, input.purpose, code), expiresAt }).returning({ id: otpCodes.id })
  try {
    await sendSms(db, { to: phone, text: otpSmsText(code) })
  } catch (e) {
    // الرمز الذي لم يصل لا يبقى صالحاً
    await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row!.id))
    if (process.env.NODE_ENV !== 'test') console.error('[otp] sms failed:', e instanceof Error ? e.message : e)
    throw new AppError('SMS_SEND_FAILED')
  }
  await writeAudit(db, { actorUserId: input.userId ?? null, workspaceId: null, action: 'otp.request', entityType: 'otp', entityId: row!.id, newValue: { purpose: input.purpose, phoneTail: phone.slice(-4) }, ip: input.ip ?? null })
  return process.env.NODE_ENV === 'test' ? { phone, expiresAt, devCode: code } : { phone, expiresAt }
}

export interface VerifyOtpInput {
  phone: string
  purpose: OtpPurpose
  code: string
  userId?: string | null
}

/** يتحقّق من آخر رمز غير مستهلك وغير منتهٍ. خطأ ⇒ OTP_INVALID؛ انتهاء ⇒ OTP_EXPIRED؛ تجاوز المحاولات ⇒ OTP_TOO_MANY_ATTEMPTS */
export async function verifyOtp(db: Db, input: VerifyOtpInput): Promise<{ ok: true }> {
  assertPurpose(input.purpose)
  const phone = normalizePhone(input.phone)
  const code = (input.code ?? '').replace(/\D/g, '')
  if (code.length !== 6) throw new AppError('OTP_INVALID')
  const now = new Date()
  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.phone, phone), eq(otpCodes.purpose, input.purpose), isNull(otpCodes.consumedAt)))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1)
  if (!row) throw new AppError('OTP_INVALID')
  if (row.expiresAt.getTime() <= now.getTime()) {
    await db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, row.id))
    throw new AppError('OTP_EXPIRED')
  }
  const expected = Buffer.from(row.codeHash, 'hex')
  const actual = Buffer.from(hashCode(phone, input.purpose, code), 'hex')
  const match = expected.length === actual.length && timingSafeEqual(expected, actual)
  if (!match) {
    const attempts = row.attempts + 1
    const exhausted = attempts >= OTP_MAX_ATTEMPTS
    await db
      .update(otpCodes)
      .set({ attempts: sql`${otpCodes.attempts} + 1`, consumedAt: exhausted ? now : null })
      .where(eq(otpCodes.id, row.id))
    await writeAudit(db, { actorUserId: input.userId ?? row.userId ?? null, workspaceId: null, action: 'otp.verify', entityType: 'otp', entityId: row.id, newValue: { purpose: input.purpose, ok: false, attempts, exhausted } })
    throw new AppError(exhausted ? 'OTP_TOO_MANY_ATTEMPTS' : 'OTP_INVALID')
  }
  await db.update(otpCodes).set({ consumedAt: now }).where(eq(otpCodes.id, row.id))
  const userId = input.userId ?? row.userId ?? null
  if (input.purpose === 'REGISTER' && userId) {
    assertUuid(userId, 'VALIDATION')
    await db.update(profiles).set({ phone, phoneVerifiedAt: now, updatedAt: now }).where(eq(profiles.userId, userId))
  }
  await writeAudit(db, { actorUserId: userId, workspaceId: null, action: 'otp.verify', entityType: 'otp', entityId: row.id, newValue: { purpose: input.purpose, ok: true } })
  return { ok: true }
}

/** هل أكّد المستخدم هاتفه؟ (مع الهاتف المؤكَّد إن وُجد) */
export async function isPhoneVerified(db: Db, userId: string): Promise<{ verified: boolean; phone: string | null }> {
  assertUuid(userId, 'VALIDATION')
  const [p] = await db.select({ phone: profiles.phone, at: profiles.phoneVerifiedAt }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  return { verified: Boolean(p?.at), phone: p?.phone ?? null }
}

/** حذف الرموز القديمة (للصيانة) */
export async function purgeOtpCodes(db: Db, olderThan: Date): Promise<number> {
  const rows = await db.delete(otpCodes).where(lt(otpCodes.expiresAt, olderThan)).returning({ id: otpCodes.id })
  return rows.length
}
