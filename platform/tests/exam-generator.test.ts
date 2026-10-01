import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, GenerateExamItemsInput } from '@/server/ai/types'
import { parseExamItems } from '@/server/ai/shared'
import type { DatabaseHandle } from '@/server/db/connect'
import { bankQuestions, jobs, levels, notifications, streams, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { applyVariant, shuffleWith } from '@/server/lib/exam-render'
import { buildExamFromBank, parseExamRequest, quotaOf, requestAiBuild, selectFromBank } from '@/server/services/exam-generator.service'
import { getExam } from '@/server/services/exams.service'
import { createBankQuestion, listBankQuestions } from '@/server/services/question-bank.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let arabic: string
let l3: string
let sci: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  // بنك: 2 سهل، 3 متوسط، 2 صعب (منها واحد طويل جداً)، وواحد لشعبة أخرى، وواحد مسودة
  const mk = (body: string, difficulty: 1 | 2 | 3 | 4, minutes: number, extra: Record<string, unknown> = {}) => createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', body, points: 4, difficulty, estimatedMinutes: minutes, subjectId: arabic, levelId: l3, schoolTerm: 1, ...extra })
  await mk('سهل 1', 1, 10)
  await mk('سهل 2', 1, 10)
  await mk('متوسط 1', 2, 20)
  await mk('متوسط 2', 2, 20, { schoolTerm: 2 })
  await mk('متوسط 3', 2, 20)
  await mk('صعب 1', 3, 30, { streamId: sci })
  await mk('صعب طويل', 4, 500)
  await mk('مسودة', 2, 10, { status: 'DRAFT' })
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('بناء الامتحان تلقائياً — المرحلة 5', () => {
  it('حصص الصعوبة', () => {
    expect(quotaOf(4)).toEqual({ 1: 1, 2: 2, 3: 1 })
    expect(quotaOf(4, { easy: 10, medium: 50, hard: 40 })).toEqual({ 1: 0, 2: 2, 3: 2 })
    expect(quotaOf(1, { easy: 0, medium: 0, hard: 100 })).toEqual({ 1: 0, 2: 0, 3: 1 })
    expect(quotaOf(3, { easy: 0, medium: 0, hard: 0 })).toEqual({ 1: 0, 2: 3, 3: 0 })
  })

  it('الاختيار من البنك يحترم الصعوبة والمدة والفصل ويستبعد المسودات والطويل', async () => {
    const sel = await selectFromBank(h.db, teacher, { subjectId: arabic, levelId: l3, streamId: sci, schoolTerm: 1, durationMinutes: 120, exercises: 4 })
    expect(sel.pool).toBe(7)
    expect(sel.missing).toEqual([])
    const bodies = sel.picked.map((q) => q.body)
    expect(bodies).toHaveLength(4)
    expect(bodies).toContain('صعب 1')
    expect(bodies).not.toContain('صعب طويل')
    expect(bodies).not.toContain('مسودة')
    // المتوسط من الفصل الأول يتقدّم على الفصل الثاني
    expect(bodies.filter((b) => b.startsWith('متوسط')).sort()).toEqual(['متوسط 1', 'متوسط 3'])
    // الاستبعاد يعمل، ونقص الصعب يُعوَّض من المتاح
    const sel2 = await selectFromBank(h.db, teacher, { subjectId: arabic, levelId: l3, streamId: sci, durationMinutes: 120, exercises: 4, profile: { easy: 0, medium: 0, hard: 100 } }, sel.picked.map((q) => q.id))
    const rest = sel2.picked.map((q) => q.body)
    expect(rest).toHaveLength(2)
    expect(rest).toContain('متوسط 2')
    expect(rest.some((b) => b.startsWith('سهل'))).toBe(true)
    expect(sel2.missing).toHaveLength(2)
    // ميزانية زمنية ضيّقة: لا يتجاوزها
    const sel3 = await selectFromBank(h.db, teacher, { subjectId: arabic, levelId: l3, durationMinutes: 25, exercises: 4 })
    expect(sel3.picked.reduce((a, q) => a + (q.estimatedMinutes ?? 0), 0)).toBeLessThanOrEqual(25)
    expect(sel3.picked.length + sel3.missing.length).toBe(4)
  })

  it('البناء الفوري من البنك: امتحان مسودة بعنوان مشتقّ ونقاط موزّعة', async () => {
    const r = await buildExamFromBank(h.db, teacher, { subjectId: arabic, levelId: l3, schoolTerm: 1, durationMinutes: 120, exercises: 3, targetPoints: 20 })
    expect(r.picked).toBe(3)
    expect(r.missing).toBe(0)
    const v = await getExam(h.db, teacher, r.examId)
    expect(v.title).toBe('اختبار الفصل الأول في اللغة العربية')
    expect(v.status).toBe('DRAFT')
    expect(v.items.every((i) => i.bankQuestionId)).toBe(true)
    expect(Number(v.totalPoints)).toBe(20)
    await expect(buildExamFromBank(h.db, teacher, { subjectId: arabic, levelId: l3, durationMinutes: 60, exercises: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('الناقص يولّده الذكاء الاصطناعي مشابهاً للبنك، موسوماً في الورقة ونسخةً في المراجعة', async () => {
    setAiProviderForTests(null)
    // بلا مزوّد: لا مهمة، والورقة تحوي ما وجده البنك
    const noAi = await requestAiBuild(h.db, teacher, { subjectId: arabic, levelId: l3, durationMinutes: 120, exercises: 8, allowAi: true })
    expect(noAi.jobId).toBeNull()
    expect(noAi.missing).toBeGreaterThan(0)

    const calls: GenerateExamItemsInput[] = []
    const generator = {
      name: 'anthropic',
      model: 'x',
      async generateExamItems(input: GenerateExamItemsInput) {
        calls.push(input)
        return parseExamItems({
          questions: Array.from({ length: input.count }, (_, i) => ({ kind: 'EXERCISE', type: 'OPEN', title: `مولَّد ${input.difficulty} ${i + 1}`, body: `تمرين مولَّد (${input.difficulty}) رقم ${i + 1}`, options: [], answer_key: null, solution: 'حلّ مولَّد', points: 4, difficulty: input.difficulty === 'صعب' ? 3 : input.difficulty === 'سهل' ? 1 : 2, estimated_minutes: input.minutesEach, topic: null, keywords: ['مولَّد'], children: [{ kind: 'QUESTION', type: 'OPEN', title: null, body: 'سؤال فرعي', options: [], answer_key: null, solution: null, points: 2, difficulty: 2, estimated_minutes: null, topic: null, keywords: [] }] })),
          note: null
        })
      }
    } as unknown as AIProvider
    setAiProviderForTests(generator)
    const r = await requestAiBuild(h.db, teacher, { subjectId: arabic, levelId: l3, schoolTerm: 1, durationMinutes: 180, exercises: 8, targetPoints: 20, allowAi: true })
    expect(r.jobId).not.toBeNull()
    expect(r.picked + r.missing).toBe(8)
    await processQueuedJobs(h.db)
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId!))
    expect(j!.status).toBe('COMPLETED')
    expect(j!.result).toMatchObject({ generated: r.missing })
    // الأمثلة من البنك وصلت إلى المولّد
    expect(calls.length).toBeGreaterThan(0)
    expect(calls[0]!.examples.length).toBeGreaterThan(0)
    expect(calls[0]!.subject).toBe('اللغة العربية')
    expect(calls[0]!.term).toBe(1)
    const v = await getExam(h.db, teacher, r.examId)
    const exercises = v.items.filter((i) => i.kind === 'EXERCISE')
    expect(exercises).toHaveLength(8)
    const generated = exercises.filter((i) => !i.bankQuestionId)
    expect(generated).toHaveLength(r.missing)
    expect(generated.every((i) => i.snapshot.sourceLabel === 'مولَّد بالذكاء الاصطناعي — راجعه' && i.snapshot.solution === 'حلّ مولَّد' && i.snapshot.children?.length === 1)).toBe(true)
    expect(Number(v.totalPoints)).toBe(20)
    // في البنك: نسخ بانتظار المراجعة فقط، لا في «الكل»
    const review = await listBankQuestions(h.db, teacher, { scope: 'review' })
    expect(review.items).toHaveLength(r.missing)
    expect(review.items.every((i) => i.status === 'NEEDS_REVIEW' && i.sourceLabel === 'مولَّد بالذكاء الاصطناعي' && i.subjectId === arabic && i.levelId === l3)).toBe(true)
    expect((await listBankQuestions(h.db, teacher, { scope: 'all', q: 'مولَّد' })).items).toHaveLength(0)
    expect((await h.db.select().from(bankQuestions).where(eq(bankQuestions.status, 'NEEDS_REVIEW'))).every((q) => q.contentHash)).toBe(true)
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title === 'اكتمل بناء الامتحان' && x.link === `/teacher/exams/${r.examId}`)).toBe(true)
  })

  it('فشل المولّد يُبلَّغ ولا يُفسد ما بناه البنك', async () => {
    setAiProviderForTests({ name: 'openai', model: 'x', async generateExamItems() { throw new Error('boom') } } as unknown as AIProvider)
    const r = await requestAiBuild(h.db, teacher, { subjectId: arabic, levelId: l3, durationMinutes: 120, exercises: 8, allowAi: true })
    expect(r.jobId).not.toBeNull()
    await processQueuedJobs(h.db)
    await processQueuedJobs(h.db, { now: new Date(Date.now() + 10 * 60_000) })
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId!))
    expect(j!.status).toBe('FAILED')
    const v = await getExam(h.db, teacher, r.examId)
    expect(v.items.length).toBe(r.picked)
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title === 'لم يكتمل توليد الامتحان')).toBe(true)
  })

  it('الطلب الحرّ بالعربية يُفهم بلا نموذج', async () => {
    const p = await parseExamRequest(h.db, 'أنشئ اختباراً لمدة ساعتين للسنة الثالثة ثانوي علوم تجريبية في اللغة العربية، الفصل الأول، أربعة تمارين، مستوى متوسط إلى صعب')
    expect(p).toEqual({ subjectId: arabic, levelId: l3, streamId: sci, schoolTerm: 1, durationMinutes: 120, exercises: 4, profile: { easy: 10, medium: 50, hard: 40 }, kind: 'TEST' })
    const q = await parseExamRequest(h.db, 'فرض في الرياضيات للثانية ثانوي، ١ ساعة و٣٠ دقيقة، 3 تمارين، سهل')
    expect(q.levelId).not.toBeNull()
    expect(q.subjectId).not.toBe(arabic)
    expect(q).toMatchObject({ durationMinutes: 90, exercises: 3, kind: 'HOMEWORK', profile: { easy: 60, medium: 35, hard: 5 }, schoolTerm: null })
    const empty = await parseExamRequest(h.db, 'شيء غامض')
    expect(empty).toMatchObject({ subjectId: null, levelId: null, durationMinutes: null, exercises: null, profile: null })
  })

  it('النسخ A/B/C/D حتمية، تحفظ فواصل الصفحات، وتخلط الاختيارات', () => {
    const items = [
      { id: '1', kind: 'EXERCISE', snapshot: { options: undefined, children: [{ options: [{ label: 'أ', isCorrect: true }, { label: 'ب', isCorrect: false }, { label: 'ج', isCorrect: false }] }] } },
      { id: '2', kind: 'QUESTION', snapshot: { options: [{ label: 'س', isCorrect: false }, { label: 'ص', isCorrect: true }, { label: 'ع', isCorrect: false }, { label: 'غ', isCorrect: false }] } },
      { id: '3', kind: 'QUESTION', snapshot: {} },
      { id: 'pb', kind: 'PAGE_BREAK', snapshot: {} },
      { id: '4', kind: 'EXERCISE', snapshot: {} },
      { id: '5', kind: 'EXERCISE', snapshot: {} }
    ]
    const examId = '11111111-1111-4111-8111-111111111111'
    expect(applyVariant(items, examId, 'A')).toBe(items)
    const b1 = applyVariant(items, examId, 'B')
    const b2 = applyVariant(items, examId, 'B')
    expect(b1.map((i) => i.id)).toEqual(b2.map((i) => i.id))
    expect(b1[3]!.id).toBe('pb')
    expect(b1.slice(0, 3).map((i) => i.id).sort()).toEqual(['1', '2', '3'])
    expect(b1.slice(4).map((i) => i.id).sort()).toEqual(['4', '5'])
    const q2 = b1.find((i) => i.id === '2')!
    expect(q2.snapshot.options!.filter((o) => o.isCorrect)).toHaveLength(1)
    expect(q2.snapshot.options!.map((o) => o.label).sort()).toEqual(['س', 'ص', 'ع', 'غ'])
    const c = applyVariant(items, examId, 'C')
    const orders = new Set([b1, c, applyVariant(items, examId, 'D')].map((v) => v.map((i) => i.id).join(',') + '|' + v.find((i) => i.id === '2')!.snapshot.options!.map((o) => o.label).join('')))
    expect(orders.size).toBeGreaterThan(1)
    expect(shuffleWith([1, 2, 3, 4, 5], 7)).toEqual(shuffleWith([1, 2, 3, 4, 5], 7))
    expect(shuffleWith([1, 2, 3, 4, 5], 7)).not.toEqual([1, 2, 3, 4, 5])
  })
})
