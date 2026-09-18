import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getAiProvider } from '@/server/ai/provider'
import type { DatabaseHandle } from '@/server/db/connect'
import { jobs, notifications, questions, quizzes, skills } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { validateQuestion } from '@/server/lib/quiz-grading'
import { groupGradeAverages, studentGradesForTeacher } from '@/server/queries/teacher-extras.queries'
import { latestStudentAnalysis, requestExercises, requestStudentAnalysis, studentFacts } from '@/server/services/ai.service'
import { createAssignment, reviewSubmission, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { getQuizForEdit, listQuizzesForStudent, listQuizzesForTeacher } from '@/server/services/quizzes.service'
import { recordSkillResult } from '@/server/services/skills.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let teacherB: Actor
let student: Actor
let group: { id: string }
let skillRhetoric: string
let skillGrammar: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  group = await createGroup(h.db, teacher, { name: 'فوج التوليد' })
  student = await makeStudent(h.db, 'طالب التوليد')
  const r = await generateCodes(h.db, teacher, { groupId: group.id, count: 1 })
  await redeemEnrollmentCode(h.db, student, r.codes[0]!.code)
  const [a, b] = await h.db
    .insert(skills)
    .values([
      { code: 'IMAGERY', nameAr: 'الصور البيانية', category: 'RHETORIC' },
      { code: 'PARSING', nameAr: 'إعراب المفردات', category: 'GRAMMAR' }
    ])
    .returning()
  skillRhetoric = a!.id
  skillGrammar = b!.id
})

afterAll(async () => {
  await h.close()
})

describe('توليد التمارين العلاجية وتحليل الطالب بالذكاء الاصطناعي', () => {
  it('المزوّد التجريبي يولّد أسئلة صالحة لكل نوع مفتاح', async () => {
    const p = getAiProvider()
    for (const name of ['الصور البيانية', 'إعراب المفردات', 'مهارة عامة']) {
      const out = await p.generateExercises({ skillName: name, skillCategory: null, levelName: null, count: 5 })
      expect(out.questions.length).toBeGreaterThanOrEqual(3)
      for (const q of out.questions) expect(validateQuestion({ type: q.type, prompt: q.prompt, points: 1, answerKey: q.answerKey, options: q.options ?? [] })).toBeNull()
    }
  })

  it('طلب التمارين: تحقق من المهارة والفوج والدور، ثم المهمة تنشئ مسودة اختبار غير منشورة مسندة للفوج', async () => {
    await expectCode(() => requestExercises(h.db, student, { skillId: skillRhetoric }), 'FORBIDDEN')
    await expectCode(() => requestExercises(h.db, teacher, { skillId: '00000000-0000-0000-0000-000000000000' }), 'NOT_FOUND')
    await expectCode(() => requestExercises(h.db, teacherB, { skillId: skillRhetoric, groupId: group.id }), 'NOT_FOUND')
    const r = await requestExercises(h.db, teacher, { skillId: skillRhetoric, groupId: group.id, count: 4 })
    expect(r.jobId).toBeTruthy()
    const s = await processQueuedJobs(h.db)
    expect(s).toMatchObject({ processed: 1, completed: 1 })
    const [job] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    const quizId = String((job?.result as { quizId?: string })?.quizId)
    expect(quizId).toMatch(/^[0-9a-f-]{36}$/)
    const q = await getQuizForEdit(h.db, teacher, quizId)
    expect(q.publishedAt).toBeNull()
    expect(q.skillId).toBe(skillRhetoric)
    expect(q.title).toContain('الصور البيانية')
    expect(q.questions.length).toBe(4)
    expect(q.questions.every((x) => x.skillId === skillRhetoric && Number(x.points) === 1)).toBe(true)
    expect(q.groupIds).toEqual([group.id])
    // غير مرئي للطالب حتى ينشره الأستاذ
    expect((await listQuizzesForStudent(h.db, student)).some((x) => x.id === quizId)).toBe(false)
    expect((await listQuizzesForTeacher(h.db, teacher)).some((x) => x.id === quizId)).toBe(true)
    await expectCode(() => getQuizForEdit(h.db, teacherB, quizId), 'QUIZ_NOT_FOUND')
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))
    expect(n.some((x) => x.title.includes('مسودة تمارين علاجية') && x.link === `/teacher/quizzes/${quizId}/edit`)).toBe(true)
    const dbq = await h.db.select().from(questions).where(eq(questions.quizId, quizId))
    expect(dbq).toHaveLength(4)
    expect((await h.db.select().from(quizzes).where(eq(quizzes.id, quizId)))[0]?.maxScore).toBe('4.00')
  })

  it('تحليل الطالب: الحقائق من البيانات فقط، مهمة واحدة نشطة، والنتيجة للأستاذ صاحب المساحة', async () => {
    await recordSkillResult(h.db, { studentId: student.studentId!, skillId: skillGrammar, percent: 40, sourceType: 'MANUAL' })
    await recordSkillResult(h.db, { studentId: student.studentId!, skillId: skillRhetoric, percent: 85, sourceType: 'MANUAL' })
    const a = await createAssignment(h.db, teacher, { title: 'واجب التحليل', maxScore: 20, groupIds: [group.id], studentIds: [] })
    const sub = await submitAnswer(h.db, student, a.id, 'إجابة كافية للتصحيح')
    await reviewSubmission(h.db, teacher, sub.submissionId, { score: 12, strengths: [], improvements: [] })
    await createAssignment(h.db, teacher, { title: 'واجب لم يُرسل', maxScore: 20, groupIds: [group.id], studentIds: [] })

    const f = await studentFacts(h.db, teacher, student.studentId!)
    expect(f.name).toBe('طالب التوليد')
    expect(f.facts.some((x) => x.includes('مهارة ضعيفة: إعراب المفردات'))).toBe(true)
    expect(f.facts.some((x) => x.includes('مهارة قوية: الصور البيانية'))).toBe(true)
    expect(f.facts.some((x) => x.includes('علامة 12/20'))).toBe(true)
    expect(f.facts.some((x) => x.includes('لم يرسل 1 واجب'))).toBe(true)
    await expectCode(() => studentFacts(h.db, teacherB, student.studentId!), 'NOT_FOUND')

    expect(await latestStudentAnalysis(h.db, teacher, student.studentId!)).toBeNull()
    await expectCode(() => requestStudentAnalysis(h.db, teacherB, student.studentId!), 'NOT_FOUND')
    const j1 = await requestStudentAnalysis(h.db, teacher, student.studentId!)
    const j2 = await requestStudentAnalysis(h.db, teacher, student.studentId!)
    expect(j2.jobId).toBe(j1.jobId)
    await processQueuedJobs(h.db)
    const v = await latestStudentAnalysis(h.db, teacher, student.studentId!)
    expect(v?.status).toBe('COMPLETED')
    expect(v?.summary).toContain('طالب التوليد')
    expect(v?.weaknesses.some((x) => x.includes('إعراب المفردات'))).toBe(true)
    expect(v?.recommendations.length).toBeGreaterThan(0)
    expect(await latestStudentAnalysis(h.db, teacherB, student.studentId!)).toBeNull()
    await expectCode(() => latestStudentAnalysis(h.db, student, student.studentId!), 'FORBIDDEN')
  })

  it('استعلامات التقارير القابلة للطباعة مقيّدة بمساحة الأستاذ', async () => {
    const g = await studentGradesForTeacher(h.db, teacher, student.studentId!)
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ title: 'واجب التحليل', kind: 'ASSIGNMENT' })
    expect(await studentGradesForTeacher(h.db, teacherB, student.studentId!)).toHaveLength(0)
    const avg = await groupGradeAverages(h.db, teacher, group.id)
    expect(avg.get(student.studentId!)).toEqual({ avg: 12, count: 1 })
  })
})
