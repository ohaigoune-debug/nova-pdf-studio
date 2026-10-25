'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requestMeta, requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { sha256 } from '@/server/lib/codes'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { CANCEL_REASONS, cancelMyOrder, trackByPhone, type CancelReason } from '@/server/services/order-tracking.service'

export interface TrackedOrderView {
  id: string
  number: string
  status: string
  statusAr: string
  createdAt: string
  totalDzd: number
  itemsText: string
  firstName: string
  deliveryProvider: string | null
  trackingId: string | null
  timeline: { label: string; at: string; tone: 'done' | 'bad' | 'info' }[]
  canCancel: boolean
  wilayaName: string | null
  commune: string | null
}

/** التتبّع العام بالهاتف: 12 بحثاً / 10 دقائق لكل عنوان، و10 / ساعة لكل هاتف */
export async function trackOrdersAction(phone: string): Promise<ActionResult<TrackedOrderView[]>> {
  const parsed = z.string().trim().min(9, 'أدخل رقم الهاتف').max(20).safeParse(phone)
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    const db = await getDb()
    const meta = await requestMeta()
    await checkRateLimit(db, { scope: 'track-ip', subject: meta.ip ?? 'unknown', limit: 12, windowSeconds: 600 })
    await checkRateLimit(db, { scope: 'track-phone', subject: sha256(parsed.data.replace(/\D/g, '')), limit: 10, windowSeconds: 3600 })
    const rows = await trackByPhone(db, parsed.data)
    return rows.map((o) => ({ ...o, createdAt: o.createdAt.toISOString(), timeline: o.timeline.map((t) => ({ ...t, at: t.at.toISOString() })) }))
  })
}

/** صاحب الطلب يلغيه قبل الشحن */
export async function cancelMyOrderAction(orderId: string, reason: string, note?: string | null): Promise<ActionResult> {
  const parsed = z.object({ orderId: z.string().uuid(), reason: z.enum(Object.keys(CANCEL_REASONS) as [CancelReason, ...CancelReason[]]), note: z.string().max(200).nullish() }).safeParse({ orderId, reason, note })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await cancelMyOrder(await getDb(), await requireActor(), parsed.data.orderId, parsed.data.reason, parsed.data.note ?? null)
    return undefined
  })
  if (result.ok) {
    revalidatePath('/student/courses/orders')
    revalidatePath(`/store/orders/${orderId}`)
    revalidatePath('/admin/store')
  }
  return result
}
