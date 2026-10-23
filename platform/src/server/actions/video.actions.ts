'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { writeAudit } from '@/server/lib/audit'
import { clearBunnyCredentials, createVideo, getBunnyCredentials, saveBunnyCredentials, testBunny, uploadVideoBytes } from '@/server/lib/bunny'
import { AppError } from '@/server/lib/errors'

const credsSchema = z.object({
  libraryId: z.string().trim().regex(/^\d{1,12}$/, 'معرّف المكتبة رقم'),
  apiKey: z.string().trim().min(16, 'مفتاح API قصير'),
  tokenAuthKey: z.string().trim().min(16, 'مفتاح التوقيع قصير'),
  cdnHostname: z.string().trim().max(200).optional().default('')
})

/** يختبر الاعتمادات عند Bunny ثم يحفظها مختومة؛ لا تعود إلى المتصفح بعدها */
export async function saveBunnyCredentialsAction(_prev: ActionResult<{ totalItems: number }> | null, fd: FormData): Promise<ActionResult<{ totalItems: number }>> {
  const parsed = credsSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const t = await testBunny(parsed.data)
    const db = await getDb()
    await saveBunnyCredentials(db, parsed.data)
    await writeAudit(db, { actorUserId: actor.userId, action: 'video.bunny_save', entityType: 'settings', entityId: null, newValue: { libraryId: parsed.data.libraryId, cdnHostname: parsed.data.cdnHostname } })
    return { totalItems: t.totalItems }
  })
  if (r.ok) revalidatePath('/admin/settings/video')
  return r
}

export async function clearBunnyCredentialsAction(): Promise<ActionResult> {
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await clearBunnyCredentials(db)
    await writeAudit(db, { actorUserId: actor.userId, action: 'video.bunny_clear', entityType: 'settings', entityId: null })
    return undefined
  })
  if (r.ok) revalidatePath('/admin/settings/video')
  return r
}

export async function testBunnyAction(): Promise<ActionResult<{ totalItems: number }>> {
  return runAction(async () => {
    await requireRole('SUPER_ADMIN')
    const creds = await getBunnyCredentials(await getDb())
    if (!creds) throw new AppError('BUNNY_NOT_CONFIGURED')
    const t = await testBunny(creds)
    return { totalItems: t.totalItems }
  })
}

const MAX_SERVER_UPLOAD = 200 * 1024 * 1024

/**
 * رفع فيديو صغير إلى Bunny من نموذج خادمي (حتى 200 MB): ينشئ الكيان ثم يرفع الملف كاملاً.
 * الملفات الأكبر تُرفع من لوحة Bunny ثم يُلصق المعرّف في نموذج المحتوى.
 */
export async function uploadBunnyVideoAction(_prev: ActionResult<{ videoId: string }> | null, fd: FormData): Promise<ActionResult<{ videoId: string }>> {
  const file = fd.get('file')
  const title = String(fd.get('title') ?? '').trim()
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: { code: 'VALIDATION', message: 'اختر ملف فيديو', fieldErrors: { file: 'اختر ملف فيديو' } } }
  if (file.size > MAX_SERVER_UPLOAD) return { ok: false, error: { code: 'FILE_TOO_LARGE', message: 'الملف أكبر من 200 MB — ارفعه من لوحة Bunny ثم الصق المعرّف.' } }
  if (!file.type.startsWith('video/')) return { ok: false, error: { code: 'FILE_TYPE_NOT_ALLOWED', message: 'الملف ليس فيديو.' } }
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN', 'TEACHER')
    const db = await getDb()
    const creds = await getBunnyCredentials(db)
    if (!creds) throw new AppError('BUNNY_NOT_CONFIGURED')
    const { videoId } = await createVideo(creds, title || file.name)
    await uploadVideoBytes(creds, videoId, new Uint8Array(await file.arrayBuffer()))
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'video.bunny_upload', entityType: 'bunny_video', entityId: null, newValue: { videoId, title: title || file.name, size: file.size } })
    return { videoId }
  })
  return r
}
