'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { createBunnyUploadTicket, moveCourseLesson, saveCourseLesson, setCourseLessonPublished, type BunnyUploadTicket, type LessonVideoInput } from '@/server/services/course-lessons.service'

/** المشرف ورافع المحتوى فقط؛ الإسناد إلى الدورة يُتحقَّق منه داخل كل خدمة (assertCourseEditor) */
const editor = () => requireRole('SUPER_ADMIN', 'CONTENT_UPLOADER')

function revalidateCourse(courseId: string) {
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath(`/studio/courses/${courseId}`)
  revalidatePath('/student/courses', 'layout')
}

const lessonSchema = z.object({
  courseId: z.string().uuid(),
  lessonId: z.string().uuid().nullable(),
  title: z.string().trim().min(2, 'عنوان الدرس حرفان على الأقل').max(200),
  summary: z.string().trim().max(1000).nullable(),
  body: z.string().trim().max(50_000).nullable(),
  pdfFileId: z.string().uuid().nullable(),
  videoKind: z.enum(['NONE', 'BUNNY', 'YOUTUBE']),
  bunnyVideoId: z.string().trim().max(64),
  youtubeUrl: z.string().trim().max(300),
  publish: z.boolean(),
  allowDownload: z.boolean()
})

/** حفظ الدرس من الشاشة الواحدة: «احفظ وانشر» أو «احفظ مسودة» */
export async function saveCourseLessonAction(_prev: ActionResult<{ id: string; published: boolean }> | null, fd: FormData): Promise<ActionResult<{ id: string; published: boolean }>> {
  const str = (k: string) => String(fd.get(k) ?? '').trim()
  const parsed = lessonSchema.safeParse({
    courseId: str('courseId'),
    lessonId: str('lessonId') || null,
    title: str('title'),
    summary: str('summary') || null,
    body: str('body') || null,
    pdfFileId: str('pdfFileId') || null,
    videoKind: str('videoKind') || 'NONE',
    bunnyVideoId: str('bunnyVideoId'),
    youtubeUrl: str('youtubeUrl'),
    publish: str('intent') === 'publish',
    allowDownload: fd.get('allowDownload') === 'on'
  })
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  if (d.videoKind === 'BUNNY' && !d.bunnyVideoId) return { ok: false, error: { code: 'VALIDATION', message: 'ارفع الفيديو أو الصق معرّفه', fieldErrors: { bunnyVideoId: 'ارفع الفيديو أو الصق معرّفه' } } }
  if (d.videoKind === 'YOUTUBE' && !d.youtubeUrl) return { ok: false, error: { code: 'VALIDATION', message: 'الصق رابط يوتيوب', fieldErrors: { youtubeUrl: 'الصق رابط يوتيوب' } } }
  const video: LessonVideoInput = d.videoKind === 'BUNNY' ? { provider: 'BUNNY', bunnyVideoId: d.bunnyVideoId } : d.videoKind === 'YOUTUBE' ? { provider: 'YOUTUBE', url: d.youtubeUrl } : null
  const r = await runAction(async () => {
    const row = await saveCourseLesson(await getDb(), await editor(), d.courseId, d.lessonId, { title: d.title, summary: d.summary, body: d.body, pdfFileId: d.pdfFileId, video, publish: d.publish, allowDownload: d.allowDownload })
    return { id: row.id, published: Boolean(row.publishedAt) }
  })
  if (r.ok) revalidateCourse(d.courseId)
  return r
}

const ids = z.object({ courseId: z.string().uuid(), lessonId: z.string().uuid() })

export async function moveCourseLessonAction(courseId: string, lessonId: string, direction: 'up' | 'down'): Promise<ActionResult> {
  const parsed = ids.extend({ direction: z.enum(['up', 'down']) }).safeParse({ courseId, lessonId, direction })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await moveCourseLesson(await getDb(), await editor(), parsed.data.courseId, parsed.data.lessonId, parsed.data.direction)
    return undefined
  })
  if (r.ok) revalidateCourse(parsed.data.courseId)
  return r
}

export async function setCourseLessonPublishedAction(courseId: string, lessonId: string, published: boolean): Promise<ActionResult> {
  const parsed = ids.extend({ published: z.boolean() }).safeParse({ courseId, lessonId, published })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    await setCourseLessonPublished(await getDb(), await editor(), parsed.data.courseId, parsed.data.lessonId, parsed.data.published)
    return undefined
  })
  if (r.ok) revalidateCourse(parsed.data.courseId)
  return r
}

/** توقيع رفع فيديو واحد مباشرة إلى Bunny (40 فيديو في الساعة لكل حساب) */
export async function createBunnyUploadAction(courseId: string, title: string): Promise<ActionResult<BunnyUploadTicket>> {
  const parsed = z.object({ courseId: z.string().uuid(), title: z.string().trim().max(200) }).safeParse({ courseId, title })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await editor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'bunny-upload', subject: actor.userId, limit: 40, windowSeconds: 3600 })
    return createBunnyUploadTicket(db, actor, parsed.data.courseId, parsed.data.title)
  })
}
