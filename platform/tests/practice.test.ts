import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { curriculumNodes, levels, practiceSessions, students, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { answerPractice, finishPractice, getPractice, practiceOptions, practiceOverview, startPractice } from '@/server/services/practice.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let student: Actor
let other: Actor
let arabic: string
let l3: string
let l2: string
let nodeA: string
let nodeB: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  other = await makeStudent(h.db, 'تلميذ آخر')
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  l2 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '2AS')))[0]!.id
  await h.db.update(students).set({ levelId: l3 }).where(eq(students.id, student.studentId!))
  const [na] = await h.db.insert(curriculumNodes).values({ subjectId: arabic, levelId: l3, kind: 'UNIT', title: 'البلاغة', slug: 'balagha', sortOrder: 1 }).returning()
  const [nb] = await h.db.insert(curriculumNodes).values({ subjectId: arabic, levelId: l3, kind: 'UNIT', title: 'النحو', slug: 'nahw', sortOrder: 2 }).returning()
  nodeA = na!.id
  nodeB = nb!.id
  const pub = { subjectId: arabic, levelId: l3, visibility: 'PUBLIC' as const }
  // البلاغة: 3 أسئلة · النحو: 2 · + خاص (لا يظهر) + مفتوح (لا يُصحَّح) + مستوى آخر (لا يظهر)
  await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeA, type: 'MCQ', body: 'نوع الصورة في «رأيت أسداً يخطب»؟', options: [{ label: 'استعارة تصريحية', isCorrect: true }, { label: 'كناية', isCorrect: false }, { label: 'تشبيه', isCorrect: false }], points: 2, difficulty: 1 })
  await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeA, type: 'TRUE_FALSE', body: 'الكناية تصريح بالمعنى.', answerKey: { value: false }, points: 1, difficulty: 2, solution: 'الكناية تلميح لا تصريح.' })
  await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeA, type: 'SHORT_ANSWER', body: 'ما البحر الذي تفعيلته «متفاعلن»؟', answerKey: { accepted: ['الكامل', 'بحر الكامل'] }, points: 1, difficulty: 3 })
  await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeB, type: 'FILL_BLANK', body: 'الفاعل ___ دائماً.', answerKey: { blanks: [['مرفوع']] }, points: 1, difficulty: 2 })
  await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeB, type: 'MATCHING', body: 'صِل كل كلمة بإعرابها', answerKey: { pairs: [{ left: 'العلمُ', right: 'مبتدأ' }, { left: 'نورٌ', right: 'خبر' }] }, points: 2, difficulty: 2 })
  await createBankQuestion(h.db, teacher, { subjectId: arabic, levelId: l3, curriculumNodeId: nodeA, type: 'MCQ', body: 'خاص بالأستاذ', options: [{ label: 'أ', isCorrect: true }, { label: 'ب', isCorrect: false }], points: 1 })
  await createBankQuestion(h.db, teacher, { ...pub, type: 'OPEN', body: 'حلّل النصّ.', points: 4 })
  await createBankQuestion(h.db, teacher, { subjectId: arabic, levelId: l2, visibility: 'PUBLIC', type: 'TRUE_FALSE', body: 'سؤال للثانية ثانوي', answerKey: { value: true }, points: 1 })
})

afterAll(async () => {
  await h.close()
})

describe('التدريب الذاتي — المرحلة 7', () => {
  it('الخيارات: مواد ودروس فيها أسئلة عامة قابلة للتصحيح بمستوى التلميذ', async () => {
    const o = await practiceOptions(h.db, student, arabic)
    expect(o.subjects).toEqual([{ id: arabic, name: 'اللغة العربية', questions: 5 }])
    expect(o.nodes.map((n) => [n.title, n.questions])).toEqual([['البلاغة', 3], ['النحو', 2]])
    // تلميذ بلا مستوى يرى كل المستويات
    expect((await practiceOptions(h.db, other)).subjects[0]!.questions).toBe(6)
    await expect(practiceOptions(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('جلسة كاملة: بدء، إجابة بتصحيح فوري بلا كشف المفتاح مسبقاً، إنهاء بملخّص ونقاط ضعف', async () => {
    await expect(startPractice(h.db, student, { subjectId: arabic, difficulty: 4 })).rejects.toMatchObject({ code: 'PRACTICE_NO_QUESTIONS' })
    const s = await startPractice(h.db, student, { subjectId: arabic, count: 10 })
    expect(s.questionCount).toBe(5)
    expect(s.levelId).toBe(l3)
    const v = await getPractice(h.db, student, s.id)
    expect(v.summary).toBeNull()
    expect(v.questions).toHaveLength(5)
    expect(v.questions.every((q) => q.result === null)).toBe(true)
    const mcq = v.questions.find((q) => q.type === 'MCQ')!
    expect(mcq.options.map((o) => o.label)).toContain('استعارة تصريحية')
    expect(JSON.stringify(mcq)).not.toContain('isCorrect')
    const matching = v.questions.find((q) => q.type === 'MATCHING')!
    expect(matching.matching!.lefts).toEqual(['العلمُ', 'نورٌ'])
    expect(matching.matching!.rights.map((r) => r.label).sort()).toEqual(['خبر', 'مبتدأ'])
    await expect(getPractice(h.db, other, s.id)).rejects.toMatchObject({ code: 'PRACTICE_NOT_FOUND' })

    const r1 = await answerPractice(h.db, student, s.id, mcq.id, { optionIds: ['0'] })
    expect(r1).toMatchObject({ isCorrect: true, score: 2, points: 2, correctOptionIds: ['0'] })
    // الإجابة لا تُعاد
    const again = await answerPractice(h.db, student, s.id, mcq.id, { optionIds: ['1'] })
    expect(again.isCorrect).toBe(true)
    const tf = v.questions.find((q) => q.type === 'TRUE_FALSE')!
    const r2 = await answerPractice(h.db, student, s.id, tf.id, { value: true })
    expect(r2).toMatchObject({ isCorrect: false, score: 0, correctText: 'خطأ', solution: 'الكناية تلميح لا تصريح.' })
    const sa = v.questions.find((q) => q.type === 'SHORT_ANSWER')!
    expect((await answerPractice(h.db, student, s.id, sa.id, { text: 'بحر الكامل' })).isCorrect).toBe(true)
    const fb = v.questions.find((q) => q.type === 'FILL_BLANK')!
    expect(fb.blanksCount).toBe(1)
    expect((await answerPractice(h.db, student, s.id, fb.id, { blanks: ['منصوب'] })).isCorrect).toBe(false)
    expect((await answerPractice(h.db, student, s.id, matching.id, { matches: { '0': 1, '1': 0 } })).isCorrect).toBe(false)
    await expect(answerPractice(h.db, other, s.id, fb.id, { blanks: ['مرفوع'] })).rejects.toMatchObject({ code: 'PRACTICE_NOT_FOUND' })

    const mid = await getPractice(h.db, student, s.id)
    expect(mid.session.answeredCount).toBe(5)
    expect(mid.session.correctCount).toBe(2)
    expect(mid.questions.find((q) => q.id === tf.id)!.result).toMatchObject({ isCorrect: false, answer: { value: true } })

    const sum = await finishPractice(h.db, student, s.id)
    expect(sum).toMatchObject({ answered: 5, correct: 2, total: 5, scorePct: 42.9 })
    expect(sum.byNode.map((n) => [n.title, n.correct, n.total])).toEqual([['النحو', 0, 2], ['البلاغة', 2, 3]])
    expect(sum.weak).toEqual(['النحو'])
    await expect(answerPractice(h.db, student, s.id, fb.id, { blanks: ['مرفوع'] })).rejects.toMatchObject({ code: 'PRACTICE_FINISHED' })
    const done = await getPractice(h.db, student, s.id)
    expect(done.session.status).toBe('FINISHED')
    expect(Number(done.session.scorePct)).toBe(42.9)
    expect(done.summary!.weak).toEqual(['النحو'])
  })

  it('اختيار الدرس وفروعه، والإنهاء المبكّر يعدّ الباقي خطأ، والنظرة العامة ترصد الضعف', async () => {
    const [child] = await h.db.insert(curriculumNodes).values({ subjectId: arabic, levelId: l3, parentId: nodeB, kind: 'LESSON', title: 'الفاعل', slug: 'fael', sortOrder: 1 }).returning()
    await createBankQuestion(h.db, teacher, { subjectId: arabic, levelId: l3, visibility: 'PUBLIC', curriculumNodeId: child!.id, type: 'TRUE_FALSE', body: 'الفاعل اسم مرفوع.', answerKey: { value: true }, points: 1 })
    const s = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeB, count: 5 })
    expect(s.questionCount).toBe(3)
    const v = await getPractice(h.db, student, s.id)
    expect(v.questions.map((q) => q.nodeTitle).sort()).toEqual(['الفاعل', 'النحو', 'النحو'])
    const q0 = v.questions.find((q) => q.nodeTitle === 'الفاعل')!
    expect((await answerPractice(h.db, student, s.id, q0.id, { value: true })).isCorrect).toBe(true)
    const sum = await finishPractice(h.db, student, s.id)
    expect(sum).toMatchObject({ answered: 1, correct: 1, total: 3 })
    expect(sum.scorePct).toBe(25)

    const ov = await practiceOverview(h.db, student)
    expect(ov.totals).toEqual({ sessions: 2, answered: 6, correct: 3 })
    expect(ov.sessions).toHaveLength(2)
    expect(ov.sessions[0]!.status).toBe('FINISHED')
    expect(ov.weak.map((w) => w.title)).toEqual([])
    expect(ov.bySubject[0]).toMatchObject({ subjectId: arabic, correct: 3, total: 6 })
    // ضعف واضح بعد 3 إجابات خاطئة في النحو
    const s3 = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeB, count: 5 })
    const v3 = await getPractice(h.db, student, s3.id)
    for (const q of v3.questions.filter((q) => q.nodeTitle === 'النحو')) await answerPractice(h.db, student, s3.id, q.id, q.type === 'FILL_BLANK' ? { blanks: ['x'] } : { matches: { '0': 1, '1': 0 } })
    const ov2 = await practiceOverview(h.db, student)
    expect(ov2.weak.map((w) => [w.title, w.correct, w.total])).toEqual([['النحو', 0, 4]])
    expect(ov2.weak[0]).toMatchObject({ subjectId: arabic, nodeId: nodeB })
    expect((await h.db.select().from(practiceSessions).where(eq(practiceSessions.studentId, other.studentId!))).length).toBe(0)
  })
})
