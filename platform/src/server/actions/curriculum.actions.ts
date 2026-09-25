'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { CURRICULUM_NODE_KINDS } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createNode, deleteNode } from '@/server/services/taxonomy.service'

const uuid = z.string().uuid()
const nodeSchema = z.object({
  subjectId: uuid,
  levelId: uuid,
  streamId: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null)),
  parentId: z
    .string()
    .optional()
    .transform((v) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null)),
  kind: z.enum(CURRICULUM_NODE_KINDS),
  title: z.string().trim().min(2, 'العنوان قصير').max(200),
  schoolTerm: z
    .string()
    .optional()
    .transform((v) => (v && /^[123]$/.test(v) ? Number(v) : null))
})

export async function createNodeAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = nodeSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const row = await createNode(await getDb(), actor, parsed.data)
    return { id: row.id }
  })
  if (result.ok) revalidatePath('/admin/curriculum')
  return result
}

export async function deleteNodeAction(nodeId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await deleteNode(await getDb(), actor, nodeId)
    return undefined
  })
  if (result.ok) revalidatePath('/admin/curriculum')
  return result
}
