/** حذف دورة بدل أرشفتها (طلب المالك 22 نوفمبر 2026) */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseEnrollments, courseProducts, courses, groups, liveSessions, products, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { deleteCourse, listCoursesAdmin, myCourses } from '@/server/services/courses.service'
import { createLiveSession } from '@/server/services/live.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let courseId = ''
let sessionId = ''

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin, 'أستاذ الحذف')
  student = await makeStudent(h.db, 'تلميذ الحذف')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
  const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج الحذف' }).returning()
  const [p] = await h.db.insert(products).values({ createdByUserId: admin.userId, workspaceId, slug: 'kitab-hadf', title: 'كتاب', type: 'BOOK', priceDzd: 1000, status: 'PUBLISHED' }).returning()
  const [c] = await h.db.insert(courses).values({ slug: 'dawra-hadf', title: 'دورة للحذف', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 1000, bookProductId: p!.id }).returning()
  courseId = c!.id
  await h.db.insert(courseProducts).values({ courseId, productId: p!.id })
  await h.db.insert(courseEnrollments).values({ courseId, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 })
  sessionId = (await createLiveSession(h.db, admin, { courseId, title: 'حصة', startsAt: new Date(Date.now() + 86_400_000), durationMinutes: 60, provider: 'ZOOM', joinUrl: 'https://zoom.us/j/1' })).id
})

afterAll(async () => {
  await h.close()
})

describe('حذف دورة', () => {
  it('المشرف وحده، وبكتابة «حذف» حرفيًّا', async () => {
    await expect(deleteCourse(h.db, student, courseId, 'حذف')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(deleteCourse(h.db, admin, courseId, 'نعم')).rejects.toMatchObject({ code: 'VALIDATION' })
    expect((await listCoursesAdmin(h.db, admin)).map((c) => c.id)).toContain(courseId)
  })

  it('تختفي من كل مكان، تُسحب اشتراكاتها وتُلغى حصصها وتُفكّ كتبها، ويتحرّر رابطها', async () => {
    expect((await myCourses(h.db, student)).map((c) => c.id)).toContain(courseId)
    expect(await deleteCourse(h.db, admin, courseId, ' حذف ')).toEqual({ revoked: 1 })
    expect((await listCoursesAdmin(h.db, admin)).map((c) => c.id)).not.toContain(courseId)
    expect((await myCourses(h.db, student)).map((c) => c.id)).not.toContain(courseId)
    const [e] = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, courseId))
    expect(e!.status).toBe('REVOKED')
    const [s] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, sessionId))
    expect(s!.status).toBe('CANCELLED')
    expect(await h.db.select().from(courseProducts).where(eq(courseProducts.courseId, courseId))).toEqual([])
    const [c] = await h.db.select().from(courses).where(eq(courses.id, courseId))
    expect(c!.deletedAt).not.toBeNull()
    expect(c!.slug).not.toBe('dawra-hadf')
    expect(c!.bookProductId).toBeNull()
    const audit = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'course.delete'))
    expect(audit).toHaveLength(1)
  })

  it('حذفها مرة ثانية: غير موجودة', async () => {
    await expect(deleteCourse(h.db, admin, courseId, 'حذف')).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' })
  })
})
