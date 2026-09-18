import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { aiEvaluations, grades, jobs, notifications, teacherReviews } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import {
  aiAdminStats,
  applyAiEvaluation,
  getLatestAiEvaluation,
  latestTeacherInsights,
  maybeAutoEvaluate,
  rejectAiEvaluation,
  requestAiEvaluation,
  requestTeacherInsights,
  updateAiSettings
} from '@/server/services/ai.service'
import { createAssignment, getAssignmentForStudent, listAssignmentsForStudent, reviewSubmission, saveDraft, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { listSkills } from '@/server/services/reference.service'
import { createRubric } from '@/server/services/rubrics.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let s1: Actor
let s2: Actor
let groupA: { id: string }
let rubricId: string
let assignmentId: string
let submissionId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

const ANSWER =
  'الفكرة العامة للنص هي الحنين إلى الوطن، إذ يصوّر الشاعر غربته بصورة بيانية مؤثرة. مثلاً في قوله "أرى الوطن في كل نجم" استعارة تدل على شدة الشوق. لذلك جاءت الألفاظ موحية والعاطفة صادقة. كما أن البناء الفكري ينتقل من الوصف إلى التمني ثم إلى الحكمة.'

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s2 = await makeStudent(h.db, 'سارة بن علي')
  for (const s of [s1, s2]) {
    const r = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
    await redeemEnrollmentCode(h.db, s, r.codes[0]!.code)
  }
  const skills = await listSkills(h.db)
  const rubric = await createRubric(h.db, teacherA, {
    name: 'شبكة تحليل النص',
    items: [
      { label: 'الفكرة العامة', maxPoints: 5, skillId: skills[0]?.id ?? null },
      { label: 'الصور البيانية', maxPoints: 10, skillId: skills[1]?.id ?? null },
      { label: 'اللغة والأسلوب', maxPoints: 5 }
    ]
  })
  rubricId = rubric.id
  const a = await createAssignment(h.db, teacherA, { title: 'تحليل نص شعري', description: 'حلّل النص مبيّناً الفكرة العامة والصور البيانية', maxScore: 20, rubricId, groupIds: [groupA.id], studentIds: [] })
  assignmentId = a.id
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('التصحيح بمساعدة الذكاء الاصطناعي (اقتراح ← مراجعة الأستاذ)', () => {
  it('لا اقتراح لمسودة، ولا يطلبه طالب أو أستاذ آخر', async () => {
    const d = await saveDraft(h.db, s1, assignmentId, 'مسودة')
    await expectCode(() => requestAiEvaluation(h.db, teacherA, d.submissionId), 'SUBMISSION_NOT_SUBMITTED')
    const r = await submitAnswer(h.db, s1, assignmentId, ANSWER)
    submissionId = r.submissionId
    await expectCode(() => requestAiEvaluation(h.db, s1, submissionId), 'FORBIDDEN')
    await expectCode(() => requestAiEvaluation(h.db, teacherB, submissionId), 'SUBMISSION_NOT_FOUND')
  })

  it('الطلب ينشئ تقييماً PENDING ومهمة، والعامل يكمله باقتراح ضمن الشبكة ويُشعر الأستاذ', async () => {
    const r1 = await requestAiEvaluation(h.db, teacherA, submissionId)
    expect(r1.reused).toBe(false)
    const r2 = await requestAiEvaluation(h.db, teacherA, submissionId)
    expect(r2.reused).toBe(true)
    expect(r2.evaluationId).toBe(r1.evaluationId)

    let view = await getLatestAiEvaluation(h.db, teacherA, submissionId)
    expect(view?.status).toBe('PENDING')

    const summary = await processQueuedJobs(h.db)
    expect(summary).toMatchObject({ processed: 1, completed: 1, failed: 0 })

    view = await getLatestAiEvaluation(h.db, teacherA, submissionId)
    expect(view?.status).toBe('COMPLETED')
    expect(view?.provider).toBe('mock')
    expect(view!.suggestedScore!).toBeGreaterThan(0)
    expect(view!.suggestedScore!).toBeLessThanOrEqual(20)
    expect(Object.keys(view!.rubricBreakdown!)).toHaveLength(3)
    const total = Object.values(view!.rubricBreakdown!).reduce((s, v) => s + v, 0)
    expect(Math.round(total * 100) / 100).toBe(view!.suggestedScore)
    expect(view!.strengths.length + view!.weaknesses.length).toBeGreaterThan(0)
    expect(view?.decision).toBeNull()

    const tn = await h.db.select().from(notifications).where(eq(notifications.userId, teacherA.userId))
    expect(tn.some((n) => n.title.includes('اقتراح تصحيح جاهز'))).toBe(true)

    // الأستاذ الآخر لا يرى الاقتراح
    await expectCode(() => getLatestAiEvaluation(h.db, teacherB, submissionId), 'SUBMISSION_NOT_FOUND')
  })

  it('الطالب لا يرى أي أثر: لا علامة، الحالة "مرسلة"، لا رسالة من الذكاء الاصطناعي', async () => {
    const view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.grade).toBeNull()
    expect(view.submission?.status).toBe('SUBMITTED')
    expect(view.messages.map((m) => m.kind)).toEqual(['ANSWER'])
    const list = await listAssignmentsForStudent(h.db, s1)
    expect(list.find((a) => a.id === assignmentId)?.status).toBe('SUBMITTED')
    expect(list.find((a) => a.id === assignmentId)?.score).toBeNull()
    // في قاعدة البيانات الحالة الداخلية AI_EVALUATED لكن لا علامة
    const g = await h.db.select().from(grades).where(eq(grades.submissionId, submissionId))
    expect(g).toHaveLength(0)
  })

  it('الاعتماد بعد تعديل: العلامة تُكتب بمصدر TEACHER ويُسجَّل القرار EDITED، والاقتراح لا يُبَتّ فيه مرتين', async () => {
    const ev = (await getLatestAiEvaluation(h.db, teacherA, submissionId))!
    const edited = { ...ev.rubricBreakdown! }
    const firstKey = Object.keys(edited)[0]!
    edited[firstKey] = Math.max(0, edited[firstKey]! - 1)
    const score = Math.round(Object.values(edited).reduce((s, v) => s + v, 0) * 100) / 100
    await expectCode(() => applyAiEvaluation(h.db, teacherB, ev.id, { score, strengths: [], improvements: [], rubricBreakdown: edited }), 'AI_EVAL_NOT_FOUND')
    const r = await applyAiEvaluation(h.db, teacherA, ev.id, { score, strengths: ev.strengths, improvements: ev.weaknesses, notes: 'راجع درس الاستعارة', rubricBreakdown: edited })
    expect(r.decision).toBe('EDITED')

    const [g] = await h.db.select().from(grades).where(eq(grades.submissionId, submissionId))
    expect(g?.source).toBe('TEACHER')
    expect(g?.approvedByUserId).toBe(teacherA.userId)
    expect(Number(g?.score)).toBe(score)
    const view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.submission?.status).toBe('REVIEWED')
    expect(Number(view.grade?.score)).toBe(score)
    expect(view.messages.at(-1)?.kind).toBe('FEEDBACK')

    const after = await getLatestAiEvaluation(h.db, teacherA, submissionId)
    expect(after?.decision?.decision).toBe('EDITED')
    await expectCode(() => applyAiEvaluation(h.db, teacherA, ev.id, { score, strengths: [], improvements: [], rubricBreakdown: edited }), 'AI_EVAL_ALREADY_DECIDED')
    await expectCode(() => rejectAiEvaluation(h.db, teacherA, ev.id), 'AI_EVAL_ALREADY_DECIDED')
  })

  it('القاعدة الذهبية: الذكاء الاصطناعي لا يكتب فوق علامة الأستاذ ولا يغيّر حالة إجابة مصحَّحة', async () => {
    await reviewSubmission(h.db, teacherA, submissionId, { score: 17, strengths: ['تحليل دقيق'], improvements: [] })
    const [before] = await h.db.select().from(grades).where(eq(grades.submissionId, submissionId))
    expect(before?.score).toBe('17.00')

    const r = await requestAiEvaluation(h.db, teacherA, submissionId)
    expect(r.reused).toBe(false)
    const summary = await processQueuedJobs(h.db)
    expect(summary.completed).toBe(1)
    const ev = await getLatestAiEvaluation(h.db, teacherA, submissionId)
    expect(ev?.status).toBe('COMPLETED')
    expect(ev?.suggestedScore).not.toBe(17)

    const [after] = await h.db.select().from(grades).where(eq(grades.submissionId, submissionId))
    expect(after?.score).toBe('17.00')
    expect(after?.source).toBe('TEACHER')
    expect(after?.updatedAt.getTime()).toBe(before!.updatedAt.getTime())
    const view = await getAssignmentForStudent(h.db, s1, assignmentId)
    expect(view.submission?.status).toBe('REVIEWED')
    expect(view.grade?.score).toBe('17.00')
    // لا يوجد أي سجل علامة مصدره AI في النظام كله
    const aiGrades = await h.db.select().from(grades).where(eq(grades.source, 'AI'))
    expect(aiGrades).toHaveLength(0)
  })

  it('الاعتماد كما هو يسجَّل APPROVED، والرفض يعيد الإجابة إلى "مرسلة" بلا علامة', async () => {
    // إجابة ثانية (سارة)
    const r = await submitAnswer(h.db, s2, assignmentId, 'إجابة قصيرة بلا شواهد')
    const req = await requestAiEvaluation(h.db, teacherA, r.submissionId)
    await processQueuedJobs(h.db)
    const ev = (await getLatestAiEvaluation(h.db, teacherA, r.submissionId))!
    expect(ev.status).toBe('COMPLETED')
    await rejectAiEvaluation(h.db, teacherA, req.evaluationId, 'الاقتراح متساهل')
    const after = await getLatestAiEvaluation(h.db, teacherA, r.submissionId)
    expect(after?.decision?.decision).toBe('REJECTED')
    expect(await h.db.select().from(grades).where(eq(grades.submissionId, r.submissionId))).toHaveLength(0)
    let view = await getAssignmentForStudent(h.db, s2, assignmentId)
    expect(view.submission?.status).toBe('SUBMITTED')
    expect(view.grade).toBeNull()

    // اقتراح جديد ثم اعتماد كما هو
    const req2 = await requestAiEvaluation(h.db, teacherA, r.submissionId)
    await processQueuedJobs(h.db)
    const ev2 = (await getLatestAiEvaluation(h.db, teacherA, r.submissionId))!
    const res = await applyAiEvaluation(h.db, teacherA, ev2.id, { score: ev2.suggestedScore!, strengths: ev2.strengths, improvements: ev2.weaknesses, notes: ev2.teacherNotesSuggestion, rubricBreakdown: ev2.rubricBreakdown })
    expect(res.decision).toBe('APPROVED')
    expect(req2.evaluationId).toBe(ev2.id)
    view = await getAssignmentForStudent(h.db, s2, assignmentId)
    expect(view.submission?.status).toBe('REVIEWED')
    expect(Number(view.grade?.score)).toBe(ev2.suggestedScore)
    const reviews = await h.db.select().from(teacherReviews).where(eq(teacherReviews.submissionId, r.submissionId))
    expect(reviews.map((x) => x.decision).sort()).toEqual(['APPROVED', 'REJECTED'])
  })

  it('فشل المزوّد: إعادة محاولة ثم FAILED مع رسالة داخلية فقط، ولا يتأثر الطالب', async () => {
    const failing: AIProvider = {
      name: 'failing',
      model: 'x',
      async evaluateEssay() {
        throw new Error('upstream 500 with secret details')
      },
      async generateTeacherInsights() {
        throw new Error('down')
      },
      async generateExercises() {
        throw new Error('down')
      },
      async analyzeStudent() {
        throw new Error('down')
      }
    }
    setAiProviderForTests(failing)
    try {
      const a = await createAssignment(h.db, teacherA, { title: 'واجب ثانٍ', maxScore: 10, groupIds: [groupA.id], studentIds: [] })
      const sub = await submitAnswer(h.db, s1, a.id, 'إجابة للواجب الثاني بلا شبكة تقييم.')
      const req = await requestAiEvaluation(h.db, teacherA, sub.submissionId)
      const first = await processQueuedJobs(h.db)
      expect(first).toMatchObject({ processed: 1, retried: 1, failed: 0 })
      let ev = await getLatestAiEvaluation(h.db, teacherA, sub.submissionId)
      expect(ev?.status).toBe('FAILED')
      await expectCode(() => applyAiEvaluation(h.db, teacherA, req.evaluationId, { score: 5, strengths: [], improvements: [] }), 'AI_EVAL_NOT_READY')

      // المحاولات المتبقية (run_after في المستقبل ⇒ نمرّر now متأخراً)
      const later = new Date(Date.now() + 60 * 60_000)
      const second = await processQueuedJobs(h.db, { now: later, limit: 1 })
      expect(second).toMatchObject({ processed: 1, retried: 1, failed: 0 })
      const last = await processQueuedJobs(h.db, { now: new Date(later.getTime() + 60 * 60_000), limit: 1 })
      expect(last).toMatchObject({ processed: 1, retried: 0, failed: 1 })
      const [job] = await h.db.select().from(jobs).where(eq(jobs.type, 'AI_EVALUATE_SUBMISSION')).orderBy(jobs.createdAt)
      expect(job).toBeTruthy()
      const failedJobs = (await h.db.select().from(jobs)).filter((j) => j.status === 'FAILED')
      expect(failedJobs.length).toBe(1)
      expect(failedJobs[0]?.attempts).toBe(3)
      ev = await getLatestAiEvaluation(h.db, teacherA, sub.submissionId)
      expect(ev?.status).toBe('FAILED')
      // الواجهة لا تحمل نص الخطأ الداخلي
      expect(JSON.stringify(ev)).not.toContain('secret details')
      const view = await getAssignmentForStudent(h.db, s1, a.id)
      expect(view.submission?.status).toBe('SUBMITTED')
      expect(view.grade).toBeNull()
      // إعادة الطلب تنشئ تقييماً جديداً وينجح بالمزوّد التجريبي
      setAiProviderForTests(null)
      const again = await requestAiEvaluation(h.db, teacherA, sub.submissionId)
      expect(again.reused).toBe(false)
      await processQueuedJobs(h.db)
      expect((await getLatestAiEvaluation(h.db, teacherA, sub.submissionId))?.status).toBe('COMPLETED')
    } finally {
      setAiProviderForTests(null)
    }
  })

  it('التقييم التلقائي عند الإرسال يحترم إعداد المشرف', async () => {
    const a = await createAssignment(h.db, teacherA, { title: 'واجب ثالث', maxScore: 10, groupIds: [groupA.id], studentIds: [] })
    const sub = await submitAnswer(h.db, s2, a.id, 'إجابة الواجب الثالث كافية الطول لتقييمها.')
    expect(await maybeAutoEvaluate(h.db, sub.submissionId)).toBeNull()
    await expectCode(() => updateAiSettings(h.db, teacherA, { autoEvaluate: true }), 'FORBIDDEN')
    await updateAiSettings(h.db, admin, { autoEvaluate: true })
    const r = await maybeAutoEvaluate(h.db, sub.submissionId)
    expect(r?.evaluationId).toBeTruthy()
    const evRows = await h.db.select().from(aiEvaluations).where(eq(aiEvaluations.id, r!.evaluationId))
    expect(evRows[0]?.requestedByUserId).toBeNull()
    await processQueuedJobs(h.db)
    expect((await getLatestAiEvaluation(h.db, teacherA, sub.submissionId))?.status).toBe('COMPLETED')
    await updateAiSettings(h.db, admin, { autoEvaluate: false })
  })

  it('ملخص الأستاذ: مهمة واحدة نشطة لكل مساحة، والنتيجة تُقرأ من المهمة', async () => {
    expect(await latestTeacherInsights(h.db, teacherA)).toBeNull()
    const j1 = await requestTeacherInsights(h.db, teacherA)
    const j2 = await requestTeacherInsights(h.db, teacherA)
    expect(j2.jobId).toBe(j1.jobId)
    expect((await latestTeacherInsights(h.db, teacherA))?.status).toBe('QUEUED')
    await processQueuedJobs(h.db)
    const v = await latestTeacherInsights(h.db, teacherA)
    expect(v?.status).toBe('COMPLETED')
    expect(v?.summary).toContain('الأستاذ أ')
    expect(await latestTeacherInsights(h.db, teacherB)).toBeNull()
    await expectCode(() => requestTeacherInsights(h.db, s1), 'FORBIDDEN')
  })

  it('إحصاءات المشرف تعكس التقييمات والقرارات', async () => {
    await expectCode(() => aiAdminStats(h.db, teacherA), 'FORBIDDEN')
    const s = await aiAdminStats(h.db, admin)
    expect(s.provider.name).toBe('mock')
    expect(s.evaluations.COMPLETED).toBeGreaterThanOrEqual(4)
    expect(s.evaluations.FAILED).toBe(1)
    expect(s.decisions.APPROVED).toBe(1)
    expect(s.decisions.EDITED).toBe(1)
    expect(s.decisions.REJECTED).toBe(1)
    expect(s.jobs.FAILED).toBe(1)
  })
})
