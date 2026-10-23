'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { claimCourse } from '@/server/services/claims.service'
import { DELIVERY_PROVIDERS, saveDeliveryWebhookSecret, setOrderShipping } from '@/server/services/delivery.service'

const uuid = z.string().uuid()

/** المشرف: شركة التوصيل + رقم التتبّع (الطلب المؤكَّد يصبح «في الطريق») */
export async function setOrderShippingAction(orderId: string, provider: string, trackingId: string): Promise<ActionResult> {
  const parsed = z.object({ orderId: uuid, provider: z.enum(DELIVERY_PROVIDERS), trackingId: z.string().trim().min(3).max(120) }).safeParse({ orderId, provider, trackingId })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await setOrderShipping(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.orderId, { provider: parsed.data.provider, trackingId: parsed.data.trackingId })
    return undefined
  })
  if (result.ok) {
    revalidatePath('/admin/store')
    revalidatePath(`/store/orders/${orderId}`)
  }
  return result
}

export async function saveDeliverySecretAction(_prev: ActionResult<{ done: true }> | null, fd: FormData): Promise<ActionResult<{ done: true }>> {
  const parsed = z.object({ secret: z.string().trim().max(200) }).safeParse({ secret: fd.get('secret') ?? '' })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    await saveDeliveryWebhookSecret(await getDb(), await requireRole('SUPER_ADMIN'), parsed.data.secret || null)
    return { done: true as const }
  })
  if (result.ok) revalidatePath('/admin/delivery')
  return result
}

const claimSchema = z.object({ phone: z.string().trim().min(9, 'أدخل رقم هاتف صحيحاً').max(20), code: z.string().trim().regex(/^\d{6}$/, 'الرمز 6 أرقام') })

/** التلميذ يفعّل دورة برمز المطالبة الذي وصل بالـSMS */
export async function claimCourseAction(_prev: ActionResult<{ courseTitle: string }> | null, fd: FormData): Promise<ActionResult<{ courseTitle: string }>> {
  const parsed = claimSchema.safeParse({ phone: fd.get('phone') ?? '', code: String(fd.get('code') ?? '').replace(/\s/g, '') })
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'course-claim', subject: actor.userId, ...RATE_LIMITS.activateCode })
    const r = await claimCourse(db, actor, parsed.data)
    return { courseTitle: r.courseTitle }
  })
  if (result.ok) {
    revalidatePath('/student')
    revalidatePath('/student/groups')
  }
  return result
}
