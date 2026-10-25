'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { failValidation, runAction, type ActionResult } from '@/server/lib/action-result'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { courseQuote, placeCourseOrder, type PlacedCourseOrder } from '@/server/services/course-purchase.service'

/**
 * شراء «الدورة مع كتابها»: المتصفح يرسل courseId وبيانات الاستلام فقط —
 * الكتاب والسعر والتوصيل والمخزون والتلميذ يحدّدها الخادم.
 */
export async function placeCourseOrderAction(input: { courseId: string; phone: string; wilayaId: string; commune?: string | null; address: string; deliveryType?: 'HOME' | 'DESK' | null; note?: string | null; otpCode?: string | null }): Promise<ActionResult<PlacedCourseOrder>> {
  const parsed = z
    .object({
      courseId: z.string().uuid(),
      phone: z.string().trim().min(9, 'أدخل هاتف الاستلام').max(20),
      wilayaId: z.string().uuid('اختر الولاية'),
      commune: z.string().trim().max(120).nullish(),
      address: z.string().trim().min(3, 'أدخل العنوان').max(400),
      deliveryType: z.enum(['HOME', 'DESK']).nullish(),
      note: z.string().trim().max(300).nullish(),
      otpCode: z.string().trim().max(8).nullish()
    })
    .strict()
    .safeParse(input)
  if (!parsed.success) return failValidation(parsed.error)
  const result = await runAction(async () => {
    const actor = await requireRole('STUDENT')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'course-order', subject: actor.userId, limit: 10, windowSeconds: 3600 })
    return placeCourseOrder(db, actor, parsed.data)
  })
  if (result.ok) {
    revalidatePath('/student/courses/orders')
    revalidatePath('/admin/store')
  }
  return result
}

/** سعر الدورة + التوصيل + الإجمالي كما يحسبه الخادم (للاستمارة قبل التأكيد) */
export async function courseQuoteAction(courseId: string, wilayaId: string | null, deliveryType: 'HOME' | 'DESK'): Promise<ActionResult<{ priceDzd: number; shippingDzd: number; totalDzd: number; bookTitle: string } | null>> {
  const parsed = z.object({ courseId: z.string().uuid(), wilayaId: z.string().uuid().nullable(), deliveryType: z.enum(['HOME', 'DESK']) }).safeParse({ courseId, wilayaId: wilayaId || null, deliveryType })
  if (!parsed.success) return failValidation(parsed.error)
  return runAction(async () => {
    await requireRole('STUDENT')
    return courseQuote(await getDb(), parsed.data.courseId, parsed.data.wilayaId, parsed.data.deliveryType)
  })
}
