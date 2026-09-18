'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { ATTENDANCE_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import {
  excuseAbsence,
  openScannerSession,
  scanAttendanceToken,
  setAttendanceManually,
  type ScanResult
} from '@/server/services/attendance.service'

export async function openScannerAction(classSessionId: string, deviceLabel?: string): Promise<ActionResult<{ scannerSessionId: string }>> {
  return runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const s = await openScannerSession(await getDb(), actor, classSessionId, deviceLabel)
    return { scannerSessionId: s?.id ?? '' }
  })
}

export async function scanAction(input: { classSessionId: string; token: string; scannerSessionId?: string | null }): Promise<ActionResult<ScanResult>> {
  const parsed = z.object({ classSessionId: z.string().uuid(), token: z.string().min(10).max(2000), scannerSessionId: z.string().uuid().nullish() }).safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'scan', subject: actor.userId, ...RATE_LIMITS.scan })
    return scanAttendanceToken(db, actor, parsed.data)
  })
}

export async function setManualAttendanceAction(input: { classSessionId: string; studentId: string; status: string; notes?: string }): Promise<ActionResult> {
  const parsed = z
    .object({ classSessionId: z.string().uuid(), studentId: z.string().uuid(), status: z.enum(ATTENDANCE_STATUSES), notes: z.string().optional() })
    .safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    await setAttendanceManually(await getDb(), actor, parsed.data)
    return undefined
  })
  if (result.ok) revalidatePath(`/teacher/sessions/${parsed.data.classSessionId}`)
  return result
}

const excuseSchema = z.object({
  recordId: z.string().uuid(),
  reason: z.string().trim().min(2, 'أدخل سبب التبرير'),
  notes: z.string().trim().optional(),
  fileUrl: z.string().trim().url().optional().or(z.literal(''))
})

export async function excuseAbsenceAction(
  _prev: ActionResult<{ canReactivate: boolean }> | null,
  formData: FormData
): Promise<ActionResult<{ canReactivate: boolean }>> {
  const parsed = excuseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const result = await runAction(async () => {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const r = await excuseAbsence(await getDb(), actor, { recordId: d.recordId, reason: d.reason, notes: d.notes || null, fileUrl: d.fileUrl || null })
    return { canReactivate: r.canReactivate }
  })
  if (result.ok) revalidatePath('/teacher', 'layout')
  return result
}
