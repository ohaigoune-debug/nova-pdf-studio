/** «فاتورة من جدول»: صفوف ورقة ← بنود فاتورة بمحرك المال الأصلي. */
import { describe, expect, it } from 'vitest'
import { sheetFromMatrix } from '@modules/spreadsheet/shared/sheetModel'
import { sheetToInvoiceItems } from '../src/lib/sheetToInvoice'

describe('spreadsheet → invoice', () => {
  it('reads French headers, decimal commas, 19 and 0.19 tax', () => {
    const sheet = sheetFromMatrix('S', [
      ['Désignation', 'Quantité', 'Prix unitaire', 'TVA'],
      ['Ramette A4', 3, '750,50', 19],
      ['Livraison', '1,5', 333.33, 0.19],
      ['', '', '', ''],
      ['Sans prix', 2, '', 19]
    ])
    const { items, skipped } = sheetToInvoiceItems(sheet, 2)
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ name: 'Ramette A4', quantityMilli: 3000, unitPriceMinor: 75050, taxBps: 1900, discountBps: 0 })
    expect(items[1]).toMatchObject({ name: 'Livraison', quantityMilli: 1500, unitPriceMinor: 33333, taxBps: 1900 })
    expect(skipped).toBe(1)
  })
  it('reads Arabic headers in any column order', () => {
    const sheet = sheetFromMatrix('S', [['السعر', 'الصنف', 'الكمية'], [1200, 'حبر طابعة', 2]])
    expect(sheetToInvoiceItems(sheet, 2).items[0]).toMatchObject({ name: 'حبر طابعة', quantityMilli: 2000, unitPriceMinor: 120000 })
  })
  it('without headers: item, quantity, price, tax; thousands separators', () => {
    const sheet = sheetFromMatrix('S', [['Consulting hour', 3, '8,000.00', 9]])
    expect(sheetToInvoiceItems(sheet, 2).items[0]).toMatchObject({ name: 'Consulting hour', quantityMilli: 3000, unitPriceMinor: 800000, taxBps: 900 })
  })
})
