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

const claimSchema = z.object({
  phone: z.string().trim().max(20).optional(),
  code: z.string().trim().min(6, 'أدخل الكود كاملاً').max(20)
})

/**
 * التلميذ يفعّل دورة بكود، من صفحة واحدة (/claim):
 *  - كود الدورة (11 رقماً) الذي ولّدته الإدارة لدورة بعينها — بلا هاتف؛
 *  - أو كود الطلب (6 أرقام) الذي وصل بالـSMS بعد التسليم — مع الهاتف الذي وصله.
 */
export async function claimCourseAction(_prev: ActionResult<{ courseTitle: string; href: string }> | null, fd: FormData): Promise<ActionResult<{ courseTitle: string; href: string }>> {
  const parsed = claimSchema.safeParse({ phone: String(fd.get('phone') ?? '') || undefined, code: String(fd.get('code') ?? '').replace(/\s/g, '') })
  if (!parsed.success) return failValidation(parsed.error)
  const { isCourseCodeShape, redeemCourseCode } = await import('@/server/services/course-codes.service')
  const courseCode = isCourseCodeShape(parsed.data.code)
  if (!courseCode && !/^\d{6}$/.test(parsed.data.code.replace(/\D/g, ''))) return { ok: false, error: { code: 'VALIDATION', message: 'الكود 11 رقماً (كود الدورة) أو 6 أرقام (كود الطلب).', fieldErrors: { code: 'الكود 11 رقماً (كود الدورة) أو 6 أرقام (كود الطلب).' } } }
  if (!courseCode && !parsed.data.phone) return { ok: false, error: { code: 'VALIDATION', message: 'كود الطلب يحتاج الهاتف الذي وصله.', fieldErrors: { phone: 'أدخل الهاتف الذي وصله الكود' } } }
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'course-claim', subject: actor.userId, ...RATE_LIMITS.activateCode })
    if (courseCode) {
      const r = await redeemCourseCode(db, actor, parsed.data.code)
      return { courseTitle: r.courseTitle, href: `/student/courses/${r.slug}` }
    }
    const r = await claimCourse(db, actor, { phone: parsed.data.phone!, code: parsed.data.code })
    return { courseTitle: r.courseTitle, href: '/student/courses' }
  })
  if (result.ok) {
    revalidatePath('/student')
    revalidatePath('/student/courses')
  }
  return result
}
