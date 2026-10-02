'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { blockSchema, layoutSchema } from '@/lib/exam-blocks'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { LIBRARY_ITEM_KINDS } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { applyLibraryHeader, createFromStudioTemplate, createRevision, deleteLibraryItem, insertLibraryBlock, listLibraryItems, listRevisions, restoreRevision, saveLibraryItem, updateLibraryItem, type LibraryListItem, type RevisionListItem } from '@/server/services/exam-studio.service'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { COPILOT_OPS, copilotPropose } from '@/server/services/exam-studio.service'
import type { CopilotOp, ExamCopilotOutput } from '@/server/ai/types'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()
const revalidate = (examId?: string) => {
  revalidatePath('/teacher/exams')
  if (examId) revalidatePath(`/teacher/exams/${examId}`)
}

/* ------------------------------- المراجعات ------------------------------- */

export async function listRevisionsAction(examId: string): Promise<ActionResult<RevisionListItem[]>> {
  const parsed = uuid.safeParse(examId)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => listRevisions(await getDb(), await requireRole('TEACHER'), parsed.data))
}

export async function createRevisionAction(examId: string, label?: string | null): Promise<ActionResult<{ number: number }>> {
  const parsed = z.object({ examId: uuid, label: z.string().max(120).nullish() }).safeParse({ examId, label })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const r = await createRevision(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.label ?? null)
    return { number: r.number }
  })
}

export async function restoreRevisionAction(examId: string, revisionId: string): Promise<ActionResult<{ restoredNumber: number }>> {
  const parsed = z.object({ examId: uuid, revisionId: uuid }).safeParse({ examId, revisionId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => restoreRevision(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.revisionId))
  if (result.ok) revalidate(examId)
  return result
}

/* ----------------------------- مكتبة الأستاذ ----------------------------- */

const libraryInput = z.object({
  kind: z.enum(LIBRARY_ITEM_KINDS),
  title: z.string().min(1).max(200),
  subjectId: optUuid,
  levelId: optUuid,
  tags: z.array(z.string().max(40)).max(10).optional(),
  block: blockSchema.optional(),
  header: z.object({ school: z.string().max(200).optional(), wilaya: z.string().max(80).optional(), teacherName: z.string().max(120).optional(), heading: z.string().max(120).optional(), date: z.string().max(40).optional(), showSources: z.boolean().optional() }).optional(),
  layout: layoutSchema.optional()
})

export async function saveLibraryItemAction(input: z.infer<typeof libraryInput>): Promise<ActionResult<{ id: string }>> {
  const parsed = libraryInput.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const row = await saveLibraryItem(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { id: row.id }
  })
}

export async function listLibraryItemsAction(filter: { kind?: 'BLOCK' | 'HEADER' | null; subjectId?: string | null; favorites?: boolean; q?: string | null } = {}): Promise<ActionResult<LibraryListItem[]>> {
  const parsed = z.object({ kind: z.enum(LIBRARY_ITEM_KINDS).nullish(), subjectId: optUuid, favorites: z.boolean().optional(), q: z.string().max(100).nullish() }).safeParse(filter)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => listLibraryItems(await getDb(), await requireRole('TEACHER'), parsed.data))
}

export async function updateLibraryItemAction(id: string, patch: { title?: string; tags?: string[]; isFavorite?: boolean }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, patch: z.object({ title: z.string().max(200).optional(), tags: z.array(z.string().max(40)).max(10).optional(), isFavorite: z.boolean().optional(), block: blockSchema.optional() }) }).safeParse({ id, patch })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    await updateLibraryItem(await getDb(), await requireRole('TEACHER'), parsed.data.id, parsed.data.patch)
    return undefined
  })
}

export async function deleteLibraryItemAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    await deleteLibraryItem(await getDb(), await requireRole('TEACHER'), parsed.data)
    return undefined
  })
}

export async function insertLibraryBlockAction(examId: string, libraryItemId: string, position?: number | null): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ examId: uuid, libraryItemId: uuid, position: z.number().int().min(0).max(500).nullish() }).safeParse({ examId, libraryItemId, position })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await insertLibraryBlock(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.libraryItemId, parsed.data.position)
    return { id: row.id }
  })
  if (result.ok) revalidate(examId)
  return result
}

export async function applyLibraryHeaderAction(examId: string, libraryItemId: string): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, libraryItemId: uuid }).safeParse({ examId, libraryItemId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await applyLibraryHeader(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.libraryItemId)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

/* ------------------------------ قوالب Madrasadz ------------------------------ */

export async function createFromStudioTemplateAction(templateId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = z.string().min(1).max(80).safeParse(templateId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await createFromStudioTemplate(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

/* ------------------------------ AI Copilot ------------------------------ */


/** مقترح فقط (معاينة): لا يغيّر الورقة؛ القبول يمرّ بإجراءات التعديل العادية من المتصفح */
export async function copilotProposeAction(examId: string, itemId: string, op: CopilotOp, instructions?: string | null): Promise<ActionResult<ExamCopilotOutput>> {
  const parsed = z.object({ examId: uuid, itemId: uuid, op: z.enum(COPILOT_OPS as [CopilotOp, ...CopilotOp[]]), instructions: z.string().max(600).nullish() }).safeParse({ examId, itemId, op, instructions })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return copilotPropose(db, actor, parsed.data.examId, parsed.data.itemId, parsed.data.op, parsed.data.instructions ?? null)
  })
}
