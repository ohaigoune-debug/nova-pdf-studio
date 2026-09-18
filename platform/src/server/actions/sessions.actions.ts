'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { ATTENDANCE_STAFF_ROLES, portalBase } from '@/server/lib/actor'
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
  let base = '/teacher'
  const result = await runAction(async () => {
    const actor = await requireRole(...ATTENDANCE_STAFF_ROLES)
    base = portalBase(actor.role)
    const s = await startSession(await getDb(), actor, {
      groupId: d.groupId,
      title: d.title || null,
      topic: d.topic || null,
      lateAfterMinutes: d.lateAfterMinutes ?? null
    })
    return { id: s.id }
  })
  if (!result.ok) return result
  revalidatePath(base, 'layout')
  redirect(d.redirectTo === 'scanner' ? `${base}/scanner?session=${result.data.id}` : `${base}/sessions/${result.data.id}`)
}

export async function closeSessionAction(sessionId: string): Promise<ActionResult<CloseSessionResult>> {
  let base = '/teacher'
  const result = await runAction(async () => {
    const actor = await requireRole(...ATTENDANCE_STAFF_ROLES)
    base = portalBase(actor.role)
    return closeSession(await getDb(), actor, sessionId)
  })
  if (result.ok) revalidatePath(base, 'layout')
  return result
}

export async function cancelSessionAction(sessionId: string): Promise<ActionResult> {
  let base = '/teacher'
  const result = await runAction(async () => {
    const actor = await requireRole(...ATTENDANCE_STAFF_ROLES)
    base = portalBase(actor.role)
    await cancelSession(await getDb(), actor, sessionId)
    return undefined
  })
  if (result.ok) revalidatePath(base, 'layout')
  return result
}
