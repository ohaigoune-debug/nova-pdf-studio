/**
 * أداء واستقرار (Node على Linux — ليس جهاز iPhone): ملفات PDF كبيرة، حفظ متكرر، وقاعدة فواتير كبيرة.
 * الأرقام تُكتب في test-results/performance.json ولا تُخترع. الحدود الزمنية متسامحة عمدًا (أجهزة CI متفاوتة).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import { addPageNumbers, addWatermark, compress, merge, rotatePages, split } from '@modules/pdf/shared/pdfTools'
import { applyEdits } from '@modules/pdf/shared/applyEdits'
import type { EditLayer } from '@modules/pdf/shared/editModel'
import { closeDatabase, getDatabase, openDatabase } from '@modules/database/main'
import { saveCustomer } from '@modules/customers/main/repository'
import { addPayment, getInvoice, listInvoices, saveInvoice } from '@modules/invoices/main/repository'
import { seedBuiltinTemplates } from '@modules/templates/main/repository'
import type { DbStorage } from '../src/platform/shims/sqlite-browser'

const report: Record<string, unknown> = {}
const mb = () => Math.round(process.memoryUsage().rss / 1048576)
async function timed<T>(key: string, fn: () => Promise<T> | T): Promise<T> {
  const t0 = performance.now()
  const out = await fn()
  report[key] = { ms: Math.round(performance.now() - t0), rssMB: mb() }
  return out
}

async function bigPdf(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  for (let i = 0; i < pages; i++) {
    const p = doc.addPage([595.28, 841.89])
    p.drawText(`Page ${i + 1} of ${pages}`, { x: 72, y: 760, size: 20, font })
    for (let l = 0; l < 30; l++) p.drawText(`Line ${l + 1}: NOVA Docs stress test — Bou Saada 28001 — invoice ${i}-${l}`, { x: 72, y: 720 - l * 20, size: 10, font })
  }
  return doc.save()
}

async function pageCount(bytes: Uint8Array) {
  return (await PDFDocument.load(bytes)).getPageCount()
}

class MemoryStorage implements DbStorage {
  bytes: Uint8Array | null = null
  async read() { return this.bytes }
  async write(b: Uint8Array) { this.bytes = b }
}

afterAll(() => {
  mkdirSync(resolve(__dirname, '../test-results'), { recursive: true })
  writeFileSync(resolve(__dirname, '../test-results/performance.json'), JSON.stringify(report, null, 2))
})

describe('large PDFs (300 pages)', () => {
  let src: Uint8Array
  beforeAll(async () => {
    src = await timed('generate 300 pages', () => bigPdf(300))
    report['300-page size KB'] = Math.round(src.length / 1024)
  })

  it('merge 300+300 → 600 pages', async () => {
    const out = await timed('merge 600 pages', () => merge([src, src]))
    expect(await pageCount(out)).toBe(600)
  })

  it('split every 50 pages → 6 files, no page lost', async () => {
    const parts = await timed('split every 50', () => split(src, { every: 50 }))
    expect(parts).toHaveLength(6)
    let total = 0
    for (const p of parts) total += await pageCount(p)
    expect(total).toBe(300)
  })

  it('rotate all + watermark + page numbers + compress, then reopen with pdf.js and search the last page', async () => {
    let bytes = await timed('rotate 300', () => rotatePages(src, 'all', 90))
    bytes = await timed('watermark 300', () => addWatermark(bytes, { text: 'CONFIDENTIAL', opacity: 0.15 }))
    bytes = await timed('page numbers 300', () => addPageNumbers(bytes, { format: '{n} / {total}' }))
    bytes = await timed('compress 300', () => compress(bytes))
    expect(await pageCount(bytes)).toBe(300)
    const doc = await timed('pdf.js open 300', () => pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise)
    expect(doc.numPages).toBe(300)
    const tc = await timed('pdf.js text of page 300', async () => (await doc.getPage(300)).getTextContent())
    expect(tc.items.map((it) => ('str' in it ? it.str : '')).join(' ')).toContain('Page 300 of 300')
    await doc.destroy()
  })

  it('20 consecutive edit-and-save cycles stay valid and do not balloon', async () => {
    let bytes = await bigPdf(20)
    const first = bytes.length
    await timed('20 save cycles', async () => {
      for (let i = 0; i < 20; i++) {
        const layer: EditLayer = { objects: [{ id: `t${i}`, kind: 'text', page: i % 20, x: 72, y: 100, width: 200, height: 20, text: `Edit ${i}`, fontSize: 12, fontFamily: 'sans', bold: false, italic: false, underline: false, align: 'left', color: '#123D36', background: null, direction: 'ltr' }] }
        bytes = await applyEdits(bytes, layer)
      }
    })
    expect(await pageCount(bytes)).toBe(20)
    report['20 saves size growth x'] = +(bytes.length / first).toFixed(2)
    expect(bytes.length / first).toBeLessThan(3)
  })
})

describe('large invoice database (original repositories)', () => {
  const storage = new MemoryStorage()
  beforeAll(async () => {
    await openDatabase(storage)
    seedBuiltinTemplates()
  })
  afterAll(async () => {
    await closeDatabase()
  })

  it('1,000 invoices × 3 lines + payments, list/paginate, persist and reopen', async () => {
    const customer = saveCustomer({ companyName: 'Stress SARL', city: 'Bou Saada' })
    await timed('create 1000 invoices', () => {
      getDatabase().transaction(() => {
        for (let i = 0; i < 1000; i++) {
          const inv = saveInvoice({
            issueDate: '2026-11-16', currency: 'DZD', customerId: customer.id,
            items: [1, 2, 3].map((n) => ({ name: `Article ${n}`, quantityMilli: 1000 * n, unitPriceMinor: 12345 * n, discountBps: 500, taxBps: 1900 }))
          })
          if (i % 3 === 0) addPayment({ invoiceId: inv.id, paidAt: '2026-11-16', amountMinor: 10000, method: 'cash' })
        }
      })
    })
    const page = await timed('list first 100', () => listInvoices({ limit: 100 }))
    expect(page.total).toBe(1000)
    expect(page.rows).toHaveLength(100)
    const last = await timed('list offset 900', () => listInvoices({ limit: 100, offset: 900 }))
    expect(last.rows).toHaveLength(100)
    const bytes = await timed('export db bytes', () => getDatabase().exportBytes())
    report['db size KB (1000 invoices)'] = Math.round(bytes.length / 1024)
    const sample = getInvoice(page.rows[0].id)!
    await closeDatabase()
    // إعادة الفتح من البايتات المحفوظة (كما بعد إعادة تشغيل التطبيق)
    storage.bytes = bytes
    await timed('reopen db', () => openDatabase(storage))
    expect(listInvoices({ limit: 1 }).total).toBe(1000)
    expect(getInvoice(sample.id)!.grandTotalMinor).toBe(sample.grandTotalMinor)
  })
})
