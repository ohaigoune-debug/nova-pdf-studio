'use server'

import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { PLAY_EXAM_MODES } from '@/server/play/constants'
import type { StepAnswer } from '@/server/play/exams/types'
import { finishExamAttempt, startExamAttempt, submitExamStep, type ExamSubmitResult } from '@/server/services/play-exams.service'

const startSchema = z.object({ setId: z.string().uuid(), mode: z.enum(PLAY_EXAM_MODES) })

export async function startExamAttemptAction(payload: z.infer<typeof startSchema>): Promise<ActionResult<{ attemptId: string }>> {
  const parsed = startSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    const r = await startExamAttempt(await getDb(), actor, parsed.data.setId, parsed.data.mode)
    return { attemptId: r.attemptId }
  })
}

const idx = z.number().int().min(0).max(40)
const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), choice: idx }),
  z.object({ type: z.literal('portrait'), choice: idx }),
  z.object({ type: z.literal('multi'), choices: z.array(idx).max(20) }),
  z.object({ type: z.literal('fill_blank'), blanks: z.array(z.string().max(300)).max(12) }),
  z.object({ type: z.literal('ordering'), order: z.array(idx).max(20) }),
  z.object({ type: z.literal('matching'), pairs: z.array(idx).max(20) }),
  z.object({ type: z.literal('numeric'), value: z.number().finite() }),
  z.object({ type: z.literal('short_text'), text: z.string().max(500) })
])

const submitSchema = z.object({ attemptId: z.string().uuid(), stepId: z.string().min(1).max(40), answer: answerSchema })

export async function submitExamStepAction(payload: z.infer<typeof submitSchema>): Promise<ActionResult<ExamSubmitResult>> {
  const parsed = submitSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    return submitExamStep(await getDb(), actor, parsed.data.attemptId, parsed.data.stepId, parsed.data.answer as StepAnswer)
  })
}

export async function finishExamAttemptAction(attemptId: string): Promise<ActionResult<{ attemptId: string }>> {
  const parsed = z.string().uuid().safeParse(attemptId)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    return finishExamAttempt(await getDb(), actor, attemptId)
  })
}
