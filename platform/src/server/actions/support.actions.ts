'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActor, requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { SUPPORT_KINDS, SUPPORT_STATUSES } from '@/server/db/schema/enums'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { assignTicket, openTicket, replyTicket, setTicketStatus } from '@/server/services/support.service'

const uuid = z.string().uuid()
const optUuid = z.string().uuid().nullish()

const revalidate = (ticketId?: string) => {
  revalidatePath('/student/support')
  revalidatePath('/admin/support')
  if (ticketId) {
    revalidatePath(`/student/support/${ticketId}`)
    revalidatePath(`/admin/support/${ticketId}`)
  }
}

const str = (fd: FormData, k: string) => {
  const v = fd.get(k)
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

const openSchema = z.object({ kind: z.enum(SUPPORT_KINDS), subject: z.string().trim().min(3, 'الموضوع قصير جداً').max(200), body: z.string().trim().min(2, 'اكتب تفاصيل المشكلة').max(5000), courseId: optUuid, orderId: optUuid })

/** فتح تذكرة من نموذج (أي مستخدم مسجَّل) */
export async function openTicketAction(_prev: ActionResult<{ id: string; number: number }> | null, fd: FormData): Promise<ActionResult<{ id: string; number: number }>> {
  const parsed = openSchema.safeParse({ kind: str(fd, 'kind') ?? 'OTHER', subject: str(fd, 'subject') ?? '', body: str(fd, 'body') ?? '', courseId: str(fd, 'courseId'), orderId: str(fd, 'orderId') })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'support-open', subject: actor.userId, limit: 10, windowSeconds: 60 * 60 })
    const t = await openTicket(db, actor, parsed.data)
    return { id: t.id, number: t.number }
  })
  if (result.ok) revalidate(result.data.id)
  return result
}

/** ردّ (صاحب التذكرة أو المشرف؛ internal للمشرف فقط) */
export async function replyTicketAction(_prev: ActionResult<{ id: string }> | null, fd: FormData): Promise<ActionResult<{ id: string }>> {
  const parsed = z.object({ ticketId: uuid, body: z.string().trim().min(2, 'اكتب ردّاً').max(5000), internal: z.boolean() }).safeParse({ ticketId: str(fd, 'ticketId') ?? '', body: str(fd, 'body') ?? '', internal: fd.get('internal') === 'on' || fd.get('internal') === '1' })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireActor()
    const db = await getDb()
    await checkRateLimit(db, { scope: 'support-reply', subject: actor.userId, limit: 60, windowSeconds: 60 * 60 })
    return replyTicket(db, actor, parsed.data.ticketId, parsed.data.body, { internal: parsed.data.internal })
  })
  if (result.ok) revalidate(parsed.data.ticketId)
  return result
}

export async function setTicketStatusAction(ticketId: string, status: (typeof SUPPORT_STATUSES)[number]): Promise<ActionResult> {
  const parsed = z.object({ ticketId: uuid, status: z.enum(SUPPORT_STATUSES) }).safeParse({ ticketId, status })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setTicketStatus(await getDb(), await requireActor(), parsed.data.ticketId, parsed.data.status)
    return undefined
  })
  if (result.ok) revalidate(ticketId)
  return result
}

export async function assignTicketAction(ticketId: string, assigneeUserId: string | null): Promise<ActionResult> {
  const parsed = z.object({ ticketId: uuid, assigneeUserId: optUuid }).safeParse({ ticketId, assigneeUserId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await assignTicket(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.ticketId, parsed.data.assigneeUserId ?? null)
    return undefined
  })
  if (result.ok) revalidate(ticketId)
  return result
}
