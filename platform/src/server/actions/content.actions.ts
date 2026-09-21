'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { CONTENT_TYPES, VISIBILITIES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createContent, deleteContent, updateContent } from '@/server/services/content.service'
import { deleteFile, uploadFile } from '@/server/services/files.service'
import { importPlaylist, type ImportPlaylistResult } from '@/server/services/youtube-import.service'

const optionalUuid = z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : null))

const contentSchema = z.object({
  type: z.enum(CONTENT_TYPES),
  title: z.string().trim().min(2, 'أدخل العنوان'),
  summary: z.string().trim().optional(),
  body: z.string().optional(),
  externalUrl: z.string().trim().url('رابط غير صحيح').optional().or(z.literal('')),
  fileId: optionalUuid,
  levelId: optionalUuid,
  streamId: optionalUuid,
  topic: z.string().trim().optional(),
  skillId: optionalUuid,
  visibility: z.enum(VISIBILITIES),
  publish: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  videoProvider: z.enum(['YOUTUBE', 'UPLOAD']).optional().or(z.literal('')),
  youtubeUrl: z.string().trim().optional(),
  allowDownload: z.string().optional().transform((v) => v === 'on' || v === 'true')
})

/** يحوّل حقول النموذج إلى مدخلات الخدمة: فيديو يوتيوب ⇒ externalUrl = رابط يوتيوب، فيديو مرفوع ⇒ fileId */
function contentInput(d: z.infer<typeof contentSchema>, fd: FormData) {
  const provider = d.type === 'VIDEO' ? (d.videoProvider || (d.fileId ? 'UPLOAD' : 'YOUTUBE')) : null
  const externalUrl = provider === 'YOUTUBE' ? d.youtubeUrl || d.externalUrl || '' : d.externalUrl || ''
  return {
    ...d,
    externalUrl: externalUrl || null,
    fileId: provider === 'YOUTUBE' ? null : d.fileId,
    videoProvider: provider as 'YOUTUBE' | 'UPLOAD' | null,
    ...targets(fd)
  }
}

function targets(fd: FormData) {
  return {
    groupIds: fd.getAll('groupIds').map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v)),
    studentIds: fd.getAll('studentIds').map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  }
}

export async function createContentAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = contentSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const c = await createContent(await getDb(), actor, contentInput(parsed.data, fd))
    return { id: c.id }
  })
  if (!result.ok) return result
  revalidatePath('/teacher/content')
  redirect('/teacher/content')
}

const importSchema = z.object({
  url: z.string().trim().min(5, 'الصق رابط قائمة التشغيل'),
  levelId: optionalUuid,
  streamId: optionalUuid,
  visibility: z.enum(VISIBILITIES),
  publish: z.string().optional().transform((v) => v === 'on' || v === 'true'),
  organize: z.string().optional().transform((v) => v === 'on' || v === 'true')
})

export async function importPlaylistAction(_prev: ActionResult<ImportPlaylistResult> | null, fd: FormData): Promise<ActionResult<ImportPlaylistResult>> {
  const parsed = importSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    return importPlaylist(await getDb(), actor, { ...parsed.data, groupIds: targets(fd).groupIds })
  })
  if (result.ok) revalidatePath('/teacher/content')
  return result
}

export async function updateContentAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = contentSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await updateContent(await getDb(), actor, id, contentInput(parsed.data, fd))
    return undefined
  })
  if (result.ok) {
    revalidatePath('/teacher/content')
    revalidatePath(`/teacher/content/${id}/edit`)
  }
  return result
}

export async function setContentPublishedAction(id: string, publish: boolean): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await updateContent(await getDb(), actor, id, { publish })
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/content')
  return result
}

export async function deleteContentAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await deleteContent(await getDb(), actor, id)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/content')
  return result
}

export async function uploadFileAction(_prev: ActionResult<{ id: string; name: string }> | null, fd: FormData): Promise<ActionResult<{ id: string; name: string }>> {
  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: { code: 'VALIDATION', message: 'اختر ملفاً.', fieldErrors: { file: 'اختر ملفاً.' } } }
  }
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const bytes = Buffer.from(await file.arrayBuffer())
    const row = await uploadFile(await getDb(), actor, { originalName: file.name, mimeType: file.type || 'application/octet-stream', bytes })
    return { id: row.id, name: row.originalName }
  })
  if (result.ok) revalidatePath('/teacher/files')
  return result
}

export async function deleteFileAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await deleteFile(await getDb(), actor, id)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/files')
  return result
}
