'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { EXAM_ITEM_KINDS, EXAM_KINDS, EXAM_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { blockSchema, figuresSchema, layoutSchema } from '@/lib/exam-blocks'
import { addBlock, addFreeItem, addItemFromBank, createExam, createFromTemplate, deleteExam, duplicateExam, duplicateItem, rebalancePoints, recordPrint, removeItem, reorderItems, restoreItems, updateExam, updateItem, type ExamInput, type ItemPatch, type ItemState } from '@/server/services/exams.service'
import { kickWorker } from '@/server/jobs/runner'
import { buildBacMock } from '@/server/services/bac-generator.service'
import { getTeacherProgress, setTeacherProgress } from '@/server/services/exam-engine.service'
import { buildExamFromBank, parseExamRequestSmart, replaceItem, requestAiBuild, type DifficultyProfile, type GenerateParams, type ParsedRequest } from '@/server/services/exam-generator.service'
import { listBankQuestions, type BankFilter, type BankListItem } from '@/server/services/question-bank.service'
import { listNodes, type CurriculumTreeNode } from '@/server/services/taxonomy.service'

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
  status: z.enum(EXAM_STATUSES).optional(),
  isTemplate: z.boolean().optional(),
  groupId: optUuid,
  layout: layoutSchema.optional(),
  isFavorite: z.boolean().optional()
})
const snapshotSchema = z.object({ body: z.string().max(8000) }).passthrough()

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

/** قالب ↔ امتحان عادي */
export async function setTemplateAction(id: string, isTemplate: boolean): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, isTemplate: z.boolean() }).safeParse({ id, isTemplate })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateExam(await getDb(), await requireRole('TEACHER'), parsed.data.id, { isTemplate: parsed.data.isTemplate })
    return undefined
  })
  if (result.ok) revalidate(id)
  return result
}

/** أرشفة/استرجاع (الأرشيف لا يظهر في القائمة الرئيسية) */
export async function archiveExamAction(id: string, archived: boolean): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, archived: z.boolean() }).safeParse({ id, archived })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateExam(await getDb(), await requireRole('TEACHER'), parsed.data.id, { status: parsed.data.archived ? 'ARCHIVED' : 'DRAFT' })
    return undefined
  })
  if (result.ok) revalidate(id)
  return result
}

/** امتحان جديد من قالب */
export async function createFromTemplateAction(templateId: string): Promise<ActionResult<{ id: string }>> {
  const parsed = uuid.safeParse(templateId)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await createFromTemplate(await getDb(), await requireRole('TEACHER'), parsed.data)
    return { id: row.id }
  })
  if (result.ok) revalidate()
  return result
}

/** يُستدعى من زرّ الطباعة: عدّاد الطباعة والسجلّ (لا يؤثر على الطباعة نفسها) */
export async function recordPrintAction(examId: string, mode: 'subject' | 'correction', variant: string): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, mode: z.enum(['subject', 'correction']), variant: z.enum(['A', 'B', 'C', 'D']) }).safeParse({ examId, mode, variant })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await recordPrint(await getDb(), await requireRole('TEACHER'), parsed.data.examId, { mode: parsed.data.mode, variant: parsed.data.variant })
    return undefined
  })
  if (result.ok) revalidate(examId)
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

const optionsSchema = z.array(z.object({ label: z.string().max(500), isCorrect: z.boolean() })).max(8)
const itemPatchSchema = z.object({
  title: z.string().max(200).nullish(),
  points: z.number().positive().max(200).nullish(),
  body: z.string().max(8000).optional(),
  solution: z.string().max(8000).nullish(),
  childPoints: z.array(z.number().min(0).max(200)).max(40).optional(),
  options: optionsSchema.optional(),
  block: blockSchema.optional(),
  figures: figuresSchema.nullish(),
  children: z.array(z.object({ body: z.string().max(8000), points: z.number().min(0).max(200).nullish(), solution: z.string().max(8000).nullish(), options: optionsSchema.optional(), type: z.string().max(20).optional(), title: z.string().max(200).nullish() })).max(40).optional(),
  bareme: z.array(z.object({ label: z.string().max(300), points: z.number().min(0).max(200) })).max(40).nullish(),
  optionsColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullish(),
  difficulty: z.number().int().min(1).max(4).nullish(),
  estimatedMinutes: z.number().int().min(0).max(600).nullish(),
  type: z.string().max(20).optional()
})

export async function updateItemAction(examId: string, itemId: string, patch: ItemPatch): Promise<ActionResult> {
  const parsed = z.object({ examId: uuid, itemId: uuid, patch: itemPatchSchema }).safeParse({ examId, itemId, patch })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await updateItem(await getDb(), await requireRole('TEACHER'), parsed.data.itemId, parsed.data.patch as ItemPatch)
    return undefined
  })
  if (result.ok) revalidate(examId)
  return result
}

/** الاستوديو: كتلة منظّمة في الورقة */
export async function addBlockAction(examId: string, block: unknown, position?: number | null): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ examId: uuid, block: blockSchema, position: z.number().int().min(0).max(500).nullish() }).safeParse({ examId, block, position })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const row = await addBlock(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.block, parsed.data.position)
    return { id: row.id }
  })
  if (result.ok) revalidate(examId)
  return result
}

/** الاستوديو: تراجع/إعادة — استرجاع حالة عناصر (استبدال أو إعادة إدراج بالمعرّف نفسه) */
export async function restoreItemsAction(examId: string, states: ItemState[]): Promise<ActionResult<{ ids: string[] }>> {
  const parsed = z
    .object({
      examId: uuid,
      states: z.array(z.object({ itemId: optUuid, kind: z.enum(EXAM_ITEM_KINDS), bankQuestionId: optUuid, title: z.string().max(200).nullish(), points: z.number().min(0).max(200).nullish(), snapshot: snapshotSchema, position: z.number().int().min(0).max(500).nullish() })).min(1).max(60)
    })
    .safeParse({ examId, states })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const rows = await restoreItems(await getDb(), await requireRole('TEACHER'), parsed.data.examId, parsed.data.states as ItemState[])
    return { ids: rows.map((r) => r.id) }
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

const generateSchema = z.object({
  title: z.string().max(200).nullish(),
  kind: z.enum(EXAM_KINDS).optional(),
  subjectId: uuid,
  levelId: uuid,
  streamId: optUuid,
  schoolTerm: z.coerce.number().int().min(1).max(3).nullish(),
  curriculumNodeIds: z.array(uuid).max(20).optional(),
  durationMinutes: z.coerce.number().int().min(5).max(600),
  exercises: z.coerce.number().int().min(1).max(12),
  targetPoints: z.coerce.number().positive().max(200).optional(),
  profile: z.object({ easy: z.coerce.number().min(0).max(100), medium: z.coerce.number().min(0).max(100), hard: z.coerce.number().min(0).max(100) }).optional(),
  allowAi: z.boolean().optional(),
  slots: z.array(z.object({ curriculumNodeId: optUuid, difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullish(), points: z.number().positive().max(200).nullish() })).max(12).optional(),
  respectProgress: z.boolean().optional()
})

/** «ابنِ لي الامتحان»: من البنك فوراً، ثم الناقص بالذكاء الاصطناعي في الخلفية إن سُمح */
export async function buildExamAction(input: GenerateParams): Promise<ActionResult<{ examId: string; jobId: string | null; picked: number; missing: number }>> {
  const parsed = generateSchema.safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    const p = parsed.data as GenerateParams
    if (p.allowAi) {
      await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
      return requestAiBuild(db, actor, p)
    }
    const r = await buildExamFromBank(db, actor, p)
    return { ...r, jobId: null }
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidate(result.data.examId)
  }
  return result
}

/** AI Mode: يحوّل طلباً حرّاً إلى معاملات النموذج (النموذج إن ضُبط، وإلا المحلّل الحتمي) — ثم البنك أولاً */
export async function parseExamRequestAction(text: string): Promise<ActionResult<ParsedRequest>> {
  const parsed = z.string().min(3).max(500).safeParse(text)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return parseExamRequestSmart(db, parsed.data, { userId: actor.userId, workspaceId: actor.workspaceId })
  })
}

/** «استبدال هذا التمرين» ببديل من البنك بنفس المعايير */
export async function replaceItemAction(examId: string, itemId: string): Promise<ActionResult<{ itemId: string }>> {
  const parsed = z.object({ examId: uuid, itemId: uuid }).safeParse({ examId, itemId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const r = await replaceItem(await getDb(), await requireRole('TEACHER'), parsed.data.itemId)
    return { itemId: r.itemId }
  })
  if (result.ok) revalidate(examId)
  return result
}

export type NodeOption = { id: string; name: string; kind: string; schoolTerm: number | null; parentId: string | null }

/** عقد المنهاج لمادة وصف (وشعبة) — للفتحات والتدرّج في «ابنِ لي الامتحان» */
export async function listNodesAction(scope: { subjectId: string; levelId: string; streamId?: string | null }): Promise<ActionResult<{ nodes: NodeOption[]; progressNodeId: string | null }>> {
  const parsed = z.object({ subjectId: uuid, levelId: uuid, streamId: optUuid }).safeParse(scope)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    const tree = await listNodes(db, { subjectId: parsed.data.subjectId, levelId: parsed.data.levelId, streamId: parsed.data.streamId ?? null })
    const nodes: NodeOption[] = []
    const walk = (ns: CurriculumTreeNode[], parentId: string | null, prefix: string) => {
      for (const n of ns) {
        nodes.push({ id: n.id, name: `${prefix}${n.title}`, kind: n.kind, schoolTerm: n.schoolTerm, parentId })
        walk(n.children, n.id, `${prefix}${n.title} / `)
      }
    }
    walk(tree, null, '')
    const progress = await getTeacherProgress(db, actor, { subjectId: parsed.data.subjectId, levelId: parsed.data.levelId, streamId: parsed.data.streamId ?? null })
    return { nodes: nodes.slice(0, 400), progressNodeId: progress.nodeId }
  })
}

/** «حدّد أين وصلت في البرنامج» */
export async function setProgressAction(scope: { subjectId: string; levelId: string; streamId?: string | null }, nodeId: string | null): Promise<ActionResult> {
  const parsed = z.object({ subjectId: uuid, levelId: uuid, streamId: optUuid, nodeId: optUuid }).safeParse({ ...scope, nodeId })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    await setTeacherProgress(await getDb(), await requireRole('TEACHER'), { subjectId: parsed.data.subjectId, levelId: parsed.data.levelId, streamId: parsed.data.streamId ?? null }, parsed.data.nodeId ?? null)
    return undefined
  })
}

/** بكالوريا تجريبية بالهيكلة الرسمية للمادة والشعبة */
export async function buildBacMockAction(input: { subjectId: string; streamId?: string | null; title?: string | null }): Promise<ActionResult<{ examId: string; filled: number; missing: string[] }>> {
  const parsed = z.object({ subjectId: uuid, streamId: optUuid, title: z.string().max(200).nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const r = await buildBacMock(await getDb(), await requireRole('TEACHER'), { subjectId: parsed.data.subjectId, streamId: parsed.data.streamId ?? null, title: parsed.data.title ?? null })
    return { examId: r.examId, filled: r.filled, missing: r.missing }
  })
  if (result.ok) revalidate(result.data.examId)
  return result
}

export type { DifficultyProfile }
