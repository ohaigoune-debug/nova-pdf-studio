'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { cancelSession, closeSession, startSession, type CloseSessionResult } from '@/server/services/class-sessions.service'

const startSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  lateAfterMinutes: z.coerce.number().int().min(0).max(120).optional(),
  redirectTo: z.enum(['scanner', 'session']).optional()
})

export async function startSessionAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = startSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const s = await startSession(await getDb(), actor, {
      groupId: d.groupId,
      title: d.title || null,
      topic: d.topic || null,
      lateAfterMinutes: d.lateAfterMinutes ?? null
    })
    return { id: s.id }
  })
  if (!result.ok) return result
  revalidatePath('/teacher', 'layout')
  redirect(d.redirectTo === 'scanner' ? `/teacher/scanner?session=${result.data.id}` : `/teacher/sessions/${result.data.id}`)
}

export async function closeSessionAction(sessionId: string): Promise<ActionResult<CloseSessionResult>> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    return closeSession(await getDb(), actor, sessionId)
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}

export async function cancelSessionAction(sessionId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await cancelSession(await getDb(), actor, sessionId)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}
