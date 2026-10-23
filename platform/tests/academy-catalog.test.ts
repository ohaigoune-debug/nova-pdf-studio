/**
 * أكاديمية 2027 — اختبارات انحدار: الكتالوج (اكتشاف ≠ وصول)، «دوراتي»، المحتوى المجاني دون فوج،
 * المرشّحات وترتيب المنهاج، والبطاقات الست. قاعدة PGlite في الذاكرة وبيانات وهمية فقط.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { curriculumNodes, levels, streams, students, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { CATALOG_FORBIDDEN_KEYS, assessmentCards, browseOptions, browseScope, courseLanding, listCourseCatalog, listStudentLessonsOrganized } from '@/server/services/academy-catalog.service'
import { createContent, getContentForStudent } from '@/server/services/content.service'
import { courseHome, createCourse, enrollStudent, linkProduct, myCourses, revokeEnrollment, setCourseStatus } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { listResourceCards, practiceCounts, publicResourceFile } from '@/server/services/library.service'
import { resolveMediaAccess } from '@/server/services/media.service'
import { upsertResource } from '@/server/services/resources.service'
import { createProduct } from '@/server/services/store.service'
import { resolveCodes } from '@/server/services/taxonomy.service'
import { listStudentContent, listStudentFiles } from '@/server/queries/student-extras.queries'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

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

  published = await createCourse(h.db, admin, { title: 'دورة الأدب العربي 2027', description: 'وصف تسويقي', workspaceId, levelId: ids.levelId, subjectId: ids.subjectId, streamIds: [ids.streamId!], season: '2026/2027', priceDzd: 4500, accessEndsOn: '2027-06-30', termsText: '## شروط', status: 'PUBLISHED' })
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
