import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { playQuestionMemory, playQuestions, playSessions, playStudentStats } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { gradePlayAnswer, normalizeContentQuestion, safeEvalArithmetic, shufflePayloadForSession, validateContentQuestion } from '@/server/play/engine'
import { importQuestions, syncCatalog } from '@/server/play/importer'
import type { PlayContentQuestion, PlayStudentAnswer } from '@/server/play/question-types'
import { abandonSession, getMistakesOverview, getPlayDashboard, getSessionView, listLessonsFor, listSubjectsFor, pickBalanced, reportQuestion, setPlayProfile, startPlaySession, submitPlayAnswer } from '@/server/services/play.service'
import { listQuestionsAdmin, playAdminOverview, setReviewStatus } from '@/server/services/play-admin.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let student: Actor
let admin: Actor

const catalog = {
  version: 1,
  grades: [
    {
      grade: '3AS',
      subjects: [
        {
          subject: 'AR',
          units: [
            { code: 'U1', name: 'البناء اللغوي', verified: true, lessons: [{ code: 'L1', name: 'الصور البيانية', verified: true }, { code: 'L2', name: 'إعراب المفردات', verified: true }] }
          ]
        },
        { subject: 'MATH', streams: ['SCI', 'MATH'], units: [{ code: 'U1', name: 'الدوال', lessons: [{ code: 'L1', name: 'النهايات' }] }] }
      ]
    }
  ]
}

function q(key: string, patch: Partial<PlayContentQuestion>): PlayContentQuestion {
  return {
    key,
    type: 'MCQ',
    grade: '3AS',
    subject: 'AR',
    unit: 'U1',
    lesson: 'L1',
    difficulty: 'EASY',
    question: `ما نوع الصورة البيانية في «ابتسم الصباح»؟ (${key})`,
    options: ['تشبيه بليغ', 'استعارة مكنية', 'كناية', 'مجاز مرسل'],
    correct: 1,
    explanation: 'شُبّه الصباح بإنسان يبتسم وحُذف المشبه به وأبقيت لازمة من لوازمه.',
    ...patch
  }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'طالب بلاي')
  const r = await syncCatalog(h.db, catalog)
  expect(r.inserted).toBe(3)
})

afterAll(async () => {
  await h.close()
})

describe('engine', () => {
  it('validates MCQ / FILL_BLANK structure', () => {
    expect(validateContentQuestion(q('3AS-AR-U1-L1-0001', {})).errors).toEqual([])
    expect(validateContentQuestion(q('3AS-AR-U1-L1-0002', { correct: 7 })).errors.length).toBeGreaterThan(0)
    expect(validateContentQuestion(q('3AS-AR-U1-L1-0003', { options: ['أ', 'أ', 'ب', 'ج'] })).errors.join()).toContain('مكررة')
    const fb = q('3AS-AR-U1-L2-0001', { lesson: 'L2', type: 'FILL_BLANK', question: 'إنَّ العلمَ ____', options: undefined, correct: undefined, blanks: ['نافعٌ'], bank: ['نافعٌ', 'نافعًا', 'نافعٍ', 'نافعْ'] })
    expect(validateContentQuestion(fb).errors).toEqual([])
    expect(validateContentQuestion({ ...fb, bank: ['نافعًا', 'نافعٍ'] }).errors.join()).toContain('غير موجودة في بنك')
    expect(validateContentQuestion({ ...fb, question: 'لا فراغ هنا' }).errors.join()).toContain('____')
  })

  it('grades every type on the server', () => {
    const fb = normalizeContentQuestion(q('3AS-AR-U1-L2-0001', { lesson: 'L2', type: 'FILL_BLANK', question: 'إنَّ العلمَ ____ و____', options: undefined, blanks: ['نافعٌ', ['مفيدٌ', 'مفيدٌ']], bank: ['نافعٌ', 'نافعًا', 'مفيدٌ', 'مفيدًا'] }))
    expect(gradePlayAnswer(fb.answerKey, { type: 'FILL_BLANK', blanks: ['نافعٌ', 'مفيدٌ'] }).isCorrect).toBe(true)
    expect(gradePlayAnswer(fb.answerKey, { type: 'FILL_BLANK', blanks: ['نافعًا', 'مفيدٌ'] })).toEqual({ isCorrect: false, score: 0.5 })
    const mcq = normalizeContentQuestion(q('x', {}))
    expect(gradePlayAnswer(mcq.answerKey, { type: 'MCQ', key: 'b' }).isCorrect).toBe(true)
    expect(gradePlayAnswer(mcq.answerKey, { type: 'MCQ', key: 'a' }).isCorrect).toBe(false)
    expect(gradePlayAnswer(mcq.answerKey, null).isCorrect).toBe(false)
    const m = normalizeContentQuestion(q('m', { type: 'MATCHING', options: undefined, correct: undefined, pairs: [{ left: 'تشبيه', right: 'كالأسد' }, { left: 'استعارة', right: 'ابتسم الصباح' }, { left: 'كناية', right: 'كثير الرماد' }] }))
    expect(gradePlayAnswer(m.answerKey, { type: 'MATCHING', matches: { l0: 'r0', l1: 'r1', l2: 'r2' } }).isCorrect).toBe(true)
    expect(gradePlayAnswer(m.answerKey, { type: 'MATCHING', matches: { l0: 'r1', l1: 'r0', l2: 'r2' } }).score).toBeCloseTo(1 / 3)
    const o = normalizeContentQuestion(q('o', { type: 'ORDERING', options: undefined, correct: undefined, order: ['أ', 'ب', 'ج', 'د'] }))
    expect(gradePlayAnswer(o.answerKey, { type: 'ORDERING', order: ['o0', 'o1', 'o2', 'o3'] }).isCorrect).toBe(true)
    const shuffled = shufflePayloadForSession(o.payload, 42)
    expect(shuffled.type === 'ORDERING' && shuffled.items.map((i) => i.key).join()).not.toBe('o0,o1,o2,o3')
  })

  it('evaluates arithmetic safely', () => {
    expect(safeEvalArithmetic('2*(3+4)^2')).toBe(98)
    expect(safeEvalArithmetic('sqrt(16)+1')).toBe(5)
    expect(safeEvalArithmetic('١٢+٣')).toBe(15)
    expect(safeEvalArithmetic('process.exit()')).toBeNull()
    expect(validateContentQuestion(q('v', { verify: { expression: '2+2', expected: 5 } })).errors.join()).toContain('التحقق الحسابي')
  })

  it('balances difficulty and lessons when picking', () => {
    const cands = [] as { id: string; lessonId: string; difficulty: 'EASY' | 'MEDIUM' | 'HARD'; weight: number }[]
    for (let i = 0; i < 60; i++) cands.push({ id: `q${i}`, lessonId: `l${i % 3}`, difficulty: (['EASY', 'MEDIUM', 'HARD'] as const)[i % 3]!, weight: 1 })
    const ids = pickBalanced(cands, 10, 7)
    expect(new Set(ids).size).toBe(10)
    const diff = ids.map((id) => cands.find((c) => c.id === id)!.difficulty)
    expect(diff.filter((d) => d === 'EASY').length).toBe(3)
    expect(diff.filter((d) => d === 'MEDIUM').length).toBe(5)
    expect(diff.filter((d) => d === 'HARD').length).toBe(2)
  })
})

describe('import + play loop', () => {
  it('imports idempotently and refuses invalid rows', async () => {
    const batch: PlayContentQuestion[] = []
    for (let i = 1; i <= 12; i++) batch.push(q(`3AS-AR-U1-L1-${String(i).padStart(4, '0')}`, { difficulty: i % 3 === 0 ? 'HARD' : i % 2 === 0 ? 'MEDIUM' : 'EASY' }))
    batch.push(q('3AS-AR-U1-L2-0001', { lesson: 'L2', type: 'FILL_BLANK', question: 'إنَّ العلمَ ____', options: undefined, correct: undefined, blanks: ['نافعٌ'], bank: ['نافعٌ', 'نافعًا', 'نافعٍ', 'نافعْ'], difficulty: 'MEDIUM' }))
    batch.push(q('3AS-MATH-U1-L1-0001', { subject: 'MATH', streams: ['SCI'], question: 'نهاية 1/x عندما x → +∞ هي؟', options: ['0', '1', '+∞', '−1'], correct: 0, explanation: 'كلما كبر x صغر 1/x واقترب من الصفر دون أن يبلغه.', difficulty: 'EASY' }))
    batch.push(q('3AS-AR-U1-L9-0001', { lesson: 'L9' })) // درس غير موجود في المنهاج
    batch.push(q('3AS-AR-U1-L1-0099', { correct: 9 })) // غير صالح
    const r1 = await importQuestions(h.db, batch)
    expect(r1.inserted).toBe(14)
    expect(r1.skippedInvalid).toBe(1)
    expect(r1.skippedNoLesson).toBe(1)
    const r2 = await importQuestions(h.db, batch)
    expect(r2.inserted).toBe(0)
    expect(r2.updated).toBe(14)
    const [row] = await h.db.select().from(playQuestions).where(eq(playQuestions.key, '3AS-AR-U1-L1-0001'))
    expect(row?.reviewStatus).toBe('AUTO_VALIDATED')
    // الاعتماد اليدوي لا يُلغى بإعادة الاستيراد
    await setReviewStatus(h.db, admin, row!.id, 'APPROVED')
    await importQuestions(h.db, batch)
    const [again] = await h.db.select().from(playQuestions).where(eq(playQuestions.key, '3AS-AR-U1-L1-0001'))
    expect(again?.reviewStatus).toBe('APPROVED')
  })

  it('requires a profile, lists subjects for the stream, hides MATH for LIT', async () => {
    await expectCode(() => startPlaySession(h.db, student, { challengeType: 'QUICK10' }), 'PLAY_PROFILE_REQUIRED')
    await expect(setPlayProfile(h.db, student, { gradeCode: '3AS', streamCode: 'XX' })).rejects.toBeInstanceOf(AppError)
    await setPlayProfile(h.db, student, { gradeCode: '3AS', streamCode: 'LIT' })
    const lit = await listSubjectsFor(h.db, '3AS', 'LIT')
    expect(lit.map((s) => s.code)).toEqual(['AR'])
    const sci = await listSubjectsFor(h.db, '3AS', 'SCI')
    expect(sci.map((s) => s.code).sort()).toEqual(['AR', 'MATH'])
    const units = await listLessonsFor(h.db, '3AS', 'LIT', 'AR', student.studentId!)
    expect(units[0]?.lessons.map((l) => l.questions)).toEqual([12, 1])
  })

  it('runs a full session with server-side grading, XP, memory and no double scoring', async () => {
    const s = await startPlaySession(h.db, student, { challengeType: 'QUICK10', subjectCode: 'AR' })
    expect(s.questionIds.length).toBe(10)
    const view = await getSessionView(h.db, student, s.id)
    expect(view.questions.length).toBe(10)
    // لا مفتاح إجابة في العرض
    expect(JSON.stringify(view)).not.toContain('answerKey')
    expect(JSON.stringify(view)).not.toContain('"correct"')
    let xp = 0
    let correct = 0
    for (const vq of view.questions) {
      const answer: PlayStudentAnswer = vq.payload.type === 'MCQ' ? { type: 'MCQ', key: vq.payload.options.find((o) => o.text === 'استعارة مكنية')!.key } : { type: 'FILL_BLANK', blanks: ['نافعًا'] }
      const r = await submitPlayAnswer(h.db, student, s.id, vq.id, answer, 1200)
      xp += r.xp
      if (r.isCorrect) correct++
      if (vq.payload.type === 'MCQ') expect(r.isCorrect).toBe(true)
      else {
        expect(r.isCorrect).toBe(false)
        expect(r.correctText).toBe('نافعٌ')
      }
      expect(r.explanation.length).toBeGreaterThan(10)
    }
    const done = await getSessionView(h.db, student, s.id)
    expect(done.session.status).toBe('COMPLETED')
    expect(done.session.xpEarned).toBe(xp)
    expect(done.session.correctCount).toBe(correct)
    // لا تسجيل مزدوج
    await expectCode(() => submitPlayAnswer(h.db, student, s.id, view.questions[0]!.id, { type: 'MCQ', key: 'a' }, null), 'PLAY_SESSION_CLOSED')
    const [stats] = await h.db.select().from(playStudentStats).where(eq(playStudentStats.studentId, student.studentId!))
    expect(stats?.xpTotal).toBe(xp)
    expect(stats?.sessionsCompleted).toBe(1)
    expect(stats?.streakDays).toBe(1)
    const dash = await getPlayDashboard(h.db, student)
    expect(dash.badges.find((b) => b.code === 'FIRST_SESSION')?.earnedAt).toBeTruthy()
    expect(dash.level.title).toBe(xp >= 200 ? 'مستكشف' : 'مبتدئ')
    const mem = await h.db.select().from(playQuestionMemory).where(eq(playQuestionMemory.studentId, student.studentId!))
    expect(mem.length).toBe(10)
    expect(mem.filter((m) => m.lastResult === false).length).toBeGreaterThanOrEqual(0)
  })

  it('rejects answering a question outside the session and double answers inside an active one', async () => {
    const s = await startPlaySession(h.db, student, { challengeType: 'QUICK10', subjectCode: 'AR' })
    const view = await getSessionView(h.db, student, s.id)
    const first = view.questions[0]!
    await submitPlayAnswer(h.db, student, s.id, first.id, { type: 'MCQ', key: 'a' }, null)
    await expectCode(() => submitPlayAnswer(h.db, student, s.id, first.id, { type: 'MCQ', key: 'b' }, null), 'PLAY_ALREADY_ANSWERED')
    await expectCode(() => submitPlayAnswer(h.db, student, s.id, '00000000-0000-0000-0000-000000000000', { type: 'MCQ', key: 'b' }, null), 'PLAY_QUESTION_NOT_FOUND')
    await abandonSession(h.db, student, s.id)
    const [row] = await h.db.select().from(playSessions).where(eq(playSessions.id, s.id))
    expect(row?.status).toBe('ABANDONED')
  })

  it('expires timed sessions on the server', async () => {
    const s = await startPlaySession(h.db, student, { challengeType: 'QUICK10', subjectCode: 'AR', timed: true })
    expect(s.expiresAt).toBeTruthy()
    const view = await getSessionView(h.db, student, s.id)
    const late = new Date(s.expiresAt!.getTime() + 1000)
    await expectCode(() => submitPlayAnswer(h.db, student, s.id, view.questions[0]!.id, { type: 'MCQ', key: 'a' }, null, late), 'PLAY_SESSION_EXPIRED')
  })

  it('surfaces mistakes and builds a MISTAKES challenge from due wrong answers', async () => {
    // أجب خطأ عمداً
    const s = await startPlaySession(h.db, student, { challengeType: 'QUICK10', subjectCode: 'AR' })
    const view = await getSessionView(h.db, student, s.id)
    for (const vq of view.questions) {
      const wrong: PlayStudentAnswer = vq.payload.type === 'MCQ' ? { type: 'MCQ', key: vq.payload.options.find((o) => o.text !== 'استعارة مكنية')!.key } : { type: 'FILL_BLANK', blanks: ['نافعٍ'] }
      await submitPlayAnswer(h.db, student, s.id, vq.id, wrong, null)
    }
    const overview = await getMistakesOverview(h.db, student, new Date(Date.now() + 2 * 86400000))
    expect(overview.length).toBeGreaterThan(0)
    expect(overview[0]?.wrong).toBeGreaterThan(0)
    const m = await startPlaySession(h.db, student, { challengeType: 'MISTAKES' }, new Date(Date.now() + 2 * 86400000))
    expect(m.questionIds.length).toBeGreaterThan(0)
    await reportQuestion(h.db, student, { questionId: m.questionIds[0]!, sessionId: m.id, reason: 'AMBIGUOUS', message: 'الخياران متقاربان' })
    const ov = await playAdminOverview(h.db, admin)
    expect(ov.openReports).toBe(1)
    const page = await listQuestionsAdmin(h.db, admin, { grade: '3AS', subject: 'AR', page: 1, pageSize: 5 })
    expect(page.total).toBe(13)
    expect(page.items.length).toBe(5)
  })

  it('does not let a student call admin functions', async () => {
    await expectCode(() => playAdminOverview(h.db, student), 'FORBIDDEN')
  })
})
