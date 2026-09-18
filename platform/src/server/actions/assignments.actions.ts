'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import {
  addThreadMessage,
  createAssignment,
  deleteAssignment,
  reviewSubmission,
  saveDraft,
  submitAnswer,
  updateAssignment
} from '@/server/services/assignments.service'

const optionalUuid = z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : null))
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), 'تاريخ غير صحيح')

const assignmentSchema = z.object({
  title: z.string().trim().min(3, 'أدخل عنوان الواجب'),
  description: z.string().trim().optional(),
  subject: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  skillId: optionalUuid,
  startsAt: optionalDate,
  dueAt: optionalDate,
  maxScore: z.coerce.number().positive('العلامة يجب أن تكون موجبة').max(1000).default(20),
  attachmentFileId: optionalUuid
})

function parseTargets(fd: FormData) {
  const groupIds = fd.getAll('groupIds').map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  const studentIds = fd.getAll('studentIds').map(String).filter((v) => /^[0-9a-f-]{36}$/.test(v))
  return { groupIds, studentIds }
}

export async function createAssignmentAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = assignmentSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const targets = parseTargets(fd)
  if (targets.groupIds.length === 0 && targets.studentIds.length === 0) {
    return { ok: false, error: { code: 'VALIDATION', message: 'اختر فوجاً أو طالباً واحداً على الأقل.', fieldErrors: { targets: 'اختر فوجاً أو طالباً واحداً على الأقل.' } } }
  }
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const a = await createAssignment(await getDb(), actor, { ...parsed.data, ...targets })
    return { id: a.id }
  })
  if (!result.ok) return result
  revalidatePath('/teacher/assignments')
  redirect(`/teacher/assignments/${result.data.id}`)
}

export async function updateAssignmentAction(id: string, _prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = assignmentSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const targets = parseTargets(fd)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await updateAssignment(await getDb(), actor, id, { ...parsed.data, ...targets })
    return undefined
  })
  if (result.ok) {
    revalidatePath(`/teacher/assignments/${id}`)
    revalidatePath('/teacher/assignments')
  }
  return result
}

export async function deleteAssignmentAction(id: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await deleteAssignment(await getDb(), actor, id)
    return undefined
  })
  if (!result.ok) return result
  revalidatePath('/teacher/assignments')
  redirect('/teacher/assignments')
}

export async function saveDraftAction(assignmentId: string, text: string): Promise<ActionResult<{ submissionId: string }>> {
  const parsed = z.object({ assignmentId: z.string().uuid(), text: z.string().max(50_000) }).safeParse({ assignmentId, text })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    return saveDraft(await getDb(), actor, parsed.data.assignmentId, parsed.data.text)
  })
}

export async function submitAnswerAction(assignmentId: string, text: string): Promise<ActionResult<{ submissionId: string; late: boolean }>> {
  const parsed = z.object({ assignmentId: z.string().uuid(), text: z.string().max(50_000) }).safeParse({ assignmentId, text })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    return submitAnswer(await getDb(), actor, parsed.data.assignmentId, parsed.data.text)
  })
  if (result.ok) {
    revalidatePath(`/student/assignments/${assignmentId}`)
    revalidatePath('/student/assignments')
  }
  return result
}

export async function addThreadMessageAction(submissionId: string, text: string): Promise<ActionResult> {
  const parsed = z.object({ submissionId: z.string().uuid(), text: z.string().trim().min(1, 'اكتب رسالة').max(10_000) }).safeParse({ submissionId, text })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    await addThreadMessage(await getDb(), actor, parsed.data.submissionId, parsed.data.text)
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  score: z.coerce.number().min(0, 'النقطة لا تكون سالبة'),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  notes: z.string().trim().optional()
})

const lines = (v?: string) =>
  (v ?? '')
    .split(/\r?\n/)
    .map((s) => s.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean)

export async function reviewSubmissionAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await reviewSubmission(await getDb(), actor, d.submissionId, { score: d.score, strengths: lines(d.strengths), improvements: lines(d.improvements), notes: d.notes })
    return undefined
  })
  if (result.ok) revalidatePath('/', 'layout')
  return result
}
