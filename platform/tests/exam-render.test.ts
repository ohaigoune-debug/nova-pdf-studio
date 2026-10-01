import { describe, expect, it } from 'vitest'
import { answerKeyText, durationAr, hasMath, renderBody } from '@/server/lib/exam-render'

describe('تصيير ورقة الامتحان', () => {
  it('يهرّب HTML ويصيّر المعادلات في الخادم ويحوّل الغامق والفقرات', () => {
    const html = renderBody('ادرس الدالة $f(x)=e^x-x$ على $\\mathbb{R}$.\n**ملاحظة:** <script>x</script>\n\nفقرة ثانية')
    expect(html).toContain('<span class="katex">')
    expect(html).toContain('<strong>ملاحظة:</strong>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>')
    expect(html.match(/<p dir="auto">/g)).toHaveLength(2)
    expect(html).toContain('<br>')
    // بلا معادلات: نصّ عادي
    expect(renderBody('سؤال بسيط')).toBe('<p dir="auto">سؤال بسيط</p>')
    expect(hasMath(['لا', 'نعم $x$'])).toBe(true)
    expect(hasMath(['لا'])).toBe(false)
  })

  it('المدة والمفاتيح بالعربية', () => {
    expect(durationAr(180)).toBe('3 سا')
    expect(durationAr(90)).toBe('1 سا و30 د')
    expect(durationAr(45)).toBe('45 د')
    expect(answerKeyText('MCQ', null, [{ label: 'الكرم', isCorrect: true }, { label: 'البخل', isCorrect: false }])).toBe('أ) الكرم')
    expect(answerKeyText('TRUE_FALSE', { value: false })).toBe('خطأ')
    expect(answerKeyText('SHORT_ANSWER', { accepted: ['الرجز', 'بحر الرجز'] })).toBe('الرجز / بحر الرجز')
    expect(answerKeyText('FILL_BLANK', { blanks: [['مرفوع'], ['منصوب']] })).toBe('(1) مرفوع · (2) منصوب')
    expect(answerKeyText('OPEN', null)).toBeNull()
  })
})
