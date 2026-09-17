'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { GROUP_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { reactivateStudent, setEnrollmentStatus } from '@/server/services/enrollment.service'
import { archiveGroup, createGroup, updateGroup } from '@/server/services/groups.service'
import { createSchool } from '@/server/services/reference.service'

const optionalUuid = z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : null))
const optionalText = z.string().trim().optional().transform((v) => (v ? v : null))
const optionalInt = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== '' ? Number(v) : null))
  .pipe(z.number().int().min(0).nullable())

const groupSchema = z.object({
  name: z.string().trim().min(2, 'أدخل اسم الفوج'),
  wilayaId: optionalUuid,
  schoolId: optionalUuid,
  levelId: optionalUuid,
  streamId: optionalUuid,
  academicYearId: optionalUuid,
  dayOfWeek: optionalInt.pipe(z.number().int().min(0).max(6).nullable()),
  startTime: optionalText,
  durationMinutes: optionalInt,
  room: optionalText,
  capacity: optionalInt,
  startsOn: optionalText,
  endsOn: optionalText,
  status: z.enum(GROUP_STATUSES).optional(),
  lateAfterMinutes: optionalInt,
  maxUnexcusedAbsences: optionalInt,
  notes: optionalText
})

export async function createGroupAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = groupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const g = await createGroup(await getDb(), actor, {
      ...d,
      durationMinutes: d.durationMinutes ?? undefined,
      lateAfterMinutes: d.lateAfterMinutes ?? undefined,
      maxUnexcusedAbsences: d.maxUnexcusedAbsences ?? undefined
    })
    return { id: g.id }
  })
  if (!result.ok) return result
  revalidatePath('/teacher/groups')
  redirect(`/teacher/groups/${result.data.id}`)
}

export async function updateGroupAction(groupId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const parsed = groupSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await updateGroup(await getDb(), actor, groupId, {
      ...d,
      durationMinutes: d.durationMinutes ?? undefined,
      lateAfterMinutes: d.lateAfterMinutes ?? undefined,
      maxUnexcusedAbsences: d.maxUnexcusedAbsences ?? undefined
    })
    return undefined
  })
  if (result.ok) {
    revalidatePath(`/teacher/groups/${groupId}`)
    revalidatePath('/teacher/groups')
  }
  return result
}

export async function archiveGroupAction(groupId: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await archiveGroup(await getDb(), actor, groupId)
    return undefined
  })
  if (!result.ok) return result
  revalidatePath('/teacher/groups')
  redirect('/teacher/groups')
}

export async function reactivateStudentAction(groupStudentId: string, reason?: string): Promise<ActionResult> {
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await reactivateStudent(await getDb(), actor, groupStudentId, reason)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}

const statusSchema = z.enum(['SUSPENDED', 'INACTIVE', 'COMPLETED', 'LEFT_GROUP'])

export async function setEnrollmentStatusAction(groupStudentId: string, status: string, reason?: string): Promise<ActionResult> {
  const parsed = statusSchema.safeParse(status)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await setEnrollmentStatus(await getDb(), actor, groupStudentId, parsed.data, reason)
    return undefined
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}

const schoolSchema = z.object({ name: z.string().trim().min(2), wilayaId: z.string().uuid(), type: z.enum(['LYCEE', 'CEM', 'PRIVATE', 'OTHER']).optional() })

export async function createSchoolAction(_prev: ActionResult<{ id: string }> | null, formData: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = schoolSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const s = await createSchool(await getDb(), actor, parsed.data)
    return { id: s?.id ?? '' }
  })
  if (result.ok) revalidatePath('/teacher/groups/new')
  return result
}
