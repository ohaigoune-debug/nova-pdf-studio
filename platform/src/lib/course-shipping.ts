/**
 * التوصيل في سعر الدورة مع كتابها (قرار المالك 16 نوفمبر 2026)، لكل دورة:
 *  - NONE: السعر لا يشمل التوصيل — يدفع التلميذ رسم شركة التوصيل كاملًا (منزل أو مكتب).
 *  - DESK: شامل التوصيل إلى المكتب — المكتب مجاني، والمنزل يدفع الفرق فقط (رسم المنزل − رسم المكتب).
 *  - HOME: شامل التوصيل إلى المنزل — لا رسم توصيل أبدًا.
 * دالة صافية: الواجهة (عرض الخيارات) والخادم (حساب الطلب) يحسبان بالقاعدة نفسها.
 */
import type { CourseShippingIncluded } from '@/server/db/schema/enums'

export type { CourseShippingIncluded }

export const SHIPPING_INCLUDED_LABELS: Record<CourseShippingIncluded, string> = {
  NONE: 'السعر لا يشمل التوصيل',
  DESK: 'السعر شامل التوصيل إلى المكتب',
  HOME: 'السعر شامل التوصيل إلى المنزل'
}

/** شرح قصير لكل خيار في شاشة الدورة */
export const SHIPPING_INCLUDED_HINTS: Record<CourseShippingIncluded, string> = {
  NONE: 'يدفع التلميذ رسم التوصيل كاملًا فوق السعر، حسب ولايته (منزل أو مكتب).',
  DESK: 'الاستلام من المكتب مجاني، ومن يختار المنزل يدفع الفرق بين الرسمين فقط.',
  HOME: 'لا يدفع التلميذ أي رسم توصيل، أيًّا كانت ولايته وطريقة استلامه.'
}

/** جملة تظهر للتلميذ تحت السعر (فارغة حين لا يشمل السعر التوصيل) */
export const SHIPPING_INCLUDED_BADGES: Record<CourseShippingIncluded, string | null> = {
  NONE: null,
  DESK: 'التوصيل إلى المكتب مجاني',
  HOME: 'التوصيل إلى المنزل مجاني'
}

export function asShippingIncluded(v: unknown): CourseShippingIncluded {
  return v === 'DESK' || v === 'HOME' ? v : 'NONE'
}

/** ما يدفعه التلميذ للتوصيل، من رسمَي شركة التوصيل لولايته */
export function courseShippingDzd(included: CourseShippingIncluded, fees: { home: number; desk: number }, deliveryType: 'HOME' | 'DESK'): number {
  const home = Math.max(0, Math.round(fees.home))
  const desk = Math.max(0, Math.round(fees.desk))
  if (included === 'HOME') return 0
  if (included === 'DESK') return deliveryType === 'HOME' ? Math.max(0, home - desk) : 0
  return deliveryType === 'HOME' ? home : desk
}

const RANK: Record<CourseShippingIncluded, number> = { NONE: 0, DESK: 1, HOME: 2 }

/** طرد فيه كتب عدة دورات: يسري الخيار الأوسع للتلميذ */
export function strongestShippingIncluded(values: unknown[]): CourseShippingIncluded {
  return values.map(asShippingIncluded).reduce<CourseShippingIncluded>((best, v) => (RANK[v] > RANK[best] ? v : best), 'NONE')
}
