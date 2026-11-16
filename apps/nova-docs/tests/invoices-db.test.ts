/**
 * يتحقق من أن المحرك المالي والمستودعات الأصلية لنسخة Windows تعمل كما هي فوق محرك قاعدة البيانات الخاص بـ iOS.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { closeDatabase, getDatabase, openDatabase } from '@modules/database/main'
import { saveCustomer, listCustomers } from '@modules/customers/main/repository'
import { saveProduct, searchProducts } from '@modules/products/main/repository'
import { addPayment, getInvoice, listInvoices, saveInvoice } from '@modules/invoices/main/repository'
import { listCurrencies, listTaxes } from '@modules/settings/main/taxes-currencies'
import { getDefaultTemplate, seedBuiltinTemplates } from '@modules/templates/main/repository'
import { renderInvoiceHtml } from '@modules/templates/shared/invoiceHtml'
import { getSettings } from '@modules/settings/main/repository'
import type { DbStorage } from '../src/platform/shims/sqlite-browser'

class MemoryStorage implements DbStorage {
  bytes: Uint8Array | null = null
  writes = 0
  async read() { return this.bytes }
  async write(b: Uint8Array) { this.bytes = b; this.writes++ }
}
const storage = new MemoryStorage()

beforeAll(async () => {
  await openDatabase(storage)
  seedBuiltinTemplates()
})
afterAll(async () => {
  await closeDatabase()
})

describe('iOS database layer + original repositories', () => {
  it('applies the desktop migrations (same schema as Windows)', () => {
    const tables = getDatabase().all<{ name: string }>("SELECT name FROM sqlite_master WHERE type='table'").map((r) => r.name)
    for (const t of ['invoices', 'invoice_items', 'payments', 'customers', 'products', 'taxes', 'currencies', 'invoice_templates', 'spreadsheet_documents']) {
      expect(tables).toContain(t)
    }
    expect(listCurrencies().length).toBeGreaterThan(0)
  })

  it('creates customer, product, invoice with tax + discount + partial payment using the integer engine', () => {
    const customer = saveCustomer({ companyName: 'مكتبة النور', city: 'بوسعادة', phone: '0550 00 00 00' })
    expect(listCustomers().some((c) => c.id === customer.id)).toBe(true)
    const product = saveProduct({ name: 'Ramette A4', priceMinor: 75050, currency: 'DZD' })
    expect(searchProducts('Ramette')[0].id).toBe(product.id)

    const inv = saveInvoice({
      issueDate: '2026-11-16', dueDate: '2026-12-16', currency: 'DZD', customerId: customer.id,
      items: [
        { productId: product.id, name: 'Ramette A4', quantityMilli: 3000, unitPriceMinor: 75050, discountBps: 1000, taxBps: 1900 },
        { name: 'Livraison spéciale', quantityMilli: 1500, unitPriceMinor: 33333, discountBps: 0, taxBps: 0 }
      ]
    })
    // 3 × 750.50 = 2251.50 ; خصم 10% = 225.15 ; صافي 2026.35 ; ضريبة 19% = 385.0065 → 385.01 ; سطر 2 = 1.5 × 333.33 = 499.995 → 500.00
    expect(inv.items[0].baseMinor).toBe(225150)
    expect(inv.items[0].discountMinor).toBe(22515)
    expect(inv.items[0].netMinor).toBe(202635)
    expect(inv.items[0].taxMinor).toBe(38501)
    expect(inv.items[1].totalMinor).toBe(50000)
    expect(inv.grandTotalMinor).toBe(202635 + 38501 + 50000)
    expect(inv.number).toMatch(/2026/)
    expect(inv.status).toBe('draft')

    const after = addPayment({ invoiceId: inv.id, paidAt: '2026-11-16', amountMinor: 100000, method: 'cash' })
    expect(after.paidMinor).toBe(100000)
    expect(after.remainingMinor).toBe(inv.grandTotalMinor - 100000)
    expect(after.status).toBe('partially_paid')
    expect(listInvoices({ status: 'unpaid' }).rows.map((r) => r.id)).toContain(inv.id)
  })

  it('numbers invoices sequentially without duplicates', () => {
    const a = saveInvoice({ issueDate: '2026-11-16', currency: 'DZD', items: [] })
    const b = saveInvoice({ issueDate: '2026-11-16', currency: 'DZD', items: [] })
    expect(a.number).not.toBe(b.number)
  })

  it('renders the invoice with the built-in template (Arabic, RTL)', () => {
    const inv = getInvoice(listInvoices({}).rows.at(-1)!.id)!
    const template = getDefaultTemplate()
    const settings = getSettings()
    const cur = listCurrencies().find((c) => c.code === 'DZD')!
    const html = renderInvoiceHtml({ invoice: inv, company: settings.company, template: template.definition, currency: cur as never, language: 'ar' })
    expect(html).toContain('dir="rtl"')
    expect(html).toContain(inv.number)
    expect(listTaxes().length).toBeGreaterThan(0)
  })

  it('persists to device storage after writes (debounced flush)', async () => {
    await getDatabase().flush()
    expect(storage.writes).toBeGreaterThan(0)
    expect(storage.bytes!.length).toBeGreaterThan(10_000)
  })
})
