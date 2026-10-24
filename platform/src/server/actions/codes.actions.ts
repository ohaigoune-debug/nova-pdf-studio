'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { cancelBatch, disableCode, generateCodes, type GeneratedCode } from '@/server/services/enrollment-codes.service'

const schema = z.object({
  groupId: z.string().uuid(),
  count: z.coerce.number().int().min(1, 'العدد 1 على الأقل').max(500, 'الحد الأقصى 500'),
  label: z.string().trim().optional(),
  expiresAt: z.string().optional()
})

export interface GenerateCodesData {
  batchId: string
  codes: GeneratedCode[]
  groupName: string
}

export async function generateCodesAction(_prev: ActionResult<GenerateCodesData> | null, formData: FormData): Promise<ActionResult<GenerateCodesData>> {
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const expiresAt = d.expiresAt ? new Date(d.expiresAt) : null
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    return generateCodes(await getDb(), actor, {
      groupId: d.groupId,
      count: d.count,
      label: d.label || null,
      expiresAt: expiresAt && !Number.isNaN(expiresAt.getTime()) ? expiresAt : null
    })
  })
  if (result.ok) {
    revalidatePath(`/teacher/groups/${d.groupId}/codes`)
    revalidatePath('/teacher/codes')
  }
  return result
}

export async function disableCodeAction(codeId: string, groupId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await disableCode(await getDb(), actor, codeId)
    return undefined
  })
  if (result.ok) revalidatePath(`/teacher/groups/${groupId}/codes`)
  return result
}

export async function cancelBatchAction(batchId: string, groupId: string): Promise<ActionResult<{ disabled: number }>> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    return cancelBatch(await getDb(), actor, batchId)
  })
  if (result.ok) revalidatePath(`/teacher/groups/${groupId}/codes`)
  return result
}
