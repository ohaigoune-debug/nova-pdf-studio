'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revokeSessionById } from '@/server/auth/session'
import { clearSessionCookie, currentSessionToken, homeFor, requestMeta, requireActor, setSessionCookie } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { UserRole } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { sha256 } from '@/server/lib/codes'
import { safeNextPath } from '@/server/lib/safe-next'
import { RATE_LIMITS, checkRateLimit, resetRateLimit } from '@/server/lib/rate-limit'
import { deleteOwnAccount } from '@/server/services/account-deletion.service'
import { changePassword, login, logout, registerStudent, requestPasswordReset, resetPassword } from '@/server/services/auth.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { attachReferralForNewAccount, checkCodeForSignup } from '@/server/services/referrals.service'
import { completeOAuthSignup } from '@/server/services/oauth.service'
import { OAUTH_SIGNUP_COOKIE } from '@/server/auth/oauth-flow'
import { REF_COOKIE } from '@/lib/referral'

const loginSchema = z.object({
  // البريد أو رقم الهاتف
  email: z.string().trim().min(3, 'أدخل بريدك أو رقم هاتفك').max(254),
  password: z.string().min(1, 'أدخل كلمة السر'),
  next: z.string().optional()
})

export async function loginAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const meta = await requestMeta()
  const result = await runAction(async () => {
    const emailKey = sha256(parsed.data.email.trim().toLowerCase())
    await checkRateLimit(db, { scope: 'login-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.loginIp })
    await checkRateLimit(db, { scope: 'login-email', subject: emailKey, ...RATE_LIMITS.loginEmail })
    const r = await login(db, { email: parsed.data.email, password: parsed.data.password }, meta)
    await resetRateLimit(db, 'login-email', emailKey)
    await setSessionCookie(r.session.token, r.session.expiresAt)
    return r.role as UserRole
  })
  if (!result.ok) return result
  const next = safeNextPath(parsed.data.next) ?? homeFor(result.data)
  redirect(next)
}

const DZ_MOBILE = /^0[5-7]\d{8}$/
const dzPhone = (msg: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0'))
    .refine((v) => DZ_MOBILE.test(v), msg)

/**
 * التسجيل (قرار المالك 2026-10-24): الهاتف وهاتف الولي إلزاميان (رقم جزائري حقيقي 05/06/07)،
 * والمستوى إلزامي، والشعبة إلزامية للثانوي — لا يُطلب بعدها كتاب لشعبة أخرى.
 */
const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'أدخل الاسم الكامل'),
    email: z.string().trim().email('أدخل بريداً صحيحاً'),
    phone: dzPhone('أدخل رقم هاتفك (05 / 06 / 07 — 10 أرقام)'),
    guardianPhone: dzPhone('أدخل رقم هاتف الولي (05 / 06 / 07 — 10 أرقام)'),
    password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'),
    wilayaId: z.string().uuid('اختر الولاية'),
    levelId: z.string().uuid('اختر المستوى'),
    streamId: z.string().uuid().optional().or(z.literal('')),
    /** كود دعوة زميل أو مسوّق (اختياري) */
    refCode: z.string().trim().max(24).optional()
  })

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const meta = await requestMeta()
  const d = parsed.data
  const result = await runAction(async () => {
    await checkRateLimit(db, { scope: 'register-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.registerIp })
    // الكود يُفحص قبل إنشاء الحساب: خطأ فيه يظهر للتلميذ ولا يُنشأ حساب
    const ref = d.refCode?.trim() ? await checkCodeForSignup(db, d.refCode, d.phone) : null
    const r = await registerStudent(
      db,
      {
        email: d.email,
        password: d.password,
        fullName: d.fullName,
        phone: d.phone,
        guardianPhone: d.guardianPhone,
        wilayaId: d.wilayaId || null,
        levelId: d.levelId || null,
        streamId: d.streamId || null
      },
      meta
    )
    await setSessionCookie(r.session.token, r.session.expiresAt)
    if (ref) {
      const fromLink = (await cookies()).get(REF_COOKIE)?.value === ref.code
      await attachReferralForNewAccount(db, r.userId, ref.code, fromLink ? 'LINK' : 'REGISTER').catch(() => null)
    }
    return r
  })
  if (!result.ok) return result
  // تأكيد الهاتف بعد التسجيل مباشرة (رمز SMS أو مكالمة فائتة مجانية): الحسابات الجديدة لا تدخل قبله
  redirect('/student?verify=1')
}

/** إكمال حساب بدأ بـ Google أو Apple: نفس حقول التسجيل دون البريد وكلمة السر */
const oauthCompleteSchema = z.object({
  fullName: z.string().trim().min(3, 'أدخل الاسم الكامل').max(120),
  phone: dzPhone('أدخل رقم هاتفك (05 / 06 / 07 — 10 أرقام)'),
  guardianPhone: dzPhone('أدخل رقم هاتف الولي (05 / 06 / 07 — 10 أرقام)'),
  wilayaId: z.string().uuid('اختر الولاية'),
  levelId: z.string().uuid('اختر المستوى'),
  streamId: z.string().uuid().optional().or(z.literal('')),
  refCode: z.string().trim().max(24).optional()
})

export async function completeOAuthSignupAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = oauthCompleteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const meta = await requestMeta()
  const d = parsed.data
  const jar = await cookies()
  const token = jar.get(OAUTH_SIGNUP_COOKIE)?.value ?? ''
  const result = await runAction(async () => {
    await checkRateLimit(db, { scope: 'register-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.registerIp })
    const ref = d.refCode?.trim() ? await checkCodeForSignup(db, d.refCode, d.phone) : null
    const r = await completeOAuthSignup(
      db,
      token,
      { fullName: d.fullName, phone: d.phone, guardianPhone: d.guardianPhone, wilayaId: d.wilayaId, levelId: d.levelId, streamId: d.streamId || null },
      meta
    )
    await setSessionCookie(r.session.token, r.session.expiresAt)
    jar.delete(OAUTH_SIGNUP_COOKIE)
    if (ref) {
      const fromLink = jar.get(REF_COOKIE)?.value === ref.code
      await attachReferralForNewAccount(db, r.userId, ref.code, fromLink ? 'LINK' : 'REGISTER').catch(() => null)
    }
    return r
  })
  if (!result.ok) return result
  // كالتسجيل العادي: تأكيد الهاتف برمز قبل أي شيء
  redirect('/student?verify=1')
}

export async function logoutAction(): Promise<void> {
  const token = await currentSessionToken()
  if (token) await logout(await getDb(), token)
  await clearSessionCookie()
  redirect('/login')
}

const activateSchema = z.object({ code: z.string().trim().min(6, 'أدخل الكود كاملاً') })

export async function activateCodeAction(_prev: ActionResult<{ groupName: string }> | null, formData: FormData): Promise<ActionResult<{ groupName: string }>> {
  const parsed = activateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  return runAction(async () => {
    const actor = await requireActor()
    await checkRateLimit(db, { scope: 'activate-code', subject: actor.userId, ...RATE_LIMITS.activateCode })
    const r = await redeemEnrollmentCode(db, actor, parsed.data.code)
    return { groupName: r.groupName }
  })
}

const forgotSchema = z.object({ email: z.string().trim().email('أدخل بريداً صحيحاً') })

/** لا يكشف وجود الحساب: النتيجة واحدة في كل الحالات (عدا تجاوز الحد) */
export async function forgotPasswordAction(_prev: ActionResult<{ done: true }> | null, formData: FormData): Promise<ActionResult<{ done: true }>> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const meta = await requestMeta()
  return runAction(async () => {
    await checkRateLimit(db, { scope: 'reset-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.passwordReset })
    await checkRateLimit(db, { scope: 'reset-email', subject: sha256(parsed.data.email.toLowerCase()), ...RATE_LIMITS.passwordReset })
    await requestPasswordReset(db, parsed.data.email, meta)
    return { done: true as const }
  })
}

const resetSchema = z
  .object({ token: z.string().min(20), password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'كلمتا السر غير متطابقتين' })

export async function resetPasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const result = await runAction(async () => {
    await resetPassword(db, parsed.data.token, parsed.data.password)
    return undefined
  })
  if (!result.ok) return result
  await clearSessionCookie()
  redirect('/login?reset=1')
}

const changeSchema = z
  .object({ current: z.string().min(1, 'أدخل كلمة السر الحالية'), password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'), confirm: z.string() })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'كلمتا السر غير متطابقتين' })

/** تغيير كلمة السر من داخل الحساب — لمن يعرف كلمته الحالية ولا ينتظر بريداً */
export async function changePasswordAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = changeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const result = await runAction(async () => {
    const actor = await requireActor()
    // نفس حدّ محاولات الدخول: الحقل يقبل كلمة السر الحالية، فلا يُترك للتخمين
    await checkRateLimit(db, { scope: 'password-change', subject: actor.userId, ...RATE_LIMITS.loginEmail })
    await changePassword(db, actor.userId, parsed.data.current, parsed.data.password)
    return undefined
  })
  if (!result.ok) return result
  await clearSessionCookie()
  redirect('/login?reset=1')
}

const deleteSchema = z.object({
  // كلمة السر، أو «حذف» لحساب Google / Apple
  password: z.string().min(1, 'أدخل كلمة السر'),
  understood: z.literal('on', { errorMap: () => ({ message: 'أكّد أنك تفهم أن الحذف نهائي' }) })
})

/** حذف التلميذ حسابه بنفسه — بكلمة السر وتأكيد صريح */
export async function deleteAccountAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = deleteSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const result = await runAction(async () => {
    const actor = await requireActor()
    await checkRateLimit(db, { scope: 'account-delete', subject: actor.userId, ...RATE_LIMITS.loginEmail })
    await deleteOwnAccount(db, actor.userId, parsed.data.password)
    return undefined
  })
  if (!result.ok) return result
  await clearSessionCookie()
  redirect('/delete-account?done=1')
}

export async function revokeDeviceAction(sessionId: string): Promise<ActionResult> {
  const db = await getDb()
  return runAction(async () => {
    const actor = await requireActor()
    await revokeSessionById(db, actor.userId, sessionId)
    return undefined
  })
}
