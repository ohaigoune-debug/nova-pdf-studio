import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { assignmentSubmissions, grades, teacherReviews } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { applyAllAiEvaluations, assignmentAiSummary, requestAiEvaluationForAssignment } from '@/server/services/ai.service'
import { createAssignment, getAssignmentForStudent, saveDraft, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let teacherB: Actor
const students: Actor[] = []
let assignmentId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

/** مزوّد اختبار: الثقة تعتمد على طول الإجابة (قصيرة ⇒ ثقة منخفضة) */
const provider: AIProvider = {
  name: 'mock',
  model: 'test-bulk',
  async evaluateEssay(input) {
    const long = input.answerText.length > 80
    return {
      suggestedScore: long ? 16 : 9,
      confidence: long ? 0.9 : 0.4,
      rubricBreakdown: null,
      strengths: ['وضوح الفكرة'],
      weaknesses: long ? [] : ['إجابة مختصرة'],
      mistakes: [],
      skillsDetected: [],
      skillsToImprove: [],
      teacherNotesSuggestion: long ? 'أحسنت' : 'وسّع الإجابة'
    }
  },
  async generateTeacherInsights() {
    return { summary: '', nextLessonSuggestions: [] }
  },
  async generateExercises() {
    throw new Error('not used')
  },
  async analyzeStudent() {
    throw new Error('not used')
  }
}

beforeAll(async () => {
  setAiProviderForTests(provider)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  const g = await createGroup(h.db, teacher, { name: 'فوج الدفعة' })
  for (const n of ['طالب 1', 'طالب 2', 'طالب 3', 'طالب 4']) {
    const s = await makeStudent(h.db, n)
    const codes = await generateCodes(h.db, teacher, { groupId: g.id, count: 1 })
    await redeemEnrollmentCode(h.db, s, codes.codes[0]!.code)
    students.push(s)
  }
  const a = await createAssignment(h.db, teacher, { title: 'واجب الدفعة', maxScore: 20, groupIds: [g.id], studentIds: [] })
  assignmentId = a.id
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('التصحيح دفعة واحدة: طلب للكل ثم اعتماد للكل فوق حدّ الثقة', () => {
  it('الملخص يبدأ فارغاً؛ إجابتان مرسلتان ومسودة وغائب', async () => {
    expect(await assignmentAiSummary(h.db, teacher, assignmentId)).toMatchObject({ eligible: 4, submitted: 0, awaiting: 0 })
    await submitAnswer(h.db, students[0]!, assignmentId, 'إجابة طويلة ومفصّلة تتناول الفكرة العامة والصور البيانية والأسلوب بوضوح تام مع الأمثلة والشواهد المناسبة.')
    await submitAnswer(h.db, students[1]!, assignmentId, 'إجابة قصيرة جداً.')
    await saveDraft(h.db, students[2]!, assignmentId, 'مسودة لم تُرسل')
    const s = await assignmentAiSummary(h.db, teacher, assignmentId)
    expect(s).toMatchObject({ eligible: 4, submitted: 2, awaiting: 2, pending: 0, suggested: 0, reviewed: 0 })
  })

  it('طلب الكل: مهمة لكل إجابة مرسلة فقط، وإعادة الطلب لا تكرّر، والصلاحيات محفوظة', async () => {
    await expectCode(() => requestAiEvaluationForAssignment(h.db, students[0]!, assignmentId), 'FORBIDDEN')
    await expectCode(() => requestAiEvaluationForAssignment(h.db, teacherB, assignmentId), 'ASSIGNMENT_NOT_FOUND')
    const r1 = await requestAiEvaluationForAssignment(h.db, teacher, assignmentId)
    expect(r1).toEqual({ queued: 2, skipped: 0, total: 2 })
    const r2 = await requestAiEvaluationForAssignment(h.db, teacher, assignmentId)
    expect(r2).toEqual({ queued: 0, skipped: 2, total: 2 })
    expect(await assignmentAiSummary(h.db, teacher, assignmentId)).toMatchObject({ awaiting: 0, pending: 2, suggested: 0 })
    const jobs = await processQueuedJobs(h.db)
    expect(jobs).toMatchObject({ processed: 2, completed: 2, failed: 0 })
    const s = await assignmentAiSummary(h.db, teacher, assignmentId)
    expect(s).toMatchObject({ pending: 0, suggested: 2, minConfidence: 0.4 })
    // بعد الاكتمال وبلا قرار: الطلب مجدداً يتجاوزها
    expect(await requestAiEvaluationForAssignment(h.db, teacher, assignmentId)).toEqual({ queued: 0, skipped: 2, total: 2 })
    // الطالب لا يرى أثراً
    const sv = await getAssignmentForStudent(h.db, students[1]!, assignmentId)
    expect(sv.submission?.status).toBe('SUBMITTED')
  })

  it('اعتماد الكل بحدّ ثقة 70%: الواثقة تُعتمد وتُكتب علامتها، والضعيفة تبقى للمراجعة', async () => {
    await expectCode(() => applyAllAiEvaluations(h.db, teacherB, assignmentId, { minConfidence: 0.7 }), 'ASSIGNMENT_NOT_FOUND')
    const r = await applyAllAiEvaluations(h.db, teacher, assignmentId, { minConfidence: 0.7 })
    expect(r).toEqual({ approved: 1, belowThreshold: 1, skipped: 0 })
    const s = await assignmentAiSummary(h.db, teacher, assignmentId)
    expect(s).toMatchObject({ suggested: 1, reviewed: 1, minConfidence: 0.4 })
    const reviews = await h.db.select().from(teacherReviews)
    expect(reviews).toHaveLength(1)
    expect(reviews[0]?.decision).toBe('APPROVED')
    expect(Number(reviews[0]?.finalScore)).toBe(16)
    const g = await h.db.select().from(grades)
    expect(g).toHaveLength(1)
    expect(Number(g[0]?.score)).toBe(16)
    // الطالب الأول يرى علامته، الثاني ما زال بانتظار
    const v0 = await getAssignmentForStudent(h.db, students[0]!, assignmentId)
    expect(v0.submission?.status).toBe('REVIEWED')
    const v1 = await getAssignmentForStudent(h.db, students[1]!, assignmentId)
    expect(v1.submission?.status).toBe('SUBMITTED')
  })

  it('خفض الحدّ إلى 0 يعتمد الباقي، وإعادة الاعتماد لا تفعل شيئاً', async () => {
    expect(await applyAllAiEvaluations(h.db, teacher, assignmentId, { minConfidence: 0 })).toEqual({ approved: 1, belowThreshold: 0, skipped: 0 })
    expect(await applyAllAiEvaluations(h.db, teacher, assignmentId, { minConfidence: 0 })).toEqual({ approved: 0, belowThreshold: 0, skipped: 0 })
    const s = await assignmentAiSummary(h.db, teacher, assignmentId)
    expect(s).toMatchObject({ awaiting: 0, pending: 0, suggested: 0, reviewed: 2, minConfidence: null })
    const subs = await h.db.select().from(assignmentSubmissions).where(eq(assignmentSubmissions.assignmentId, assignmentId))
    expect(subs.filter((x) => x.status === 'REVIEWED')).toHaveLength(2)
    expect(subs.filter((x) => x.status === 'DRAFT')).toHaveLength(1)
    // الطلب مجدداً بعد التصحيح: لا شيء
    expect(await requestAiEvaluationForAssignment(h.db, teacher, assignmentId)).toEqual({ queued: 0, skipped: 0, total: 0 })
  })
})
