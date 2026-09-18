'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revokeSessionById } from '@/server/auth/session'
import { clearSessionCookie, currentSessionToken, homeFor, requestMeta, requireActor, setSessionCookie } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { UserRole } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { sha256 } from '@/server/lib/codes'
import { RATE_LIMITS, checkRateLimit, resetRateLimit } from '@/server/lib/rate-limit'
import { login, logout, registerStudent, requestPasswordReset, resetPassword } from '@/server/services/auth.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'

const loginSchema = z.object({
  email: z.string().trim().email('أدخل بريداً صحيحاً'),
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
  const next = parsed.data.next && parsed.data.next.startsWith('/') ? parsed.data.next : homeFor(result.data)
  redirect(next)
}

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'أدخل الاسم الكامل'),
  email: z.string().trim().email('أدخل بريداً صحيحاً'),
  phone: z.string().trim().optional(),
  password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل'),
  wilayaId: z.string().uuid().optional().or(z.literal('')),
  levelId: z.string().uuid().optional().or(z.literal('')),
  streamId: z.string().uuid().optional().or(z.literal('')),
  code: z.string().trim().optional()
})

export async function registerAction(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const db = await getDb()
  const meta = await requestMeta()
  const d = parsed.data
  const result = await runAction(async () => {
    await checkRateLimit(db, { scope: 'register-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.registerIp })
    const r = await registerStudent(
      db,
      {
        email: d.email,
        password: d.password,
        fullName: d.fullName,
        phone: d.phone || null,
        wilayaId: d.wilayaId || null,
        levelId: d.levelId || null,
        streamId: d.streamId || null
      },
      meta
    )
    await setSessionCookie(r.session.token, r.session.expiresAt)
    return r
  })
  if (!result.ok) return result
  redirect(d.code ? `/activate-code?code=${encodeURIComponent(d.code)}` : '/activate-code')
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

export async function revokeDeviceAction(sessionId: string): Promise<ActionResult> {
  const db = await getDb()
  return runAction(async () => {
    const actor = await requireActor()
    await revokeSessionById(db, actor.userId, sessionId)
    return undefined
  })
}
