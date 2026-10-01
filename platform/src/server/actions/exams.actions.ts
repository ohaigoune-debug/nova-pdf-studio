'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { EXAM_ITEM_KINDS, EXAM_KINDS, EXAM_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { addFreeItem, addItemFromBank, createExam, deleteExam, duplicateExam, duplicateItem, rebalancePoints, removeItem, reorderItems, updateExam, updateItem, type ExamInput } from '@/server/services/exams.service'
import { listBankQuestions, type BankFilter, type BankListItem } from '@/server/services/question-bank.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()

const examSchema = z.object({
  title: z.string().max(200).optional(),
  kind: z.enum(EXAM_KINDS).optional(),
  subjectId: optUuid,
  levelId: optUuid,
  streamId: optUuid,
  schoolTerm: z.coerce.number().int().min(1).max(3).nullish(),
  academicYear: z.string().max(20).nullish(),
  durationMinutes: z.coerce.number().int().min(5).max(600).optional(),
  targetPoints: z.coerce.number().positive().max(200).optional(),
  instructions: z.string().max(4000).nullish(),
  header: z.object({ school: z.string().max(200).optional(), wilaya: z.string().max(80).optional(), teacherName: z.string().max(120).optional(), heading: z.string().max(120).optional(), date: z.string().max(40).optional(), showSources: z.boolean().optional() }).optional(),
  status: z.enum(EXAM_STATUSES).optional()
})

const revalidate = (id?: string) => {
  revalidatePath('/teacher/exams')
  if (id) revalidatePath(`/teacher/exams/${id}`)
}

export async function createExamAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  const parsed = examSchema.safeParse({ title: s('title') ?? '', kind: s('kind') ?? undefined, subjectId: s('subjectId'), levelId: s('levelId'), streamId: s('streamId'), schoolTerm: s('schoolTerm'), durationMinutes: s('durationMinutes') ?? undefined, targetPoints: s('targetPoints') ?? undefined })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await createExam(await getDb(), await requireRole('TEACHER'), parsed.data as ExamInput)
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

export async function updateExamAction(id: string, input: ExamInput): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, input: examSchema }).safeParse({ id, input })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateExam(await getDb(), await requireRole('TEACHER'), parsed.data.id, parsed.data.input as ExamInput)
    return undefined
  })
  if (result.ok) revalidate(id)
  return result
}

export async function deleteExamAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await deleteExam(await getDb(), await requireRole('TEACHER'), parsed.data)
    return undefined
  })
  if (result.ok) revalidate()
  return result
}

export async function duplicateExamAction(id: string): Promise<ActionResult<{ id: string }>> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await duplicateExam(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

export async function addFromBankAction(examId: string, questionId: string, position?: number | null): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ examId: uuid, questionId: uuid, position: z.number().int().min(0).max(500).nullish() }).safeParse({ examId, questionId, position })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await addItemFromBank(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.questionId, parsed.data.position)
    return { id: row.id }
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function addFreeItemAction(examId: string, input: { kind: string; body?: string; title?: string | null; points?: number | null; position?: number | null }): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ examId: uuid, kind: z.enum(EXAM_ITEM_KINDS), body: z.string().max(8000).optional(), title: z.string().max(200).nullish(), points: z.number().positive().max(200).nullish(), position: z.number().int().min(0).max(500).nullish() }).safeParse({ examId, ...input })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const { examId: ex, ...rest } = parsed.data
    const row = await addFreeItem(await getDb(), await requireRole('TEACHER'), ex, rest)
    return { id: row.id }
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function updateItemAction(examId: string, itemId: string, patch: { title?: string | null; points?: number | null; body?: string; solution?: string | null; childPoints?: number[]; options?: { label: string; isCorrect: boolean }[] }): Promise<ActionResult> {
  const parsed = z
    .object({ examId: uuid, itemId: uuid, patch: z.object({ title: z.string().max(200).nullish(), points: z.number().positive().max(200).nullish(), body: z.string().max(8000).optional(), solution: z.string().max(8000).nullish(), childPoints: z.array(z.number().min(0).max(200)).max(40).optional(), options: z.array(z.object({ label: z.string().max(500), isCorrect: z.boolean() })).max(8).optional() }) })
    .safeParse({ examId, itemId, patch })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateItem(await getDb(), await requireRole('TEACHER'), parsed.data.itemId, parsed.data.patch)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function removeItemAction(examId: string, itemId: string): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, itemId: uuid }).safeParse({ examId, itemId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await removeItem(await getDb(), await requireRole('TEACHER'), parsed.data.itemId)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function duplicateItemAction(examId: string, itemId: string): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, itemId: uuid }).safeParse({ examId, itemId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await duplicateItem(await getDb(), await requireRole('TEACHER'), parsed.data.itemId)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function reorderItemsAction(examId: string, orderedIds: string[]): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, orderedIds: z.array(uuid).max(500) }).safeParse({ examId, orderedIds })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await reorderItems(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.orderedIds)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function rebalanceAction(examId: string): Promise<ActionResult<{ total: number }>> {
  const parsed = uuid.safeParse(examId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const r = await rebalancePoints(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { total: r.total }
  })
  if (result.ok) revalidate(examId)
  return result
}

/** بحث البنك من داخل المحرّر (لوحة اليمين) */
export async function searchBankAction(filter: BankFilter, cursor?: string | null): Promise<ActionResult<{ items: BankListItem[]; nextCursor: string | null }>> {
  const parsed = z
    .object({ scope: z.enum(['mine', 'central', 'public', 'all', 'favorites']).optional(), q: z.string().max(200).nullish(), subjectId: optUuid, levelId: optUuid, streamId: optUuid, curriculumNodeId: optUuid, schoolTerm: z.number().int().min(1).max(3).nullish(), types: z.array(z.string()).optional(), kinds: z.array(z.string()).optional(), difficulties: z.array(z.number().int().min(1).max(4)).optional(), examKind: z.string().nullish(), sourceYear: z.number().int().nullish(), hasSolution: z.boolean().nullish() })
    .safeParse(filter)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => listBankQuestions(await getDb(), await requireRole('TEACHER'), parsed.data as BankFilter, { cursor: cursor ?? null, limit: 20 }))
}
