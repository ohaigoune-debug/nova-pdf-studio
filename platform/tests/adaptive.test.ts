import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { curriculumNodes, levels, studentNodeProgress, students, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { groupNodeWeakness, nodeProgress, nodeProgressFor, recommendations, targetDifficulties } from '@/server/services/adaptive.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { answerPractice, getPractice, startPractice } from '@/server/services/practice.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let other: Actor
let student: Actor
let arabic: string
let l3: string
let nodeA: string
let nodeB: string
let nodeC: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
  student = await makeStudent(h.db)
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  await h.db.update(students).set({ levelId: l3 }).where(eq(students.id, student.studentId!))
  const mk = async (title: string, slug: string) => (await h.db.insert(curriculumNodes).values({ subjectId: arabic, levelId: l3, kind: 'UNIT', title, slug, sortOrder: 1 }).returning())[0]!.id
  nodeA = await mk('البلاغة', 'bal-ad')
  nodeB = await mk('النحو', 'nahw-ad')
  nodeC = await mk('العروض', 'arud-ad')
  const pub = { subjectId: arabic, levelId: l3, visibility: 'PUBLIC' as const, type: 'TRUE_FALSE' as const, answerKey: { value: true }, points: 1 }
  // البلاغة: صعوبات 1..4 (3 أسئلة لكل صعوبة) · النحو: سهل فقط · العروض: متوسط فقط (لم يُلمس)
  for (const d of [1, 2, 3, 4] as const) for (let i = 0; i < 3; i++) await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeA, difficulty: d, body: `بلاغة ${d}-${i} صحيح.` })
  for (let i = 0; i < 4; i++) await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeB, difficulty: 1, body: `نحو ${i} صحيح.` })
  for (let i = 0; i < 2; i++) await createBankQuestion(h.db, teacher, { ...pub, curriculumNodeId: nodeC, difficulty: 2, body: `عروض ${i} صحيح.` })
})

afterAll(async () => {
  await h.close()
})

describe('التكيّف — المرحلة 8', () => {
  it('الصعوبة المستهدفة من التقدّم', () => {
    expect(targetDifficulties(null)).toEqual([1, 2])
    expect(targetDifficulties({ score: '90', attempts: 2, streak: 2 })).toEqual([1, 2])
    expect(targetDifficulties({ score: '40', attempts: 5, streak: 0 })).toEqual([1, 2])
    expect(targetDifficulties({ score: '70', attempts: 5, streak: 1 })).toEqual([2])
    expect(targetDifficulties({ score: '70', attempts: 5, streak: 3 })).toEqual([2, 3])
    expect(targetDifficulties({ score: '85', attempts: 5, streak: 0 })).toEqual([3, 4])
  })

  it('الجلسة التكيّفية تبدأ سهلة، والإجابات تحدّث التقدّم (متوسط متحرّك، سلسلة، أعلى صعوبة)', async () => {
    const s1 = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeA, count: 3, adaptive: true })
    const v1 = await getPractice(h.db, student, s1.id)
    expect(v1.questions.every((q) => q.difficulty <= 2)).toBe(true)
    for (const q of v1.questions) await answerPractice(h.db, student, s1.id, q.id, { value: true })
    let [p] = await nodeProgress(h.db, student.studentId!)
    expect(p).toMatchObject({ nodeId: nodeA, title: 'البلاغة', attempts: 3, correct: 3, score: 100, streak: 3 })
    expect(p!.masteredDifficulty).toBeLessThanOrEqual(2)
    // قوي ⇒ الجلسة التالية صعبة (3–4)
    const s2 = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeA, count: 3, adaptive: true })
    const v2 = await getPractice(h.db, student, s2.id)
    expect(v2.questions.every((q) => q.difficulty >= 3)).toBe(true)
    // خطأ يصفّر السلسلة ويخفض المتوسط تدريجياً
    await answerPractice(h.db, student, s2.id, v2.questions[0]!.id, { value: false })
    ;[p] = await nodeProgress(h.db, student.studentId!)
    expect(p).toMatchObject({ attempts: 4, correct: 3, score: 70, streak: 0 })
    await answerPractice(h.db, student, s2.id, v2.questions[1]!.id, { value: true })
    ;[p] = await nodeProgress(h.db, student.studentId!)
    expect(p!.score).toBe(79)
    expect(p!.masteredDifficulty).toBeGreaterThanOrEqual(3)
    // صعوبة محدّدة تلغي التكيّف
    const s3 = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeA, count: 2, adaptive: true, difficulty: 1 })
    expect((await getPractice(h.db, student, s3.id)).questions.every((q) => q.difficulty === 1)).toBe(true)
  })

  it('التوصيات: راجع الضعيف، جديد لما لم يُلمس، ارفع الصعوبة للقوي', async () => {
    // النحو: 3 أخطاء ⇒ ضعيف
    const s = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeB, count: 3 })
    for (const q of (await getPractice(h.db, student, s.id)).questions) await answerPractice(h.db, student, s.id, q.id, { value: false })
    const recs = await recommendations(h.db, student)
    const kinds = Object.fromEntries(recs.map((r) => [r.title, r.kind]))
    expect(kinds).toEqual({ النحو: 'REVIEW', العروض: 'NEW' })
    expect(recs[0]).toMatchObject({ kind: 'REVIEW', nodeId: nodeB, difficulty: 1, questions: 4 })
    expect(recs.find((r) => r.kind === 'NEW')).toMatchObject({ nodeId: nodeC, difficulty: null, questions: 2 })
    // البلاغة عند 79% (دون عتبة القوة 80) ⇒ لا توصية؛ بعد إجابتين صحيحتين تتجاوزها ⇒ «ارفع الصعوبة» إن بقيت صعوبة أعلى
    expect(recs.find((r) => r.nodeId === nodeA)).toBeUndefined()
    const s2 = await startPractice(h.db, student, { subjectId: arabic, curriculumNodeId: nodeA, count: 2, adaptive: true })
    const v2 = await getPractice(h.db, student, s2.id)
    expect(v2.questions.every((q) => q.difficulty === 2)).toBe(true)
    for (const q of v2.questions) await answerPractice(h.db, student, s2.id, q.id, { value: true })
    const [bal] = await h.db.select().from(studentNodeProgress).where(eq(studentNodeProgress.curriculumNodeId, nodeA))
    expect(Number(bal!.score)).toBeGreaterThan(80)
    const levelUp = (await recommendations(h.db, student)).find((r) => r.kind === 'LEVEL_UP')
    if (bal!.masteredDifficulty < 4) expect(levelUp).toMatchObject({ nodeId: nodeA, difficulty: bal!.masteredDifficulty + 1 })
    else expect(levelUp).toBeUndefined()
    await expect(recommendations(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('الأستاذ يرى تقدّم تلاميذه فقط، وأضعف دروس الفوج', async () => {
    await expect(nodeProgressFor(h.db, teacher, student.studentId!)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const g = await createGroup(h.db, teacher, { name: 'فوج التكيّف' })
    const { codes } = await generateCodes(h.db, teacher, { groupId: g.id, count: 1 })
    await redeemEnrollmentCode(h.db, student, codes[0]!.code)
    const mine = await nodeProgressFor(h.db, teacher, student.studentId!)
    expect(mine.map((n) => n.title)).toEqual(['النحو', 'البلاغة'])
    await expect(nodeProgressFor(h.db, other, student.studentId!)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(await nodeProgressFor(h.db, student, student.studentId!)).toHaveLength(2)
    const weak = await groupNodeWeakness(h.db, teacher, g.id)
    expect(weak).toHaveLength(1)
    expect(weak[0]).toMatchObject({ nodeId: nodeB, title: 'النحو', weak: 1, assessed: 1, average: 0, students: [student.fullName] })
    expect(await groupNodeWeakness(h.db, other, g.id)).toEqual([])
  })
})
