/** استيراد الفواتير القديمة: رقم الفاتورة بالتسميات القصيرة التي تطبعها قوالب NOVA نفسها (رُصد على محاكي iOS: number = null). */
import { describe, expect, it } from 'vitest'
import { autoExtract, type Span } from '@modules/import/shared/extract'

const line = (text: string, y: number, x = 400): Span => ({ text, x, y, width: text.length * 6, height: 10 })

describe('old-invoice import: invoice number labels', () => {
  it('reads "No. INV-2026-09013" (English template)', () => {
    const r = autoExtract([[line('INVOICE', 40), line('No. INV-2026-09013', 60), line('Customer no. C-0042', 120), line('Grand total 26,160.00 DZD', 400)]])
    expect(r.fields.number?.value).toBe('INV-2026-09013')
  })
  it('reads "N° 2026-015" (French template) and ignores "N° client"', () => {
    const r = autoExtract([[line('N° client 00042', 50), line('N° 2026-015', 70), line('Total TTC 12 500,00 DA', 400)]])
    expect(r.fields.number?.value).toBe('2026-015')
  })
  it('reads the Arabic label "رقم" in either span order', () => {
    expect(autoExtract([[line('رقم INV-2026-09014', 60)]]).fields.number?.value).toBe('INV-2026-09014')
    expect(autoExtract([[line('INV-2026-09014 رقم', 60)]]).fields.number?.value).toBe('INV-2026-09014')
  })
  it('does not take a phone or tax id as the invoice number', () => {
    const r = autoExtract([[line('Tél. 0550 12 34 56', 60), line('NIF 001234567890', 80)]])
    expect(r.fields.number).toBeUndefined()
  })
})
