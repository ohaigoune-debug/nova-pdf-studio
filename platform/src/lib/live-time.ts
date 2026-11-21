/** المدّة الباقية على الحصة المباشرة القادمة، بالعربية — دالة نقية تُختبر وحدها */
import { countArForms as countAr } from './arabic-count'

/** «بعد 22 ساعة»، «بعد ساعتين»، «بعد 3 أيام»… */
export function untilLabel(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `بعد ${countAr(min, ['دقيقة', 'دقيقتين', 'دقائق', 'دقيقة'])}`
  const h = Math.round(min / 60)
  if (h < 24) return `بعد ${countAr(h, ['ساعة', 'ساعتين', 'ساعات', 'ساعة'])}`
  return `بعد ${countAr(Math.round(h / 24), ['يوم', 'يومين', 'أيام', 'يومًا'])}`
}
