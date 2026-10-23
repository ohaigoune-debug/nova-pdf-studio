'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { PLAY_DIFFICULTIES, PLAY_QUESTION_TYPES, PLAY_REVIEW_STATUSES, type PlayRules } from '@/server/play/constants'
import type { PlayContentQuestion } from '@/server/play/question-types'
import {
  archiveQuestion,
  bulkReviewByFilter,
  bulkSetReviewStatus,
  nextManualKey,
  resolveReport,
  setReviewStatus,
  setSuspended,
  upsertQuestionManual,
  type QuestionFilter
} from '@/server/services/play-admin.service'
import { updatePlayRules } from '@/server/services/play.service'

const ADMIN_PATHS = ['/admin/play', '/admin/play/questions', '/admin/play/reports', '/admin/play/coverage']

function revalidateAll(id?: string) {
  for (const p of ADMIN_PATHS) revalidatePath(p)
  if (id) revalidatePath(`/admin/play/questions/${id}`)
}

const statusSchema = z.enum(PLAY_REVIEW_STATUSES)
const uuid = z.string().uuid()

export async function setPlayReviewStatusAction(payload: { id: string; status: string; note?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: statusSchema, note: z.string().max(2000).nullable().optional() }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await setReviewStatus(await getDb(), actor, parsed.data.id, parsed.data.status, parsed.data.note === undefined ? undefined : parsed.data.note?.trim() || null)
    return undefined
  })
  if (r.ok) revalidateAll(parsed.data.id)
  return r
}

export async function bulkPlayReviewAction(payload: { ids: string[]; status: string }): Promise<ActionResult<{ count: number }>> {
  const parsed = z.object({ ids: z.array(uuid).min(1).max(500), status: statusSchema }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const count = await bulkSetReviewStatus(await getDb(), actor, parsed.data.ids, parsed.data.status)
    return { count }
  })
  if (r.ok) revalidateAll()
  return r
}

const filterSchema = z.object({
  grade: z.string().max(8).nullable().optional(),
  stream: z.string().max(10).nullable().optional(),
  subject: z.string().max(10).nullable().optional(),
  unit: z.string().max(20).nullable().optional(),
  type: z.enum(PLAY_QUESTION_TYPES).nullable().optional(),
  difficulty: z.enum(PLAY_DIFFICULTIES).nullable().optional(),
  status: statusSchema.nullable().optional(),
  search: z.string().max(200).nullable().optional(),
  suspended: z.boolean().nullable().optional(),
  reported: z.boolean().nullable().optional()
})

type PlayFilterInput = z.infer<typeof filterSchema>

export async function bulkPlayReviewByFilterAction(payload: { filter: PlayFilterInput; status: string }): Promise<ActionResult<{ count: number }>> {
  const parsed = z.object({ filter: filterSchema, status: statusSchema }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const count = await bulkReviewByFilter(await getDb(), actor, parsed.data.filter as QuestionFilter, parsed.data.status)
    return { count }
  })
  if (r.ok) revalidateAll()
  return r
}

export async function setPlaySuspendedAction(id: string, suspended: boolean): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, suspended: z.boolean() }).safeParse({ id, suspended })
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await setSuspended(await getDb(), actor, parsed.data.id, parsed.data.suspended)
    return undefined
  })
  if (r.ok) revalidateAll(id)
  return r
}

export async function archivePlayQuestionAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await archiveQuestion(await getDb(), actor, parsed.data)
    return undefined
  })
  if (r.ok) revalidateAll(id)
  return r
}

const questionSchema = z.object({
  key: z.string().max(60).optional(),
  type: z.enum(PLAY_QUESTION_TYPES),
  grade: z.string().min(2).max(8),
  streams: z.array(z.string().max(10)).max(8).optional(),
  subject: z.string().min(1).max(10),
  unit: z.string().min(1).max(20),
  lesson: z.string().min(1).max(20),
  objective: z.string().max(500).optional(),
  difficulty: z.enum(PLAY_DIFFICULTIES),
  question: z.string().min(1).max(4000),
  options: z.array(z.string().max(500)).max(6).optional(),
  correct: z.number().int().min(0).max(5).optional(),
  blanks: z.array(z.union([z.string().max(200), z.array(z.string().max(200)).max(6)])).max(6).optional(),
  bank: z.array(z.string().max(200)).max(12).optional(),
  pairs: z.array(z.object({ left: z.string().max(300), right: z.string().max(300) })).max(6).optional(),
  order: z.array(z.string().max(300)).max(7).optional(),
  explanation: z.string().min(1).max(4000),
  tags: z.array(z.string().max(40)).max(20).optional(),
  reviewStatus: statusSchema.optional(),
  note: z.string().max(2000).optional()
})

export type PlayQuestionInput = z.infer<typeof questionSchema>

/** إنشاء (بلا existingId) أو تعديل سؤال يدوياً. المفتاح يُولَّد تلقائياً للإنشاء إن لم يُعطَ. */
export async function upsertPlayQuestionAction(payload: PlayQuestionInput, existingId?: string | null): Promise<ActionResult<{ id: string }>> {
  const parsed = questionSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  if (existingId !== undefined && existingId !== null && !uuid.safeParse(existingId).success) return failValidation(new z.ZodError([{ code: 'custom', path: ['id'], message: 'معرّف غير صالح' }]))
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    const db = await getDb()
    const d = parsed.data
    const key = d.key?.trim() || (await nextManualKey(db, actor, d.grade, d.subject, d.unit, d.lesson))
    const input: PlayContentQuestion = {
      ...d,
      key,
      source: 'TEACHER',
      tags: (d.tags ?? []).map((t) => t.trim()).filter(Boolean),
      options: d.type === 'MCQ' ? d.options : undefined,
      correct: d.type === 'MCQ' ? d.correct : undefined,
      blanks: d.type === 'FILL_BLANK' ? d.blanks : undefined,
      bank: d.type === 'FILL_BLANK' ? d.bank : undefined,
      pairs: d.type === 'MATCHING' ? d.pairs : undefined,
      order: d.type === 'ORDERING' ? d.order : undefined
    }
    const id = await upsertQuestionManual(db, actor, input, existingId ?? null)
    return { id }
  })
  if (r.ok) revalidateAll(r.data.id)
  return r
}

export async function resolvePlayReportAction(payload: { id: string; status: 'RESOLVED' | 'DISMISSED'; resolution?: string | null }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(['RESOLVED', 'DISMISSED']), resolution: z.string().max(2000).nullable().optional() }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    await resolveReport(await getDb(), actor, parsed.data.id, parsed.data.status, parsed.data.resolution ?? null)
    return undefined
  })
  if (r.ok) revalidateAll()
  return r
}

const nonNeg = z.number().int().min(0).max(1_000_000)
const rulesSchema = z.object({
  xp: z.object({ correct: nonNeg, correctHard: nonNeg, sessionComplete: nonNeg, lessonMastery: nonNeg, repeatMastered: nonNeg }),
  levels: z.array(z.object({ title: z.string().min(1).max(40), minXp: nonNeg })).min(1).max(20),
  mastery: z.object({ minAnswered: z.number().int().min(1).max(1000), minPct: z.number().int().min(1).max(100) }),
  servableStatuses: z.array(statusSchema).min(1),
  publicLeaderboard: z.boolean()
})

export async function updatePlayRulesAction(payload: PlayRules): Promise<ActionResult<PlayRules>> {
  const parsed = rulesSchema.safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const levels = [...parsed.data.levels].sort((a, b) => a.minXp - b.minXp)
  if (levels[0]!.minXp !== 0) return failValidation(new z.ZodError([{ code: 'custom', path: ['levels'], message: 'المستوى الأول يجب أن يبدأ من 0 XP' }]))
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN')
    return updatePlayRules(await getDb(), actor, { ...parsed.data, levels })
  })
  if (r.ok) {
    revalidatePath('/admin/play/settings')
    revalidatePath('/student/play')
  }
  return r
}
