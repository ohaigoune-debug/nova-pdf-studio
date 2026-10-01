'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { answerPractice, finishPractice, startPractice, type PracticeAnswerResult, type PracticeSummary } from '@/server/services/practice.service'

const uuid = z.string().uuid()

export async function startPracticeAction(input: { subjectId: string; curriculumNodeId?: string | null; difficulty?: number | null; count?: number; adaptive?: boolean }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ subjectId: uuid, curriculumNodeId: uuid.nullish(), difficulty: z.coerce.number().int().min(1).max(4).nullish(), count: z.coerce.number().int().min(1).max(30).optional(), adaptive: z.boolean().optional() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const s = await startPractice(await getDb(), await requireRole('STUDENT'), { ...parsed.data, curriculumNodeId: parsed.data.curriculumNodeId ?? null, difficulty: parsed.data.difficulty ?? null })
    return { id: s.id }
  })
  if (result.ok) revalidatePath('/student/practice')
  return result
}

export async function answerPracticeAction(sessionId: string, questionId: string, answer: { optionIds?: string[]; value?: boolean; text?: string; blanks?: string[]; matches?: Record<string, number> }): Promise<ActionResult<PracticeAnswerResult>> {
  const parsed = z
    .object({ sessionId: uuid, questionId: uuid, answer: z.object({ optionIds: z.array(z.string().max(4)).max(12).optional(), value: z.boolean().optional(), text: z.string().max(500).optional(), blanks: z.array(z.string().max(200)).max(20).optional(), matches: z.record(z.string(), z.number().int().min(0).max(50)).optional() }) })
    .safeParse({ sessionId, questionId, answer })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => answerPractice(await getDb(), await requireRole('STUDENT'), parsed.data.sessionId, parsed.data.questionId, parsed.data.answer))
}

export async function finishPracticeAction(sessionId: string): Promise<ActionResult<PracticeSummary>> {
  const parsed = uuid.safeParse(sessionId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => finishPractice(await getDb(), await requireRole('STUDENT'), parsed.data))
  if (result.ok) {
    revalidatePath('/student/practice')
    revalidatePath(`/student/practice/${sessionId}`)
  }
  return result
}
