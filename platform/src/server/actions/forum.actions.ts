'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createThread, deletePost, deleteThread, FORUM_LIMITS, hidePost, moderateThread, replyToThread, type ForumModeration } from '@/server/services/forum.service'

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : null))

const threadSchema = z.object({
  title: z.string().trim().min(FORUM_LIMITS.title.min, 'العنوان قصير جداً').max(FORUM_LIMITS.title.max, 'العنوان طويل'),
  body: z.string().trim().min(FORUM_LIMITS.body.min, 'اكتب سؤالك أو فكرتك').max(FORUM_LIMITS.body.max, 'النص طويل جداً'),
  subjectId: optionalUuid,
  levelId: optionalUuid
})

export async function createThreadAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = threadSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => createThread(await getDb(), await requireActor(), parsed.data))
  if (result.ok) {
    revalidatePath('/forum')
    redirect(`/forum/${result.data.id}`)
  }
  return result
}

const replySchema = z.object({
  threadId: z.string().uuid(),
  body: z.string().trim().min(FORUM_LIMITS.body.min, 'اكتب ردّك').max(FORUM_LIMITS.body.max, 'الردّ طويل جداً')
})

export async function replyAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = replySchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => replyToThread(await getDb(), await requireActor(), parsed.data.threadId, parsed.data.body))
  if (result.ok) {
    revalidatePath(`/forum/${parsed.data.threadId}`)
    revalidatePath('/forum')
  }
  return result
}

export async function deleteThreadAction(threadId: string): Promise<ActionResult<undefined>> {
  const result = await runAction(async () => {
    await deleteThread(await getDb(), await requireActor(), threadId)
    return undefined
  })
  if (result.ok) revalidatePath('/forum')
  return result
}

export async function deletePostAction(postId: string): Promise<ActionResult<undefined>> {
  const result = await runAction(async () => {
    const { threadId } = await deletePost(await getDb(), await requireActor(), postId)
    revalidatePath(`/forum/${threadId}`)
    return undefined
  })
  if (result.ok) revalidatePath('/forum')
  return result
}

const MODERATIONS: ForumModeration[] = ['pin', 'unpin', 'lock', 'unlock', 'hide', 'unhide']

export async function moderateThreadAction(threadId: string, action: string): Promise<ActionResult<undefined>> {
  if (!MODERATIONS.includes(action as ForumModeration)) return { ok: false, error: { code: 'VALIDATION', message: 'إجراء غير معروف' } }
  const result = await runAction(async () => {
    await moderateThread(await getDb(), await requireActor(), threadId, action as ForumModeration)
    return undefined
  })
  if (result.ok) {
    revalidatePath('/forum')
    revalidatePath(`/forum/${threadId}`)
  }
  return result
}

export async function hidePostAction(postId: string, hidden: boolean): Promise<ActionResult<undefined>> {
  return runAction(async () => {
    const { threadId } = await hidePost(await getDb(), await requireActor(), postId, hidden)
    revalidatePath(`/forum/${threadId}`)
    return undefined
  })
}
