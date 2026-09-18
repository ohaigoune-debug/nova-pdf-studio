'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { QUESTION_TYPES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { createQuiz, deleteQuiz, reviewAttempt, startAttempt, submitAttempt, updateQuiz } from '@/server/services/quizzes.service'
import { createRubric, deleteRubric, updateRubric } from '@/server/services/rubrics.service'

const questionSchema = z.object({
  id: z.string().optional(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().trim().min(1),
  imageFileId: z.string().uuid().nullable().optional(),
  points: z.number().positive().max(100),
  skillId: z.string().uuid().nullable().optional(),
  answerKey: z.record(z.unknown()).nullable(),
  options: z.array(z.object({ label: z.string(), isCorrect: z.boolean() })).max(10)
})

const quizSchema = z.object({
  title: z.string().trim().min(2, 'أدخل عنوان الاختبار'),
  description: z.string().trim().optional().nullable(),
  topic: z.string().trim().optional().nullable(),
  skillId: z.string().uuid().nullable().optional(),
  timeLimitMinutes: z.number().int().min(1).max(300).nullable().optional(),
  maxAttempts: z.number().int().min(1).max(10).default(1),
  dueAt: z.string().nullable().optional(),
  isPublic: z.boolean().default(false),
  publish: z.boolean().default(true),
  groupIds: z.array(z.string().uuid()).default([]),
  studentIds: z.array(z.string().uuid()).default([]),
  questions: z.array(questionSchema).optional()
})

export type QuizPayload = z.infer<typeof quizSchema>

export async function saveQuizAction(quizId: string | null, payload: QuizPayload): Promise<ActionResult<{ id: string }>> {
  const parsed = quizSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const dueAt = d.dueAt ? new Date(d.dueAt) : null
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const db = await getDb()
    const input = { ...d, dueAt: dueAt && !Number.isNaN(dueAt.getTime()) ? dueAt : null, questions: d.questions?.map((q) => ({ ...q, imageFileId: q.imageFileId ?? null, skillId: q.skillId ?? null })) }
    if (quizId) {
      await updateQuiz(db, actor, quizId, input)
      return { id: quizId }
    }
    const q = await createQuiz(db, actor, input)
    return { id: q.id }
  })
  if (result.ok) {
    revalidatePath('/teacher/quizzes')
    revalidatePath(`/teacher/quizzes/${result.data.id}`)
  }
  return result
}

export async function deleteQuizAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await deleteQuiz(await getDb(), actor, id)
    return undefined
  })
  if (!result.ok) return result
  revalidatePath('/teacher/quizzes')
  redirect('/teacher/quizzes')
}

export async function startAttemptAction(quizId: string): Promise<ActionResult<{ attemptId: string }>> {
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const a = await startAttempt(await getDb(), actor, quizId)
    return { attemptId: a.id }
  })
  if (!result.ok) return result
  redirect(`/student/quizzes/${quizId}/attempt/${result.data.attemptId}`)
}

const answerSchema = z.object({
  questionId: z.string().uuid(),
  optionIds: z.array(z.string().uuid()).optional(),
  value: z.boolean().optional(),
  text: z.string().max(20_000).optional(),
  blanks: z.array(z.string().max(500)).optional(),
  matches: z.record(z.number().int().min(0)).optional()
})

export async function submitAttemptAction(attemptId: string, answers: unknown): Promise<ActionResult<{ status: string; finalScore: number | null; maxScore: number | null; needsReview: boolean }>> {
  const parsed = z.array(answerSchema).safeParse(answers)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const r = await submitAttempt(await getDb(), actor, attemptId, parsed.data)
    return { status: r.status, finalScore: r.finalScore ?? null, maxScore: r.maxScore ?? null, needsReview: r.needsReview }
  })
  if (result.ok) revalidatePath('/student', 'layout')
  return result
}

export async function reviewAttemptAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const attemptId = String(fd.get('attemptId') ?? '')
  if (!/^[0-9a-f-]{36}$/.test(attemptId)) return { ok: false, error: { code: 'VALIDATION', message: 'محاولة غير صحيحة' } }
  const scores: Record<string, number> = {}
  for (const [k, v] of fd.entries()) {
    if (k.startsWith('score_')) scores[k.slice(6)] = Number(v)
  }
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await reviewAttempt(await getDb(), actor, attemptId, scores)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}

const rubricSchema = z.object({
  name: z.string().trim().min(2, 'أدخل اسم الشبكة'),
  description: z.string().trim().optional().nullable(),
  global: z.boolean().optional(),
  items: z.array(z.object({ id: z.string().uuid().optional(), label: z.string().trim().min(1, 'اسم البند مطلوب'), description: z.string().optional().nullable(), maxPoints: z.number().positive('النقاط موجبة'), skillId: z.string().uuid().nullable().optional() })).min(1, 'أضف بنداً واحداً على الأقل')
})
export type RubricPayload = z.infer<typeof rubricSchema>

export async function saveRubricAction(rubricId: string | null, payload: RubricPayload): Promise<ActionResult<{ id: string }>> {
  const parsed = rubricSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const db = await getDb()
    if (rubricId) {
      await updateRubric(db, actor, rubricId, d)
      return { id: rubricId }
    }
    const r = await createRubric(db, actor, d, { global: d.global })
    return { id: r.id }
  })
  if (result.ok) revalidatePath('/teacher/rubrics')
  return result
}

export async function deleteRubricAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await deleteRubric(await getDb(), actor, id)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/rubrics')
  return result
}
