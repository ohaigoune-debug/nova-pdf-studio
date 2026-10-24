/**
 * أكاديمية 2027 — اختبارات انحدار: الكتالوج (اكتشاف ≠ وصول)، «دوراتي»، المحتوى المجاني دون فوج،
 * المرشّحات وترتيب المنهاج، والبطاقات الست. قاعدة PGlite في الذاكرة وبيانات وهمية فقط.
 */
import { and, eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, curriculumNodes, groupStudents, levels, notifications, streams, students, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { CATALOG_FORBIDDEN_KEYS, assessmentCards, browseOptions, browseScope, courseLanding, curriculumNodeOptions, listCourseCatalog, listStudentLessonsOrganized, streamFamily } from '@/server/services/academy-catalog.service'
import { createContent, getContentForStudent, updateContent } from '@/server/services/content.service'
import { runCourseAccessMigration, courseHome, createCourse, endOfDayDz, enrollStudent, linkProduct, myCourses, revokeEnrollment, setCourseStatus } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { listResourceCards, practiceCounts, publicResourceFile } from '@/server/services/library.service'
import { resolveMediaAccess } from '@/server/services/media.service'
import { upsertResource } from '@/server/services/resources.service'
import { createProduct } from '@/server/services/store.service'
import { resolveCodes } from '@/server/services/taxonomy.service'
import { listStudentContent, listStudentFiles } from '@/server/queries/student-extras.queries'
import { getCourseAccessMode, reachableGroupIds, setCourseAccessMode } from '@/server/lib/course-access'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let noGroup: Actor // تلميذ بلا أي فوج ولا اشتراك
let member: Actor // تلميذ سيُشترك
let workspaceId: string
let ids: { levelId: string | null; streamId: string | null; subjectId: string | null }
let published: Awaited<ReturnType<typeof createCourse>>
let draft: Awaited<ReturnType<typeof createCourse>>
let archived: Awaited<ReturnType<typeof createCourse>>
let deleted: Awaited<ReturnType<typeof createCourse>>

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = `data/test-uploads-academy-${Date.now()}`
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الأكاديمية')
  noGroup = await makeStudent(h.db, 'تلميذ بلا فوج')
  member = await makeStudent(h.db, 'تلميذ مشترك')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  ids = await resolveCodes(h.db, { level: '3AS', stream: 'SCI', subject: 'ARABIC' })
  expect(ids.levelId && ids.streamId && ids.subjectId).toBeTruthy()
  // ملف الاختبار هذا يفحص النمط الصارم؛ النمط الافتراضي legacy يُختبر في كتلة الترحيل
  await setCourseAccessMode(h.db, 'strict')

  published = await createCourse(h.db, admin, { title: 'دورة الأدب العربي 2027', description: 'وصف تسويقي', workspaceId, levelId: ids.levelId, subjectId: ids.subjectId, streamIds: [ids.streamId!], season: '2026/2027', priceDzd: 4500, accessEndsOn: '2027-06-30', termsText: '## شروط', status: 'DRAFT' })
  await publishLegacyCourse(h.db, published.id)
  published = { ...published, status: 'PUBLISHED' }
  draft = await createCourse(h.db, admin, { title: 'دورة مسودة', workspaceId, season: '2026/2027', status: 'DRAFT' })
  archived = await createCourse(h.db, admin, { title: 'دورة مؤرشفة', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
  await setCourseStatus(h.db, admin, archived.id, 'ARCHIVED')
  deleted = await createCourse(h.db, admin, { title: 'دورة محذوفة', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
  await h.db.update((await import('@/server/db/schema')).courses).set({ deletedAt: new Date() }).where(eq((await import('@/server/db/schema')).courses.id, deleted.id))
})

afterAll(async () => {
  await h.close()
})

describe('1. الكتالوج: نشر دورة يجعلها مرئية لغير المشترك', () => {
  it('المنشورة تظهر لتلميذ بلا اشتراك؛ المسودة والمؤرشفة والمحذوفة لا تظهر', async () => {
    const list = await listCourseCatalog(h.db, noGroup)
    const slugs = list.map((c) => c.slug)
    expect(slugs).toContain(published.slug)
    expect(slugs).not.toContain(draft.slug)
    expect(slugs).not.toContain(archived.slug)
    expect(slugs).not.toContain(deleted.slug)
    const c = list.find((x) => x.slug === published.slug)!
    expect(c.enrollment).toBeNull()
    expect(c.teacherName).toBe('أستاذ الأكاديمية')
    expect(c.priceDzd).toBe(4500)
    expect(c.levelName).toBeTruthy()
    expect(c.subjectName).toBeTruthy()
    expect(c.streamNames.length).toBe(1)
  })

  it('بيانات الكتالوج لا تحمل محتوى ولا ملفات ولا روابط وصول', async () => {
    const [c] = (await listCourseCatalog(h.db, noGroup)).filter((x) => x.slug === published.slug)
    for (const k of CATALOG_FORBIDDEN_KEYS) expect(c).not.toHaveProperty(k)
    expect(JSON.stringify(c)).not.toMatch(/api\/v1\/media|bunny|zoom|youtube|storageKey/i)
    const landing = await courseLanding(h.db, noGroup, published.slug)
    for (const k of CATALOG_FORBIDDEN_KEYS) expect(landing.course).not.toHaveProperty(k)
    expect(landing).not.toHaveProperty('videos')
    expect(landing).not.toHaveProperty('lessons')
    expect(landing.products).toEqual([])
    await expectCode(() => courseLanding(h.db, noGroup, draft.slug), 'COURSE_NOT_FOUND')
    await expectCode(() => courseLanding(h.db, noGroup, 'no-such'), 'COURSE_NOT_FOUND')
  })

  it('المنتج المنشور المرتبط يظهر في صفحة التعريف؛ تصفّح الكتالوج لا يمنح اشتراكاً', async () => {
    const p = await createProduct(h.db, admin, { title: 'الكتاب المرافق', priceDzd: 2500, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, published.id, p.id)
    const landing = await courseLanding(h.db, noGroup, published.slug)
    expect(landing.products.map((x) => x.id)).toEqual([p.id])
    expect(await myCourses(h.db, noGroup)).toHaveLength(0)
    await expectCode(() => courseHome(h.db, noGroup, published.slug), 'COURSE_NOT_FOUND')
  })

  it('المرشّحات: مستوى/شعبة/مادة لا تُسقط الدورات العامة (بلا مستوى أو بكل الشعب)', async () => {
    const other = await resolveCodes(h.db, { level: '3AS', stream: 'LIT', subject: 'MATH' })
    const byStream = await listCourseCatalog(h.db, noGroup, { levelId: ids.levelId, streamId: other.streamId })
    expect(byStream.map((c) => c.slug)).not.toContain(published.slug) // دورة الشعبة العلمية فقط
    const bySci = await listCourseCatalog(h.db, noGroup, { levelId: ids.levelId, streamId: ids.streamId })
    expect(bySci.map((c) => c.slug)).toContain(published.slug)
    const bySubject = await listCourseCatalog(h.db, noGroup, { subjectId: other.subjectId })
    expect(bySubject.map((c) => c.slug)).not.toContain(published.slug)
  })
})

describe('2. «دوراتي» وحقّ الوصول', () => {
  it('غير المشترك لا يقرأ محتوى الدورة ولا يصل إلى وسائطه', async () => {
    const pdf = await uploadFile(h.db, teacher, { originalName: 'paid.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 paid') })
    const paid = await createContent(h.db, teacher, { type: 'PDF', title: 'درس مدفوع', visibility: 'GROUP_ONLY', groupIds: [published.groupId], fileId: pdf.id, publish: true })
    await expectCode(() => getContentForStudent(h.db, noGroup, paid.slug), 'CONTENT_NOT_FOUND')
    await expectCode(() => resolveMediaAccess(h.db, noGroup, paid.id), 'CONTENT_NOT_FOUND')
    expect((await listStudentFiles(h.db, noGroup)).some((f) => f.id === paid.id)).toBe(false)
    expect((await listStudentContent(h.db, noGroup)).some((f) => f.id === paid.id)).toBe(false)
  })

  it('المشترك الساري يرى الدورة في «دوراتي» ويصل إلى محتواها؛ والكتالوج يعلّمها ACTIVE', async () => {
    await enrollStudent(h.db, admin, { courseId: published.id, studentId: member.studentId!, source: 'MANUAL' })
    const mine = await myCourses(h.db, member)
    expect(mine.map((m) => m.id)).toEqual([published.id])
    expect(mine[0]!.status).toBe('ACTIVE')
    expect((await listCourseCatalog(h.db, member)).find((c) => c.id === published.id)?.enrollment).toBe('ACTIVE')
    const gate = await courseHome(h.db, member, published.slug)
    expect(gate.needsTerms).toBe(true) // الشروط قائمة ولم تُقبل بعد
  })

  it('المنتهي والملغى لا يُعرضان نشطين ولا يفتحان المحتوى المدفوع', async () => {
    const short = await createCourse(h.db, admin, { title: 'دورة فصلية', workspaceId, season: '2026/2027', plan: 'TERM', status: 'PUBLISHED' })
    const e = await enrollStudent(h.db, admin, { courseId: short.id, studentId: member.studentId!, source: 'MANUAL', expiresAt: new Date(Date.now() - 1000) })
    expect(e.status).toBe('ACTIVE') // لم تمرّ مهمة الانتهاء بعد، لكن التاريخ مضى
    const mine = await myCourses(h.db, member)
    expect(mine.find((m) => m.id === short.id)?.status).toBe('EXPIRED')
    expect((await listCourseCatalog(h.db, member)).find((c) => c.id === short.id)?.enrollment).toBe('EXPIRED')
    await expectCode(() => courseHome(h.db, member, short.slug), 'COURSE_NOT_ENROLLED')

    await revokeEnrollment(h.db, admin, e.id, 'اختبار')
    expect((await myCourses(h.db, member)).some((m) => m.id === short.id)).toBe(false)
    expect((await listCourseCatalog(h.db, member)).find((c) => c.id === short.id)?.enrollment).toBe('REVOKED')
    await expectCode(() => courseHome(h.db, member, short.slug), 'COURSE_NOT_ENROLLED')
    // الدورة تبقى في الكتالوج (اكتشاف) رغم الإلغاء
    expect((await listCourseCatalog(h.db, member)).some((c) => c.id === short.id)).toBe(true)
  })
})

describe('3. المحتوى المجاني دون فوج', () => {
  it('تلميذ بلا فوج يقرأ المحتوى العام ومحتوى «للتلاميذ» ويصل إلى ملفه؛ ولا يرى GROUP_ONLY', async () => {
    const pdf = await uploadFile(h.db, teacher, { originalName: 'free.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 free') })
    const pub = await createContent(h.db, teacher, { type: 'PDF', title: 'ملخص عام', visibility: 'PUBLIC', fileId: pdf.id, publish: true })
    const stu = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس للتلاميذ', visibility: 'STUDENTS_ONLY', body: 'نص', publish: true })
    const unpublished = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس غير منشور', visibility: 'PUBLIC', body: 'نص', publish: false })
    expect((await getContentForStudent(h.db, noGroup, pub.slug)).id).toBe(pub.id)
    expect((await getContentForStudent(h.db, noGroup, stu.slug)).id).toBe(stu.id)
    await expect(resolveMediaAccess(h.db, noGroup, pub.id)).resolves.toBeTruthy()
    expect((await listStudentFiles(h.db, noGroup)).some((f) => f.id === pub.id)).toBe(true)
    await expectCode(() => getContentForStudent(h.db, noGroup, unpublished.slug), 'CONTENT_NOT_FOUND')
    const sections = await listStudentLessonsOrganized(h.db, noGroup)
    const all = sections.flatMap((s) => s.lessons.map((l) => l.id))
    expect(all).toEqual(expect.arrayContaining([pub.id, stu.id]))
    expect(all).not.toContain(unpublished.id)
  })

  it('الفروض المجانية (موارد عامة) متاحة بلا فوج، وموارد الفوج لا تُكشف', async () => {
    const pub = await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'free-hw-1', title: 'فرض الفصل الأول — عربية', type: 'HOMEWORK', subjectId: ids.subjectId, levelId: ids.levelId, schoolTerm: 1, fileUrl: 'https://example.test/hw1.pdf' })
    const grp = await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'group-hw-1', title: 'فرض خاص بفوج', type: 'HOMEWORK', subjectId: ids.subjectId, levelId: ids.levelId, schoolTerm: 1, accessLevel: 'GROUP', fileUrl: 'https://example.test/g.pdf' })
    const list = await listResourceCards(h.db, { levelId: ids.levelId, subjectId: ids.subjectId, types: ['HOMEWORK'], studentId: noGroup.studentId })
    expect(list.items.map((i) => i.id)).toContain(pub.id)
    expect(list.items.map((i) => i.id)).not.toContain(grp.id)
    await expect(publicResourceFile(h.db, pub.id, 'file', { studentId: noGroup.studentId })).resolves.toMatchObject({ url: 'https://example.test/hw1.pdf' })
    await expectCode(() => publicResourceFile(h.db, grp.id, 'file', { studentId: noGroup.studentId }), 'NOT_FOUND')
  })
})

describe('4. اختيار المستوى والشعبة والمادة', () => {
  it('النطاق من ملف التلميذ افتراضياً، ومن الرابط عند تحديده، ولا يغيّر الملف', async () => {
    await h.db.update(students).set({ levelId: ids.levelId, streamId: ids.streamId }).where(eq(students.id, noGroup.studentId!))
    const def = await browseScope(h.db, noGroup, {})
    expect(def).toMatchObject({ levelId: ids.levelId, streamId: ids.streamId, subjectId: null, fromProfile: true })
    const other = await resolveCodes(h.db, { level: '4AM' })
    const fromUrl = await browseScope(h.db, noGroup, { level: other.levelId!, subject: ids.subjectId! })
    expect(fromUrl).toMatchObject({ levelId: other.levelId, streamId: null, subjectId: ids.subjectId, fromProfile: false })
    expect(await browseScope(h.db, noGroup, { level: 'all' })).toMatchObject({ levelId: null, streamId: null })
    expect(await browseScope(h.db, noGroup, { level: 'not-a-uuid' })).toMatchObject({ levelId: null })
    const [me] = await h.db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, noGroup.studentId!))
    expect(me).toEqual({ levelId: ids.levelId, streamId: ids.streamId }) // لم يتغيّر
  })

  it('الخيارات من البيانات المرجعية: شعب الصف ومواد الشعبة (المشتركة + الخاصة)', async () => {
    const opts = await browseOptions(h.db, { levelId: ids.levelId, streamId: ids.streamId, subjectId: null })
    expect(opts.levels.length).toBeGreaterThan(5)
    expect(opts.streams.map((s) => s.code)).toContain('SCI')
    expect(opts.subjects.map((s) => s.id)).toContain(ids.subjectId)
    const none = await browseOptions(h.db, { levelId: null, streamId: null, subjectId: null })
    expect(none.streams).toEqual([])
    expect(none.subjects.length).toBeGreaterThan(0)
  })

  it('الفلاتر لا تتجاوز الصلاحيات: المحتوى الخاص لا يظهر مهما كانت المرشّحات', async () => {
    const paid = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس فوج بالمستوى', visibility: 'GROUP_ONLY', groupIds: [published.groupId], levelId: ids.levelId, subjectId: ids.subjectId, body: 'x', publish: true })
    const sections = await listStudentLessonsOrganized(h.db, noGroup, { levelId: ids.levelId, subjectId: ids.subjectId })
    expect(sections.flatMap((s) => s.lessons.map((l) => l.id))).not.toContain(paid.id)
    const asMember = await listStudentLessonsOrganized(h.db, member, { levelId: ids.levelId, subjectId: ids.subjectId })
    expect(asMember.flatMap((s) => s.lessons.map((l) => l.id))).toContain(paid.id)
  })
})

describe('5. ترتيب الدروس بالمنهاج', () => {
  it('الوحدات بترتيبها ثم الدروس بترتيبها، والقديم غير المصنّف في قسم أخير', async () => {
    const [u2] = await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, kind: 'UNIT', title: 'الوحدة الثانية', slug: 'u2-test', sortOrder: 2, schoolTerm: 2 }).returning()
    const [u1] = await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, kind: 'UNIT', title: 'الوحدة الأولى', slug: 'u1-test', sortOrder: 1, schoolTerm: 1 }).returning()
    const [l12] = await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, parentId: u1!.id, kind: 'LESSON', title: 'الدرس 1.2', slug: 'l12', sortOrder: 2 }).returning()
    const [l11] = await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, parentId: u1!.id, kind: 'LESSON', title: 'الدرس 1.1', slug: 'l11', sortOrder: 1 }).returning()
    const [l21] = await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, parentId: u2!.id, kind: 'LESSON', title: 'الدرس 2.1', slug: 'l21', sortOrder: 1 }).returning()
    // يُنشر بترتيب معاكس للمنهاج وبعناوين لا توحي بالترتيب: الترتيب يجب أن يتبع المنهاج لا النشر ولا العنوان
    const c21 = await createContent(h.db, teacher, { type: 'LESSON', title: 'ي', visibility: 'PUBLIC', body: 'x', publish: true, levelId: ids.levelId, subjectId: ids.subjectId, curriculumNodeId: l21!.id })
    const c12 = await createContent(h.db, teacher, { type: 'LESSON', title: 'أ', visibility: 'PUBLIC', body: 'x', publish: true, levelId: ids.levelId, subjectId: ids.subjectId, curriculumNodeId: l12!.id })
    const c11 = await createContent(h.db, teacher, { type: 'LESSON', title: 'ب', visibility: 'PUBLIC', body: 'x', publish: true, levelId: ids.levelId, subjectId: ids.subjectId, curriculumNodeId: l11!.id })
    const legacy = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس قديم', visibility: 'PUBLIC', body: 'x', publish: true })
    const sections = await listStudentLessonsOrganized(h.db, noGroup, { levelId: ids.levelId, subjectId: ids.subjectId }, ['LESSON'])
    const classified = sections.filter((s) => s.nodeId)
    expect(classified.map((s) => s.title)).toEqual(['الوحدة الأولى', 'الوحدة الثانية'])
    expect(classified[0]!.term).toBe(1)
    expect(classified[0]!.lessons.map((l) => l.id)).toEqual([c11.id, c12.id])
    expect(classified[1]!.lessons.map((l) => l.id)).toEqual([c21.id])
    const last = sections[sections.length - 1]!
    expect(last.nodeId).toBeNull()
    expect(last.lessons.map((l) => l.id)).toContain(legacy.id)
  })
})

describe('6. البطاقات الست للفروض والاختبارات', () => {
  it('ست بطاقات ثابتة بأعداد من school_term الحقيقي، وروابط إلى /exams بالمرشّحات', async () => {
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'test-t2', title: 'اختبار', type: 'TEST', subjectId: ids.subjectId, levelId: ids.levelId, schoolTerm: 2, fileUrl: 'https://example.test/t2.pdf' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'hw-noterm', title: 'فرض الفصل الثالث بلا تصنيف', type: 'HOMEWORK', subjectId: ids.subjectId, levelId: ids.levelId, fileUrl: 'https://example.test/x.pdf' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'hw-draft', title: 'فرض مسودة', type: 'HOMEWORK', subjectId: ids.subjectId, levelId: ids.levelId, schoolTerm: 3, status: 'DRAFT', fileUrl: 'https://example.test/d.pdf' })
    const cards = await assessmentCards(h.db, { levelId: ids.levelId, subjectId: ids.subjectId }, { studentId: noGroup.studentId, levelCode: '3AS' })
    expect(cards.map((c) => c.key)).toEqual(['HOMEWORK-1', 'TEST-1', 'HOMEWORK-2', 'TEST-2', 'HOMEWORK-3', 'TEST-3'])
    const n = Object.fromEntries(cards.map((c) => [c.key, c.count]))
    expect(n['HOMEWORK-1']).toBe(1) // العام فقط؛ مورد الفوج لا يُعدّ لتلميذ بلا فوج
    expect(n['TEST-2']).toBe(1)
    expect(n['HOMEWORK-3']).toBe(0) // «الفصل الثالث» في العنوان لا يُحتسب، والمسودة لا تُحتسب
    expect(cards[0]!.href).toBe(`/exams?level=3AS&subject=${ids.subjectId}&kind=homework&term=1`)
    for (const c of cards) expect(JSON.stringify(c)).not.toMatch(/example\.test|fileUrl|fileId/)
    // المرشّح term في المكتبة يطابق البطاقة
    const t1 = await listResourceCards(h.db, { levelId: ids.levelId, subjectId: ids.subjectId, types: ['HOMEWORK'], term: 1, studentId: noGroup.studentId })
    expect(t1.total).toBe(1)
    const counts = await practiceCounts(h.db, { levelId: ids.levelId, subjectId: ids.subjectId, term: 3, studentId: noGroup.studentId })
    expect(counts.homework).toBe(0)
  })
})

describe('البيانات المرجعية المستعملة في الاختبار', () => {
  it('المستوى والشعبة والمادة موجودة فعلاً', async () => {
    expect((await h.db.select().from(levels).where(eq(levels.id, ids.levelId!))).length).toBe(1)
    expect((await h.db.select().from(streams).where(eq(streams.id, ids.streamId!))).length).toBe(1)
    expect((await h.db.select().from(subjects).where(eq(subjects.id, ids.subjectId!))).length).toBe(1)
  })
})

describe('مراجعة PR #2 — الملاحظات الأربع', () => {
  it('1. الاشتراك المنتهي زمنياً يُغلق الدرس والوسائط والملفات والموارد فوراً رغم بقاء عضوية الفوج', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة تنتهي', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
    const s = await makeStudent(h.db, 'تلميذ سينتهي اشتراكه')
    const e = await enrollStudent(h.db, admin, { courseId: c.id, studentId: s.studentId!, source: 'MANUAL', expiresAt: new Date(Date.now() + 3600_000) })
    const pdf = await uploadFile(h.db, teacher, { originalName: 'exp.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 exp') })
    const lesson = await createContent(h.db, teacher, { type: 'PDF', title: 'درس الدورة', visibility: 'GROUP_ONLY', groupIds: [c.groupId], fileId: pdf.id, publish: true })
    const res = await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'course-res-1', title: 'فرض الدورة', type: 'HOMEWORK', accessLevel: 'GROUP', schoolTerm: 1, fileUrl: 'https://example.test/c.pdf' })
    await h.db.insert((await import('@/server/db/schema')).resourceGroups).values({ resourceId: res.id, groupId: c.groupId })
    // قبل الانتهاء: كل شيء متاح
    expect((await getContentForStudent(h.db, s, lesson.slug)).id).toBe(lesson.id)
    await expect(resolveMediaAccess(h.db, s, lesson.id)).resolves.toBeTruthy()
    expect((await listStudentFiles(h.db, s)).some((f) => f.id === lesson.id)).toBe(true)
    expect((await listResourceCards(h.db, { types: ['HOMEWORK'], studentId: s.studentId })).items.some((i) => i.id === res.id)).toBe(true)
    // ينتهي التاريخ دون أن تمرّ مهمة الانتهاء: العضوية ما زالت ACTIVE
    await h.db.update(courseEnrollments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(courseEnrollments.id, e.id))
    const [gs] = await h.db.select().from(groupStudents).where(eq(groupStudents.groupId, c.groupId))
    expect(gs?.status).toBe('ACTIVE')
    expect(await reachableGroupIds(h.db, s.studentId!)).not.toContain(c.groupId)
    await expectCode(() => getContentForStudent(h.db, s, lesson.slug), 'CONTENT_NOT_FOUND')
    await expectCode(() => resolveMediaAccess(h.db, s, lesson.id), 'CONTENT_NOT_FOUND')
    expect((await listStudentFiles(h.db, s)).some((f) => f.id === lesson.id)).toBe(false)
    expect((await listStudentContent(h.db, s)).some((f) => f.id === lesson.id)).toBe(false)
    expect((await listStudentLessonsOrganized(h.db, s)).flatMap((x) => x.lessons.map((l) => l.id))).not.toContain(lesson.id)
    expect((await listResourceCards(h.db, { types: ['HOMEWORK'], studentId: s.studentId })).items.some((i) => i.id === res.id)).toBe(false)
    await expectCode(() => publicResourceFile(h.db, res.id, 'file', { studentId: s.studentId }), 'NOT_FOUND')
    await expectCode(() => courseHome(h.db, s, c.slug), 'COURSE_NOT_ENROLLED')
    // الفوج العادي (بلا دورة) لا يتأثر
    const { createGroup } = await import('@/server/services/groups.service')
    const g = await createGroup(h.db, teacher, { name: 'فوج عادي' })
    await h.db.insert(groupStudents).values({ groupId: g.id, studentId: s.studentId!, workspaceId, status: 'ACTIVE' })
    expect(await reachableGroupIds(h.db, s.studentId!)).toContain(g.id)
  })

  it('2. شجرة «وحدة ← فصل ← درس»: الترتيب بالمسار الكامل لا بالأب المباشر', async () => {
    const mk = async (v: { title: string; slug: string; parentId?: string; sortOrder: number; kind: string; term?: number }) =>
      (await h.db.insert(curriculumNodes).values({ subjectId: ids.subjectId!, levelId: ids.levelId!, kind: v.kind, title: v.title, slug: v.slug, sortOrder: v.sortOrder, parentId: v.parentId ?? null, schoolTerm: v.term ?? null }).returning())[0]!
    const unitB = await mk({ title: 'الوحدة ب', slug: 'ub', sortOrder: 20, kind: 'UNIT', term: 2 })
    const unitA = await mk({ title: 'الوحدة أ', slug: 'ua', sortOrder: 10, kind: 'UNIT', term: 1 })
    const chA2 = await mk({ title: 'فصل أ2', slug: 'ua-c2', parentId: unitA.id, sortOrder: 2, kind: 'CHAPTER' })
    const chA1 = await mk({ title: 'فصل أ1', slug: 'ua-c1', parentId: unitA.id, sortOrder: 1, kind: 'CHAPTER' })
    const chB1 = await mk({ title: 'فصل ب1', slug: 'ub-c1', parentId: unitB.id, sortOrder: 1, kind: 'CHAPTER' })
    // درس في الفصل ب1 بترتيب 1 (أصغر من دروس الوحدة أ) — لو اعتُمد الأب المباشر فقط لظهر قبلها
    const lB11 = await mk({ title: 'درس ب1.1', slug: 'lb11', parentId: chB1.id, sortOrder: 1, kind: 'LESSON' })
    const lA21 = await mk({ title: 'درس أ2.1', slug: 'la21', parentId: chA2.id, sortOrder: 1, kind: 'LESSON' })
    const lA12 = await mk({ title: 'درس أ1.2', slug: 'la12', parentId: chA1.id, sortOrder: 9, kind: 'LESSON' })
    const lA11 = await mk({ title: 'درس أ1.1', slug: 'la11', parentId: chA1.id, sortOrder: 5, kind: 'LESSON' })
    const mkc = async (title: string, nodeId: string) => createContent(h.db, teacher, { type: 'ARTICLE', title, visibility: 'PUBLIC', body: 'x', publish: true, levelId: ids.levelId, subjectId: ids.subjectId, curriculumNodeId: nodeId })
    const cB11 = await mkc('ا', lB11.id) // عنوان يسبق أبجدياً
    const cA21 = await mkc('ب', lA21.id)
    const cA12 = await mkc('ت', lA12.id)
    const cA11 = await mkc('ث', lA11.id)
    const sections = (await listStudentLessonsOrganized(h.db, noGroup, { levelId: ids.levelId, subjectId: ids.subjectId }, ['ARTICLE'])).filter((s) => s.nodeId)
    expect(sections.map((s) => s.title)).toEqual(['الوحدة أ', 'الوحدة ب'])
    expect(sections[0]!.term).toBe(1)
    expect(sections[0]!.lessons.map((l) => l.id)).toEqual([cA11.id, cA12.id, cA21.id])
    expect(sections[1]!.lessons.map((l) => l.id)).toEqual([cB11.id])
    // خيارات التصنيف في نموذج الأستاذ: مسار كامل وبترتيب الشجرة
    const opts = (await curriculumNodeOptions(h.db)).filter((o) => o.subjectId === ids.subjectId && [unitA.id, chA1.id, lA11.id, lA12.id, lB11.id].includes(o.id))
    expect(opts.map((o) => o.label)).toEqual(['الوحدة أ', 'الوحدة أ › فصل أ1', 'الوحدة أ › فصل أ1 › درس أ1.1', 'الوحدة أ › فصل أ1 › درس أ1.2', 'الوحدة ب › فصل ب1 › درس ب1.1'])
  })

  it('3. بطاقة «اختبار» تعدّ TEST وEXAM معاً كما تعرضهما وجهتها', async () => {
    const other = await resolveCodes(h.db, { level: '3AS', subject: 'PHILO' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'exam-t1-philo', title: 'امتحان', type: 'EXAM', subjectId: other.subjectId, levelId: other.levelId, schoolTerm: 1, fileUrl: 'https://example.test/e.pdf' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'test-t1-philo', title: 'اختبار', type: 'TEST', subjectId: other.subjectId, levelId: other.levelId, schoolTerm: 1, fileUrl: 'https://example.test/t.pdf' })
    const cards = await assessmentCards(h.db, { levelId: other.levelId, subjectId: other.subjectId }, { studentId: noGroup.studentId, levelCode: '3AS' })
    const test1 = cards.find((c) => c.key === 'TEST-1')!
    expect(test1.count).toBe(2)
    const listed = await listResourceCards(h.db, { levelId: other.levelId, subjectId: other.subjectId, types: ['TEST', 'EXAM'], term: 1, studentId: noGroup.studentId })
    expect(listed.total).toBe(test1.count)
  })

  it('4. الشعبة المتفرّعة ترى محتوى شعبتها الأم (تقني رياضي ← هندسة مدنية) مع الحفاظ على الصلاحيات', async () => {
    const tm = await resolveCodes(h.db, { level: '3AS', stream: 'TM', subject: 'MATH' })
    const civil = await resolveCodes(h.db, { level: '3AS', stream: 'TM_CIVIL' })
    const sci = await resolveCodes(h.db, { level: '3AS', stream: 'SCI' })
    expect(await streamFamily(h.db, civil.streamId)).toEqual([civil.streamId, tm.streamId])
    expect(await streamFamily(h.db, null)).toEqual([])
    // دورة للشعبة الأم فقط
    const tmCourse = await createCourse(h.db, admin, { title: 'دورة تقني رياضي', workspaceId, levelId: tm.levelId, streamIds: [tm.streamId!], season: '2026/2027', status: 'PUBLISHED' })
    const asCivil = await listCourseCatalog(h.db, noGroup, { levelId: tm.levelId, streamId: civil.streamId })
    expect(asCivil.map((c) => c.id)).toContain(tmCourse.id)
    const asSci = await listCourseCatalog(h.db, noGroup, { levelId: tm.levelId, streamId: sci.streamId })
    expect(asSci.map((c) => c.id)).not.toContain(tmCourse.id)
    // درس عام للشعبة الأم، ودرس خاص بفوج للشعبة الأم: الأول يظهر للفرع، الثاني لا (الصلاحيات)
    const pub = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس TM عام', visibility: 'PUBLIC', body: 'x', publish: true, levelId: tm.levelId, streamId: tm.streamId, subjectId: tm.subjectId })
    const priv = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس TM خاص', visibility: 'GROUP_ONLY', groupIds: [tmCourse.groupId], body: 'x', publish: true, levelId: tm.levelId, streamId: tm.streamId, subjectId: tm.subjectId })
    const seen = (await listStudentLessonsOrganized(h.db, noGroup, { levelId: tm.levelId, streamId: civil.streamId, subjectId: tm.subjectId }, ['LESSON'])).flatMap((s) => s.lessons.map((l) => l.id))
    expect(seen).toContain(pub.id)
    expect(seen).not.toContain(priv.id)
    const seenSci = (await listStudentLessonsOrganized(h.db, noGroup, { levelId: tm.levelId, streamId: sci.streamId, subjectId: tm.subjectId }, ['LESSON'])).flatMap((s) => s.lessons.map((l) => l.id))
    expect(seenSci).not.toContain(pub.id)
    // الموارد والبطاقات: مورد الشعبة الأم يُحتسب لفرعها
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'tm-hw-1', title: 'فرض TM', type: 'HOMEWORK', subjectId: tm.subjectId, levelId: tm.levelId, streamId: tm.streamId, schoolTerm: 1, fileUrl: 'https://example.test/tm.pdf' })
    const cards = await assessmentCards(h.db, { levelId: tm.levelId, streamId: civil.streamId, subjectId: tm.subjectId }, { studentId: noGroup.studentId, levelCode: '3AS' })
    expect(cards.find((c) => c.key === 'HOMEWORK-1')!.count).toBe(1)
    const viaLibrary = await listResourceCards(h.db, { levelId: tm.levelId, subjectId: tm.subjectId, streamIds: await streamFamily(h.db, civil.streamId), types: ['HOMEWORK'], term: 1, studentId: noGroup.studentId })
    expect(viaLibrary.total).toBe(1)
    const sciCards = await assessmentCards(h.db, { levelId: tm.levelId, streamId: sci.streamId, subjectId: tm.subjectId }, { studentId: noGroup.studentId, levelCode: '3AS' })
    expect(sciCards.find((c) => c.key === 'HOMEWORK-1')!.count).toBe(0)
  })
})

describe('مراجعة PR #2 (الجولة الثانية)', () => {
  it('1. عضوية فوج الدورة بلا اشتراك لا تفتح المحتوى (strict)؛ رموز الانضمام مغلقة لأفواج الدورات', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة بعضوية قديمة', workspaceId, season: '2026/2027', accessEndsOn: '2027-06-30', status: 'PUBLISHED' })
    const s = await makeStudent(h.db, 'تلميذ بعضوية قديمة')
    await h.db.insert(groupStudents).values({ groupId: c.groupId, studentId: s.studentId!, workspaceId, status: 'ACTIVE' })
    const lesson = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس للدورة القديمة', visibility: 'GROUP_ONLY', groupIds: [c.groupId], body: 'x', publish: true })
    expect(await reachableGroupIds(h.db, s.studentId!)).not.toContain(c.groupId)
    await expectCode(() => getContentForStudent(h.db, s, lesson.slug), 'CONTENT_NOT_FOUND')
    await expectCode(() => resolveMediaAccess(h.db, s, lesson.id), 'CONTENT_NOT_FOUND')
    expect((await listStudentContent(h.db, s)).some((x) => x.id === lesson.id)).toBe(false)

    const { generateCodes } = await import('@/server/services/enrollment-codes.service')
    const { redeemEnrollmentCode } = await import('@/server/services/enrollment.service')
    await expectCode(() => generateCodes(h.db, teacher, { groupId: c.groupId, count: 1 }), 'COURSE_GROUP_CODE')
    const { enrollmentCodeBatches, enrollmentCodes } = await import('@/server/db/schema')
    const { hashEnrollmentCode } = await import('@/server/lib/codes')
    const [batch] = await h.db.insert(enrollmentCodeBatches).values({ workspaceId, groupId: c.groupId, count: 1, createdByUserId: teacher.userId }).returning()
    const legacyCode = 'ABC-DEFG'
    await h.db.insert(enrollmentCodes).values({ batchId: batch!.id, workspaceId, groupId: c.groupId, codeHash: hashEnrollmentCode(legacyCode), codePrefix: 'ABC', status: 'ACTIVE', createdByUserId: teacher.userId })
    // قرار المالك (2026-10-24): لا أكواد انضمام لأفواج الدورات، حتى من المشرف — التفعيل بالتسليم أو بكود الطلب (/claim)
    const s2 = await makeStudent(h.db, 'تلميذ برمز قديم')
    await expectCode(() => redeemEnrollmentCode(h.db, s2, legacyCode), 'COURSE_GROUP_CODE')
    expect((await h.db.select().from(groupStudents).where(eq(groupStudents.studentId, s2.studentId!))).length).toBe(0)
    await expectCode(() => generateCodes(h.db, admin, { groupId: c.groupId, count: 1 }), 'COURSE_GROUP_CODE')
    const { createGroup } = await import('@/server/services/groups.service')
    const g = await createGroup(h.db, teacher, { name: 'فوج عادي 2' })
    const codes = await generateCodes(h.db, teacher, { groupId: g.id, count: 1 })
    await redeemEnrollmentCode(h.db, s2, codes.codes[0]!.code)
    expect(await reachableGroupIds(h.db, s2.studentId!)).toContain(g.id)
    await expectCode(() => runCourseAccessMigration(h.db, teacher), 'FORBIDDEN')
  })
  it('2. البطاقات تستثني البكالوريا الرسمية كما تستثنيها /exams (العدّ = العرض)', async () => {
    const phys = await resolveCodes(h.db, { level: '3AS', subject: 'PHYSICS' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'bac-official-2025', title: 'بكالوريا 2025 فيزياء', type: 'EXAM', isOfficial: true, subjectId: phys.subjectId, levelId: phys.levelId, schoolTerm: 3, examYear: 2025, fileUrl: 'https://example.test/bac.pdf' })
    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'phys-test-3', title: 'اختبار الفصل الثالث', type: 'TEST', subjectId: phys.subjectId, levelId: phys.levelId, schoolTerm: 3, fileUrl: 'https://example.test/pt3.pdf' })
    const cards = await assessmentCards(h.db, { levelId: phys.levelId, subjectId: phys.subjectId }, { studentId: noGroup.studentId, levelCode: '3AS' })
    const test3 = cards.find((c) => c.key === 'TEST-3')!
    expect(test3.count).toBe(1)
    const dest = await listResourceCards(h.db, { levelId: phys.levelId, subjectId: phys.subjectId, types: ['TEST', 'EXAM'], term: 3, excludeBac: true, studentId: noGroup.studentId })
    expect(dest.total).toBe(test3.count)
    expect(dest.items.map((i) => i.title)).toEqual(['اختبار الفصل الثالث'])
  })

  it('3. خيارات المنتقي تحمل شعبة العقدة وأب الشعبة ليرث الفرع منهاج أمّه', async () => {
    const tm = await resolveCodes(h.db, { level: '3AS', stream: 'TM', subject: 'MATH' })
    const civil = await resolveCodes(h.db, { level: '3AS', stream: 'TM_CIVIL' })
    const [node] = await h.db.insert(curriculumNodes).values({ subjectId: tm.subjectId!, levelId: tm.levelId!, streamId: tm.streamId, kind: 'UNIT', title: 'وحدة تقني رياضي', slug: 'u-tm', sortOrder: 1 }).returning()
    const opt = (await curriculumNodeOptions(h.db)).find((o) => o.id === node!.id)!
    expect(opt.streamId).toBe(tm.streamId)
    const { teacherFormOptions } = await import('@/server/queries/teacher-form-options')
    const fo = await teacherFormOptions(h.db, teacher)
    expect(fo.streams.find((s) => s.id === civil.streamId)?.parentId).toBe(tm.streamId)
    expect(fo.nodes.some((n) => n.id === node!.id)).toBe(true)
    // نفس منطق الترشيح الذي في النموذج: عائلة الشعبة المختارة (الفرع + الأم) تشمل شعبة العقدة
    const family: string[] = []
    for (let cur: string | null | undefined = civil.streamId, i = 0; cur && i < 4; i++) {
      family.push(cur)
      cur = fo.streams.find((s) => s.id === cur)?.parentId ?? null
    }
    expect(family).toEqual([civil.streamId, tm.streamId])
    expect(fo.nodes.filter((n) => n.subjectId === tm.subjectId && n.levelId === tm.levelId && (!n.streamId || family.includes(n.streamId))).some((n) => n.id === node!.id)).toBe(true)
  })

  it('4. الخادم يرفض تصنيفًا لا يطابق عقدة المنهاج، ويملأ الناقص منها، عند الإنشاء والتعديل', async () => {
    const tm = await resolveCodes(h.db, { level: '3AS', stream: 'TM', subject: 'MATH' })
    const civil = await resolveCodes(h.db, { level: '3AS', stream: 'TM_CIVIL' })
    const sci = await resolveCodes(h.db, { level: '3AS', stream: 'SCI' })
    const am = await resolveCodes(h.db, { level: '4AM' })
    const [node] = await h.db.insert(curriculumNodes).values({ subjectId: tm.subjectId!, levelId: tm.levelId!, streamId: tm.streamId, kind: 'UNIT', title: 'وحدة للتحقق', slug: 'u-check', sortOrder: 2 }).returning()
    // مادة مخالفة
    await expectCode(() => createContent(h.db, teacher, { type: 'LESSON', title: 'خطأ مادة', visibility: 'PUBLIC', body: 'x', publish: true, subjectId: ids.subjectId, curriculumNodeId: node!.id }), 'VALIDATION')
    // مستوى مخالف
    await expectCode(() => createContent(h.db, teacher, { type: 'LESSON', title: 'خطأ مستوى', visibility: 'PUBLIC', body: 'x', publish: true, levelId: am.levelId, curriculumNodeId: node!.id }), 'VALIDATION')
    // شعبة لا تنتمي لعائلة شعبة العقدة
    await expectCode(() => createContent(h.db, teacher, { type: 'LESSON', title: 'خطأ شعبة', visibility: 'PUBLIC', body: 'x', publish: true, streamId: sci.streamId, curriculumNodeId: node!.id }), 'VALIDATION')
    // فرع الشعبة مقبول، والناقص يُملأ من العقدة
    const ok = await createContent(h.db, teacher, { type: 'LESSON', title: 'صحيح', visibility: 'PUBLIC', body: 'x', publish: true, streamId: civil.streamId, curriculumNodeId: node!.id })
    expect(ok.subjectId).toBe(tm.subjectId)
    expect(ok.levelId).toBe(tm.levelId)
    expect(ok.streamId).toBe(civil.streamId)
    const filled = await createContent(h.db, teacher, { type: 'LESSON', title: 'بلا شعبة', visibility: 'PUBLIC', body: 'x', publish: true, curriculumNodeId: node!.id })
    expect(filled.streamId).toBe(tm.streamId)
    // عقدة غير موجودة
    await expectCode(() => createContent(h.db, teacher, { type: 'LESSON', title: 'عقدة وهمية', visibility: 'PUBLIC', body: 'x', publish: true, curriculumNodeId: '00000000-0000-0000-0000-000000000000' }), 'VALIDATION')
    // التعديل: تغيير المادة وحدها إلى ما يخالف العقدة مرفوض؛ وتعيين عقدة على درس بمستوى مخالف مرفوض
    await expectCode(() => updateContent(h.db, teacher, ok.id, { subjectId: ids.subjectId }), 'VALIDATION')
    const legacy = await createContent(h.db, teacher, { type: 'LESSON', title: 'قديم 4AM', visibility: 'PUBLIC', body: 'x', publish: true, levelId: am.levelId })
    await expectCode(() => updateContent(h.db, teacher, legacy.id, { curriculumNodeId: node!.id }), 'VALIDATION')
    const fixed = (await updateContent(h.db, teacher, legacy.id, { levelId: tm.levelId, curriculumNodeId: node!.id }))!
    expect(fixed.subjectId).toBe(tm.subjectId)
    expect(fixed.streamId).toBe(tm.streamId)
    // إزالة العقدة لا تمسّ التصنيف
    const cleared = (await updateContent(h.db, teacher, fixed.id, { curriculumNodeId: null }))!
    expect(cleared.curriculumNodeId).toBeNull()
    expect(cleared.subjectId).toBe(tm.subjectId)
  })
})

describe('الترحيل إلى الوصول الصارم (course_access.mode)', () => {
  it('الترتيب: legacy لا يفقد أحد وصوله؛ المحاكاة للقراءة فقط؛ الإدراج ذرّي ويشمل الموقوفين؛ التفعيل يُرفض ما بقي نقص', async () => {
    await setCourseAccessMode(h.db, 'legacy')
    expect(await getCourseAccessMode(h.db)).toBe('legacy')
    const c = await createCourse(h.db, admin, { title: 'دورة الترحيل', workspaceId, season: '2026/2027', accessEndsOn: '2027-06-30', status: 'PUBLISHED' })
    const lesson = await createContent(h.db, teacher, { type: 'LESSON', title: 'درس الترحيل', visibility: 'GROUP_ONLY', groupIds: [c.groupId], body: 'x', publish: true })
    const active = await makeStudent(h.db, 'عضو قديم نشط')
    const suspended = await makeStudent(h.db, 'عضو قديم موقوف')
    const absent = await makeStudent(h.db, 'عضو قديم موقوف للغياب')
    const left = await makeStudent(h.db, 'عضو قديم غادر')
    const revoked = await makeStudent(h.db, 'اشتراك ملغى سابقًا')
    await h.db.insert(groupStudents).values([
      { groupId: c.groupId, studentId: active.studentId!, workspaceId, status: 'ACTIVE' },
      { groupId: c.groupId, studentId: suspended.studentId!, workspaceId, status: 'SUSPENDED', suspensionReason: 'عدم الدفع' },
      { groupId: c.groupId, studentId: absent.studentId!, workspaceId, status: 'SUSPENDED_DUE_TO_ABSENCE' },
      { groupId: c.groupId, studentId: left.studentId!, workspaceId, status: 'LEFT_GROUP' },
      { groupId: c.groupId, studentId: revoked.studentId!, workspaceId, status: 'ACTIVE' }
    ])
    const e = await enrollStudent(h.db, admin, { courseId: c.id, studentId: revoked.studentId!, source: 'MANUAL' })
    await revokeEnrollment(h.db, admin, e.id, 'ملغى')

    // 4. legacy (قبل الترحيل): العضويات القديمة تصل كما كانت؛ الملغى صراحةً لا يصل
    for (const st of [active, suspended, absent]) expect((await getContentForStudent(h.db, st, lesson.slug)).id).toBe(lesson.id)
    await expectCode(() => getContentForStudent(h.db, revoked, lesson.slug), 'CONTENT_NOT_FOUND')
    await expectCode(() => getContentForStudent(h.db, left, lesson.slug), 'CONTENT_NOT_FOUND')

    // 1. المحاكاة: اتصال بلا هجرات + معاملة للقراءة فقط — لا تكتب شيئًا
    const ro = await (await import('@/server/db/connect')).createDatabase('pglite://memory', { migrate: false })
    await expect(ro.db.execute(sql`select 1 from course_enrollments`)).rejects.toBeTruthy() // لا مخطط: لم تُشغَّل الهجرات
    await ro.close()
    const before = (await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, c.id))).length
    const dry = await runCourseAccessMigration(h.db, admin, { dryRun: true, enableStrict: true })
    expect(dry.candidates.filter((x) => x.courseId === c.id).map((x) => x.studentId).sort()).toEqual([active.studentId, suspended.studentId, absent.studentId].sort())
    expect(dry.created).toBe(0)
    expect(dry.strictEnabled).toBe(false)
    expect(await getCourseAccessMode(h.db)).toBe('legacy')
    expect((await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, c.id))).length).toBe(before)
    // المعاملة للقراءة فقط ترفض الكتابة فعلًا
    await expect(
      h.db.transaction(async (tx) => {
        await tx.execute(sql`set transaction read only`)
        await tx.execute(sql`update settings set updated_at = now()`)
      })
    ).rejects.toBeTruthy()

    // 3. التنفيذ: إدراج ذرّي بلا enrollStudent — الملغى لا يُعاد تفعيله، والعضوية لا تتغيّر
    const run = await runCourseAccessMigration(h.db, admin)
    expect(run.created).toBeGreaterThanOrEqual(3)
    expect(run.remaining).toBe(0)
    const rows = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, c.id))
    const byStudent = new Map(rows.map((r) => [r.studentId, r]))
    for (const st of [active, suspended, absent]) {
      const r = byStudent.get(st.studentId!)!
      expect(r.status).toBe('ACTIVE')
      expect(r.source).toBe('MANUAL')
      expect(r.expiresAt?.toISOString()).toBe(endOfDayDz('2027-06-30').toISOString())
      expect(r.activatedByUserId).toBe(admin.userId)
    }
    expect(byStudent.get(revoked.studentId!)!.status).toBe('REVOKED') // لم يُمسّ
    expect(byStudent.has(left.studentId!)).toBe(false) // غادر: ليس من حالات الوصول
    const [gsSusp] = await h.db.select().from(groupStudents).where(and(eq(groupStudents.groupId, c.groupId), eq(groupStudents.studentId, suspended.studentId!)))
    expect(gsSusp!.status).toBe('SUSPENDED')
    expect(gsSusp!.suspensionReason).toBe('عدم الدفع')
    // لا إشعار: ليس تفعيلًا جديدًا
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, active.userId))
    expect(n.some((x) => x.type === 'ENROLLED')).toBe(false)
    expect((await runCourseAccessMigration(h.db, admin)).created).toBe(0) // idempotent

    // 2. بعد التفعيل الصارم: الموقوفون ما زالوا يصلون إلى الدروس (عضويتهم لم تتغيّر)، والملغى لا
    const en = await runCourseAccessMigration(h.db, admin, { enableStrict: true })
    expect(en.strictEnabled).toBe(true)
    expect(await getCourseAccessMode(h.db)).toBe('strict')
    for (const st of [active, suspended, absent]) expect((await getContentForStudent(h.db, st, lesson.slug)).id).toBe(lesson.id)
    await expectCode(() => getContentForStudent(h.db, revoked, lesson.slug), 'CONTENT_NOT_FOUND')

    // 4. عضوية جديدة بلا اشتراك ⇒ التفعيل الصارم يُرفض حتى تُرحَّل، ثم يُقبل
    await setCourseAccessMode(h.db, 'legacy')
    const late = await makeStudent(h.db, 'عضو متأخر')
    await h.db.insert(groupStudents).values({ groupId: c.groupId, studentId: late.studentId!, workspaceId, status: 'ACTIVE' })
    expect((await getContentForStudent(h.db, late, lesson.slug)).id).toBe(lesson.id) // legacy
    const probe = await runCourseAccessMigration(h.db, admin, { dryRun: true, enableStrict: true })
    expect(probe.remaining).toBe(1)
    expect(await getCourseAccessMode(h.db)).toBe('legacy')
    const fin = await runCourseAccessMigration(h.db, admin, { enableStrict: true })
    expect(fin.created).toBe(1)
    expect(fin.remaining).toBe(0)
    expect(fin.strictEnabled).toBe(true)
    expect((await getContentForStudent(h.db, late, lesson.slug)).id).toBe(lesson.id)
  })

  it('3. إلغاء أثناء التنفيذ: الإدراج لا يلمس اشتراكًا موجودًا ولا يعيد تفعيل الملغى', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة السباق', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
    const s = await makeStudent(h.db, 'تلميذ أُلغي اشتراكه أثناء الترحيل')
    await h.db.insert(groupStudents).values({ groupId: c.groupId, studentId: s.studentId!, workspaceId, status: 'ACTIVE' })
    const dry = await runCourseAccessMigration(h.db, admin, { dryRun: true })
    expect(dry.candidates.some((x) => x.courseId === c.id && x.studentId === s.studentId)).toBe(true)
    // يُفعَّل ويُلغى بين المحاكاة والتنفيذ (سباق): الإدراج يعيد التحقق لحظة التنفيذ ولا يعدّل الموجود
    const e = await enrollStudent(h.db, admin, { courseId: c.id, studentId: s.studentId!, source: 'MANUAL' })
    await revokeEnrollment(h.db, admin, e.id, 'إلغاء أثناء الترحيل')
    const run = await runCourseAccessMigration(h.db, admin)
    expect(run.candidates.some((x) => x.courseId === c.id)).toBe(false)
    const [row] = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, c.id), eq(courseEnrollments.studentId, s.studentId!)))
    expect(row!.status).toBe('REVOKED')
    expect(row!.revokedReason).toBe('إلغاء أثناء الترحيل')
    expect(await reachableGroupIds(h.db, s.studentId!)).not.toContain(c.groupId)
    await setCourseAccessMode(h.db, 'strict')
  })
})
