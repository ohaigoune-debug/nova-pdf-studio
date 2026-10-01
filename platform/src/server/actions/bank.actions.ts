'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { BANK_EXAM_KINDS, BANK_KINDS, BANK_QUESTION_TYPES, BANK_STATUSES, RIGHTS_STATUSES } from '@/server/db/schema/enums'
import { kickWorker } from '@/server/jobs/runner'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { approveReviewed, createBankQuestion, deleteBankQuestion, importQuizToBank, requestQuestionExtraction, setBankQuestionStatus, toggleFavorite, updateBankQuestion, type BankQuestionInput } from '@/server/services/question-bank.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()
const optInt = (max: number) => z.coerce.number().int().min(1).max(max).nullish()

const questionSchema = z.object({
  kind: z.enum(BANK_KINDS).optional(),
  type: z.enum(BANK_QUESTION_TYPES),
  title: z.string().max(200).nullish(),
  body: z.string().min(1).max(8000),
  options: z.array(z.object({ label: z.string().max(500), isCorrect: z.boolean() })).max(8).optional(),
  answerKey: z.record(z.unknown()).nullish(),
  solution: z.string().max(8000).nullish(),
  bareme: z.array(z.object({ label: z.string().max(200), points: z.coerce.number().positive().max(100) })).max(20).optional(),
  points: z.coerce.number().positive().max(100).optional(),
  difficulty: z.coerce.number().int().min(1).max(4).optional(),
  estimatedMinutes: optInt(240),
  subjectId: optUuid,
  levelId: optUuid,
  streamId: optUuid,
  curriculumNodeId: optUuid,
  schoolTerm: optInt(3),
  examKind: z.enum(BANK_EXAM_KINDS).nullish(),
  sourceLabel: z.string().max(200).nullish(),
  sourceYear: z.coerce.number().int().min(1990).max(2100).nullish(),
  rightsStatus: z.enum(RIGHTS_STATUSES).optional(),
  keywords: z.array(z.string().max(40)).max(12).optional(),
  imageFileId: optUuid,
  visibility: z.enum(['PRIVATE', 'PUBLIC']).optional(),
  status: z.enum(BANK_STATUSES).optional(),
  parentId: optUuid
})

/** يقرأ النموذج (FormData) إلى مدخل السؤال: الاختيارات والسلّم والمفتاح تُبنى حسب النوع */
function parseForm(fd: FormData) {
  const type = String(fd.get('type') ?? 'OPEN')
  const options: { label: string; isCorrect: boolean }[] = []
  for (let i = 0; i < 8; i++) {
    const label = fd.get(`option_${i}`)
    if (typeof label === 'string' && label.trim()) options.push({ label: label.trim(), isCorrect: fd.get(`correct_${i}`) === 'on' })
  }
  const bareme: { label: string; points: number }[] = []
  for (let i = 0; i < 20; i++) {
    const label = fd.get(`bareme_label_${i}`)
    const pts = Number(fd.get(`bareme_points_${i}`) ?? 0)
    if (typeof label === 'string' && label.trim() && pts > 0) bareme.push({ label: label.trim(), points: pts })
  }
  const keyText = String(fd.get('answerText') ?? '').trim()
  let answerKey: Record<string, unknown> | null = null
  if (type === 'TRUE_FALSE') answerKey = { value: fd.get('answerBool') === 'true' }
  else if (type === 'SHORT_ANSWER' && keyText) answerKey = { accepted: keyText.split('|').map((x) => x.trim()).filter(Boolean) }
  else if (type === 'FILL_BLANK' && keyText) answerKey = { blanks: keyText.split('|').map((x) => x.trim()).filter(Boolean).map((x) => [x]) }
  else if (type === 'MATCHING' && keyText) answerKey = { pairs: keyText.split('\n').map((l) => l.split('=')).filter((p) => p.length === 2).map(([left, right]) => ({ left: left!.trim(), right: right!.trim() })) }
  const s = (k: string) => {
    const v = fd.get(k)
    return typeof v === 'string' && v.trim() ? v.trim() : null
  }
  return questionSchema.safeParse({
    kind: s('kind') ?? undefined,
    type,
    title: s('title'),
    body: String(fd.get('body') ?? ''),
    options,
    answerKey,
    solution: s('solution'),
    bareme,
    points: s('points') ?? undefined,
    difficulty: s('difficulty') ?? undefined,
    estimatedMinutes: s('estimatedMinutes'),
    subjectId: s('subjectId'),
    levelId: s('levelId'),
    streamId: s('streamId'),
    curriculumNodeId: s('curriculumNodeId'),
    schoolTerm: s('schoolTerm'),
    examKind: s('examKind'),
    sourceLabel: s('sourceLabel'),
    sourceYear: s('sourceYear'),
    rightsStatus: s('rightsStatus') ?? undefined,
    keywords: String(fd.get('keywords') ?? '')
      .split(/[،,]/)
      .map((x) => x.trim())
      .filter(Boolean),
    visibility: s('visibility') ?? undefined,
    status: s('status') ?? undefined,
    parentId: s('parentId')
  })
}

export async function createBankQuestionAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = parseForm(fd)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const row = await createBankQuestion(await getDb(), actor, parsed.data as BankQuestionInput)
    return { id: row.id }
  })
  if (result.ok) revalidatePath('/teacher/bank')
  return result
}

export async function updateBankQuestionAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = parseForm(fd)
  if (!parsed.success) return failValidation(parsed.error)
  const idOk = uuid.safeParse(id)
  if (!idOk.success) return failValidation(idOk.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await updateBankQuestion(await getDb(), actor, idOk.data, parsed.data as BankQuestionInput)
    return undefined
  })
  if (result.ok) {
    revalidatePath('/teacher/bank')
    revalidatePath(`/teacher/bank/${id}/edit`)
  }
  return result
}

export async function setBankStatusAction(id: string, status: string): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(BANK_STATUSES) }).safeParse({ id, status })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setBankQuestionStatus(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data.id, parsed.data.status)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/bank')
  return result
}

export async function deleteBankQuestionAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await deleteBankQuestion(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher/bank')
  return result
}

export async function toggleFavoriteAction(id: string): Promise<ActionResult<{ favorite: boolean }>> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => toggleFavorite(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data))
}

export async function approveReviewedAction(ids: string[]): Promise<ActionResult<{ approved: number }>> {
  const parsed = z.array(uuid).max(500).safeParse(ids)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => approveReviewed(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data))
  if (result.ok) revalidatePath('/teacher/bank')
  return result
}

export async function importQuizToBankAction(quizId: string, meta: { subjectId?: string | null; levelId?: string | null; streamId?: string | null; schoolTerm?: number | null }): Promise<ActionResult<{ imported: number; skipped: number }>> {
  const parsed = z.object({ quizId: uuid, subjectId: optUuid, levelId: optUuid, streamId: optUuid, schoolTerm: optInt(3) }).safeParse({ quizId, ...meta })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => importQuizToBank(await getDb(), await requireRole('TEACHER', 'SUPER_ADMIN'), parsed.data.quizId, { subjectId: parsed.data.subjectId ?? null, levelId: parsed.data.levelId ?? null, streamId: parsed.data.streamId ?? null, schoolTerm: parsed.data.schoolTerm ?? null }))
  if (result.ok) revalidatePath('/teacher/bank')
  return result
}

export async function requestExtractionAction(input: { fileIds: string[]; subjectId?: string | null; levelId?: string | null; streamId?: string | null; schoolTerm?: number | null; examKind?: string | null; sourceLabel?: string | null; sourceYear?: number | null; rightsStatus?: string }): Promise<ActionResult<{ jobId: string; files: number }>> {
  const parsed = z
    .object({ fileIds: z.array(uuid).min(1).max(10), subjectId: optUuid, levelId: optUuid, streamId: optUuid, schoolTerm: optInt(3), examKind: z.enum(BANK_EXAM_KINDS).nullish(), sourceLabel: z.string().max(200).nullish(), sourceYear: z.coerce.number().int().min(1990).max(2100).nullish(), rightsStatus: z.enum(RIGHTS_STATUSES).optional() })
    .safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'ai-request', subject: actor.userId, ...RATE_LIMITS.aiRequest })
    return requestQuestionExtraction(db, actor, parsed.data)
  })
  if (result.ok) {
    kickWorker(getDb)
    revalidatePath('/teacher/bank')
  }
  return result
}
