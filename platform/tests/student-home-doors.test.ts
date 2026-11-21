/** الرئيسية بالأيقونات وأبواب الدورة (التصوّر المعتمد، 21 نوفمبر 2026): دوال العرض النقية */
import { describe, expect, it } from 'vitest'
import { countArForms } from '@/lib/arabic-count'
import { untilLabel } from '@/lib/live-time'
import { STUDENT_HUBS, STUDENT_MENU_ORDER } from '@/lib/student-hubs'
import { STUDENT_HINTS, STUDENT_TONES } from '@/lib/student-tiles'

const MIN = 60_000
const HOUR = 60 * MIN

describe('الوقت الباقي على الحصة المباشرة', () => {
  it('بالدقائق ثم الساعات ثم الأيام، بالعدد العربي الصحيح', () => {
    expect(untilLabel(1 * MIN)).toBe('بعد دقيقة')
    expect(untilLabel(2 * MIN)).toBe('بعد دقيقتين')
    expect(untilLabel(5 * MIN)).toBe('بعد 5 دقائق')
    expect(untilLabel(40 * MIN)).toBe('بعد 40 دقيقة')
    expect(untilLabel(1 * HOUR)).toBe('بعد ساعة')
    expect(untilLabel(2 * HOUR)).toBe('بعد ساعتين')
    expect(untilLabel(5 * HOUR)).toBe('بعد 5 ساعات')
    expect(untilLabel(22 * HOUR + 26 * MIN)).toBe('بعد 22 ساعة')
    expect(untilLabel(30 * HOUR)).toBe('بعد يوم')
    expect(untilLabel(48 * HOUR)).toBe('بعد يومين')
    expect(untilLabel(4 * 24 * HOUR)).toBe('بعد 4 أيام')
    expect(untilLabel(12 * 24 * HOUR)).toBe('بعد 12 يومًا')
  })

  it('لا «بعد 0» ولا سالب: أقلّ مدة دقيقة', () => {
    expect(untilLabel(0)).toBe('بعد دقيقة')
    expect(untilLabel(-5 * MIN)).toBe('بعد دقيقة')
  })
})

describe('عدد عناصر الأبواب', () => {
  it('حصة واحدة، حصتان، 3 حصص، 12 حصة', () => {
    const f = ['حصة واحدة', 'حصتان', 'حصص', 'حصة'] as const
    expect([1, 2, 3, 10, 12].map((n) => countArForms(n, f))).toEqual(['حصة واحدة', 'حصتان', '3 حصص', '10 حصص', '12 حصة'])
  })
})

describe('أيقونات الرئيسية والقائمة', () => {
  it('لكل مدخل من المداخل الستة لونه وتلميحه وأيقونة مختلفة', () => {
    expect(STUDENT_MENU_ORDER).toEqual(['courses', 'shop', 'code', 'train', 'support', 'account'])
    for (const k of STUDENT_MENU_ORDER) {
      expect(STUDENT_TONES[k], k).toBeTruthy()
      expect(STUDENT_HINTS[k], k).toBeTruthy()
    }
    const icons = STUDENT_MENU_ORDER.map((k) => STUDENT_HUBS[k].iconKey)
    expect(new Set(icons).size).toBe(icons.length)
  })
})
