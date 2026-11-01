/**
 * دروس الدورة من شاشة واحدة (طلب المالك 1 نوفمبر 2026: «لم أعرف من أين أرفع المحتوى»).
 *
 * الدرس = صف content موجَّه لفوج الدورة (GROUP_ONLY) — النموذج القائم نفسه، فلا تتغيّر صلاحيات التلاميذ
 * ولا صفحاتهم: يرى الدرس من يصل إلى فوج الدورة فقط (اشتراك نشط). الجديد:
 *  - ملف PDF وفيديو معًا في الدرس نفسه (fileId = PDF، والفيديو Bunny أو يوتيوب).
 *  - ترتيب يدوي (content.position)؛ الدروس القديمة تأخذ ترتيبها الحالي عند أول تعديل للترتيب.
 *  - يعمل بها المشرف ورافع المحتوى المسند إلى الدورة (assertCourseEditor في كل دالة).
 *  - لا يُنشر درس فارغ: النشر يتطلّب PDF أو فيديو. كل تغيير يُسجَّل (الفاعل، الوقت، الدورة، الدرس، العملية).
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentTargets, files, groupStudents, students } from '@/server/db/schema'
import { BUNNY_TUS_ENDPOINT, bunnyVideoExists, createVideo, getBunnyCredentials, isBunnyVideoId, tusUploadSignature } from '@/server/lib/bunny'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { parseSessionNumber } from '@/server/lib/course-sections'
import { AppError, assertUuid } from '@/server/lib/errors'
import { storage } from '@/server/lib/storage'
import { parseYoutubeId } from '@/server/lib/youtube'
import { assertCourseEditor } from './course-staff.service'
import { notifyMany } from './notifications.service'

type ContentRow = typeof content.$inferSelect
type CourseRow = Awaited<ReturnType<typeof assertCourseEditor>>

export interface CourseLessonItem {
  id: string
  slug: string
  title: string
  type: string
  position: number | null
  publishedAt: Date | null
  createdAt: Date
  fileId: string | null
  fileName: string | null
  fileMime: string | null
  videoProvider: string | null
  bunnyVideoId: string | null
  youtubeId: string | null
}

const LESSON_COLUMNS = {
  id: content.id,
  slug: content.slug,
  title: content.title,
  type: content.type,
  position: content.position,
  publishedAt: content.publishedAt,
  createdAt: content.createdAt,
  fileId: content.fileId,
  fileName: files.originalName,
  fileMime: files.mimeType,
  videoProvider: content.videoProvider,
  bunnyVideoId: content.bunnyVideoId,
  youtubeId: content.youtubeId
}

/** ترتيب العرض: الموضع اليدوي أولًا، ثم (للقديم) رقم الحصة من العنوان، ثم تاريخ النشر/الإنشاء، ثم العنوان */
export function compareLessons(a: Pick<CourseLessonItem, 'position' | 'title' | 'publishedAt' | 'createdAt'>, b: Pick<CourseLessonItem, 'position' | 'title' | 'publishedAt' | 'createdAt'>): number {
  const inf = Number.POSITIVE_INFINITY
  const time = (x: typeof a) => (x.publishedAt ?? x.createdAt).getTime()
  return (a.position ?? inf) - (b.position ?? inf) || (parseSessionNumber(a.title) ?? inf) - (parseSessionNumber(b.title) ?? inf) || time(a) - time(b) || a.title.localeCompare(b.title, 'ar')
}

async function lessonRows(db: Db, groupId: string): Promise<CourseLessonItem[]> {
  const ids = db.select({ id: contentTargets.contentId }).from(contentTargets).where(eq(contentTargets.groupId, groupId))
  const rows = await db.select(LESSON_COLUMNS).from(content).leftJoin(files, eq(files.id, content.fileId)).where(and(inArray(content.id, ids), isNull(content.deletedAt)))
  return rows.sort(compareLessons)
}

export async function listCourseLessons(db: Db, actor: Actor, courseId: string): Promise<{ course: CourseRow; lessons: CourseLessonItem[] }> {
  const course = await assertCourseEditor(db, actor, courseId)
  return { course, lessons: await lessonRows(db, course.groupId) }
}

async function loadLesson(db: Db, course: CourseRow, lessonId: string): Promise<ContentRow> {
  assertUuid(lessonId, 'LESSON_NOT_FOUND')
  const [row] = await db
    .select({ c: content })
    .from(content)
    .innerJoin(contentTargets, and(eq(contentTargets.contentId, content.id), eq(contentTargets.groupId, course.groupId)))
    .where(and(eq(content.id, lessonId), isNull(content.deletedAt)))
    .limit(1)
  if (!row) throw new AppError('LESSON_NOT_FOUND')
  return row.c
}

export interface CourseLessonDetail extends CourseLessonItem {
  summary: string | null
  body: string | null
  allowDownload: boolean
  externalUrl: string | null
  /** فيديو قديم مرفوع ملفًّا (UPLOAD): يبقى كما هو، ولا يُضاف إليه PDF من هنا */
  legacyUploadVideo: boolean
}

export async function getCourseLesson(db: Db, actor: Actor, courseId: string, lessonId: string): Promise<{ course: CourseRow; lesson: CourseLessonDetail }> {
  const course = await assertCourseEditor(db, actor, courseId)
  const c = await loadLesson(db, course, lessonId)
  const [f] = c.fileId ? await db.select({ name: files.originalName, mime: files.mimeType }).from(files).where(eq(files.id, c.fileId)).limit(1) : []
  return {
    course,
    lesson: {
      id: c.id,
      slug: c.slug,
      title: c.title,
      type: c.type,
      position: c.position,
      publishedAt: c.publishedAt,
      createdAt: c.createdAt,
      fileId: c.fileId,
      fileName: f?.name ?? null,
      fileMime: f?.mime ?? null,
      videoProvider: c.videoProvider,
      bunnyVideoId: c.bunnyVideoId,
      youtubeId: c.youtubeId,
      summary: c.summary,
      body: c.body,
      allowDownload: c.allowDownload,
      externalUrl: c.externalUrl,
      legacyUploadVideo: c.videoProvider === 'UPLOAD'
    }
  }
}

export type LessonVideoInput = { provider: 'BUNNY'; bunnyVideoId: string } | { provider: 'YOUTUBE'; url: string } | null

export interface CourseLessonInput {
  title: string
  summary?: string | null
  body?: string | null
  /** ملف PDF مرفوع (READY)؛ null = بلا PDF */
  pdfFileId: string | null
  video: LessonVideoInput
  publish: boolean
  allowDownload?: boolean
}

/** أول بايتات الملف من التخزين (للتحقق من نوعه الحقيقي، لا من النوع الذي صرّح به المتصفح) */
async function fileHead(key: string, n: number): Promise<Buffer> {
  const r = await storage().getRange(key, 0, n - 1)
  const reader = r.stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (total < n) {
    const { done, value } = await reader.read()
    if (done || !value) break
    chunks.push(value)
    total += value.length
  }
  await reader.cancel().catch(() => undefined)
  return Buffer.concat(chunks).subarray(0, n)
}

async function assertPdfFile(db: Db, actor: Actor, fileId: string): Promise<void> {
  assertUuid(fileId, 'LESSON_PDF_INVALID')
  const [f] = await db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1)
  if (!f || f.status !== 'READY' || f.mimeType !== 'application/pdf') throw new AppError('LESSON_PDF_INVALID')
  // رافع المحتوى لا يربط إلا ملفًّا رفعه بنفسه (لا ملفات مساحات أخرى)
  if (actor.role === 'CONTENT_UPLOADER' && f.ownerUserId !== actor.userId) throw new AppError('LESSON_PDF_INVALID')
  let head: Buffer
  try {
    head = await fileHead(f.storageKey, 5)
  } catch {
    throw new AppError('LESSON_PDF_INVALID')
  }
  if (head.toString('latin1') !== '%PDF-') throw new AppError('LESSON_PDF_INVALID')
}

async function videoColumns(db: Db, video: LessonVideoInput, current: ContentRow | null): Promise<Pick<ContentRow, 'videoProvider' | 'youtubeId' | 'bunnyVideoId' | 'externalUrl'>> {
  if (!video) return { videoProvider: null, youtubeId: null, bunnyVideoId: null, externalUrl: null }
  if (video.provider === 'YOUTUBE') {
    const id = parseYoutubeId(video.url ?? '')
    if (!id) throw new AppError('INVALID_YOUTUBE_URL')
    return { videoProvider: 'YOUTUBE', youtubeId: id, bunnyVideoId: null, externalUrl: `https://www.youtube.com/watch?v=${id}` }
  }
  const vid = video.bunnyVideoId.trim().toLowerCase()
  if (!isBunnyVideoId(vid)) throw new AppError('BUNNY_VIDEO_NOT_FOUND')
  // المعرّف نفسه المحفوظ سابقًا لا يُعاد فحصه عند Bunny
  if (!(current?.videoProvider === 'BUNNY' && current.bunnyVideoId === vid)) {
    const creds = await getBunnyCredentials(db)
    if (!creds) throw new AppError('BUNNY_NOT_CONFIGURED')
    if (!(await bunnyVideoExists(creds, vid))) throw new AppError('BUNNY_VIDEO_NOT_FOUND')
  }
  return { videoProvider: 'BUNNY', youtubeId: null, bunnyVideoId: vid, externalUrl: null }
}

/** يعطي كل درس في الدورة موضعًا (1..n) بترتيب العرض الحالي إن كان فيها درس بلا موضع */
async function ensurePositions(db: Db, course: CourseRow): Promise<CourseLessonItem[]> {
  const rows = await lessonRows(db, course.groupId)
  if (rows.every((r, i) => r.position === i + 1)) return rows
  await db.transaction(async (tx) => {
    for (const [i, r] of rows.entries()) if (r.position !== i + 1) await tx.update(content).set({ position: i + 1 }).where(eq(content.id, r.id))
  })
  return rows.map((r, i) => ({ ...r, position: i + 1 }))
}

async function notifyCourseStudents(db: Db, course: CourseRow, lesson: ContentRow): Promise<void> {
  const rows = await db
    .select({ userId: students.userId })
    .from(groupStudents)
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .where(and(eq(groupStudents.groupId, course.groupId), eq(groupStudents.status, 'ACTIVE')))
  await notifyMany(db, rows.map((r) => ({ userId: r.userId, workspaceId: course.workspaceId, type: 'NEW_FILE' as const, title: `درس جديد في «${course.title}»: ${lesson.title}`, link: `/student/lessons/${lesson.slug}` })))
}

function lessonSlug(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'lesson'}-${crypto.randomUUID().slice(0, 6)}`
}

/** إنشاء درس (lessonId = null) أو تعديله — من الشاشة الواحدة */
export async function saveCourseLesson(db: Db, actor: Actor, courseId: string, lessonId: string | null, input: CourseLessonInput): Promise<ContentRow> {
  const course = await assertCourseEditor(db, actor, courseId)
  const current = lessonId ? await loadLesson(db, course, lessonId) : null
  const title = input.title.trim()
  if (title.length < 2 || title.length > 200) throw new AppError('VALIDATION', { field: 'title' })
  const summary = input.summary?.trim().slice(0, 1000) || null
  const body = input.body?.trim().slice(0, 50_000) || null

  // فيديو قديم مرفوع ملفًّا: ملفه هو الفيديو، فلا يُمسّ ولا يُضاف PDF من هنا
  const legacyUpload = current?.videoProvider === 'UPLOAD'
  let media: Partial<ContentRow> = {}
  if (!legacyUpload) {
    if (input.pdfFileId && input.pdfFileId !== current?.fileId) await assertPdfFile(db, actor, input.pdfFileId)
    media = { fileId: input.pdfFileId ?? null, ...(await videoColumns(db, input.video, current)) }
  }
  const hasMedia = legacyUpload ? true : Boolean(media.fileId || media.videoProvider)
  if (input.publish && !hasMedia) throw new AppError('LESSON_EMPTY')

  const now = new Date()
  const publishedAt = input.publish ? (current?.publishedAt ?? now) : null
  let saved: ContentRow
  if (!current) {
    const ordered = await ensurePositions(db, course)
    saved = await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(content)
        .values({
          workspaceId: course.workspaceId,
          authorUserId: actor.userId,
          type: 'LESSON',
          title,
          slug: lessonSlug(title),
          summary,
          body,
          levelId: course.levelId,
          subjectId: course.subjectId,
          visibility: 'GROUP_ONLY',
          publishedAt,
          allowDownload: input.allowDownload ?? false,
          position: ordered.length + 1,
          ...media
        })
        .returning()
      if (!row) throw new AppError('INTERNAL')
      await tx.insert(contentTargets).values({ contentId: row.id, groupId: course.groupId })
      return row
    })
  } else {
    // نوعا PDF وVIDEO القديمان يصيران «درسًا» حين يُعدَّلان هنا (PDF وفيديو معًا)
    const type = !legacyUpload && (current.type === 'PDF' || current.type === 'VIDEO') ? 'LESSON' : current.type
    const [row] = await db
      .update(content)
      .set({ title, summary, body, type, publishedAt, allowDownload: input.allowDownload ?? current.allowDownload, updatedAt: now, ...media })
      .where(eq(content.id, current.id))
      .returning()
    if (!row) throw new AppError('INTERNAL')
    saved = row
  }
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: course.workspaceId,
    action: current ? 'course.lesson_update' : 'course.lesson_create',
    entityType: 'content',
    entityId: saved.id,
    oldValue: current ? { title: current.title, published: Boolean(current.publishedAt), fileId: current.fileId, video: current.videoProvider } : undefined,
    newValue: { courseId: course.id, title, published: Boolean(saved.publishedAt), fileId: saved.fileId, video: saved.videoProvider, bunnyVideoId: saved.bunnyVideoId }
  })
  if (saved.publishedAt && !current?.publishedAt) await notifyCourseStudents(db, course, saved)
  return saved
}

/** نشر/إخفاء درس دون فتح المحرّر (الإخفاء لا يحذف شيئًا) */
export async function setCourseLessonPublished(db: Db, actor: Actor, courseId: string, lessonId: string, published: boolean): Promise<void> {
  const course = await assertCourseEditor(db, actor, courseId)
  const c = await loadLesson(db, course, lessonId)
  if (published === Boolean(c.publishedAt)) return
  if (published && !c.fileId && !c.videoProvider && !c.externalUrl) throw new AppError('LESSON_EMPTY')
  const [row] = await db.update(content).set({ publishedAt: published ? new Date() : null, updatedAt: new Date() }).where(eq(content.id, c.id)).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: published ? 'course.lesson_publish' : 'course.lesson_unpublish', entityType: 'content', entityId: c.id, newValue: { courseId: course.id, title: c.title } })
  if (published && row) await notifyCourseStudents(db, course, row)
}

/** تقديم/تأخير درس خطوة واحدة */
export async function moveCourseLesson(db: Db, actor: Actor, courseId: string, lessonId: string, direction: 'up' | 'down'): Promise<void> {
  const course = await assertCourseEditor(db, actor, courseId)
  await loadLesson(db, course, lessonId)
  const ordered = await ensurePositions(db, course)
  const i = ordered.findIndex((r) => r.id === lessonId)
  const j = direction === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ordered.length) return
  const a = ordered[i]!
  const b = ordered[j]!
  await db.transaction(async (tx) => {
    await tx.update(content).set({ position: b.position }).where(eq(content.id, a.id))
    await tx.update(content).set({ position: a.position }).where(eq(content.id, b.id))
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.lesson_move', entityType: 'content', entityId: lessonId, oldValue: { position: a.position }, newValue: { courseId: course.id, position: b.position } })
}

export interface BunnyUploadTicket {
  endpoint: string
  libraryId: string
  videoId: string
  expires: number
  signature: string
}

/**
 * رفع فيديو مباشرة من المتصفح إلى Bunny (TUS، يستأنف عند الانقطاع، بلا حدّ حجم من خادمنا):
 * الخادم ينشئ كيان الفيديو ويوقّع رفعه وحده لـ6 ساعات. مفتاح API لا يغادر الخادم أبدًا.
 */
export async function createBunnyUploadTicket(db: Db, actor: Actor, courseId: string, title: string, now = Date.now()): Promise<BunnyUploadTicket> {
  const course = await assertCourseEditor(db, actor, courseId)
  const creds = await getBunnyCredentials(db)
  if (!creds) throw new AppError('BUNNY_NOT_CONFIGURED')
  const { videoId } = await createVideo(creds, `${course.title} — ${title.trim() || 'درس'}`.slice(0, 200))
  const expires = Math.floor(now / 1000) + 6 * 3600
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'video.bunny_upload', entityType: 'bunny_video', entityId: null, newValue: { videoId, courseId: course.id, title, direct: true } })
  return { endpoint: BUNNY_TUS_ENDPOINT, libraryId: creds.libraryId, videoId, expires, signature: tusUploadSignature(creds, videoId, expires) }
}
