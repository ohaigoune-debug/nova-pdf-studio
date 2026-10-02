import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { languageOfSubject, topicNumberOf } from '@/lib/bac-bank'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, DetailSolutionInput, ExtractQuestionsInput, ExtractedQuestion } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { bankQuestions, examDocuments, levels, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { installAiUsageSink } from '@/server/services/ai-usage.service'
import { bacInventory, examExercises, getExercises, inventoryCsv, registerAllBacDocuments, requestSolutionDetails, reviewSolutionDetail, searchBacExercises, solutionDetailQueue, verifyDocument } from '@/server/services/bac-bank.service'
import { approveDocument, processDocument, registerBacDocuments } from '@/server/services/exam-engine.service'
import { upsertResource } from '@/server/services/resources.service'
import { makeAdmin, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let math: string
let physics: string
let l3: string
let sci: string

const EXAM_TEXT = `بكالوريا 2024 — الرياضيات — شعبة علوم تجريبية — الموضوع الأول
التمرين الأول (04 نقاط)
نعتبر الدالة الأسية f المعرفة على R بـ f(x) = (x+1)e^{-x}.
1) احسب نهاية f عند +∞.
2) ادرس اتجاه تغير f.
التمرين الثاني (05 نقاط)
يحتوي كيس على 4 كرات حمراء و 2 كرات خضراء. نسحب عشوائياً كرتين.
1) احسب احتمال سحب كرتين من نفس اللون.
`
const SOLUTION_TEXT = `حل التمرين الأول: النهاية 0. f'(x) = -x e^{-x}.
حل التمرين الثاني: p = 7/15.
`
const SITE: Record<string, string> = { 'https://cdn.test/bac-math-2024-t1.txt': EXAM_TEXT, 'https://cdn.test/bac-math-2024-t1-corrige.txt': SOLUTION_TEXT }
const fakeFetch = (async (u: RequestInfo | URL) => {
  const hit = SITE[String(u)]
  return hit ? new Response(hit, { headers: { 'content-type': 'text/plain; charset=utf-8' } }) : new Response('nf', { status: 404 })
}) as typeof fetch

let detailCalls: DetailSolutionInput[] = []
const fakeAi: AIProvider = {
  name: 'fake',
  model: 'fake-1',
  evaluateEssay: () => Promise.reject(new Error('n/a')),
  generateTeacherInsights: () => Promise.reject(new Error('n/a')),
  generateExercises: () => Promise.reject(new Error('n/a')),
  analyzeStudent: () => Promise.reject(new Error('n/a')),
  async extractQuestions(input: ExtractQuestionsInput) {
    const parts = input.text.split(/\n(?=التمرين )/).slice(1)
    const questions: ExtractedQuestion[] = parts.map((p) => {
      const [head, ...lines] = p.split('\n')
      const body = lines.filter((l) => !/^\d\)/.test(l) && l.trim()).join('\n')
      const children = lines.filter((l) => /^\d\)/.test(l)).map((l) => ({ kind: 'QUESTION' as const, type: 'OPEN' as const, title: null, body: l.replace(/^\d\)\s*/, ''), options: [], answerKey: null, solution: null, points: 2, difficulty: 2 as const, estimatedMinutes: null, topic: null, keywords: [] }))
      return { kind: 'EXERCISE', type: 'OPEN', title: head!.replace(/\s*\(.*\)$/, ''), body, options: [], answerKey: null, solution: null, points: 4, difficulty: 2, estimatedMinutes: 30, topic: null, keywords: [], children }
    })
    return { questions, note: null }
  },
  async detailSolution(input: DetailSolutionInput) {
    detailCalls.push(input)
    return { shortAnswer: 'النهاية تساوي 0', steps: ['نكتب f(x) = (x+1)/e^x', 'النمو المقارن يعطي 0'], rule: 'النهايات المرجعية', why: 'الأسية تغلب كثير الحدود', commonMistakes: ['نسيان الإشارة'], faster: null, teacherNotes: null, bareme: [{ label: 'النهاية', points: 2 }, { label: 'التغيّرات', points: 2 }], children: [{ shortAnswer: '0', steps: ['…'], commonMistakes: [] }], selfChecked: input.scientific, uncertainties: [] }
  }
}

beforeAll(async () => {
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'bac-uploads-'))
  process.env.DRIVE_CACHE_DIR = await mkdtemp(path.join(tmpdir(), 'bac-cache-'))
  h = await setupDb()
  await seedCurriculum(h.db)
  installAiUsageSink(h.db)
  admin = await makeAdmin(h.db)
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  physics = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'PHYSICS')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  const common = { sourceCode: 'dzexams', levelId: l3, streamId: sci, isOfficial: true, accessLevel: 'PUBLIC' as const, status: 'PUBLISHED' as const, originalAuthor: 'الديوان الوطني للامتحانات والمسابقات' }
  const sol = await upsertResource(h.db, { ...common, subjectId: math, ref: 'https://dz.test/M2024T1', part: 'correction', type: 'SOLUTION', title: 'تصحيح', fileUrl: 'https://cdn.test/bac-math-2024-t1-corrige.txt', examYear: 2024, examSession: 'NORMAL' })
  await upsertResource(h.db, { ...common, subjectId: math, ref: 'https://dz.test/M2024T1', type: 'EXAM', title: 'موضوع الرياضيات شعبة علوم تجريبية — الموضوع الأول — بكالوريا 2024', fileUrl: 'https://cdn.test/bac-math-2024-t1.txt', sourceUrl: 'https://dz.test/M2024T1', examYear: 2024, examSession: 'NORMAL', hasSolution: true, solutionResourceId: sol.id })
  await upsertResource(h.db, { ...common, subjectId: math, ref: 'https://dz.test/M2024T2', type: 'EXAM', title: 'موضوع الرياضيات شعبة علوم تجريبية — الموضوع الثاني — بكالوريا 2024', fileUrl: 'https://cdn.test/none.pdf', examYear: 2024, examSession: 'NORMAL' })
  await upsertResource(h.db, { ...common, subjectId: math, ref: 'https://dz.test/M2022', type: 'EXAM', title: 'موضوع الرياضيات ع.ت — بكالوريا 2022', fileUrl: 'https://cdn.test/none2.pdf', examYear: 2022, examSession: 'NORMAL' })
  await upsertResource(h.db, { ...common, subjectId: math, ref: 'https://dz.test/M2022b', type: 'EXAM', title: 'موضوع الرياضيات علوم تجريبية بكالوريا 2022 (نسخة ثانية)', fileUrl: 'https://cdn.test/none3.pdf', examYear: 2022, examSession: 'NORMAL' })
  await upsertResource(h.db, { ...common, subjectId: physics, ref: 'https://dz.test/P2024', type: 'EXAM', title: 'موضوع العلوم الفيزيائية — بكالوريا 2024', fileUrl: 'https://cdn.test/p.pdf', examYear: 2024, examSession: 'NORMAL' })
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('بنك البكالوريا — دوال خالصة', () => {
  it('رقم الموضوع ولغة المادة', () => {
    expect(topicNumberOf('موضوع الرياضيات — الموضوع الأول — بكالوريا 2024')).toBe(1)
    expect(topicNumberOf('الموضوع الثاني بكالوريا 2019')).toBe(2)
    expect(topicNumberOf('Sujet 2 — Bac 2021')).toBe(2)
    expect(topicNumberOf('موضوع 01 اللغة العربية')).toBe(1)
    expect(topicNumberOf('موضوع الرياضيات ع.ت')).toBeNull()
    expect(languageOfSubject('FRENCH')).toBe('fr')
    expect(languageOfSubject('MATH')).toBe('ar')
  })
})

describe('بنك البكالوريا — الجرد والتسجيل والجودة والحلول', () => {
  it('الجرد قبل أي معالجة: الأعداد، الحلول الناقصة، المكرّرات، السنوات الغائبة، CSV', async () => {
    const inv = await bacInventory(h.db, admin)
    expect(inv.totals.exams).toBe(5)
    expect(inv.totals.withSolution).toBe(1)
    expect(inv.totals.missingSolutions).toBe(4)
    expect(inv.totals.registered).toBe(0)
    expect(inv.progress).toBe(0)
    expect(inv.duplicates).toHaveLength(1) // 2022 رياضيات ع.ت بلا رقم موضوع ×2
    expect(inv.totals.duplicates).toBe(1)
    expect(inv.missingYears.find((m) => m.subjectCode === 'MATH')!.years).toEqual([2023])
    expect(inv.coverage.find((c) => c.subjectCode === 'MATH')!.years).toEqual({ 2024: 2, 2022: 2 })
    expect(inv.cells.find((c) => c.topic === 2)!.needsProcessing).toBe(true)
    const csv = inventoryCsv(inv)
    expect(csv.split('\n')).toHaveLength(6)
    expect(csv).toContain('"علوم تجريبية","الرياضيات","1"')
  })

  it('التسجيل الشامل لكل المواد (رقم الموضوع واللغة)، ثم المعالجة تسجّل البصمة وعدد الصفحات', async () => {
    const r = await registerAllBacDocuments(h.db, admin, {})
    expect(r.registered).toBe(5)
    expect(r.bySubject).toEqual({ MATH: 4, PHYSICS: 1 })
    expect((await registerAllBacDocuments(h.db, admin, {})).registered).toBe(0)
    expect((await registerBacDocuments(h.db, admin, {})).registered).toBe(0) // التسجيل القديم لا يكرّر
    const docs = await h.db.select().from(examDocuments)
    expect(docs.find((d) => d.title.includes('الموضوع الأول'))!.topicNumber).toBe(1)
    expect(docs.find((d) => d.title.includes('الموضوع الثاني'))!.topicNumber).toBe(2)
    expect(docs.every((d) => d.language === 'ar')).toBe(true)
    setAiProviderForTests(fakeAi)
    const t1 = docs.find((d) => d.title.includes('الموضوع الأول'))!
    const p = await processDocument(h.db, t1.id, { userId: admin.userId, fetch: fakeFetch })
    expect(p.status).toBe('NEEDS_REVIEW')
    expect(p.exercises).toBe(2)
    const [after] = await h.db.select().from(examDocuments).where(eq(examDocuments.id, t1.id))
    expect(after!.pdfHash).toMatch(/^[0-9a-f]{64}$/)
    expect(after!.solutionPdfHash).toMatch(/^[0-9a-f]{64}$/)
    const inv = await bacInventory(h.db, admin)
    expect(inv.totals.registered).toBe(5)
    expect(inv.totals.pendingReview).toBe(1)
    expect(inv.totals.exercises).toBe(2)
    expect(inv.totals.classified).toBeGreaterThanOrEqual(1) // الدالة الأسية والاحتمالات مصنّفتان
  })

  it('التوثيق (قائمة الفحص الآلية + المشرف) ثم الاعتماد؛ ولا يُنشر للطلاب قبل الاعتماد', async () => {
    const [t1] = await h.db.select().from(examDocuments).where(eq(examDocuments.topicNumber, 1))
    const v = await verifyDocument(h.db, admin, t1!.id, { numbers: true, equations: true, figures: true, complete: true, topic: true, bareme: true, note: 'فُحص يدوياً' })
    expect(v.quality.year).toBe(true)
    expect(v.quality.notDuplicate).toBe(true)
    expect(v.quality.solution).toBe(true)
    expect(v.missing).toEqual(['pages']) // ملف نصّي بلا صفحات PDF — يبقى البند معلّقاً
    const [verified] = await h.db.select().from(examDocuments).where(eq(examDocuments.id, t1!.id))
    expect(verified!.status).toBe('VERIFIED')
    expect(verified!.quality.note).toBe('فُحص يدوياً')
    // قبل الاعتماد: لا تمارين للجمهور
    expect(await examExercises(h.db, t1!.id, { admin: false })).toHaveLength(0)
    const a = await approveDocument(h.db, admin, t1!.id)
    expect(a.approved).toBe(2)
    expect((await h.db.select().from(examDocuments).where(eq(examDocuments.id, t1!.id)))[0]!.status).toBe('PUBLISHED')
    expect(await examExercises(h.db, t1!.id, { admin: false })).toHaveLength(2)
    await expect(verifyDocument(h.db, admin, (await h.db.select().from(examDocuments).where(eq(examDocuments.topicNumber, 2)))[0]!.id, {})).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('الحلول المفصّلة: دفعة بنقاط تحقّق ← مراجعة ← تظهر للجمهور بعد الاعتماد فقط', async () => {
    detailCalls = []
    const r = await requestSolutionDetails(h.db, admin, { limit: 10 })
    expect(r.count).toBe(2)
    expect((await requestSolutionDetails(h.db, admin, { limit: 10 })).reused).toBe(true)
    await processQueuedJobs(h.db, { lane: 'slow' })
    expect(detailCalls).toHaveLength(2)
    expect(detailCalls[0]!.scientific).toBe(true)
    expect(detailCalls[0]!.exercise.officialSolution).toBeTruthy()
    const [t1] = await h.db.select().from(examDocuments).where(eq(examDocuments.topicNumber, 1))
    const pub = await examExercises(h.db, t1!.id, { admin: false })
    expect(pub.every((e) => e.detail === null)).toBe(true)
    const adm = await examExercises(h.db, t1!.id, { admin: true })
    expect(adm[0]!.detail?.verified).toBe(false)
    expect(adm[0]!.detail?.steps).toHaveLength(2)
    const queue = await solutionDetailQueue(h.db, admin)
    expect(queue).toHaveLength(2)
    await reviewSolutionDetail(h.db, admin, queue[0]!.id, 'approve')
    await reviewSolutionDetail(h.db, admin, queue[1]!.id, 'reject')
    expect(await solutionDetailQueue(h.db, admin)).toHaveLength(0)
    const after = await examExercises(h.db, t1!.id, { admin: false })
    expect(after.filter((e) => e.detail?.verified).length).toBe(1)
    expect((await h.db.select().from(bankQuestions).where(eq(bankQuestions.id, queue[1]!.id)))[0]!.solutionDetail).toBeNull()
    // بلا شيء معلّق بعد (المرفوض يعود إلى الطابور)
    expect((await requestSolutionDetails(h.db, admin, { limit: 10 })).count).toBe(1)
    const inv = await bacInventory(h.db, admin)
    expect(inv.totals.published).toBe(1)
    expect(inv.totals.detailedVerified).toBe(1)
    expect(inv.progress).toBe(20)
  })

  it('البحث الذكي وواجهة getExercises لمولّد الاختبارات', async () => {
    const hits = await searchBacExercises(h.db, 'الدالة الأسية')
    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0]!.label).toMatch(/^BAC 2024 علوم تجريبية — الرياضيات — الموضوع 1 تمرين 1$/)
    expect((await searchBacExercises(h.db, 'احتمال')).length).toBeGreaterThanOrEqual(1)
    expect(await searchBacExercises(h.db, 'x')).toEqual([])
    const ex = await getExercises(h.db, { subject: 'MATH', stream: 'SCI', chapter: 'exponentielle', difficulty: 2, source: 'BAC', year: 2024 })
    expect(ex).toHaveLength(1)
    expect(ex[0]!.children).toHaveLength(2)
    expect(ex[0]!.nodeTitle).toContain('الأسية')
    expect(await getExercises(h.db, { subject: 'MATH', chapter: 'الاحتمالات' })).toHaveLength(1)
    expect(await getExercises(h.db, { subject: 'MATH', lesson: 'nope-lesson' })).toEqual([])
    expect(await getExercises(h.db, { subject: 'MATH', difficulty: [3, 4] })).toEqual([])
    expect(await getExercises(h.db, { subject: 'PHYSICS' })).toEqual([])
    expect((await getExercises(h.db, { subject: math, exclude: [ex[0]!.id] })).some((e) => e.id === ex[0]!.id)).toBe(false)
  })
})
