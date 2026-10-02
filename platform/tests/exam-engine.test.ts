import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { and, eq, isNull } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, ExtractQuestionsInput, ExtractedQuestion } from '@/server/ai/types'
import { estimateCostUsd, recentAiUsage, reportAiUsage, withAiTask } from '@/server/ai/usage'
import type { DatabaseHandle } from '@/server/db/connect'
import { aiUsageLogs, bankQuestions, curriculumNodes, jobs, levels, notifications, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { laneOf } from '@/server/jobs/queue'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { installAiUsageSink } from '@/server/services/ai-usage.service'
import { allowedNodeIds, approveDocument, archiveDocument, archiveFacets, classifyExercise, engineStats, getTeacherProgress, listArchive, listDocuments, nodesForMapping, registerBacDocuments, rejectDocument, reprocessDocument, requestProcessing, setTeacherProgress, splitSolutions, topicNoOf } from '@/server/services/exam-engine.service'
import { buildExamFromBank, parseExamRequest, parseExamRequestSmart, replaceItem, selectFromBank } from '@/server/services/exam-generator.service'
import { getExam } from '@/server/services/exams.service'
import { publicQuestion } from '@/server/services/library.service'
import { listBankQuestions } from '@/server/services/question-bank.service'
import { upsertResource } from '@/server/services/resources.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let math: string
let l3: string
let sci: string
let examResourceId: string
let scannedResourceId: string

/* موقع وهمي: موضوع بكالوريا (نصّ عادي ليُقرأ بلا PDF)، تصحيحه، وملف PDF بلا نصّ (مصوّر) */
const EXAM_TEXT = `بكالوريا 2023 — الرياضيات — شعبة علوم تجريبية
الموضوع الأول
التمرين الأول (04 نقاط)
نعتبر المتتالية العددية (u_n) المعرفة بحدها الأول u_0 = 2 ومن أجل كل عدد طبيعي n: u_{n+1} = 3u_n - 4.
1) احسب u_1 و u_2.
2) نضع v_n = u_n - 2. بيّن أن (v_n) متتالية هندسية يُطلب تعيين أساسها.
3) اكتب u_n بدلالة n ثم احسب نهاية المتتالية.
التمرين الثاني (06 نقاط)
f دالة عددية معرفة على R بـ f(x) = x^3 - 3x + 1 و (C) تمثيلها البياني في معلم متعامد ومتجانس.
1) احسب نهايتي الدالة f عند الحدود.
2) ادرس اتجاه تغير الدالة f وشكّل جدول تغيراتها.
3) اكتب معادلة المماس عند النقطة ذات الفاصلة 0.
التمرين الثالث (05 نقاط)
يحتوي كيس على 5 كرات بيضاء و 3 كرات سوداء. نسحب عشوائياً كرتين في آن واحد.
1) احسب احتمال الحادثة A: «الكرتان من نفس اللون».
2) ليكن X المتغير العشوائي الذي يرفق بكل سحبة عدد الكرات البيضاء. عرّف قانون احتمال X واحسب أمله الرياضياتي.
الموضوع الثاني
التمرين الأول (04 نقاط)
نعتبر الدالة g المعرفة على ]0;+∞[ بـ g(x) = x - 1 - ln(x). ادرس تغيرات الدالة اللوغاريتمية g.
`
const SOLUTION_TEXT = `التصحيح النموذجي — بكالوريا 2023 رياضيات
حل التمرين الأول:
u_1 = 2 و u_2 = 2. (v_n) هندسية أساسها 3. u_n = 2.
حل التمرين الثاني:
نهاية f عند +∞ هي +∞. f'(x) = 3x^2 - 3. جدول التغيرات...
حل التمرين الثالث:
p(A) = 13/28. قانون X: ...
حل التمرين الأول (الموضوع الثاني):
g'(x) = 1 - 1/x ...
`
/** PDF صالح بلا أي نصّ (صفحة فارغة): يُعامل كمصوّر */
const EMPTY_PDF = Buffer.from(
  `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >> endobj
trailer << /Root 1 0 R >>
%%EOF`,
  'latin1'
)
const SITE: Record<string, { body: Buffer | string; type: string }> = {
  'https://cdn.test/bac-math-2023.txt': { body: EXAM_TEXT, type: 'text/plain; charset=utf-8' },
  'https://cdn.test/bac-math-2023-corrige.txt': { body: SOLUTION_TEXT, type: 'text/plain; charset=utf-8' },
  'https://cdn.test/bac-math-2019.pdf': { body: EMPTY_PDF, type: 'application/pdf' }
}
const fakeFetch = (async (u: RequestInfo | URL) => {
  const hit = SITE[String(u)]
  return hit ? new Response(typeof hit.body === 'string' ? hit.body : new Uint8Array(hit.body), { headers: { 'content-type': hit.type } }) : new Response('not found', { status: 404 })
}) as typeof fetch

/** مزوّد وهمي: يقسّم النصّ عند «التمرين …» ويعيد تمارين بأسئلة فرعية (بلا حلول: تأتي من التصحيح) */
const fakeAi: AIProvider = {
  name: 'fake',
  model: 'fake-1',
  evaluateEssay: () => Promise.reject(new Error('n/a')),
  generateTeacherInsights: () => Promise.reject(new Error('n/a')),
  generateExercises: () => Promise.reject(new Error('n/a')),
  analyzeStudent: () => Promise.reject(new Error('n/a')),
  async extractQuestions(input: ExtractQuestionsInput) {
    reportAiUsage({ provider: 'fake', model: 'gpt-4.1-mini', inputTokens: 1000, outputTokens: 500, durationMs: 10, ok: true })
    const parts = input.text.split(/\n(?=التمرين )/).slice(1)
    const questions: ExtractedQuestion[] = parts.map((p) => {
      const [head, ...lines] = p.split('\n')
      const body = lines.filter((l) => !/^\d\)/.test(l) && l.trim() && !/^الموضوع/.test(l)).join('\n')
      const children = lines.filter((l) => /^\d\)/.test(l)).map((l) => ({ kind: 'QUESTION' as const, type: 'OPEN' as const, title: null, body: l.replace(/^\d\)\s*/, ''), options: [], answerKey: null, solution: null, points: 1, difficulty: 2 as const, estimatedMinutes: null, topic: null, keywords: [] }))
      const pts = /\((\d+) نقاط\)/.exec(head ?? '')
      return { kind: 'EXERCISE', type: 'OPEN', title: head!.replace(/\s*\(.*\)$/, ''), body, options: [], answerKey: null, solution: null, points: pts ? Number(pts[1]) : null, difficulty: 2, estimatedMinutes: 30, topic: null, keywords: [], children }
    })
    return { questions, note: null }
  }
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'engine-uploads-'))
  process.env.DRIVE_CACHE_DIR = await mkdtemp(path.join(tmpdir(), 'engine-cache-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  installAiUsageSink(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  const common = { sourceCode: 'dzexams', levelId: l3, streamId: sci, subjectId: math, isOfficial: true, accessLevel: 'PUBLIC' as const, status: 'PUBLISHED' as const, originalAuthor: 'الديوان الوطني للامتحانات والمسابقات' }
  const sol = await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2023', part: 'correction', type: 'SOLUTION', title: 'تصحيح: موضوع الرياضيات ع.ت — بكالوريا 2023', fileUrl: 'https://cdn.test/bac-math-2023-corrige.txt', examYear: 2023, examSession: 'NORMAL' })
  examResourceId = (await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2023', type: 'EXAM', title: 'موضوع الرياضيات شعبة علوم تجريبية — بكالوريا 2023', fileUrl: 'https://cdn.test/bac-math-2023.txt', sourceUrl: 'https://www.dzexams.com/ar/annales/M2023', examYear: 2023, examSession: 'NORMAL', hasSolution: true, solutionResourceId: sol.id })).id
  scannedResourceId = (await upsertResource(h.db, { ...common, ref: 'https://www.dzexams.com/ar/annales/M2019', type: 'EXAM', title: 'موضوع الرياضيات ع.ت — بكالوريا 2019', fileUrl: 'https://cdn.test/bac-math-2019.pdf', sourceUrl: 'https://www.dzexams.com/ar/annales/M2019', examYear: 2019, examSession: 'NORMAL' })).id
  // مورد غير رسمي لا يُسجَّل
  await upsertResource(h.db, { ...common, isOfficial: false, ref: 'https://www.dzexams.com/ar/doc/x', type: 'EXAM', title: 'اختبار غير رسمي', examYear: 2022 })
  setAiProviderForTests(fakeAi)
  vi.stubGlobal('fetch', fakeFetch)
})

afterAll(async () => {
  setAiProviderForTests(null)
  vi.unstubAllGlobals()
  delete process.env.UPLOADS_DIR
  delete process.env.DRIVE_CACHE_DIR
  await h.close()
})

describe('محرّك الامتحانات — المرحلة 1 (رياضيات 3AS)', () => {
  it('شجرة الرياضيات 3AS تُزرع بالفصول (idempotent) وتُربط التمارين بمحاورها', async () => {
    const units = await h.db.select().from(curriculumNodes).where(and(eq(curriculumNodes.subjectId, math), eq(curriculumNodes.levelId, l3), isNull(curriculumNodes.streamId), isNull(curriculumNodes.parentId)))
    expect(units.map((u) => u.slug)).toEqual(['suites', 'fonctions', 'exponentielle', 'logarithme', 'primitives-integrales', 'probabilites', 'geometrie-espace'])
    expect(units.find((u) => u.slug === 'suites')!.schoolTerm).toBe(1)
    expect(units.find((u) => u.slug === 'probabilites')!.schoolTerm).toBe(3)
    const before = (await h.db.select().from(curriculumNodes)).length
    await seedCurriculum(h.db)
    expect((await h.db.select().from(curriculumNodes)).length).toBe(before)
    // شعبة رياضيات: محاورها الخاصة + المشتركة
    const forMath = await nodesForMapping(h.db, { subjectId: math, levelId: l3, streamId: (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'MATH')))[0]!.id })
    expect(forMath.some((n) => n.slug === 'nombres-complexes')).toBe(true)
    const nodes = await nodesForMapping(h.db, { subjectId: math, levelId: l3, streamId: sci })
    expect(nodes.some((n) => n.slug === 'nombres-complexes')).toBe(false)
    const c1 = classifyExercise({ title: null, body: 'نعتبر المتتالية العددية (u_n) الحسابية. برهن بالتراجع أن…', topic: null, keywords: [] }, nodes)
    expect(nodes.find((n) => n.id === c1.nodeId)!.slug).toBe('raisonnement-recurrence')
    expect(c1.confidence).toBeGreaterThan(0.5)
    const c2 = classifyExercise({ title: null, body: 'كيس به كرات، نسحب عشوائياً كرتين. احسب احتمال الحادثة.', topic: null, keywords: [] }, nodes)
    expect(nodes.find((n) => n.id === c2.nodeId)!.slug.startsWith('probabilit')).toBe(true)
    expect(classifyExercise({ title: null, body: 'نصّ لا علاقة له بالرياضيات', topic: null, keywords: [] }, nodes)).toEqual({ nodeId: null, confidence: null })
    // أدوات الحلّ والموضوع
    expect(splitSolutions(SOLUTION_TEXT).length).toBe(4)
    expect(splitSolutions(SOLUTION_TEXT)[1]).toContain("f'(x)")
    expect(topicNoOf(EXAM_TEXT, 'نعتبر الدالة g المعرفة على ]0;+∞[ بـ g(x) = x - 1 - ln(x). ادرس تغيرات', null)).toBe(2)
    expect(topicNoOf(EXAM_TEXT, 'نعتبر المتتالية العددية (u_n) المعرفة بحدها الأول u_0 = 2 ومن أجل كل عدد طبيعي n', null)).toBe(1)
    expect(topicNoOf('نصّ بلا مواضيع', 'أي شيء', null)).toBeNull()
  })

  it('التسجيل: مواضيع المكتبة الرسمية للرياضيات 3AS فقط، بلا تكرار، والمعالجة للمشرف وبمفتاح', async () => {
    await expect(registerBacDocuments(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const r = await registerBacDocuments(h.db, admin)
    expect(r).toEqual({ registered: 2, candidates: 2 })
    expect(await registerBacDocuments(h.db, admin)).toEqual({ registered: 0, candidates: 0 })
    const docs = await listDocuments(h.db, admin)
    expect(docs).toHaveLength(2)
    expect(docs.every((d) => d.status === 'PENDING' && d.docType === 'BAC' && d.sourceName)).toBe(true)
    expect(docs.find((d) => d.resourceId === examResourceId)!.solutionResourceId).toBeTruthy()
    expect(laneOf('EXAM_DOC_PROCESS')).toBe('slow')
    await expect(requestProcessing(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('المعالجة: تنزيل وتخزين ونصّ وتقسيم وتصنيف وربط الحلّ والموضوع؛ المصوّر يفشل بوضوح؛ والاستهلاك يُسجَّل', async () => {
    const r = await requestProcessing(h.db, admin)
    expect(r.count).toBe(2)
    expect(await requestProcessing(h.db, admin)).toMatchObject({ jobId: r.jobId, reused: true })
    // المسار البطيء فقط
    expect(await processQueuedJobs(h.db, { lane: 'default' })).toMatchObject({ processed: 0 })
    const s = await processQueuedJobs(h.db, { lane: 'slow', limit: 1 })
    expect(s).toMatchObject({ processed: 1, completed: 1 })
    const [job] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    expect(job!.result).toMatchObject({ processed: 2, needsReview: 1, failed: 1, exercises: 4 })
    const docs = await listDocuments(h.db, admin)
    const ok = docs.find((d) => d.resourceId === examResourceId)!
    const bad = docs.find((d) => d.resourceId === scannedResourceId)!
    expect(ok).toMatchObject({ status: 'NEEDS_REVIEW', exercisesCount: 4, review: 4, published: 0, duplicatesCount: 0 })
    expect(ok.fileId).toBeTruthy()
    expect(ok.solutionFileId).toBeTruthy()
    expect(ok.textChars).toBeGreaterThan(200)
    expect(Number(ok.aiCostUsd)).toBeGreaterThan(0)
    expect(bad.status).toBe('FAILED')
    expect(bad.error).toMatch(/^scanned:/)
    // التمارين في البنك المركزي: للمراجعة، عامة، أصلها وثيقة، مرقّمة، مصنّفة، بحلّها من التصحيح
    const qs = await h.db.select().from(bankQuestions).where(and(eq(bankQuestions.documentId, ok.id), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt))).orderBy(bankQuestions.sourceExerciseNo)
    expect(qs).toHaveLength(4)
    expect(qs.every((q) => q.workspaceId === null && q.status === 'NEEDS_REVIEW' && q.visibility === 'PUBLIC' && q.origin === 'SOURCED' && q.rightsStatus === 'LICENSED' && q.sourceResourceId === examResourceId && q.originalFileId === ok.fileId && q.examKind === 'BAC' && q.sourceYear === 2023)).toBe(true)
    expect(qs.map((q) => q.sourceExerciseNo)).toEqual([1, 2, 3, 4])
    expect(qs.map((q) => q.sourceTopicNo)).toEqual([1, 1, 1, 2])
    expect(qs.map((q) => Number(q.points))).toEqual([4, 6, 5, 4])
    expect(qs[0]!.sourceLabel).toContain('بكالوريا — 2023')
    expect(qs[0]!.sourceLabel).toContain('علوم تجريبية')
    const nodes = await nodesForMapping(h.db, { subjectId: math, levelId: l3, streamId: sci })
    const slugOf = (id: string | null) => nodes.find((n) => n.id === id)?.slug ?? null
    expect(slugOf(qs[0]!.curriculumNodeId)).toMatch(/^suites|raisonnement|limite-suite/)
    expect(slugOf(qs[1]!.curriculumNodeId)).toMatch(/fonction|derivation|limites/)
    expect(slugOf(qs[2]!.curriculumNodeId)).toMatch(/probabilit|variable/)
    expect(slugOf(qs[3]!.curriculumNodeId)).toMatch(/^ln|logarithme/)
    expect(qs.every((q) => q.aiConfidence != null && Number(q.aiConfidence) > 0)).toBe(true)
    expect(qs[0]!.solution).toContain('هندسية أساسها 3')
    expect(qs[1]!.solution).toContain("f'(x)")
    expect(qs[2]!.solution).toContain('13/28')
    const subs = await h.db.select().from(bankQuestions).where(eq(bankQuestions.parentId, qs[0]!.id))
    expect(subs).toHaveLength(3)
    // سجلّ الاستهلاك: نداءان (وثيقة واحدة بنصّ قصير = نداء) بسياق الوثيقة والتكلفة المقدّرة
    const usage = await h.db.select().from(aiUsageLogs).where(eq(aiUsageLogs.entityId, ok.id))
    expect(usage.length).toBeGreaterThanOrEqual(1)
    expect(usage[0]).toMatchObject({ task: 'exam_doc_extract', entityType: 'exam_document', provider: 'fake', inputTokens: 1000, outputTokens: 500, ok: true })
    expect(Number(usage[0]!.costUsd)).toBeCloseTo(estimateCostUsd('gpt-4.1-mini', 1000, 500), 6)
    expect(estimateCostUsd('gpt-4.1-mini', 1_000_000, 0)).toBe(0.4)
    expect(estimateCostUsd('unknown-model', 1000, 1000)).toBe(0)
    expect(recentAiUsage().some((u) => u.entityId === ok.id)).toBe(true)
    await withAiTask({ task: 't' }, async () => reportAiUsage({ provider: 'x', model: 'claude-sonnet-5', inputTokens: 10, outputTokens: 10, durationMs: 1, ok: false, error: 'boom' }))
    expect(recentAiUsage().at(-1)).toMatchObject({ task: 't', ok: false, error: 'boom' })
    // إشعار المشرف
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(n.some((x) => x.title.includes('محرّك الامتحانات'))).toBe(true)
    // الإحصاءات
    const st = await engineStats(h.db, admin)
    expect(st.docs).toMatchObject({ NEEDS_REVIEW: 1, FAILED: 1, PENDING: 0 })
    expect(st.questions).toMatchObject({ review: 4, published: 0 })
    expect(st.questions.byOrigin.SOURCED).toBe(4)
    expect(st.ai.calls).toBeGreaterThanOrEqual(1)
    expect(st.archive).toEqual({ registered: 2, candidates: 0 })
  })

  it('المراجعة: التمارين لا تظهر للأساتذة قبل الاعتماد؛ الاعتماد ينشرها عامة؛ الرفض يحذف غير المنشور؛ إعادة المعالجة تُبقي المنشور', async () => {
    const docs = await listDocuments(h.db, admin)
    const ok = docs.find((d) => d.resourceId === examResourceId)!
    expect((await listBankQuestions(h.db, teacher, { scope: 'central', subjectId: math })).items).toHaveLength(0)
    await expect(approveDocument(h.db, teacher, ok.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await approveDocument(h.db, admin, ok.id)).toEqual({ approved: 4 })
    expect((await listDocuments(h.db, admin)).find((d) => d.id === ok.id)).toMatchObject({ status: 'PUBLISHED', review: 0, published: 4, reviewedByUserId: admin.userId })
    const central = (await listBankQuestions(h.db, teacher, { scope: 'central', subjectId: math, levelId: l3 })).items
    expect(central).toHaveLength(4)
    expect(central.every((q) => q.status === 'PUBLISHED' && q.origin === 'SOURCED' && q.sourceName === 'DzExams')).toBe(true)
    // صفحة عامة للسؤال تعرف وثيقته الأصلية
    const pq = await publicQuestion(h.db, central.find((q) => q.children > 0)!.id)
    expect(pq.originalResourceId).toBe(examResourceId)
    expect(pq.children.length).toBeGreaterThan(0)
    // إعادة المعالجة: المنشور يبقى، والمستخرج ثانيةً مكرّر فلا يُدرج
    const rp = await reprocessDocument(h.db, admin, ok.id)
    expect(rp.reused).toBe(false)
    expect(await processQueuedJobs(h.db, { lane: 'slow', limit: 1 })).toMatchObject({ processed: 1, completed: 1 })
    const again = (await listDocuments(h.db, admin)).find((d) => d.id === ok.id)!
    expect(again).toMatchObject({ status: 'NEEDS_REVIEW', exercisesCount: 0, duplicatesCount: 4, published: 4, review: 0 })
    await approveDocument(h.db, admin, ok.id)
    // رفض الوثيقة الفاشلة بعد إعادة معالجتها لا يمسّ البنك
    const bad = docs.find((d) => d.resourceId === scannedResourceId)!
    await rejectDocument(h.db, admin, bad.id, 'مصوّرة')
    expect((await listDocuments(h.db, admin, { status: 'FAILED' })).find((d) => d.id === bad.id)!.error).toContain('rejected: مصوّرة')
    expect((await listBankQuestions(h.db, teacher, { scope: 'central', subjectId: math })).items).toHaveLength(4)
  })

  it('الأرشيف العام: القائمة بالمرشّحات والأعداد، وصفحة الوثيقة بالمعاينة الموقّعة والحلّ والتمارين', async () => {
    const all = await listArchive(h.db, {})
    expect(all.items.map((i) => i.year)).toEqual([2023, 2022, 2019])
    const bac = all.items.find((i) => i.id === examResourceId)!
    expect(bac).toMatchObject({ official: true, hasSolution: true, exercises: 4, localPreview: true, source: 'DzExams' })
    expect(bac.solutionUrl).toBe('https://cdn.test/bac-math-2023-corrige.txt')
    expect((await listArchive(h.db, { year: 2023 })).items).toHaveLength(1)
    expect((await listArchive(h.db, { streamId: sci, subjectId: math, levelId: l3 })).items).toHaveLength(3)
    expect((await listArchive(h.db, { q: '2019' })).items).toHaveLength(1)
    const page1 = await listArchive(h.db, {}, { limit: 2 })
    expect(page1.nextCursor).toBeTruthy()
    expect((await listArchive(h.db, {}, { limit: 2, cursor: page1.nextCursor })).items.map((i) => i.year)).toEqual([2019])
    const facets = await archiveFacets(h.db, { subjectId: math })
    expect(facets.total).toBe(3)
    expect(facets.years.map((y) => y.year)).toEqual([2023, 2022, 2019])
    expect(facets.streams[0]).toMatchObject({ id: sci, count: 3 })
    const d = await archiveDocument(h.db, examResourceId)
    expect(d.previewUrl).toMatch(/^\/api\/v1\/files\/[0-9a-f-]{36}\?exp=\d+&sig=/)
    expect(d.solution?.previewUrl).toMatch(/^\/api\/v1\/files\//)
    expect(d.exercises).toHaveLength(4)
    expect(d.exercises.map((e) => [e.topicNo, e.exerciseNo])).toEqual([
      [1, 1],
      [1, 2],
      [1, 3],
      [2, 4]
    ])
    expect(d.exercises[0]!.nodeTitle).toBeTruthy()
    expect(d.exercises[0]!.hasSolution).toBe(true)
    expect(d.document).toMatchObject({ status: 'PUBLISHED', review: 0 })
    expect(d.source?.attribution).toContain('DzExams')
    // غير المنشور لا يظهر للزائر
    await expect(archiveDocument(h.db, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('البناء من البنك المركزي: فتحات بالدرس والصعوبة والنقاط، والتدرّج يحجب ما بعد الدرس المبلوغ، والاستبدال بنفس المعايير', async () => {
    const nodes = await nodesForMapping(h.db, { subjectId: math, levelId: l3, streamId: sci })
    const unit = (slug: string) => nodes.find((n) => n.slug === slug)!.id
    // فتحات: متتاليات (4ن) + دوال (6ن) + احتمالات (5ن) — كلها من البكالوريا الحقيقية
    const r = await buildExamFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 180, exercises: 3, targetPoints: 15, slots: [{ curriculumNodeId: unit('suites'), points: 4 }, { curriculumNodeId: unit('fonctions'), difficulty: 2, points: 6 }, { curriculumNodeId: unit('probabilites'), points: 5 }] })
    expect(r).toMatchObject({ picked: 3, missing: 0, progressApplied: false })
    const v = await getExam(h.db, teacher, r.examId)
    expect(v.items.map((i) => Number(i.points))).toEqual([4, 6, 5])
    expect(v.items[0]!.snapshot.body).toContain('المتتالية')
    expect(v.items[1]!.snapshot.body).toContain('دالة')
    expect(v.items[2]!.snapshot.body).toContain('كيس')
    expect(v.items.every((i) => i.snapshot.solution && i.bankQuestionId)).toBe(true)
    expect(Number(v.totalPoints)).toBe(15)
    // فتحة بلا تمرين مناسب (الهندسة في الفضاء) ⇒ ناقصة برقمها
    const sel = await selectFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 180, exercises: 2, slots: [{ curriculumNodeId: unit('geometrie-espace') }, { curriculumNodeId: unit('logarithme'), difficulty: 1 }] })
    expect(sel.missing).toEqual([{ difficulty: 2, slot: 0 }])
    expect(sel.picked).toHaveLength(1)
    expect(sel.slotOf).toEqual([1])
    // التدرّج: «وصلتُ إلى المتتاليات» ⇒ الدوال والاحتمالات واللوغاريتم محجوبة
    await setTeacherProgress(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci }, unit('suites'))
    expect(await getTeacherProgress(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci })).toMatchObject({ nodeId: unit('suites'), nodeTitle: 'المتتاليات العددية' })
    const allowed = await allowedNodeIds(h.db, { subjectId: math, levelId: l3, streamId: sci }, unit('suites'))
    expect(allowed!.has(unit('suites'))).toBe(true)
    expect(allowed!.has(nodes.find((n) => n.slug === 'limite-suite')!.id)).toBe(true)
    expect(allowed!.has(unit('fonctions'))).toBe(false)
    const limited = await selectFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 180, exercises: 4 })
    expect(limited.progressApplied).toBe(true)
    expect(limited.picked).toHaveLength(1)
    expect(limited.picked[0]!.body).toContain('المتتالية')
    // درس داخل محور: ما قبله من المحور نفسه مسموح وما بعده لا
    const lessonAllowed = await allowedNodeIds(h.db, { subjectId: math, levelId: l3, streamId: sci }, nodes.find((n) => n.slug === 'derivation')!.id)
    expect(lessonAllowed!.has(nodes.find((n) => n.slug === 'limites-continuite')!.id)).toBe(true)
    expect(lessonAllowed!.has(nodes.find((n) => n.slug === 'etude-fonction')!.id)).toBe(false)
    expect(lessonAllowed!.has(unit('suites'))).toBe(true)
    // تجاهل التدرّج صراحةً أو إلغاؤه
    expect((await selectFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 180, exercises: 4, respectProgress: false })).picked).toHaveLength(4)
    await setTeacherProgress(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci }, null)
    expect((await selectFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 180, exercises: 4 })).progressApplied).toBe(false)
    await expect(setTeacherProgress(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci }, '00000000-0000-0000-0000-000000000000')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    // الاستبدال: تمرين الدوال يُستبدل بتمرين آخر غير موجود في الورقة (اللوغاريتم هو الوحيد المتبقّي)
    const fn = v.items[1]!
    const rep = await replaceItem(h.db, teacher, fn.id)
    const v2 = await getExam(h.db, teacher, r.examId)
    expect(v2.items).toHaveLength(3)
    expect(v2.items[1]!.id).toBe(rep.itemId)
    expect(v2.items[1]!.bankQuestionId).not.toBe(fn.bankQuestionId)
    expect(new Set(v2.items.map((i) => i.bankQuestionId)).size).toBe(3)
    expect(Number(v2.items[1]!.points)).toBe(6)
    // لا تمرين متتاليات آخر ⇒ بديل من أي درس (تمرين الدوال المتبقّي)، ثم لا بديل متبقٍّ ⇒ خطأ واضح والورقة كما هي
    const rep2 = await replaceItem(h.db, teacher, v2.items[0]!.id)
    const v3 = await getExam(h.db, teacher, r.examId)
    expect(v3.items[0]!.id).toBe(rep2.itemId)
    expect(v3.items[0]!.snapshot.body).toContain('دالة')
    // ورقة تضمّ البنك كله ⇒ لا بديل ⇒ خطأ واضح والورقة كما هي
    const full = await buildExamFromBank(h.db, teacher, { subjectId: math, levelId: l3, streamId: sci, durationMinutes: 240, exercises: 4 })
    expect(full.picked).toBe(4)
    const vf = await getExam(h.db, teacher, full.examId)
    await expect(replaceItem(h.db, teacher, vf.items[0]!.id)).rejects.toMatchObject({ code: 'BANK_QUESTION_NOT_FOUND' })
    expect((await getExam(h.db, teacher, full.examId)).items).toHaveLength(4)
  })

  it('AI Mode: الطلب الحرّ يُحوَّل إلى مرشّحات بمحاور المنهاج (بالنموذج ثم القواعد)، ولا توليد قبل البنك', async () => {
    const rules = await parseExamRequest(h.db, 'أنشئ اختبار الفصل الأول في الرياضيات للسنة الثالثة ثانوي علوم تجريبية: تمرين في المتتاليات وتمرين في الاحتمالات، ساعتان، 3 تمارين')
    expect(rules).toMatchObject({ subjectId: math, levelId: l3, streamId: sci, schoolTerm: 1, durationMinutes: 120, exercises: 3, via: 'rules' })
    expect(rules.topics).toEqual(['المتتاليات العددية', 'الاحتمالات'])
    expect(rules.curriculumNodeIds).toHaveLength(2)
    // مزوّد يفهم الطلب بأسماء من القوائم فقط
    const ai: AIProvider = { ...fakeAi, parseExamRequest: async (input) => ({ subject: input.subjects.find((s) => s === 'الرياضيات')!, level: null, stream: 'علوم تجريبية', term: 2, durationMinutes: 90, exercises: 2, difficulty: 'hard', topics: ['الدالة اللوغاريتمية', 'محور مخترع'], kind: 'HOMEWORK', raw: {} }) }
    setAiProviderForTests(ai)
    const smart = await parseExamRequestSmart(h.db, 'فرض في الرياضيات للسنة الثالثة ثانوي حول اللوغاريتم، صعب')
    expect(smart).toMatchObject({ via: 'ai', subjectId: math, levelId: l3, streamId: sci, schoolTerm: 2, durationMinutes: 90, exercises: 2, kind: 'HOMEWORK' })
    expect(smart.profile).toEqual({ easy: 10, medium: 40, hard: 50 })
    expect(smart.topics).toEqual(['الدالة اللوغاريتمية'])
    // فشل النموذج ⇒ القواعد
    setAiProviderForTests({ ...fakeAi, parseExamRequest: () => Promise.reject(new Error('down')) })
    expect((await parseExamRequestSmart(h.db, 'اختبار في الرياضيات للسنة الثالثة ثانوي')).via).toBe('rules')
    setAiProviderForTests(fakeAi)
  })
})
