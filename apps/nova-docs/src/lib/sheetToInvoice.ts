/**
 * «فاتورة من جدول»: يحوّل صفوف ورقة إلى بنود مسودة فاتورة.
 * الأعمدة تُعرف من صف العناوين (عربي/فرنسي/إنجليزي)، وإن لم يوجد: الأول = الصنف، ثم الكمية، ثم سعر الوحدة، ثم الضريبة %.
 * القيم تمر بمحلل المال الأصلي (أعداد صحيحة، لا فواصل عائمة).
 */
import { parseMinor, parsePercent, parseQuantity } from '@shared/money'
import type { InvoiceInput, InvoiceItemInput } from '@shared/invoicing'
import type { Sheet } from '@modules/spreadsheet/shared/sheetModel'

type Col = 'name' | 'qty' | 'price' | 'tax' | 'discount' | 'unit'
const HEADERS: [Col, RegExp][] = [
  ['name', /^(item|article|désignation|designation|description|produit|product|service|libellé|الصنف|البيان|المنتج|الخدمة|الوصف)/i],
  ['qty', /^(qty|qté|quantité|quantity|quantite|الكمية|كمية|العدد)/i],
  ['price', /^(unit\s*price|price|prix(\s*unitaire)?|p\.?u\.?|tarif|سعر(\s*الوحدة)?|السعر|ثمن)/i],
  ['tax', /^(tax|tva|vat|taxe|الضريبة|ضريبة|ر\.?ق\.?م)/i],
  ['discount', /^(discount|remise|خصم|الخصم)/i],
  ['unit', /^(unit|unité|الوحدة)$/i]
]

function text(sheet: Sheet, col: number, row: number): string {
  const c = sheet.cells[`${col}:${row}`]
  if (!c) return ''
  return c.value === null || c.value === undefined ? c.input : String(c.value)
}

export function sheetToInvoiceItems(sheet: Sheet, decimals = 2): { items: InvoiceItemInput[]; skipped: number } {
  const lastRow = Math.max(-1, ...Object.keys(sheet.cells).map((k) => Number(k.split(':')[1])))
  const lastCol = Math.max(-1, ...Object.keys(sheet.cells).map((k) => Number(k.split(':')[0])))
  const map = new Map<Col, number>()
  let start = 0
  for (let c = 0; c <= lastCol; c++) {
    const h = text(sheet, c, 0).trim()
    const hit = HEADERS.find(([, re]) => re.test(h))
    if (hit && !map.has(hit[0])) map.set(hit[0], c)
  }
  if (map.has('name') || map.has('price')) start = 1
  else ['name', 'qty', 'price', 'tax'].forEach((k, i) => map.set(k as Col, i))
  const items: InvoiceItemInput[] = []
  let skipped = 0
  const num = (raw: string) => raw.replace(/[\s ]/g, '').replace(/[^\d.,-]/g, '').replace(/,(?=\d{3}(\D|$))/g, '').replace(',', '.')
  for (let r = start; r <= lastRow; r++) {
    const name = map.has('name') ? text(sheet, map.get('name')!, r).trim() : ''
    const priceRaw = map.has('price') ? num(text(sheet, map.get('price')!, r)) : ''
    if (!name && !priceRaw) continue
    try {
      const qtyRaw = map.has('qty') ? num(text(sheet, map.get('qty')!, r)) : ''
      const taxRaw = map.has('tax') ? num(text(sheet, map.get('tax')!, r)) : ''
      const discRaw = map.has('discount') ? num(text(sheet, map.get('discount')!, r)) : ''
      const pct = (raw: string) => {
        if (!raw) return 0
        const v = Number(raw)
        return parsePercent(v > 0 && v < 1 ? v * 100 : v) // 0.19 أو 19 كلاهما = 19%
      }
      if (!name || !priceRaw) throw new Error('row')
      items.push({
        name,
        unit: map.has('unit') ? text(sheet, map.get('unit')!, r).trim() || undefined : undefined,
        quantityMilli: qtyRaw ? parseQuantity(qtyRaw) : 1000,
        unitPriceMinor: parseMinor(priceRaw, decimals),
        taxBps: pct(taxRaw),
        discountBps: pct(discRaw)
      })
    } catch {
      skipped++
    }
  }
  return { items, skipped }
}

export function sheetToInvoiceInput(sheet: Sheet, currency: string, decimals: number, sourceId?: number): { input: InvoiceInput; skipped: number } {
  const { items, skipped } = sheetToInvoiceItems(sheet, decimals)
  return { input: { issueDate: new Date().toISOString().slice(0, 10), currency, items, source: 'spreadsheet', sourceDocumentId: sourceId ?? null }, skipped }
}
