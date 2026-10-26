import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createContent } from '@/server/services/content.service'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import { iosCourseHome, iosLearningHome, iosLesson } from '@/server/services/ios-learning.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let other: Actor
let course: Awaited<ReturnType<typeof createCourse>>
let publicLesson: Awaited<ReturnType<typeof createContent>>
let privateLesson: Awaited<ReturnType<typeof createContent>>

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  other = await makeStudent(h.db)
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  course = await createCourse(h.db, admin, { title: 'دورة iOS', workspaceId, season: '2026/2027', priceDzd: 0 })
  await publishLegacyCourse(h.db, course.id)
  publicLesson = await createContent(h.db, teacher, { title: 'درس عام للآيفون', type: 'LESSON', visibility: 'PUBLIC', body: 'محتوى عام حقيقي', publish: true })
  privateLesson = await createContent(h.db, teacher, { title: 'درس خاص بالاشتراك', type: 'LESSON', visibility: 'GROUP_ONLY', groupIds: [course.groupId], body: 'خاص بالفوج', publish: true })
  await createContent(h.db, teacher, { title: 'مسودة مخفية', type: 'LESSON', visibility: 'PUBLIC', publish: false })
  await enrollStudent(h.db, admin, { studentId: student.studentId!, courseId: course.id, source: 'MANUAL' })
})

afterEach(() => vi.unstubAllEnvs())
afterAll(async () => h.close())

describe('learning-only iOS portal uses existing permissions', () => {
  it('serves published public lessons to guests without enrolling or exposing private content', async () => {
    const home = await iosLearningHome(h.db, null)
    expect(home.courses).toEqual([])
    expect(home.publicLessons.map((item) => item.id)).toEqual([publicLesson.id])
    expect(home.publicLessons[0]?.href).toBe(`/ios/lesson/${encodeURIComponent(publicLesson.slug)}`)
    expect((await iosLesson(h.db, null, publicLesson.slug)).body).toBe('محتوى عام حقيقي')
    await expect(iosLesson(h.db, null, privateLesson.slug)).rejects.toMatchObject({ code: 'CONTENT_NOT_FOUND' })
    await expect(iosCourseHome(h.db, null, course.slug)).rejects.toMatchObject({ code: 'AUTH_REQUIRED' })
  })

  it('reuses the account enrollment and routes lessons to the dedicated shell', async () => {
    const home = await iosLearningHome(h.db, student)
    expect(home.courses).toHaveLength(1)
    expect(home.courses[0]).toMatchObject({ id: course.id, status: 'ACTIVE', href: `/ios/course/${encodeURIComponent(course.slug)}` })
    const detail = await iosCourseHome(h.db, student, course.slug)
    expect(detail.needsTerms).toBe(false)
    if (!detail.needsTerms) expect(detail.lessons[0]?.href).toBe(`/ios/lesson/${encodeURIComponent(privateLesson.slug)}`)
    expect((await iosLesson(h.db, student, privateLesson.slug)).id).toBe(privateLesson.id)
  })

  it('does not give another student access by knowing a course or lesson slug', async () => {
    expect((await iosLearningHome(h.db, other)).courses).toEqual([])
    await expect(iosCourseHome(h.db, other, course.slug)).rejects.toMatchObject({ code: 'COURSE_NOT_FOUND' })
    await expect(iosLesson(h.db, other, privateLesson.slug)).rejects.toMatchObject({ code: 'CONTENT_NOT_FOUND' })
  })

  it('does not allow staff roles to use a student presentation as authorization', async () => {
    for (const actor of [admin, teacher]) {
      await expect(iosLearningHome(h.db, actor)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(iosCourseHome(h.db, actor, course.slug)).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await expect(iosLesson(h.db, actor, publicLesson.slug)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    }
  })

  it('enforces phone verification before fetching account content when a channel is configured', async () => {
    vi.stubEnv('SMS_PROVIDER', 'webhook')
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.invalid/test')
    await expect(iosLearningHome(h.db, student)).rejects.toMatchObject({ code: 'FORBIDDEN', details: { reason: 'PHONE_VERIFICATION_REQUIRED' } })
    await expect(iosCourseHome(h.db, student, course.slug)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(iosLesson(h.db, student, privateLesson.slug)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await h.db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, student.userId))
    expect((await iosLearningHome(h.db, student)).courses).toHaveLength(1)
  })

  it('keeps the existing course terms gate instead of bypassing it', async () => {
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const termsCourse = await createCourse(h.db, admin, { title: 'دورة ذات شروط', workspaceId, season: '2026/2027', termsText: 'شروط حقيقية للدورة' })
    await publishLegacyCourse(h.db, termsCourse.id)
    await enrollStudent(h.db, admin, { studentId: other.studentId!, courseId: termsCourse.id, source: 'MANUAL' })
    const home = await iosCourseHome(h.db, other, termsCourse.slug)
    expect(home).toMatchObject({ needsTerms: true, course: { id: termsCourse.id, termsText: 'شروط حقيقية للدورة' } })
  })

  it('checks expiry on the server for both the course and its lesson without waiting for a cron', async () => {
    await h.db.update(courseEnrollments).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(courseEnrollments.courseId, course.id))
    expect((await iosLearningHome(h.db, student)).courses.find((item) => item.id === course.id)?.status).toBe('EXPIRED')
    await expect(iosCourseHome(h.db, student, course.slug)).rejects.toMatchObject({ code: 'COURSE_NOT_ENROLLED' })
    await expect(iosLesson(h.db, student, privateLesson.slug)).rejects.toMatchObject({ code: 'CONTENT_NOT_FOUND' })
    expect((await iosLesson(h.db, student, publicLesson.slug)).id).toBe(publicLesson.id)
  })
})
