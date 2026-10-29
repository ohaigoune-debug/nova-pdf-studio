/** اتجاه النص في أسئلة PLAY: حروف LaTeX داخل $…$ لا تقلب جملة عربية إلى اليسار */
import { describe, expect, it } from 'vitest'
import { textDir } from '@/components/play/text-dir'

describe('textDir', () => {
  it('an Arabic sentence full of formulas stays right-to-left', () => {
    expect(textDir('بيّن أنّ الدالة $f(x)=\\dfrac{x^2-5x+4}{x(x-2)^2}$ متزايدة على $]4;+\\infty[$')).toBe('rtl')
    expect(textDir('احسب $\\lim_{x\\to+\\infty} f(x)$')).toBe('rtl')
  })
  it('English and French sentences are left-to-right, a bare formula defaults to right-to-left (its math span is LTR itself)', () => {
    expect(textDir('What does “they” refer to in §2?')).toBe('ltr')
    expect(textDir('Relevez dans le texte deux mots.')).toBe('ltr')
    expect(textDir('$\\dfrac{10}{66}$')).toBe('rtl')
  })
})
