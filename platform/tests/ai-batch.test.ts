import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, EssayBatchItem, EssayBatchOutcome, EssayBatchStatus, EvaluateEssayOutput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { jobs, notifications } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { PermanentJobError } from '@/server/lib/errors'
import { assignmentAiSummary, getLatestAiEvaluation, requestAiEvaluation, requestAiEvaluationForAssignment } from '@/server/services/ai.service'
import { createAssignment, submitAnswer } from '@/server/services/assignments.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let groupId: string
const students: Actor[] = []

const output = (suggestedScore: number, confidence: number): EvaluateEssayOutput => ({
  suggestedScore,
  confidence,
  rubricBreakdown: null,
  strengths: ['وضوح'],
  weaknesses: [],
  mistakes: [],
  skillsDetected: [],
  skillsToImprove: [],
  teacherNotesSuggestion: ''
})

const base: Pick<AIProvider, 'name' | 'model' | 'generateTeacherInsights' | 'generateExercises' | 'analyzeStudent'> = {
  name: 'batch-mock',
  model: 'test-batch',
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

const jobsOfType = async (type: string, status?: string) => (await h.db.select().from(jobs)).filter((j) => j.type === type && (!status || j.status === status))

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ')
  const g = await createGroup(h.db, teacher, { name: 'فوج الدفعة' })
  groupId = g.id
  for (const n of ['طالب 1', 'طالب 2', 'طالب 3']) {
    const s = await makeStudent(h.db, n)
    const codes = await generateCodes(h.db, teacher, { groupId, count: 1 })
    await redeemEnrollmentCode(h.db, s, codes.codes[0]!.code)
    students.push(s)
  }
})

afterAll(async () => {
  setAiProviderForTests(null)
  await h.close()
})

describe('التصحيح عبر Message Batches (نصف السعر) والأخطاء النهائية', () => {
  it('الدفعة: طلب واحد للكل، استطلاع حتى الانتهاء، ثم نجاح / فشل نهائي / إعادة فرادى لغير المفوتَر', async () => {
    const submitted: EssayBatchItem[][] = []
    let fetches = 0
    const provider: AIProvider = {
      ...base,
      async evaluateEssay() {
        return output(12, 0.6)
      },
      async submitEssayBatch(items) {
        submitted.push(items)
        return { batchId: 'msgbatch_test' }
      },
      async fetchEssayBatch(batchId, items): Promise<EssayBatchStatus> {
        fetches++
        expect(batchId).toBe('msgbatch_test')
        if (fetches === 1) return { ended: false, outcomes: {} }
        const outcomes: Record<string, EssayBatchOutcome> = {}
        for (const i of items) {
          if (i.input.answerText.startsWith('أولى')) outcomes[i.customId] = { type: 'succeeded', output: output(15, 0.9) }
          else if (i.input.answerText.startsWith('ثانية')) outcomes[i.customId] = { type: 'failed', error: 'batch invalid_request_error', permanent: true }
          else outcomes[i.customId] = { type: 'failed', error: 'batch expired', permanent: false }
        }
        return { ended: true, outcomes }
      }
    }
    setAiProviderForTests(provider)
    const a = await createAssignment(h.db, teacher, { title: 'واجب الدفعة', maxScore: 20, groupIds: [groupId], studentIds: [] })
    const sub0 = await submitAnswer(h.db, students[0]!, a.id, 'أولى: إجابة مفصّلة تتناول الفكرة العامة والصور البيانية.')
    const sub1 = await submitAnswer(h.db, students[1]!, a.id, 'ثانية: إجابة تُرفض من الخادم.')
    const sub2 = await submitAnswer(h.db, students[2]!, a.id, 'ثالثة: إجابة تنتهي صلاحيتها في الدفعة.')

    expect(await requestAiEvaluationForAssignment(h.db, teacher, a.id)).toEqual({ queued: 3, skipped: 0, total: 3 })
    expect(submitted).toHaveLength(1)
    expect(submitted[0]!.map((i) => i.input.answerText.split(':')[0]).sort()).toEqual(['أولى', 'ثالثة', 'ثانية'])
    expect(submitted[0]![0]!.input.maxScore).toBe(20)
    // لا مهام فردية: جامع واحد مؤجل دقيقة
    expect(await jobsOfType('AI_EVALUATE_SUBMISSION', 'QUEUED')).toHaveLength(0)
    const [collect] = await jobsOfType('AI_BATCH_COLLECT')
    expect(collect?.runAfter.getTime()).toBeGreaterThan(Date.now())
    expect(await assignmentAiSummary(h.db, teacher, a.id)).toMatchObject({ pending: 3, suggested: 0, awaiting: 0 })
    expect(await processQueuedJobs(h.db)).toMatchObject({ processed: 0 })

    // الاستطلاع الأول: ما زالت قيد المعالجة ⇒ استطلاع جديد بلا استهلاك محاولات
    const t1 = new Date(Date.now() + 2 * 60_000)
    expect(await processQueuedJobs(h.db, { now: t1 })).toMatchObject({ processed: 1, completed: 1, failed: 0 })
    expect(fetches).toBe(1)
    const next = await jobsOfType('AI_BATCH_COLLECT', 'QUEUED')
    expect(next).toHaveLength(1)
    expect(next[0]!.payload).toMatchObject({ batchId: 'msgbatch_test', polls: 1 })
    expect(next[0]!.runAfter.getTime()).toBeGreaterThan(t1.getTime())

    // الاستطلاع الثاني: انتهت الدفعة
    const t2 = new Date(t1.getTime() + 5 * 60_000)
    expect(await processQueuedJobs(h.db, { now: t2, limit: 1 })).toMatchObject({ processed: 1, completed: 1 })
    expect(fetches).toBe(3) // استطلاع خفيف ثم جلب النتائج بالسياقات
    expect(await getLatestAiEvaluation(h.db, teacher, sub0.submissionId)).toMatchObject({ status: 'COMPLETED', suggestedScore: 15 })
    expect((await getLatestAiEvaluation(h.db, teacher, sub1.submissionId))?.status).toBe('FAILED')
    expect((await getLatestAiEvaluation(h.db, teacher, sub2.submissionId))?.status).toBe('PENDING')
    expect(await jobsOfType('AI_EVALUATE_SUBMISSION', 'QUEUED')).toHaveLength(1)
    expect(await jobsOfType('AI_BATCH_COLLECT', 'QUEUED')).toHaveLength(0)
    const batchNotice = (await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))).filter((n) => n.title.startsWith('اكتملت دفعة'))
    expect(batchNotice).toHaveLength(1)
    expect(batchNotice[0]!.body).toContain('1 اقتراحاً')

    // غير المفوتَر يُصحَّح فرادى بالمسار المعتاد
    expect(await processQueuedJobs(h.db, { now: t2 })).toMatchObject({ processed: 1, completed: 1 })
    expect(await getLatestAiEvaluation(h.db, teacher, sub2.submissionId)).toMatchObject({ status: 'COMPLETED', suggestedScore: 12 })
    expect(await assignmentAiSummary(h.db, teacher, a.id)).toMatchObject({ pending: 0, suggested: 2, awaiting: 1 })
  })

  it('تعذّر إرسال الدفعة ⇒ الصفوف نفسها تُعالَج فرادى بالمسار المعتاد', async () => {
    const provider: AIProvider = {
      ...base,
      async evaluateEssay() {
        return output(10, 0.8)
      },
      async submitEssayBatch() {
        throw new Error('network down')
      },
      async fetchEssayBatch() {
        throw new Error('unreachable')
      }
    }
    setAiProviderForTests(provider)
    const a = await createAssignment(h.db, teacher, { title: 'واجب بلا دفعة', maxScore: 10, groupIds: [groupId], studentIds: [] })
    await submitAnswer(h.db, students[0]!, a.id, 'إجابة الطالب الأول.')
    await submitAnswer(h.db, students[1]!, a.id, 'إجابة الطالب الثاني.')
    const collectBefore = (await jobsOfType('AI_BATCH_COLLECT')).length
    expect(await requestAiEvaluationForAssignment(h.db, teacher, a.id)).toEqual({ queued: 2, skipped: 0, total: 2 })
    expect((await jobsOfType('AI_BATCH_COLLECT')).length).toBe(collectBefore)
    expect(await jobsOfType('AI_EVALUATE_SUBMISSION', 'QUEUED')).toHaveLength(2)
    expect(await processQueuedJobs(h.db)).toMatchObject({ processed: 2, completed: 2, failed: 0 })
    expect(await assignmentAiSummary(h.db, teacher, a.id)).toMatchObject({ pending: 0, suggested: 2 })
  })

  it('الخطأ النهائي (ردّ مبتور/مرفوض) لا يُعاد: FAILED من أول محاولة بلا فوترة إضافية', async () => {
    let calls = 0
    const provider: AIProvider = {
      ...base,
      async evaluateEssay() {
        calls++
        throw new PermanentJobError('AI output truncated (max_tokens)')
      }
    }
    setAiProviderForTests(provider)
    const a = await createAssignment(h.db, teacher, { title: 'واجب مبتور', maxScore: 10, groupIds: [groupId], studentIds: [] })
    const sub = await submitAnswer(h.db, students[2]!, a.id, 'إجابة تُنتج ردّاً مبتوراً.')
    await requestAiEvaluation(h.db, teacher, sub.submissionId)
    expect(await processQueuedJobs(h.db)).toMatchObject({ processed: 1, retried: 0, failed: 1 })
    const later = new Date(Date.now() + 60 * 60_000)
    expect(await processQueuedJobs(h.db, { now: later })).toMatchObject({ processed: 0 })
    expect(calls).toBe(1)
    const [job] = (await jobsOfType('AI_EVALUATE_SUBMISSION', 'FAILED')).filter((j) => j.payload.submissionId === sub.submissionId)
    expect(job).toMatchObject({ attempts: 1 })
    expect(job?.error).toContain('truncated')
    expect((await getLatestAiEvaluation(h.db, teacher, sub.submissionId))?.status).toBe('FAILED')
  })
})
