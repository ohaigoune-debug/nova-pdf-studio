import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, groupStudents, groups, jobs, liveSessions, notifications, subjects } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createContent } from '@/server/services/content.service'
import {
  acceptTerms,
  courseHome,
  createCourse,
  endOfDayDz,
  enrollStudent,
  ensureCourseExpiryScheduled,
  expireDueEnrollments,
  getCourseAdmin,
  linkProduct,
  listCoursesAdmin,
  myCourses,
  playHrefForSubjectCode,
  revokeEnrollment,
  runCourseExpiryJob,
  setCourseStatus,
  unlinkProduct,
  updateCourse
} from '@/server/services/courses.service'
import { resolveMediaAccess } from '@/server/services/media.service'
import { createProduct } from '@/server/services/store.service'
import { listStudentFiles } from '@/server/queries/student-extras.queries'
import { uploadFile } from '@/server/services/files.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let other: Actor
let workspaceId: string
let course: Awaited<ReturnType<typeof createCourse>>

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-courses-${Date.now()}`
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الدورات')
  student = await makeStudent(h.db, 'تلميذ الدورة')
  other = await makeStudent(h.db, 'تلميذ خارجي')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  await h.db.insert(subjects).values({ code: 'ARABIC', slug: 'arabic', nameAr: 'اللغة العربية', nameFr: 'Arabe', sortOrder: 1 })
})

afterAll(async () => {
  await h.close()
})

describe('الدورات المدفوعة — الإدارة', () => {
  it('غير المشرف لا ينشئ دورة', async () => {
    await expectCode(() => createCourse(h.db, teacher, { title: 'دورة', workspaceId, season: '2026/2027' }), 'FORBIDDEN')
    await expectCode(() => createCourse(h.db, student, { title: 'دورة', workspaceId, season: '2026/2027' }), 'FORBIDDEN')
  })

  it('إنشاء دورة ينشئ فوجاً خلفياً باسمها في مساحة الأستاذ', async () => {
    const { levelId } = await refIds(h.db)
    const [subj] = await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC'))
    course = await createCourse(h.db, admin, {
      title: 'دورة البكالوريا في الأدب العربي',
      workspaceId,
      levelId,
      subjectId: subj!.id,
      season: '2026/2027',
      plan: 'ANNUAL',
      accessEndsOn: '2027-06-30',
      priceDzd: 4500,
      termsText: '## الشروط\n\n1. لا مشاركة للحساب.\n2. الفيديوهات تختفي بعد البكالوريا.',
      status: 'DRAFT'
    })
    // دورة مدفوعة «قديمة» بلا كتاب مرفق: تُنشر خارج حارس النشر (قاعدة الكتاب الإلزامي تخصّ الجديدة)
    await publishLegacyCourse(h.db, course.id)
    expect(course.slug).toBeTruthy()
    expect(course.termsVersion).toBe(1)
    const [g] = await h.db.select().from(groups).where(eq(groups.id, course.groupId))
    expect(g).toBeTruthy()
    expect(g!.name).toBe('دورة البكالوريا في الأدب العربي')
    expect(g!.workspaceId).toBe(workspaceId)
    expect(g!.teacherId).toBe(teacher.teacherId)
    expect(g!.status).toBe('ACTIVE')
    expect(g!.academicYearId).toBeTruthy()

    const list = await listCoursesAdmin(h.db, admin)
    expect(list.find((c) => c.id === course.id)?.teacherName).toBe('أستاذ الدورات')
  })

  it('تعديل الشروط يرفع رقم النسخة؛ وتغيير العنوان يتبعه اسم الفوج', async () => {
    const updated = await updateCourse(h.db, admin, course.id, { title: 'دورة الأدب العربي — بكالوريا 2027', termsText: '## الشروط (محدّثة)\n\n1. بند جديد.' })
    expect(updated.termsVersion).toBe(2)
    const [g] = await h.db.select({ name: groups.name }).from(groups).where(eq(groups.id, course.groupId))
    expect(g!.name).toBe('دورة الأدب العربي — بكالوريا 2027')
    // تعديل بلا مساس بالشروط لا يرفع النسخة
    const again = await updateCourse(h.db, admin, course.id, { priceDzd: 5000 })
    expect(again.termsVersion).toBe(2)
    course = again
  })

  it('ربط منتج وفكّه، وتفاصيل الإدارة تحمل العدّادات', async () => {
    const p = await createProduct(h.db, admin, { title: 'كتاب وسام التفوق', priceDzd: 2500, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, course.id, p.id)
    await linkProduct(h.db, admin, course.id, p.id) // idempotent
    let d = await getCourseAdmin(h.db, admin, course.id)
    expect(d.products.map((x) => x.productId)).toEqual([p.id])
    expect(d.counts.productsCount).toBe(1)
    await unlinkProduct(h.db, admin, course.id, p.id)
    d = await getCourseAdmin(h.db, admin, course.id)
    expect(d.products).toHaveLength(0)
    await expectCode(() => getCourseAdmin(h.db, admin, '00000000-0000-0000-0000-000000000000'), 'COURSE_NOT_FOUND')
  })
})

describe('الاشتراكات', () => {
  let contentId: string

  it('التفعيل idempotent ويضيف عضوية الفوج؛ التاريخ الافتراضي = آخر يوم للوصول', async () => {
    const e1 = await enrollStudent(h.db, admin, { courseId: course.id, studentId: student.studentId!, source: 'MANUAL' })
    expect(e1.status).toBe('ACTIVE')
    expect(e1.expiresAt?.toISOString()).toBe(endOfDayDz('2027-06-30').toISOString())
    const e2 = await enrollStudent(h.db, null, { courseId: course.id, studentId: student.studentId!, source: 'BOOK_ORDER' })
    expect(e2.id).toBe(e1.id)
    expect(e2.source).toBe('MANUAL') // لم يتغيّر: كان نشطاً
    const rows = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))
    expect(rows).toHaveLength(1)
    const [gs] = await h.db.select().from(groupStudents).where(and(eq(groupStudents.groupId, course.groupId), eq(groupStudents.studentId, student.studentId!)))
    expect(gs?.status).toBe('ACTIVE')
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(n.some((x) => x.type === 'ENROLLED' && x.link === `/student/courses/${course.slug}`)).toBe(true)
  })

  it('المحتوى الموجّه إلى فوج الدورة يصبح مرئياً للمشترك، ويختفي بعد الإلغاء', async () => {
    const pdf = await uploadFile(h.db, teacher, { originalName: 'summary.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 test') })
    const c = await createContent(h.db, teacher, { type: 'PDF', title: 'ملخص الدورة', visibility: 'GROUP_ONLY', groupIds: [course.groupId], fileId: pdf.id, publish: true })
    contentId = c.id
    const v = await createContent(h.db, teacher, { type: 'VIDEO', title: 'حصة 1', visibility: 'GROUP_ONLY', groupIds: [course.groupId], videoProvider: 'YOUTUBE', externalUrl: 'https://youtu.be/dQw4w9WgXcQ', publish: true })
    expect(v.id).toBeTruthy()

    const files = await listStudentFiles(h.db, student)
    expect(files.some((f) => f.id === contentId)).toBe(true)
    await expect(resolveMediaAccess(h.db, student, contentId)).resolves.toBeTruthy()
    await expectCode(() => resolveMediaAccess(h.db, other, contentId), 'CONTENT_NOT_FOUND')

    const mine = await myCourses(h.db, student)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.videos).toBe(1)
    expect(mine[0]!.lessons).toBe(1)
    expect(mine[0]!.termsAccepted).toBe(false)
    expect(mine[0]!.status).toBe('ACTIVE')
  })

  it('courseHome يطلب قبول الشروط أولاً ثم يعيد الأقسام', async () => {
    await expectCode(() => courseHome(h.db, other, course.slug), 'COURSE_NOT_FOUND')
    await expectCode(() => courseHome(h.db, student, 'no-such-course'), 'COURSE_NOT_FOUND')
    const gate = await courseHome(h.db, student, course.slug)
    expect(gate.needsTerms).toBe(true)
    if (gate.needsTerms) expect(gate.course.termsVersion).toBe(2)

    await expectCode(() => acceptTerms(h.db, other, course.id), 'COURSE_NOT_FOUND')
    await acceptTerms(h.db, student, course.id)
    const [e] = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))
    expect(e!.acceptedTermsVersion).toBe(2)

    await h.db.insert(liveSessions).values({ courseId: course.id, title: 'حصة مباشرة', startsAt: new Date(Date.now() + 3600_000), status: 'SCHEDULED' })
    await h.db.insert(liveSessions).values({ courseId: course.id, title: 'حصة قديمة', startsAt: new Date(Date.now() - 3600_000), status: 'ENDED' })

    const home = await courseHome(h.db, student, course.slug)
    expect(home.needsTerms).toBe(false)
    if (!home.needsTerms) {
      expect(home.videos.map((v) => v.title)).toEqual(['حصة 1'])
      expect(home.lessons.map((l) => l.title)).toEqual(['ملخص الدورة'])
      expect(home.nextLive?.title).toBe('حصة مباشرة')
      expect(home.upcoming).toHaveLength(1)
      expect(home.playHref).toBe('/student/play/subject/AR')
      expect(home.classroomHref).toBe(`/student/classroom?group=${course.groupId}`)
    }
    const mine = await myCourses(h.db, student)
    expect(mine[0]!.termsAccepted).toBe(true)
    expect(mine[0]!.nextLive?.title).toBe('حصة مباشرة')
    expect(playHrefForSubjectCode('UNKNOWN')).toBe('/student/play')
  })

  it('تحديث الشروط من جديد يعيد طلب الموافقة', async () => {
    await updateCourse(h.db, admin, course.id, { termsText: '## نسخة 3' })
    const gate = await courseHome(h.db, student, course.slug)
    expect(gate.needsTerms).toBe(true)
    await acceptTerms(h.db, student, course.id)
    expect((await courseHome(h.db, student, course.slug)).needsTerms).toBe(false)
  })

  it('الإلغاء يزيل عضوية الفوج فيختفي المحتوى؛ وإعادة التفعيل تعيدها', async () => {
    const [e] = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))
    await expectCode(() => revokeEnrollment(h.db, teacher, e!.id, 'x'), 'FORBIDDEN')
    await revokeEnrollment(h.db, admin, e!.id, 'مشاركة الحساب')
    const [gs] = await h.db.select().from(groupStudents).where(and(eq(groupStudents.groupId, course.groupId), eq(groupStudents.studentId, student.studentId!)))
    expect(gs?.status).toBe('INACTIVE')
    await expectCode(() => resolveMediaAccess(h.db, student, contentId), 'CONTENT_NOT_FOUND')
    expect((await listStudentFiles(h.db, student)).some((f) => f.id === contentId)).toBe(false)
    await expectCode(() => courseHome(h.db, student, course.slug), 'COURSE_NOT_ENROLLED')
    expect(await myCourses(h.db, student)).toHaveLength(0) // الملغى لا يُعرض

    const re = await enrollStudent(h.db, null, { courseId: course.id, studentId: student.studentId!, source: 'GIFT' })
    expect(re.id).toBe(e!.id)
    expect(re.status).toBe('ACTIVE')
    expect(re.source).toBe('GIFT')
    const [gs2] = await h.db.select().from(groupStudents).where(eq(groupStudents.id, gs!.id))
    expect(gs2?.status).toBe('ACTIVE')
    await expect(resolveMediaAccess(h.db, student, contentId)).resolves.toBeTruthy()
  })

  it('expireDueEnrollments ينهي المتأخّر فقط ويُشعر التلميذ', async () => {
    const c2 = await createCourse(h.db, admin, { title: 'دورة قصيرة', workspaceId, season: '2026/2027', plan: 'TERM', status: 'PUBLISHED' })
    const past = await enrollStudent(h.db, admin, { courseId: c2.id, studentId: other.studentId!, source: 'MANUAL', expiresAt: new Date(Date.now() - 60_000) })
    const future = await enrollStudent(h.db, admin, { courseId: c2.id, studentId: student.studentId!, source: 'MANUAL', expiresAt: new Date(Date.now() + 86_400_000) })
    expect(await expireDueEnrollments(h.db)).toBe(1)
    expect(await expireDueEnrollments(h.db)).toBe(0)
    const [p] = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.id, past.id))
    const [f] = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.id, future.id))
    expect(p!.status).toBe('EXPIRED')
    expect(f!.status).toBe('ACTIVE')
    const [gs] = await h.db.select().from(groupStudents).where(and(eq(groupStudents.groupId, c2.groupId), eq(groupStudents.studentId, other.studentId!)))
    expect(gs?.status).toBe('INACTIVE')
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, other.userId))
    expect(n.some((x) => x.title.includes('انتهى اشتراكك'))).toBe(true)
    // المنتهي يظهر في «دوراتي» رمادياً
    const mine = await myCourses(h.db, other)
    expect(mine.find((m) => m.id === c2.id)?.status).toBe('EXPIRED')
    await expectCode(() => courseHome(h.db, other, c2.slug), 'COURSE_NOT_ENROLLED')
    // الاشتراك بلا تاريخ انتهاء لا يُمسّ
    await setCourseStatus(h.db, admin, c2.id, 'ARCHIVED')
    expect((await listCoursesAdmin(h.db, admin)).find((c) => c.id === c2.id)?.status).toBe('ARCHIVED')
  })

  it('مهمة COURSE_EXPIRY تُجدوَل مرة في اليوم وتعمل', async () => {
    expect(await ensureCourseExpiryScheduled(h.db)).toBe(true)
    expect(await ensureCourseExpiryScheduled(h.db)).toBe(false)
    const [j] = await h.db.select().from(jobs).where(eq(jobs.type, 'COURSE_EXPIRY'))
    expect(j?.status).toBe('QUEUED')
    expect(await runCourseExpiryJob(h.db)).toEqual({ expired: 0 })
  })
})
