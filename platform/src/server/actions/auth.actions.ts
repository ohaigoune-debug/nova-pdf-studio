'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { revokeSessionById } from '@/server/auth/session'
import { clearSessionCookie, currentSessionToken, homeFor, requestMeta, requireActor, setSessionCookie } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import type { UserRole } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { login, logout, registerStudent } from '@/server/services/auth.service'
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
    const r = await login(db, { email: parsed.data.email, password: parsed.data.password }, meta)
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
    const r = await redeemEnrollmentCode(db, actor, parsed.data.code)
    return { groupName: r.groupName }
  })
}

export async function revokeDeviceAction(sessionId: string): Promise<ActionResult> {
  const db = await getDb()
  return runAction(async () => {
    const actor = await requireActor()
    await revokeSessionById(db, actor.userId, sessionId)
    return undefined
  })
}
