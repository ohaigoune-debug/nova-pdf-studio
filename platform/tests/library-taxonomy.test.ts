import { count, eq, sql } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { bacExams, curriculumNodes, educationStages, levels, resources, subjectOfferings, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { backfillBacExams, fingerprintOf, listResources, normalizeUrl, resourceStats, streamCodeOf, upsertResource } from '@/server/services/resources.service'
import { createNode, deleteNode, getTaxonomy, listNodes, resolveCodes, subjectsFor } from '@/server/services/taxonomy.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
})
afterAll(async () => {
  await h.close()
})

const n = async (table: PgTable) => (await h.db.select({ n: count() }).from(table))[0]!.n

describe('تصنيف المنهاج', () => {
  it('الزرع لا يكرّر، ويحفظ اسم الصف القائم ويضيف طوره', async () => {
    const before = { stages: await n(educationStages), levels: await n(levels), subjects: await n(subjects), offerings: await n(subjectOfferings) }
    await seedCurriculum(h.db)
    expect({ stages: await n(educationStages), levels: await n(levels), subjects: await n(subjects), offerings: await n(subjectOfferings) }).toEqual(before)
    expect(before.levels).toBe(12)
    const [l3] = await h.db.select().from(levels).where(eq(levels.code, '3AS'))
    expect(l3?.nameAr).toBe('السنة الثالثة ثانوي') // اسم الإعداد القائم لا يُستبدل
    expect(l3?.slug).toBe('3as')
    const t = await getTaxonomy(h.db)
    expect(t.stages.map((s) => s.code)).toEqual(['PRIMARY', 'MIDDLE', 'SECONDARY'])
    expect(t.stages[2]!.levels.find((l) => l.code === '1AS')!.streams.map((s) => s.code).sort()).toEqual(['TC_LIT', 'TC_SCI'])
  })

  it('مواد الشعبة: مشتركة + خاصة، وخيار تقني رياضي يرث مواد أمّه', async () => {
    const ids = await resolveCodes(h.db, { level: '3AS', stream: 'SCI' })
    const sci = await subjectsFor(h.db, ids.levelId!, ids.streamId)
    const codes = sci.map((s) => s.code)
    expect(codes).toEqual(expect.arrayContaining(['SCIENCES', 'PHYSICS', 'MATH', 'ARABIC', 'PHILO']))
    expect(codes).not.toContain('ACCOUNTING')
    expect(sci.find((s) => s.code === 'SCIENCES')?.isExamSubject).toBe(true)
    expect(sci.find((s) => s.code === 'SPORT')?.isExamSubject).toBe(false)

    const civil = await resolveCodes(h.db, { level: '3AS', stream: 'TM_CIVIL' })
    const tm = (await subjectsFor(h.db, civil.levelId!, civil.streamId)).map((s) => s.code)
    expect(tm).toEqual(expect.arrayContaining(['TECH_CIVIL', 'MATH', 'PHYSICS']))
    expect(tm).not.toContain('TECH_MECA')

    const bem = await resolveCodes(h.db, { level: '4AM' })
    expect((await subjectsFor(h.db, bem.levelId!)).filter((s) => s.isExamSubject).map((s) => s.code)).toEqual(expect.arrayContaining(['ARABIC', 'MATH', 'PHYSICS', 'CIVIC']))
  })

  it('شجرة المنهاج: ترتيب الأنواع مفروض، والتكرار مرفوض، والعقدة المستعملة لا تُحذف', async () => {
    const ids = await resolveCodes(h.db, { level: '3AS', stream: 'SCI', subject: 'MATH' })
    const scope = { subjectId: ids.subjectId!, levelId: ids.levelId!, streamId: null }
    const unit = await createNode(h.db, admin, { ...scope, kind: 'UNIT', title: 'الاحتمالات' })
    await expect(createNode(h.db, admin, { ...scope, kind: 'LESSON', title: 'درس بلا وحدة' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(createNode(h.db, admin, { ...scope, kind: 'UNIT', title: 'الاحتمالات' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const lesson = await createNode(h.db, admin, { ...scope, parentId: unit.id, kind: 'LESSON', title: 'الاحتمال الشرطي', schoolTerm: 3 })
    await createNode(h.db, admin, { ...scope, parentId: lesson.id, kind: 'TOPIC', title: 'شجرة الاحتمالات' })
    const teacher = await makeTeacher(h.db, admin)
    await expect(createNode(h.db, teacher, { ...scope, kind: 'UNIT', title: 'x x' })).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const tree = await listNodes(h.db, { ...scope, streamId: ids.streamId })
    expect(tree[0]?.title).toBe('الاحتمالات')
    expect(tree[0]?.children[0]?.children[0]?.title).toBe('شجرة الاحتمالات')

    await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'lesson-proba', title: 'ملخص الاحتمال الشرطي', type: 'SUMMARY', subjectId: scope.subjectId, levelId: scope.levelId, curriculumNodeId: lesson.id })
    await expect(deleteNode(h.db, admin, unit.id)).rejects.toMatchObject({ code: 'NODE_IN_USE' })
    const spare = await createNode(h.db, admin, { ...scope, kind: 'UNIT', title: 'وحدة للحذف' })
    await createNode(h.db, admin, { ...scope, parentId: spare.id, kind: 'LESSON', title: 'درس للحذف' })
    await deleteNode(h.db, admin, spare.id)
    expect((await h.db.select().from(curriculumNodes).where(eq(curriculumNodes.title, 'درس للحذف'))).length).toBe(0)
  })
})

describe('المكتبة الموحّدة', () => {
  it('البصمة تُطبِّع الرابط، والإدراج المكرّر يحدّث ولا يضاعف', async () => {
    expect(normalizeUrl('https://WWW.dzexams.com/ar/annales/X==/?utm_source=fb#top')).toBe('https://dzexams.com/ar/annales/X==')
    expect(fingerprintOf('dzexams', 'https://www.dzexams.com/ar/x/')).toBe(fingerprintOf('dzexams', 'https://dzexams.com/ar/x'))
    const a = await upsertResource(h.db, { sourceCode: 'dzexams', ref: 'https://www.dzexams.com/ar/doc/1', title: 'فرض الفصل الأول', type: 'HOMEWORK' })
    const b = await upsertResource(h.db, { sourceCode: 'dzexams', ref: 'https://dzexams.com/ar/doc/1/?utm_medium=x', title: 'فرض الفصل الأول (محدّث)', type: 'HOMEWORK' })
    expect(a.created).toBe(true)
    expect(b).toEqual({ id: a.id, created: false })
    const [row] = await h.db.select().from(resources).where(eq(resources.id, a.id))
    expect(row?.title).toBe('فرض الفصل الأول (محدّث)')
  })

  it('الرسمي لا يكون مولّداً: الخدمة والقاعدة ترفضان', async () => {
    await expect(upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'x-ai', title: 'x', type: 'EXAM', isOfficial: true, isAiGenerated: true })).rejects.toMatchObject({ code: 'VALIDATION' })
    const [src] = await h.db.execute<{ id: string }>(sql`select id from content_sources where code = 'madrasadz'`).then((r) => (Array.isArray(r) ? r : (r as { rows: { id: string }[] }).rows))
    await expect(h.db.insert(resources).values({ title: 'x', type: 'EXAM', sourceId: src!.id, fingerprint: 'raw-ai', isOfficial: true, isAiGenerated: true })).rejects.toThrow()
  })

  it('أرشيف البكالوريا القديم ينتقل مرّة واحدة: موضوع رسمي مصنّف وتصحيحه مربوط به', async () => {
    await h.db.insert(bacExams).values([
      { subjectSlug: 'mathematiques', subjectName: 'الرياضيات', streamSlug: 'se', streamName: 'علوم تجريبية', year: 2024, title: 'موضوع الرياضيات شعبة علوم تجريبية – بكالوريا 2024', pageUrl: 'https://www.dzexams.com/ar/annales/M2024', examUrl: 'https://cdn.dzexams.com/m-2024.pdf', correctionUrl: 'https://cdn.dzexams.com/m-2024-c.pdf' },
      { subjectSlug: 'inconnu', subjectName: 'مادة غير معروفة', year: 2019, title: 'موضوع 2019', pageUrl: 'https://www.dzexams.com/ar/annales/U2019' }
    ])
    expect(await backfillBacExams(h.db)).toEqual({ exams: 2, solutions: 1 })
    expect(await backfillBacExams(h.db)).toEqual({ exams: 0, solutions: 0 })

    const ids = await resolveCodes(h.db, { level: '3AS', stream: 'SCI', subject: 'MATH' })
    const list = await listResources(h.db, { subjectId: ids.subjectId, types: ['EXAM'], isOfficial: true })
    expect(list.items).toHaveLength(1)
    const exam = list.items[0]!
    expect(exam.r).toMatchObject({ examYear: 2024, streamId: ids.streamId, levelId: ids.levelId, hasSolution: true, isOfficial: true, fileUrl: 'https://cdn.dzexams.com/m-2024.pdf' })
    expect(exam.source.attribution).toBe('المصدر: DzExams')
    const [sol] = await h.db.select().from(resources).where(eq(resources.id, exam.r.solutionResourceId!))
    expect(sol).toMatchObject({ type: 'SOLUTION', fileUrl: 'https://cdn.dzexams.com/m-2024-c.pdf' })
    // المادة المجهولة تنتظر المراجعة ولا تظهر للعموم
    const stats = await resourceStats(h.db)
    expect(stats.byStatus.find((s) => s.status === 'NEEDS_REVIEW')?.n).toBe(1)
    expect(streamCodeOf(null, 'شعبة آداب وفلسفة')).toBe('LIT')
    expect(streamCodeOf('le', null)).toBe('LANG')
  })

  it('الترقيم بالمؤشّر يمرّ على الكل بلا تكرار ولا ضياع', async () => {
    const ids = await resolveCodes(h.db, { level: '1AM', subject: 'ARABIC' })
    for (let i = 0; i < 7; i++) await upsertResource(h.db, { sourceCode: 'madrasadz', ref: `page-test-${i}`, title: `درس ${i}`, type: 'LESSON', subjectId: ids.subjectId, levelId: ids.levelId })
    const seen: string[] = []
    let cursor: string | null = null
    do {
      const page: Awaited<ReturnType<typeof listResources>> = await listResources(h.db, { subjectId: ids.subjectId, levelId: ids.levelId }, { cursor, limit: 3 })
      seen.push(...page.items.map((i) => i.r.id))
      cursor = page.nextCursor
    } while (cursor)
    expect(seen).toHaveLength(7)
    expect(new Set(seen).size).toBe(7)
  })
})
