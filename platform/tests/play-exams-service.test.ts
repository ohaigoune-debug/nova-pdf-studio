/**
 * MADRASA PLAY — تشغيل مجموعات الفروض والاختبارات (تدريب / محاكاة) على قاعدة حقيقية (PGlite):
 * الظهور حسب الاعتماد والشعبة، الوصول (تجربة 72 ساعة)، التصحيح في الخادم، عدم التنقيط المزدوج، النتيجة على 20.
 */
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playExamSets } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { readExamSetFile, validateExamSet } from '@/server/play/exams/engine'
import type { ExamSetDocument, StepAnswer, TrainingStep } from '@/server/play/exams/types'
import { finishExamAttempt, getExamAttemptView, getExamProgress, getExamResult, listExamSets, startExamAttempt, submitExamStep } from '@/server/services/play-exams.service'
import { setPlayProfile } from '@/server/services/play.service'
import { makeStudent, setupDb } from './helpers'

const FILE = 'content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json'
let h: DatabaseHandle
let approvedId: string
let reviewId: string
let doc: ExamSetDocument
const T0 = new Date('2026-11-03T09:00:00Z')
const H = 3_600_000

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

function rightAnswer(s: TrainingStep): StepAnswer {
  const a = s.answer
  switch (a.type) {
    case 'mcq':
      return { type: 'mcq', choice: a.correct }
    case 'multi':
      return { type: 'multi', choices: a.correct }
    case 'fill_blank':
      return { type: 'fill_blank', blanks: a.blanks.map((b) => b[0]!) }
    case 'matching':
      return { type: 'matching', pairs: a.pairs }
    default:
      throw new Error(`no right answer helper for ${a.type}`)
  }
}

async function student(stream: string): Promise<Actor> {
  const s = await makeStudent(h.db, 'تلميذ اختبارات')
  await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: stream })
  return s
}

beforeAll(async () => {
  h = await setupDb()
  const { doc: d, checksum } = readExamSetFile(FILE)
  doc = d
  // نسخة «معتمدة» داخل الاختبار فقط (محاكاة قرار صاحب المنصة) — الملف في المستودع يبقى «قيد المراجعة»
  const approved: ExamSetDocument = structuredClone(d)
  approved.set_id = 'ar-2as-t1-sci-03-approved-test'
  approved.status = 'APPROVED'
  approved.source.verified = true
  for (const s of approved.steps) if (s.type !== 'essay_builder') s.review_status = 'approved'
  const v = validateExamSet(approved)
  expect(v.publishable).toBe(true)
  const base = { kind: 'TEST', gradeCode: '2AS', streamCodes: d.source.streams, subjectCode: 'AR', year: d.source.year, term: 1, paper: null, scoreTotal: 20, stepCount: d.steps.length }
  const [a] = await h.db.insert(playExamSets).values({ ...base, setId: approved.set_id, title: approved.source.title, status: 'APPROVED', publishable: true, checksum: 'approved-' + checksum, document: approved }).returning()
  const [r] = await h.db.insert(playExamSets).values({ ...base, setId: d.set_id, title: d.source.title, status: d.status, publishable: false, checksum, document: d }).returning()
  approvedId = a!.id
  reviewId = r!.id
})

afterEach(() => {
  delete process.env.PLAY_EXAM_PREVIEW
})

afterAll(async () => {
  await h.close()
})

describe('visibility', () => {
  it('students see approved sets of their level and stream only; review sets stay hidden', async () => {
    const sci = await student('SCI')
    const list = await listExamSets(h.db, sci, { subjectCode: 'AR', kind: 'TESTS' })
    expect(list.items.map((i) => i.id)).toEqual([approvedId])
    expect(list.items[0]).toMatchObject({ interactivePoints: 16, deferredPoints: 4, stepCount: 35, preview: false })
    const lit = await student('LIT')
    expect((await listExamSets(h.db, lit, { subjectCode: 'AR', kind: 'TESTS' })).items).toEqual([])
    await expectCode(() => startExamAttempt(h.db, sci, reviewId, 'PRACTICE', T0), 'PLAY_EXAM_NOT_FOUND')
    await expectCode(() => startExamAttempt(h.db, lit, approvedId, 'PRACTICE', T0), 'PLAY_EXAM_NOT_FOUND')
  })

  it('PLAY_EXAM_PREVIEW=1 (development only) shows review sets with a preview badge', async () => {
    process.env.PLAY_EXAM_PREVIEW = '1'
    const sci = await student('SCI')
    const list = await listExamSets(h.db, sci, { subjectCode: 'AR', kind: 'TESTS' })
    expect(list.items.find((i) => i.id === reviewId)?.preview).toBe(true)
  })
})

describe('practice mode', () => {
  it('grades on the server with instant feedback, counts the first answer only, and totals the original weights', async () => {
    const s = await student('SCI')
    const { attemptId, resumed } = await startExamAttempt(h.db, s, approvedId, 'PRACTICE', T0)
    expect(resumed).toBe(false)
    expect((await startExamAttempt(h.db, s, approvedId, 'PRACTICE', T0)).attemptId).toBe(attemptId)
    const view = await getExamAttemptView(h.db, s, attemptId)
    expect(view.steps).toHaveLength(35)
    expect(JSON.stringify(view.steps)).not.toContain('"correct"')
    expect(view.deferred.map((d) => d.label)).toEqual(['الوجاهة', 'سلامة اللّغة', 'الانسجام', 'الإتقان'])

    const steps = doc.steps.filter((x) => x.type !== 'essay_builder')
    const first = steps[0]!
    const ok = await submitExamStep(h.db, s, attemptId, first.id, rightAnswer(first), T0)
    expect(ok.feedback).toMatchObject({ correct: true, earned: first.points })
    const again = await submitExamStep(h.db, s, attemptId, first.id, { type: 'mcq', choice: 99 }, T0)
    expect(again.alreadyAnswered).toBe(true)
    expect(again.score).toBe(first.points)

    const second = steps[1]!
    const wrong: StepAnswer = second.answer.type === 'matching' ? { type: 'matching', pairs: [...second.answer.pairs].reverse() } : { type: 'mcq', choice: -1 }
    const w = await submitExamStep(h.db, s, attemptId, second.id, wrong, T0)
    expect(w.feedback!.correct).toBe(false)
    expect(w.feedback!.correctText.length).toBeGreaterThan(0)

    for (const st of steps.slice(2)) await submitExamStep(h.db, s, attemptId, st.id, rightAnswer(st), T0)
    await expectCode(() => submitExamStep(h.db, s, attemptId, 's36', { type: 'short_text', text: 'x' }, T0), 'PLAY_STEP_NOT_FOUND')
    await finishExamAttempt(h.db, s, attemptId, T0)
    const r = await getExamResult(h.db, s, attemptId)
    expect(r.interactiveMax).toBe(16)
    expect(r.deferredPoints).toBe(4)
    expect(r.earned).toBeCloseTo(16 - second.points + w.feedback!.earned)
    expect(r.byPart.map((p) => p.max + p.deferred)).toEqual([8, 8, 4])
    await expectCode(() => submitExamStep(h.db, s, attemptId, steps[3]!.id, rightAnswer(steps[3]!), T0), 'PLAY_EXAM_CLOSED')
  })
})

describe('exam mode', () => {
  it('reveals nothing until the end, then shows the full correction', async () => {
    const s = await student('SCI')
    const { attemptId } = await startExamAttempt(h.db, s, approvedId, 'EXAM', T0)
    const st = doc.steps[0]!
    const res = await submitExamStep(h.db, s, attemptId, st.id, rightAnswer(st), T0)
    expect(res.feedback).toBeNull()
    expect(res.score).toBeNull()
    const mid = await getExamAttemptView(h.db, s, attemptId)
    expect(mid.score).toBe(0)
    expect(mid.answered[st.id]!.feedback).toBeNull()
    await finishExamAttempt(h.db, s, attemptId, T0)
    const r = await getExamResult(h.db, s, attemptId)
    expect(r.earned).toBe(st.points)
    expect(r.steps.find((x) => x.id === st.id)!.feedback!.correct).toBe(true)
    const p = await getExamProgress(h.db, s)
    expect(p.byKind.find((k) => k.kind === 'TEST')!.completed).toBe(1)
    expect(p.skills.length).toBeGreaterThan(0)
  })
})

describe('access is enforced on exams too', () => {
  it('the first exam start opens the 72h trial; after it ends answers and new starts are refused', async () => {
    const s = await student('SCI')
    const { attemptId } = await startExamAttempt(h.db, s, approvedId, 'PRACTICE', T0)
    const st = doc.steps[0]!
    await submitExamStep(h.db, s, attemptId, st.id, rightAnswer(st), new Date(T0.getTime() + 71 * H))
    await expectCode(() => submitExamStep(h.db, s, attemptId, doc.steps[1]!.id, rightAnswer(doc.steps[1]!), new Date(T0.getTime() + 72 * H)), 'PLAY_TRIAL_EXPIRED')
    await expectCode(() => startExamAttempt(h.db, s, approvedId, 'EXAM', new Date(T0.getTime() + 73 * H)), 'PLAY_TRIAL_EXPIRED')
  })

  it("another student cannot open or answer someone else's attempt", async () => {
    const a = await student('SCI')
    const b = await student('SCI')
    const { attemptId } = await startExamAttempt(h.db, a, approvedId, 'PRACTICE', T0)
    await expectCode(() => getExamAttemptView(h.db, b, attemptId), 'PLAY_EXAM_ATTEMPT_NOT_FOUND')
    await expectCode(() => submitExamStep(h.db, b, attemptId, doc.steps[0]!.id, rightAnswer(doc.steps[0]!), T0), 'PLAY_EXAM_ATTEMPT_NOT_FOUND')
  })

  it('stored sets keep their checksum so results stay tied to the played version', async () => {
    const [row] = await h.db.select({ checksum: playExamSets.checksum }).from(playExamSets).where(eq(playExamSets.id, reviewId))
    expect(row!.checksum).toMatch(/^[0-9a-f]{64}$/)
  })
})
