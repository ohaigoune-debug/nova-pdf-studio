import { describe, expect, it } from 'vitest'
import { fixArabicPdfOrder } from '@/server/lib/arabic-pdf'

describe('ترتيب نصوص PDF العربية', () => {
  it('يعيد السطر المقلوب إلى ترتيب القراءة، ويترك السليم كما هو', () => {
    // كما أخرجها pdf.js فعلاً من PDF يولّده Chromium
    const extracted = [
      'ةينايبلا روصلا :درس',
      '.ةينكم رةاعتسا',
      '.هبشلا',
      '.يلصلأا ىنعملا إرادة ازوج عم هانعم زملا هب ديرُ أو قلطُ أ ظفل ةيانكلا'
    ].join('\n')
    const fixed = fixArabicPdfOrder(extracted).split('\n')
    expect(fixed[0]).toContain('الصور البيانية')
    expect(fixed[1]).toBe('استعارة مكنية.')
    expect(fixed[2]).toBe('الشبه.')
    expect(fixed[3]).toContain('الكناية لفظ')
    expect(fixed[3]).toContain('المعنى الأصلي')

    const clean = 'التشبيه هو إلحاق أمر بأمر في صفة مشتركة بينهما بأداة.\nسنة 2024 في BAC'
    expect(fixArabicPdfOrder(clean)).toBe(clean)
  })

  it('الأرقام واللاتينية تبقى باتجاهها بعد قلب السطر', () => {
    const fixed = fixArabicPdfOrder('2024 ةنس ايرولاكبلا')
    expect(fixed).toContain('البكالوريا')
    expect(fixed).toContain('2024')
  })
})
