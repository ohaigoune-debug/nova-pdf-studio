'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { LIVE_PROVIDERS, LIVE_SESSION_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { attachRecording, createLiveSession, joinInfo, setLiveStatus, updateLiveSession } from '@/server/services/live.service'

const uuid = z.string().uuid()
const optionalUuid = z.string().uuid().optional().or(z.literal('')).transform((v) => (v ? v : null))

const sessionSchema = z.object({
  courseId: uuid,
  title: z.string().trim().min(2, 'أدخل عنوان الحصة').max(200),
  description: z.string().trim().max(2000).optional(),
  startsAt: z.string().refine((v) => !Number.isNaN(new Date(v).getTime()), 'موعد غير صحيح'),
  durationMinutes: z.coerce.number().int().min(10).max(600).default(90),
  provider: z.enum(LIVE_PROVIDERS).default('ZOOM'),
  joinUrl: z.string().trim().url('رابط غير صحيح').optional().or(z.literal('')),
  providerMeetingId: z.string().trim().max(100).optional()
})

function revalidate() {
  revalidatePath('/admin/live')
  revalidatePath('/student')
}

export async function createLiveSessionAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = sessionSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN', 'TEACHER')
    const s = await createLiveSession(await getDb(), actor, { ...d, startsAt: new Date(d.startsAt), joinUrl: d.joinUrl || null, description: d.description || null, providerMeetingId: d.providerMeetingId || null })
    return { id: s.id }
  })
  if (r.ok) revalidate()
  return r
}

export async function updateLiveSessionAction(id: string, _prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  if (!uuid.safeParse(id).success) return { ok: false, error: { code: 'VALIDATION', message: 'معرّف غير صحيح' } }
  const parsed = sessionSchema.safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const d = parsed.data
  const keepUrl = fd.get('keepJoinUrl') === 'on' && !d.joinUrl
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN', 'TEACHER')
    const s = await updateLiveSession(await getDb(), actor, id, {
      courseId: d.courseId,
      title: d.title,
      description: d.description || null,
      startsAt: new Date(d.startsAt),
      durationMinutes: d.durationMinutes,
      provider: d.provider,
      ...(keepUrl ? {} : { joinUrl: d.joinUrl || null }),
      providerMeetingId: d.providerMeetingId || null
    })
    return { id: s.id }
  })
  if (r.ok) {
    revalidate()
    revalidatePath(`/admin/live/${id}`)
  }
  return r
}

export async function setLiveStatusAction(payload: { id: string; status: string }): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, status: z.enum(LIVE_SESSION_STATUSES) }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN', 'TEACHER')
    await setLiveStatus(await getDb(), actor, parsed.data.id, parsed.data.status)
    return undefined
  })
  if (r.ok) {
    revalidate()
    revalidatePath(`/admin/live/${parsed.data.id}`)
  }
  return r
}

export async function attachRecordingAction(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const parsed = z.object({ id: uuid, recordingContentId: optionalUuid }).safeParse(Object.fromEntries(fd))
  if (!parsed.success) return failValidation(parsed.error)
  const r = await runAction(async () => {
    const actor = await requireRole('SUPER_ADMIN', 'TEACHER')
    await attachRecording(await getDb(), actor, parsed.data.id, parsed.data.recordingContentId)
    return undefined
  })
  if (r.ok) {
    revalidate()
    revalidatePath(`/admin/live/${parsed.data.id}`)
  }
  return r
}

/** التلميذ: رابط الانضمام (يُسجَّل حضوره)؛ يُرفض خارج النافذة أو بلا اشتراك نشط/شروط */
export async function joinLiveAction(payload: { sessionId: string }): Promise<ActionResult<{ url: string; provider: string; title: string }>> {
  const parsed = z.object({ sessionId: uuid }).safeParse(payload)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const actor = await requireRole('STUDENT')
    return joinInfo(await getDb(), actor, parsed.data.sessionId)
  })
}
