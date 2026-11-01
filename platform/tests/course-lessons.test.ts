/**
 * تبسيط المنصة (1 نوفمبر 2026): دروس الدورة من شاشة واحدة، رافع المحتوى المقيَّد بدوراته،
 * إخفاء فيديوهات يوتيوب العامة عن التلميذ. قاعدة PGlite في الذاكرة وبيانات وهمية.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, content, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { buildCourseSections } from '@/server/lib/course-sections'
import { AppError } from '@/server/lib/errors'
import { listStudentLessonsOrganized } from '@/server/services/academy-catalog.service'
import { createContent } from '@/server/services/content.service'
import { listCourseLessons, moveCourseLesson, saveCourseLesson, setCourseLessonPublished } from '@/server/services/course-lessons.service'
import { assertCourseEditor, createContentUploader, listEditableCourses, setUploaderCourses } from '@/server/services/course-staff.service'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let workspaceId: string
let uploader: Actor
let courseA: string
let courseB: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

const pdf = async (by: Actor, bytes = '%PDF-1.4\n%test\n') => (await uploadFile(h.db, by, { originalName: 'درس.pdf', mimeType: 'application/pdf', bytes: Buffer.from(bytes) })).id
const yt = (url = 'https://youtu.be/dQw4w9WgXcQ') => ({ provider: 'YOUTUBE' as const, url })

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الدورة')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  courseA = (await createCourse(h.db, admin, { title: 'دورة أ', workspaceId, season: '2026/2027', status: 'PUBLISHED', priceDzd: 3000 })).id
  courseB = (await createCourse(h.db, admin, { title: 'دورة ب', workspaceId, season: '2026/2027', status: 'PUBLISHED' })).id
  const { userId } = await createContentUploader(h.db, admin, { email: 'up@example.com', password: 'Upload@12345', fullName: 'رافع المحتوى', phone: '0550000001', courseIds: [courseA] })
  uploader = { userId, role: 'CONTENT_UPLOADER', fullName: 'رافع المحتوى', email: 'up@example.com', workspaceId: null, teacherId: null, studentId: null }
})

afterAll(async () => {
  await h.close()
})

describe('رافع المحتوى', () => {
  it('يرى ويعدّل دورته المسندة فقط؛ غيرها كأنها غير موجودة', async () => {
    expect((await listEditableCourses(h.db, uploader)).map((c) => c.id)).toEqual([courseA])
    await expect(assertCourseEditor(h.db, uploader, courseA)).resolves.toMatchObject({ id: courseA })
    await expectCode(() => assertCourseEditor(h.db, uploader, courseB), 'COURSE_NOT_FOUND')
    await expectCode(() => saveCourseLesson(h.db, uploader, courseB, null, { title: 'تسلل', pdfFileId: null, video: yt(), publish: true }), 'COURSE_NOT_FOUND')
  })

  it('سحب الإسناد أو إيقاف الحساب يقطع الوصول فورًا', async () => {
    await setUploaderCourses(h.db, admin, uploader.userId, [courseB])
    await expectCode(() => assertCourseEditor(h.db, uploader, courseA), 'COURSE_NOT_FOUND')
    await setUploaderCourses(h.db, admin, uploader.userId, [courseA])
    await h.db.update(users).set({ status: 'DISABLED' }).where(eq(users.id, uploader.userId))
    await expectCode(() => assertCourseEditor(h.db, uploader, courseA), 'COURSE_NOT_FOUND')
    await h.db.update(users).set({ status: 'ACTIVE' }).where(eq(users.id, uploader.userId))
  })

  it('لا يربط ملفًّا رفعه غيره، ولا يدير الإسناد', async () => {
    const adminPdf = await pdf(admin)
    await expectCode(() => saveCourseLesson(h.db, uploader, courseA, null, { title: 'ملف غيري', pdfFileId: adminPdf, video: null, publish: true }), 'LESSON_PDF_INVALID')
    await expectCode(() => setUploaderCourses(h.db, uploader, uploader.userId, [courseB]), 'FORBIDDEN')
  })
})

describe('دروس الدورة', () => {
  it('درس بـPDF وفيديو يُنشر ويُسجَّل؛ الدرس الفارغ لا يُنشر لكن يُحفظ مسودة', async () => {
    const id = await pdf(admin)
    const l = await saveCourseLesson(h.db, admin, courseA, null, { title: 'الدرس 1 — المقدمة', pdfFileId: id, video: yt(), publish: true })
    expect(l.type).toBe('LESSON')
    expect(l.fileId).toBe(id)
    expect(l.youtubeId).toBe('dQw4w9WgXcQ')
    expect(l.visibility).toBe('GROUP_ONLY')
    await expectCode(() => saveCourseLesson(h.db, admin, courseA, null, { title: 'فارغ', pdfFileId: null, video: null, publish: true }), 'LESSON_EMPTY')
    const draft = await saveCourseLesson(h.db, admin, courseA, null, { title: 'مسودة فارغة', pdfFileId: null, video: null, publish: false })
    expect(draft.publishedAt).toBeNull()
    await expectCode(() => setCourseLessonPublished(h.db, admin, courseA, draft.id, true), 'LESSON_EMPTY')
    const logs = await h.db.select().from(auditLogs).where(eq(auditLogs.entityId, l.id))
    expect(logs.some((x) => x.action === 'course.lesson_create')).toBe(true)
  })

  it('PDF مزيّف (ليس %PDF) وفيديو Bunny بلا ضبط الخدمة يُرفضان برسالة واضحة', async () => {
    const fake = await pdf(admin, 'not a pdf at all')
    await expectCode(() => saveCourseLesson(h.db, admin, courseA, null, { title: 'مزيّف', pdfFileId: fake, video: null, publish: true }), 'LESSON_PDF_INVALID')
    await expectCode(() => saveCourseLesson(h.db, admin, courseA, null, { title: 'بني', pdfFileId: null, video: { provider: 'BUNNY', bunnyVideoId: '0b0e2c2a-1111-4222-8333-444455556666' }, publish: true }), 'BUNNY_NOT_CONFIGURED')
    await expectCode(() => saveCourseLesson(h.db, admin, courseA, null, { title: 'بني خطأ', pdfFileId: null, video: { provider: 'BUNNY', bunnyVideoId: 'bad' }, publish: true }), 'BUNNY_VIDEO_NOT_FOUND')
  })

  it('رافع المحتوى ينشر درس دورته فورًا، والترتيب اليدوي يحكم صفحة التلميذ', async () => {
    const second = await saveCourseLesson(h.db, uploader, courseA, null, { title: 'درس رافع المحتوى', pdfFileId: null, video: yt('https://www.youtube.com/watch?v=abcdefghijk'), publish: true })
    expect(second.publishedAt).not.toBeNull()
    let { lessons } = await listCourseLessons(h.db, uploader, courseA)
    expect(lessons.at(-1)!.id).toBe(second.id)
    await moveCourseLesson(h.db, uploader, courseA, second.id, 'up')
    ;({ lessons } = await listCourseLessons(h.db, uploader, courseA))
    expect(lessons.findIndex((x) => x.id === second.id)).toBe(lessons.length - 2)
    expect(lessons.every((x, i) => x.position === i + 1)).toBe(true)
    const sections = buildCourseSections(lessons.filter((x) => x.publishedAt).map((x) => ({ ...x, href: '' })))
    const order = sections.flatMap((s) => s.items.map((i) => i.id))
    expect(order.indexOf(second.id)).toBeLessThan(order.length)
  })
})

describe('حساب التلميذ', () => {
  it('فيديوهات يوتيوب العامة مخفية، ودرس دورته (ولو بيوتيوب) يبقى ظاهرًا', async () => {
    const pub = await createContent(h.db, teacher, { type: 'VIDEO', title: 'فيديو يوتيوب عام', visibility: 'PUBLIC', externalUrl: 'https://youtu.be/zzzzzzzzzzz', videoProvider: 'YOUTUBE', publish: true })
    const stu = await makeStudent(h.db, 'تلميذ مشترك')
    await enrollStudent(h.db, admin, { courseId: courseA, studentId: stu.studentId!, source: 'MANUAL' })
    const ids = (await listStudentLessonsOrganized(h.db, stu)).flatMap((s) => s.lessons.map((l) => l.id))
    expect(ids).not.toContain(pub.id)
    const courseLesson = (await h.db.select({ id: content.id }).from(content).where(eq(content.title, 'درس رافع المحتوى')))[0]!.id
    expect(ids).toContain(courseLesson)
  })
})
