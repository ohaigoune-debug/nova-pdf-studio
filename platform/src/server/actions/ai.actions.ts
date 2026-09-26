'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { kickWorker } from '@/server/jobs/runner'
import { clearAiCredentials, saveAiCredentials } from '@/server/services/ai-credentials.service'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { applyAiEvaluation, approveAiEvaluation, applyAllAiEvaluations, rejectAiEvaluation, requestAiEvaluation, requestAiEvaluationForAssignment, requestExercises, requestStudentAnalysis, requestTeacherInsights, updateAiSettings } from '@/server/services/ai.service'

export async function requestAiEvaluationAction(submissionId: string): Promise<ActionResult<{ evaluationId: string; reused: boolean }>> {
  const parsed = z.string().uuid().safeParse(submissionId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    const r = await requestAiEvaluation(db, actor, parsed.data)
    return { evaluationId: r.evaluationId, reused: r.reused }
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/', 'layout')
  }
  return result
}

const lines = (v?: string) =>
  (v ?? '')
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)

const applySchema = z.object({
  evaluationId: z.string().uuid(),
  score: z.coerce.number().min(0, 'النقطة لا تكون سالبة').default(0),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  notes: z.string().trim().optional()
})

/** اعتماد الاقتراح (كما هو أو بعد تعديل) — نفس نموذج التصحيح مع معرّف الاقتراح */
export async function applyAiEvaluationAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = applySchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const breakdown: Record<string, number> = {}
  for (const [k, v] of fd.entries()) if (k.startsWith('rubric_')) breakdown[k.slice(7)] = Number(v)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await applyAiEvaluation(await getDb(), actor, d.evaluationId, {
      score: d.score,
      strengths: lines(d.strengths),
      improvements: lines(d.improvements),
      notes: d.notes,
      rubricBreakdown: Object.keys(breakdown).length ? breakdown : null
    })
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

/** «نعم» بنقرة واحدة */
export async function approveAiEvaluationAction(evaluationId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(evaluationId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await approveAiEvaluation(await getDb(), actor, parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export async function rejectAiEvaluationAction(evaluationId: string): Promise<ActionResult> {
  const parsed = z.string().uuid().safeParse(evaluationId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await rejectAiEvaluation(await getDb(), actor, parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export async function requestTeacherInsightsAction(): Promise<ActionResult<{ jobId: string }>> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    return requestTeacherInsights(await getDb(), actor)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/ai-insights')
  }
  return result
}

export async function updateAiSettingsAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const autoEvaluate = fd.get('autoEvaluate') === 'on'
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await updateAiSettings(await getDb(), actor, { autoEvaluate })
    return undefined
  })
  if (result.ok) revalidatePath('/admin/ai')
  return result
}

export async function requestExercisesAction(input: { skillId: string; groupId?: string | null }): Promise<ActionResult<{ jobId: string }>> {
  const parsed = z.object({ skillId: z.string().uuid(), groupId: z.string().uuid().nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestExercises(db, actor, { skillId: parsed.data.skillId, groupId: parsed.data.groupId ?? null })
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/quizzes')
  }
  return result
}

export async function requestStudentAnalysisAction(studentId: string): Promise<ActionResult<{ jobId: string }>> {
  const parsed = z.string().uuid().safeParse(studentId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestStudentAnalysis(db, actor, parsed.data)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath(`/teacher/students/${parsed.data}`)
  }
  return result
}

/** "تصحيح الكل": اقتراح لكل الإجابات المرسلة في الواجب دفعة واحدة */
export async function requestAiEvaluationForAssignmentAction(assignmentId: string): Promise<ActionResult<{ queued: number; skipped: number; total: number }>> {
  const parsed = z.string().uuid().safeParse(assignmentId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestAiEvaluationForAssignment(db, actor, parsed.data)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/', 'layout')
  }
  return result
}

/** "اعتماد الكل": اعتماد كل الاقتراحات المكتملة فوق حدّ الثقة كما هي */
export async function applyAllAiEvaluationsAction(assignmentId: string, minConfidence: number): Promise<ActionResult<{ approved: number; belowThreshold: number; skipped: number }>> {
  const parsed = z.object({ assignmentId: z.string().uuid(), minConfidence: z.coerce.number().min(0).max(1) }).safeParse({ assignmentId, minConfidence })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    return applyAllAiEvaluations(await getDb(), actor, parsed.data.assignmentId, { minConfidence: parsed.data.minConfidence })
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

export async function saveAiKeyAction(_prev: ActionResult<{ hint: string }> | null, fd: FormData): Promise<ActionResult<{ hint: string }>> {
  const parsed = z
    .object({ provider: z.enum(['openai', 'anthropic']), apiKey: z.string().min(1).max(400), model: z.string().max(80).optional() })
    .safeParse({ provider: fd.get('provider'), apiKey: fd.get('apiKey') ?? '', model: fd.get('model') ?? undefined })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-key', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    const saved = await saveAiCredentials(db, actor, parsed.data)
    return { hint: saved.hint }
  })
  if (result.ok) revalidatePath('/admin/ai')
  return result
}

export async function clearAiKeyAction(): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await clearAiCredentials(await getDb(), actor)
    return undefined
  })
  if (result.ok) revalidatePath('/admin/ai')
  return result
}
