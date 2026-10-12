'use server'

import { revalidatePath } from 'next/cache'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { runAction, type ActionResult } from '@/server/lib/action-result'
import { createBatch, createBatchFromContent, publishBatch, saveBatchItems, unpublishResource, type BatchDefaults, type BatchItem, type CreateBatchInput } from '@/server/services/publish.service'

const refresh = () => {
  for (const p of ['/teacher/publish', '/admin/publish', '/exams', '/lessons']) revalidatePath(p)
}

export async function createBatchAction(input: CreateBatchInput): Promise<ActionResult<{ id: string; status: string }>> {
  const r = await runAction(async () => createBatch(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), { fileIds: input.fileIds ?? [], mode: input.mode === 'ai' ? 'ai' : 'manual', defaults: input.defaults }))
  if (r.ok) kickWorker(getDb)
  return r
}

export async function saveBatchAction(id: string, items: Partial<BatchItem>[], defaults?: Partial<BatchDefaults>): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    await saveBatchItems(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), id, items, defaults)
    return undefined
  })
}

export async function publishBatchAction(id: string, items: Partial<BatchItem>[], defaults?: Partial<BatchDefaults>): Promise<ActionResult<{ published: number; sections: { exams: number; lessons: number } }>> {
  const r = await runAction(async () => {
    const db = await getDb()
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await saveBatchItems(db, actor, id, items, defaults)
    return publishBatch(db, actor, id)
  })
  if (r.ok) refresh()
  return r
}

export async function unpublishAction(resourceId: string): Promise<ActionResult<undefined>> {
  const r = await runAction(async () => {
    await unpublishResource(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), resourceId)
    return undefined
  })
  if (r.ok) refresh()
  return r
}

export async function splitSeriesAction(contentId: string): Promise<ActionResult<{ id: string }>> {
  const r = await runAction(async () => createBatchFromContent(await getDb(), await requireRole('SUPER_ADMIN'), contentId))
  if (r.ok) kickWorker(getDb)
  return r
}
