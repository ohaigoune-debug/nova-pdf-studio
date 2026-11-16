import { describe, expect, it } from 'vitest'
import { fontkitTreatsAsRtl, prepareArabicRunForFontkit } from '@modules/ocr/renderer/bidiOrder'

describe('Arabic text-layer ordering (digits inside Arabic lines)', () => {
  it('detects when fontkit will reverse the run', () => {
    expect(fontkitTreatsAsRtl('المبلغ 12500 دينار')).toBe(true)
    expect(fontkitTreatsAsRtl('2026 فاتورة')).toBe(true)
    expect(fontkitTreatsAsRtl('Client : مكتبة')).toBe(false)
  })
  it('pre-reverses only the LTR runs (digits, latin, amounts)', () => {
    expect(prepareArabicRunForFontkit('المبلغ 12500 دينار')).toBe('المبلغ 00521 دينار')
    expect(prepareArabicRunForFontkit('الإجمالي 12 500,00 DA')).toBe('الإجمالي AD 00,005 21')
    expect(prepareArabicRunForFontkit('فاتورة رقم 2026-015')).toBe('فاتورة رقم 510-6202')
  })
  it('leaves pure Arabic and latin-first lines untouched', () => {
    expect(prepareArabicRunForFontkit('مكتبة النور')).toBe('مكتبة النور')
    expect(prepareArabicRunForFontkit('Client : مكتبة 12')).toBe('Client : مكتبة 12')
  })
})
