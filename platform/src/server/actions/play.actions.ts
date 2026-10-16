'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { PLAY_CHALLENGE_TYPES, PLAY_REPORT_REASONS } from '@/server/play/constants'
import type { PlayStudentAnswer } from '@/server/play/question-types'
import { abandonSession, reportQuestion, setPlayPrefs, setPlayProfile, startPlaySession, submitPlayAnswer, type SubmitResult } from '@/server/services/play.service'

const profileSchema = z.object({ gradeCode: z.string().min(2).max(8), streamCode: z.string().min(2).max(10).nullable() })

export async function setPlayProfileAction(payload: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const parsed = profileSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    await setPlayProfile(await getDb(), actor, parsed.data)
    return undefined
  })
  if (r.ok) revalidatePath('/student/play')
  return r
}

const startSchema = z.object({
  challengeType: z.enum(PLAY_CHALLENGE_TYPES),
  subjectCode: z.string().min(1).max(10).nullable().optional(),
  unitCode: z.string().min(1).max(10).nullable().optional(),
  lessonId: z.string().uuid().nullable().optional(),
  timed: z.boolean().optional()
})

export async function startPlaySessionAction(payload: z.infer<typeof startSchema>): Promise<ActionResult<{ sessionId: string }>> {
  const parsed = startSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    const s = await startPlaySession(await getDb(), actor, parsed.data)
    return { sessionId: s.id }
  })
}

const answerSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MCQ'), key: z.string().min(1).max(4) }),
  z.object({ type: z.literal('FILL_BLANK'), blanks: z.array(z.string().max(200)).max(6) }),
  z.object({ type: z.literal('MATCHING'), matches: z.record(z.string().max(8), z.string().max(8)) }),
  z.object({ type: z.literal('ORDERING'), order: z.array(z.string().max(8)).max(10) })
])

const submitSchema = z.object({
  sessionId: z.string().uuid(),
  questionId: z.string().uuid(),
  answer: answerSchema.nullable(),
  timeMs: z.number().int().min(0).max(3_600_000).nullable().optional()
})

export async function submitPlayAnswerAction(payload: z.infer<typeof submitSchema>): Promise<ActionResult<SubmitResult>> {
  const parsed = submitSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    const d = parsed.data
    return submitPlayAnswer(await getDb(), actor, d.sessionId, d.questionId, d.answer as PlayStudentAnswer | null, d.timeMs ?? null)
  })
}

export async function abandonPlaySessionAction(sessionId: string): Promise<ActionResult> {
  const r = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    await abandonSession(await getDb(), actor, sessionId)
    return undefined
  })
  if (r.ok) revalidatePath('/student/play')
  return r
}

const reportSchema = z.object({ questionId: z.string().uuid(), sessionId: z.string().uuid().nullable().optional(), reason: z.enum(PLAY_REPORT_REASONS), message: z.string().max(1000).nullable().optional() })

export async function reportPlayQuestionAction(payload: z.infer<typeof reportSchema>): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    await reportQuestion(await getDb(), actor, parsed.data)
    return undefined
  })
}

const prefsSchema = z.object({ sound: z.boolean().optional(), motion: z.boolean().optional() })

export async function setPlayPrefsAction(payload: z.infer<typeof prefsSchema>): Promise<ActionResult> {
  const parsed = prefsSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    await setPlayPrefs(await getDb(), actor, parsed.data)
    return undefined
  })
}
