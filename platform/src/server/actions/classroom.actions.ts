'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { sendAnnouncement } from '@/server/services/announcements.service'
import { addComment, createPost, deleteComment, deletePost, MAX_COMMENT, MAX_POST, updatePost } from '@/server/services/classroom.service'

const uuidList = (fd: FormData, k: string) => fd.getAll(k).map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
const refresh = () => {
  revalidatePath('/teacher/classroom')
  revalidatePath('/student/classroom')
}

const announcementSchema = z.object({
  title: z.string().trim().min(2, 'أدخل عنواناً').max(150),
  body: z.string().trim().min(2, 'اكتب الرسالة').max(3000),
  link: z.string().trim().max(500).optional(),
  audience: z.enum(['all', 'groups']).default('all')
})

export async function sendAnnouncementAction(_prev: ActionResult<{ recipients: number }> | null, fd: FormData): Promise<ActionResult<{ recipients: number }>> {
  const parsed = announcementSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const groupIds = parsed.data.audience === 'groups' ? uuidList(fd, 'groupIds') : []
  if (parsed.data.audience === 'groups' && groupIds.length === 0) return { ok: false, error: { code: 'VALIDATION', message: 'اختر فوجاً واحداً على الأقل.', fieldErrors: { groupIds: 'اختر فوجاً واحداً على الأقل.' } } }
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    // الإشعار يصل كل التلاميذ: حدّ يمنع الإغراق بالخطأ
    await checkRateLimit(db, { scope: 'announcement', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    const row = await sendAnnouncement(db, actor, { title: parsed.data.title, body: parsed.data.body, link: parsed.data.link, groupIds })
    return { recipients: row.recipients }
  })
  if (result.ok) revalidatePath('/teacher/announcements')
  return result
}

const postSchema = z.object({
  body: z.string().trim().min(1, 'اكتب المنشور').max(MAX_POST),
  groupId: z.string().optional(),
  linkUrl: z.string().trim().max(500).optional(),
  fileId: z.string().optional(),
  allowComments: z.literal('on').optional()
})

export async function createPostAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = postSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/.test(v) ? v : null)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const post = await createPost(await getDb(), actor, {
      body: parsed.data.body,
      groupId: uuid(parsed.data.groupId),
      linkUrl: parsed.data.linkUrl,
      fileId: uuid(parsed.data.fileId),
      allowComments: parsed.data.allowComments === 'on'
    })
    return { id: post.id }
  })
  if (result.ok) refresh()
  return result
}

export async function updatePostAction(postId: string, patch: { pinned?: boolean; allowComments?: boolean }): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    await updatePost(await getDb(), actor, postId, patch)
    return undefined
  })
  if (result.ok) refresh()
  return result
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    await deletePost(await getDb(), actor, postId)
    return undefined
  })
  if (result.ok) refresh()
  return result
}

export async function addCommentAction(postId: string, body: string): Promise<ActionResult> {
  const parsed = z.string().trim().min(1, 'اكتب تعليقاً').max(MAX_COMMENT).safeParse(body)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'class-comment', subject: actor.userId, limit: 20, windowSeconds: 60 })
    await addComment(db, actor, postId, parsed.data)
    return undefined
  })
  if (result.ok) refresh()
  return result
}

export async function deleteCommentAction(commentId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireActor()
    await deleteComment(await getDb(), actor, commentId)
    return undefined
  })
  if (result.ok) refresh()
  return result
}
