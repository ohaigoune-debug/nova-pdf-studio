/**
 * عزل محتوى الدورات (سؤال المالك 21 نوفمبر 2026): المشترك في دورة لا يرى دروس دورة أخرى ولا ملفاتها،
 * لا في «دروسي» ولا في «الملفات» ولا بفتح الدرس مباشرة بالرابط؛ وغير المشترك لا يرى شيئًا منها.
 * وقراره في اليوم نفسه: دروس الدورة تظهر في صفحة الدورة («دوراتي») وحدها، و«دروسي» و«الملفات» للمجاني.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, groupStudents } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { listStudentFiles, listStudentContent } from '@/server/queries/student-extras.queries'
import { listStudentLessonsOrganized } from '@/server/services/academy-catalog.service'
import { getContentForStudent } from '@/server/services/content.service'
import { saveCourseLesson } from '@/server/services/course-lessons.service'
import { createGroup } from '@/server/services/groups.service'
import { createContent } from '@/server/services/content.service'
import { courseHome, createCourse, enrollStudent } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let inA: Actor
let none: Actor
let workspaceId = ''
const lesson = { A: { id: '', slug: '', fileId: '' }, B: { id: '', slug: '', fileId: '' } }
let courseSlugA = ''

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ'))
  for (const k of ['A', 'B'] as const) {
    const created = await createCourse(h.db, admin, { title: `دورة ${k}`, workspaceId, season: '2026/2027', status: 'PUBLISHED', priceDzd: 3000 })
    const courseId = created.id
    if (k === 'A') courseSlugA = created.slug
    const fileId = (await uploadFile(h.db, admin, { originalName: `ملف ${k}.pdf`, mimeType: 'application/pdf', bytes: Buffer.from(`%PDF-1.4\n%${k}\n`) })).id
    const l = await saveCourseLesson(h.db, admin, courseId, null, { title: `درس الدورة ${k}`, pdfFileId: fileId, video: null, publish: true })
    lesson[k] = { id: l.id, slug: l.slug, fileId }
    if (k === 'A') {
      inA = await makeStudent(h.db, 'مشترك في أ فقط')
      await enrollStudent(h.db, admin, { courseId, studentId: inA.studentId!, source: 'MANUAL' })
    }
  }
  none = await makeStudent(h.db, 'غير مشترك')
})

afterAll(async () => {
  await h.close()
})

const lessonIds = async (a: Actor) => (await listStudentLessonsOrganized(h.db, a)).flatMap((s) => s.lessons.map((l) => l.id))
const fileContentIds = async (a: Actor) => (await listStudentFiles(h.db, a)).map((f) => f.id)
const contentIds = async (a: Actor) => (await listStudentContent(h.db, a)).map((c) => c.id)
const opens = async (a: Actor, slug: string) => getContentForStudent(h.db, a, slug).then(() => true, (e) => (e instanceof AppError ? e.code : String(e)))

describe('عزل محتوى الدورات', () => {
  it('المشترك في أ: درس أ في صفحة دورته فقط، ولا أثر لدرس ب في أي مكان', async () => {
    const home = await courseHome(h.db, inA, courseSlugA)
    if (home.needsTerms) throw new Error('شروط الدورة غير متوقعة في الاختبار')
    const inCourse = [...home.lessons, ...home.videos].map((c) => c.id)
    expect(inCourse).toContain(lesson.A.id)
    expect(inCourse).not.toContain(lesson.B.id)
    // «دروسي» و«الملفات» واقتراحات «اليوم»: المجاني فقط، لا دروس الدورات (ولا دورته هو)
    for (const ids of [await lessonIds(inA), await fileContentIds(inA), await contentIds(inA)]) {
      expect(ids).not.toContain(lesson.A.id)
      expect(ids).not.toContain(lesson.B.id)
    }
  })

  it('«دروسي» تبقى للمجاني ولما وُجِّه للتلميذ من فوجه العادي (غير الدورة)', async () => {
    const free = await createContent(h.db, admin, { type: 'PDF', title: 'ملف مجاني للجميع', visibility: 'PUBLIC', fileId: lesson.A.fileId, publish: true })
    const g = await createGroup(h.db, admin, { name: 'فوج حضوري' }, workspaceId)
    await h.db.insert(groupStudents).values({ workspaceId, groupId: g.id, studentId: inA.studentId!, status: 'ACTIVE' })
    const forGroup = await createContent(h.db, admin, { type: 'PDF', title: 'ملف الفوج الحضوري', visibility: 'GROUP_ONLY', groupIds: [g.id], fileId: lesson.B.fileId, publish: true })
    const lessons = await lessonIds(inA)
    expect(lessons).toEqual(expect.arrayContaining([free.id, forGroup.id]))
    expect(await fileContentIds(inA)).toEqual(expect.arrayContaining([free.id, forGroup.id]))
    expect(await lessonIds(none)).toContain(free.id)
    expect(await lessonIds(none)).not.toContain(forGroup.id)
  })

  it('فتح درس ب مباشرة بالرابط مرفوض للمشترك في أ، ودرس أ يفتح', async () => {
    expect(await opens(inA, lesson.A.slug)).toBe(true)
    expect(await opens(inA, lesson.B.slug)).not.toBe(true)
  })

  it('غير المشترك في أي دورة لا يرى شيئًا من الدورتين ولا يفتحهما', async () => {
    for (const ids of [await lessonIds(none), await fileContentIds(none), await contentIds(none)]) {
      expect(ids).not.toContain(lesson.A.id)
      expect(ids).not.toContain(lesson.B.id)
    }
    expect(await opens(none, lesson.A.slug)).not.toBe(true)
    expect(await opens(none, lesson.B.slug)).not.toBe(true)
  })

  it('انتهاء الاشتراك أو إلغاؤه يُخفي درس أ فورًا', async () => {
    await h.db.update(courseEnrollments).set({ status: 'REVOKED' }).where(eq(courseEnrollments.studentId, inA.studentId!))
    expect(await lessonIds(inA)).not.toContain(lesson.A.id)
    expect(await fileContentIds(inA)).not.toContain(lesson.A.id)
    expect(await opens(inA, lesson.A.slug)).not.toBe(true)
  })
})
