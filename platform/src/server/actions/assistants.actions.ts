'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getCurrentActor, requestMeta, requireRole, setSessionCookie } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import {
  createAssistantCode,
  disableAssistantCode,
  joinAsAssistant,
  revokeAssistant,
  type AssistantCodeResult
} from '@/server/services/assistants.service'

const createSchema = z.object({
  email: z.string().trim().email('أدخل بريداً صحيحاً'),
  expiresDays: z.coerce.number().int().min(0).max(365).optional()
})

export async function createAssistantCodeAction(_prev: ActionResult<AssistantCodeResult> | null, formData: FormData): Promise<ActionResult<AssistantCodeResult>> {
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const expiresAt = d.expiresDays && d.expiresDays > 0 ? new Date(Date.now() + d.expiresDays * 86_400_000) : null
    return createAssistantCode(await getDb(), actor, { email: d.email, expiresAt })
  })
  if (result.ok) revalidatePath('/teacher/assistants')
  return result
}

export async function revokeAssistantAction(assistantId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    await revokeAssistant(await getDb(), actor, assistantId)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/assistants')
  return result
}

export async function disableAssistantCodeAction(codeId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    await disableAssistantCode(await getDb(), actor, codeId)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/assistants')
  return result
}

const joinSchema = z.object({
  code: z.string().trim().min(6, 'أدخل الكود كاملاً'),
  email: z.string().trim().email('أدخل بريداً صحيحاً'),
  fullName: z.string().trim().min(3, 'أدخل الاسم الكامل'),
  password: z.string().min(8, 'كلمة السر 8 أحرف على الأقل')
})

/** انضمام المساعد بالكود: يُنشئ الحساب (أو يستعمل حساب مساعد قائماً) ويفتح جلسة. */
export async function joinAssistantAction(_prev: ActionResult<{ teacherName: string }> | null, formData: FormData): Promise<ActionResult<{ teacherName: string }>> {
  const parsed = joinSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const db = await getDb()
  const meta = await requestMeta()
  const result = await runAction(async () => {
    if (await getCurrentActor()) throw new AppError('FORBIDDEN')
    await checkRateLimit(db, { scope: 'assistant-join-ip', subject: meta.ip ?? 'unknown', ...RATE_LIMITS.activateCode })
    await checkRateLimit(db, { scope: 'assistant-join-email', subject: sha256(d.email.toLowerCase()), ...RATE_LIMITS.activateCode })
    const r = await joinAsAssistant(db, { code: d.code, email: d.email, fullName: d.fullName, password: d.password }, meta)
    await setSessionCookie(r.session.token, r.session.expiresAt)
    return { teacherName: r.teacherName }
  })
  if (!result.ok) return result
  redirect('/assistant?welcome=1')
}
