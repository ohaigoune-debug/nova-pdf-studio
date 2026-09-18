import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { normalizeArabic } from '@/server/lib/arabic'
import { gradeAnswer } from '@/server/lib/quiz-grading'
import { listStudentGrades } from '@/server/queries/student-extras.queries'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import {
  createQuiz,
  getAttemptForStudent,
  getQuizForStudent,
  getQuizForTeacher,
  listQuizzesForStudent,
  listQuizzesForTeacher,
  reviewAttempt,
  startAttempt,
  submitAttempt,
  updateQuiz,
  type QuestionInput
} from '@/server/services/quizzes.service'
import { listSkills } from '@/server/services/reference.service'
import { groupWeakSkills, skillMap } from '@/server/services/skills.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'
import { skills } from '@/server/db/schema'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let s1: Actor
let s3: Actor
let irab: string
let imagery: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  await h.db.insert(skills).values([
    { code: 'IRAB_SENTENCE', nameAr: 'إعراب الجمل', category: 'GRAMMAR' },
    { code: 'IMAGERY', nameAr: 'الصور البيانية', category: 'RHETORIC' }
  ])
  const sk = await listSkills(h.db)
  irab = sk.find((s) => s.code === 'IRAB_SENTENCE')!.id
  imagery = sk.find((s) => s.code === 'IMAGERY')!.id
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s3 = await makeStudent(h.db, 'طالب خارجي')
  const c = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
  await redeemEnrollmentCode(h.db, s1, c.codes[0]!.code)
})

afterAll(async () => {
  await h.close()
})

const questionsFixture = (): QuestionInput[] => [
  { type: 'MCQ', prompt: 'ما نوع الصورة في "عيناك غابتا نخيل"؟', points: 2, skillId: imagery, answerKey: null, options: [{ label: 'تشبيه بليغ', isCorrect: true }, { label: 'استعارة', isCorrect: false }, { label: 'كناية', isCorrect: false }] },
  { type: 'TRUE_FALSE', prompt: 'الحال اسم نكرة منصوب.', points: 1, skillId: irab, answerKey: { value: true }, options: [] },
  { type: 'SHORT_ANSWER', prompt: 'ما إعراب "كتاباً" في: قرأتُ كتاباً؟', points: 2, skillId: irab, answerKey: { accepted: ['مفعول به', 'مفعول به منصوب'] }, options: [] },
  { type: 'FILL_BLANK', prompt: 'الاستعارة ___ حُذف فيها المشبه به، و___ حُذف فيها المشبه.', points: 2, skillId: imagery, answerKey: { blanks: [['المكنية', 'مكنية'], ['التصريحية', 'تصريحية']] }, options: [] },
  { type: 'MATCHING', prompt: 'طابق كل مصطلح بتعريفه', points: 2, skillId: imagery, answerKey: { pairs: [{ left: 'تشبيه', right: 'مماثلة بين شيئين' }, { left: 'كناية', right: 'لفظ أريد به لازم معناه' }] }, options: [] },
  { type: 'LONG_ANSWER', prompt: 'اشرح الصورة البيانية في البيت الثاني.', points: 3, skillId: imagery, answerKey: null, options: [] }
]

describe('تطبيع العربية والتصحيح الآلي', () => {
  it('يتسامح مع التشكيل والهمزات والتاء المربوطة', () => {
    expect(normalizeArabic('مَفْعُولٌ بِهِ')).toBe(normalizeArabic('مفعول به'))
    expect(normalizeArabic('إستعارة')).toBe(normalizeArabic('استعاره'))
    expect(gradeAnswer({ id: 'x', type: 'SHORT_ANSWER', points: 2, answerKey: { accepted: ['مفعول به'] }, options: [] }, { questionId: 'x', text: 'مَفعولٌ بهِ.' }).score).toBe(2)
    expect(gradeAnswer({ id: 'x', type: 'FILL_BLANK', points: 2, answerKey: { blanks: [['أ'], ['ب']] }, options: [] }, { questionId: 'x', blanks: ['أ', 'خطأ'] }).score).toBe(1)
    expect(gradeAnswer({ id: 'x', type: 'LONG_ANSWER', points: 3, answerKey: null, options: [] }, { questionId: 'x', text: 'نص' }).needsReview).toBe(true)
  })
})

describe('الاختبارات', () => {
  let quizId: string
  let attemptId: string

  it('الأستاذ ينشئ اختباراً بسبعة أنواع أسئلة ويسنده لفوجه', async () => {
    await expectCode(() => createQuiz(h.db, teacherA, { title: 'x', groupIds: [groupA.id], studentIds: [], questions: [] }), 'QUIZ_NO_QUESTIONS')
    await expectCode(() => createQuiz(h.db, teacherA, { title: 'x', groupIds: [groupA.id], studentIds: [], questions: [{ type: 'MCQ', prompt: 'س', points: 1, answerKey: null, options: [{ label: 'أ', isCorrect: false }] }] }), 'VALIDATION')
    await expectCode(() => createQuiz(h.db, teacherA, { title: 'x', groupIds: [], studentIds: [], questions: questionsFixture() }), 'VALIDATION')
    const q = await createQuiz(h.db, teacherA, { title: 'اختبار البلاغة والإعراب', timeLimitMinutes: 20, maxAttempts: 2, publish: true, groupIds: [groupA.id], studentIds: [], questions: questionsFixture() })
    quizId = q.id
    expect(Number(q.maxScore)).toBe(12)
    const list = await listQuizzesForTeacher(h.db, teacherA)
    expect(list.find((x) => x.id === quizId)?.questionsCount).toBe(6)
    expect((await listQuizzesForTeacher(h.db, teacherB)).some((x) => x.id === quizId)).toBe(false)
    await expectCode(() => getQuizForTeacher(h.db, teacherB, quizId), 'QUIZ_NOT_FOUND')
  })

  it('الطالب المستهدف يراه بلا مفاتيح الإجابة؛ غير المستهدف لا يراه', async () => {
    const v = await getQuizForStudent(h.db, s1, quizId)
    expect(v.questions).toHaveLength(6)
    expect(JSON.stringify(v.questions)).not.toContain('isCorrect')
    expect(JSON.stringify(v.questions)).not.toContain('accepted')
    expect(v.questions.find((x) => x.type === 'MATCHING')?.matching?.rights).toHaveLength(2)
    expect((await listQuizzesForStudent(h.db, s1)).some((x) => x.id === quizId)).toBe(true)
    expect((await listQuizzesForStudent(h.db, s3)).some((x) => x.id === quizId)).toBe(false)
    await expectCode(() => getQuizForStudent(h.db, s3, quizId), 'NOT_TARGETED')
    await expectCode(() => startAttempt(h.db, s3, quizId), 'NOT_TARGETED')
  })

  it('المحاولة: تصحيح آلي للموضوعي وانتظار الأستاذ للمقالي، ثم اعتماد وتحديث المهارات', async () => {
    const a = await startAttempt(h.db, s1, quizId)
    attemptId = a.id
    expect(a.expiresAt).not.toBeNull()
    expect((await startAttempt(h.db, s1, quizId)).id).toBe(a.id)
    const v = await getQuizForStudent(h.db, s1, quizId)
    const byType = Object.fromEntries(v.questions.map((q) => [q.type, q]))
    const mcq = byType.MCQ!
    const correctOpt = mcq.options.find((o) => o.label === 'تشبيه بليغ')!.id
    const matching = byType.MATCHING!
    const rightIndexOf = (label: string) => matching.matching!.rights.find((r) => r.label === label)!.index
    const r = await submitAttempt(h.db, s1, attemptId, [
      { questionId: mcq.id, optionIds: [correctOpt] },
      { questionId: byType.TRUE_FALSE!.id, value: true },
      { questionId: byType.SHORT_ANSWER!.id, text: 'مَفعولٌ به' },
      { questionId: byType.FILL_BLANK!.id, blanks: ['المكنية', 'خطأ'] },
      { questionId: matching.id, matches: { '0': rightIndexOf('مماثلة بين شيئين'), '1': rightIndexOf('لفظ أريد به لازم معناه') } },
      { questionId: byType.LONG_ANSWER!.id, text: 'الصورة استعارة مكنية حيث شُبّه المساء بإنسان يتثاءب.' }
    ])
    expect(r.status).toBe('SUBMITTED')
    expect(r.needsReview).toBe(true)
    expect(r.autoScore).toBe(8) // 2 + 1 + 2 + 1 + 2
    await expectCode(() => submitAttempt(h.db, s1, attemptId, []), 'ATTEMPT_CLOSED')

    // الطالب لا يرى مفاتيح الإجابة قبل الاعتماد
    const before = await getAttemptForStudent(h.db, s1, attemptId)
    expect(before.items.every((i) => i.answerKey === null)).toBe(true)
    expect(before.items.find((i) => i.type === 'FILL_BLANK')?.score).toBe(1)
    expect((await listStudentGrades(h.db, s1))).toHaveLength(0)

    // مراجعة الأستاذ للمقالي
    const tv = await getQuizForTeacher(h.db, teacherA, quizId)
    expect(tv.attempts[0]?.needsReview).toBe(true)
    const longAnswerId = before.items.find((i) => i.type === 'LONG_ANSWER')!.answerId!
    await expectCode(() => reviewAttempt(h.db, teacherA, attemptId, { [longAnswerId]: 5 }), 'INVALID_SCORE')
    await expectCode(() => reviewAttempt(h.db, teacherB, attemptId, { [longAnswerId]: 2 }), 'ATTEMPT_NOT_FOUND')
    const f = await reviewAttempt(h.db, teacherA, attemptId, { [longAnswerId]: 2 })
    expect(f.finalScore).toBe(10)
    expect(f.maxScore).toBe(12)

    const after = await getAttemptForStudent(h.db, s1, attemptId)
    expect(after.attempt.status).toBe('REVIEWED')
    expect(after.items.find((i) => i.type === 'MCQ')?.options.some((o) => o.isCorrect)).toBe(true)
    expect((await listStudentGrades(h.db, s1))).toHaveLength(1)

    // المهارات: إعراب 3/3 = 100، الصور البيانية (2+1+2+2)/(2+2+2+3) = 7/9 ≈ 77.78
    const map = await skillMap(h.db, s1.studentId!)
    expect(map.find((m) => m.code === 'IRAB_SENTENCE')?.score).toBe(100)
    expect(map.find((m) => m.code === 'IMAGERY')?.score).toBeCloseTo(77.78, 1)
    expect(map[0]?.attempts).toBe(1)
  })

  it('حدود المحاولات وقفل الأسئلة بعد البدء', async () => {
    const a2 = await startAttempt(h.db, s1, quizId)
    expect(a2.id).not.toBe(attemptId)
    await submitAttempt(h.db, s1, a2.id, [])
    await expectCode(() => startAttempt(h.db, s1, quizId), 'ATTEMPT_LIMIT')
    await expectCode(() => updateQuiz(h.db, teacherA, quizId, { title: 'جديد', groupIds: [groupA.id], studentIds: [], questions: questionsFixture() }), 'QUIZ_HAS_ATTEMPTS')
    await updateQuiz(h.db, teacherA, quizId, { title: 'عنوان معدّل', groupIds: [groupA.id], studentIds: [], publish: true, maxAttempts: 2 })
    expect((await getQuizForTeacher(h.db, teacherA, quizId)).title).toBe('عنوان معدّل')
  })

  it('اختبار عام يظهر لأي طالب ويصحَّح آلياً بالكامل', async () => {
    const pub = await createQuiz(h.db, teacherA, { title: 'اختبار عام', isPublic: true, publish: true, groupIds: [], studentIds: [], questions: [{ type: 'TRUE_FALSE', prompt: 'التمييز اسم نكرة.', points: 1, skillId: irab, answerKey: { value: true }, options: [] }] })
    expect((await listQuizzesForStudent(h.db, s3)).some((x) => x.id === pub.id)).toBe(true)
    const a = await startAttempt(h.db, s3, pub.id)
    const q = await getQuizForStudent(h.db, s3, pub.id)
    const r = await submitAttempt(h.db, s3, a.id, [{ questionId: q.questions[0]!.id, value: false }])
    expect(r.status).toBe('REVIEWED')
    expect(r.finalScore).toBe(0)
    expect((await skillMap(h.db, s3.studentId!)).find((m) => m.code === 'IRAB_SENTENCE')?.score).toBe(0)
  })

  it('المهارات الضعيفة المشتركة في الفوج', async () => {
    const weak = await groupWeakSkills(h.db, groupA.id)
    // s1 وحده في الفوج: إعراب 100 والصور 77 → لا مهارة تحت 60
    expect(weak).toHaveLength(0)
  })
})
