/**
 * «اليوم» (3 نوفمبر 2026): أين توقّف التلميذ في دورته، وواجباته المنتظرة، وحاله في PLAY.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { mediaViews } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createAssignment, submitAnswer } from '@/server/services/assignments.service'
import { createContent } from '@/server/services/content.service'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import { studentToday } from '@/server/services/student-today.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let newcomer: Actor
let course: Awaited<ReturnType<typeof createCourse>>
const ids: string[] = []

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-today-${Date.now()}`
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ اليوم')
  student = await makeStudent(h.db, 'سارة بن علي')
  newcomer = await makeStudent(h.db, 'تلميذ جديد')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  course = await createCourse(h.db, admin, { title: 'دورة الأدب العربي', workspaceId, season: '2026/2027', status: 'DRAFT' })
  await publishLegacyCourse(h.db, course.id)
  await enrollStudent(h.db, admin, { courseId: course.id, studentId: student.studentId!, source: 'MANUAL' })
  for (const title of ['الحصة 1', 'الحصة 2', 'الحصة 3']) {
    const c = await createContent(h.db, teacher, { type: 'VIDEO', title, visibility: 'GROUP_ONLY', groupIds: [course.groupId], videoProvider: 'YOUTUBE', externalUrl: 'https://youtu.be/dQw4w9WgXcQ', publish: true })
    ids.push(c.id)
  }
})
afterAll(async () => h.close())

describe('اليوم — الدورات', () => {
  it('لم يبدأ: الحصة الأولى، وتقدّم صفر', async () => {
    const t = await studentToday(h.db, student)
    expect(t.hasCourses).toBe(true)
    expect(t.courses).toHaveLength(1)
    const c = t.courses[0]!
    expect(c).toMatchObject({ title: 'دورة الأدب العربي', total: 3, seen: 0, needsTerms: false, href: `/student/courses/${course.slug}` })
    expect(c.next).toMatchObject({ started: false })
    expect(c.next!.title).toBe('الحصة 1')
  })

  it('شاهد الأولى: التالي هو الثانية، ثم بعد الثالثة يعود إلى ما فاته', async () => {
    await h.db.insert(mediaViews).values({ contentId: ids[0]!, userId: student.userId, studentId: student.studentId, viewerKey: 'web-a', startedAt: new Date('2026-11-01T10:00:00Z'), lastSeenAt: new Date('2026-11-01T10:30:00Z'), secondsWatched: 1800 })
    let c = (await studentToday(h.db, student)).courses[0]!
    expect(c).toMatchObject({ seen: 1, next: { started: true } })
    expect(c.next!.title).toBe('الحصة 2')

    // قفز إلى الثالثة: التالي بعدها لا شيء، فنعود إلى أول ما لم يشاهده (الثانية)
    await h.db.insert(mediaViews).values({ contentId: ids[2]!, userId: student.userId, studentId: student.studentId, viewerKey: 'web-a', startedAt: new Date('2026-11-02T10:00:00Z'), lastSeenAt: new Date('2026-11-02T10:30:00Z'), secondsWatched: 900 })
    c = (await studentToday(h.db, student)).courses[0]!
    expect(c.seen).toBe(2)
    expect(c.next!.title).toBe('الحصة 2')

    await h.db.insert(mediaViews).values({ contentId: ids[1]!, userId: student.userId, studentId: student.studentId, viewerKey: 'web-a', startedAt: new Date('2026-11-03T10:00:00Z'), lastSeenAt: new Date('2026-11-03T10:30:00Z'), secondsWatched: 900 })
    c = (await studentToday(h.db, student)).courses[0]!
    expect(c).toMatchObject({ seen: 3, total: 3, next: null })
  })

  it('مشاهدات تلميذ آخر لا تُحسب له', async () => {
    const t = await studentToday(h.db, newcomer)
    expect(t).toMatchObject({ hasCourses: false, courses: [], assignments: [] })
  })
})

describe('اليوم — الواجبات و PLAY', () => {
  it('الواجبات غير المسلَّمة فقط، الأقرب موعدًا أولًا، والمنتهية لا تظهر', async () => {
    const now = new Date()
    const later = await createAssignment(h.db, teacher, { title: 'واجب بعيد', groupIds: [course.groupId], studentIds: [], dueAt: new Date(now.getTime() + 5 * 86_400_000) })
    const soon = await createAssignment(h.db, teacher, { title: 'واجب قريب', groupIds: [course.groupId], studentIds: [], dueAt: new Date(now.getTime() + 86_400_000) })
    const done = await createAssignment(h.db, teacher, { title: 'واجب سلّمته', groupIds: [course.groupId], studentIds: [], dueAt: new Date(now.getTime() + 2 * 86_400_000) })
    await createAssignment(h.db, teacher, { title: 'واجب فات موعده', groupIds: [course.groupId], studentIds: [], dueAt: new Date(now.getTime() - 86_400_000) })
    await submitAnswer(h.db, student, done.id, 'إجابتي')
    const t = await studentToday(h.db, student, now)
    expect(t.assignments.map((a) => a.id)).toEqual([soon.id, later.id])
  })

  it('PLAY: لا تحدي منجز ولا أخطاء مستحقة لتلميذ جديد', async () => {
    const { play } = await studentToday(h.db, newcomer)
    expect(play).toMatchObject({ dailyDone: false, mistakesDue: 0, streakDays: 0, xpTotal: 0 })
    expect(typeof play.levelTitle).toBe('string')
  })
})
