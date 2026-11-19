/**
 * جسر الفواتير في التطبيق: يعيد استخدام مستودعات ومحرك نسخة Windows كما هي (SQLite على الجهاز)،
 * ويضيف: أصول الهوية (شعار/توقيع/ختم كـ data URL)، تصدير PDF عبر WKWebView، واستيراد فاتورة PDF قديمة.
 */
import { getInternalValue, getSettings, setInternalValue } from '@modules/settings/main/repository'
import { getDefaultTemplate, getTemplate } from '@modules/templates/main/repository'
import { listCurrencies } from '@modules/settings/main/taxes-currencies'
import { renderInvoiceHtml, suggestedFileName } from '@modules/templates/shared/invoiceHtml'
import { autoExtract, type Span } from '@modules/import/shared/extract'
import type { CurrencyInfo } from '@shared/money'
import type { Invoice, InvoiceInput } from '@shared/invoicing'
import type { Language } from '@shared/settings'
import { pageSizeMm } from '@shared/templates'
import { NovaDocuments, isNative, readNativeFile } from '../platform/native'
import { loadEngine } from './docs'
import { ensureDatabase } from '../platform/db'
import { currencyDecimals } from './worldCurrencies'

export type BrandKind = 'logo' | 'signature' | 'stamp'

export function brandAsset(kind: BrandKind): string | null {
  return getInternalValue<string>(`ios.brand.${kind}`)
}
export function setBrandAsset(kind: BrandKind, dataUrl: string | null): void {
  setInternalValue(`ios.brand.${kind}`, dataUrl)
}

export function currencyInfo(code: string): CurrencyInfo {
  const c = listCurrencies(true).find((x) => x.code === code)
  return c ? { code: c.code, symbol: c.symbol, decimals: c.decimals, position: c.position } : { code, symbol: code, decimals: currencyDecimals(code), position: 'after' }
}

export function invoiceHtml(invoice: Invoice, language: Language): string {
  const settings = getSettings()
  const template = (invoice.templateId ? getTemplate(invoice.templateId) : null) ?? getDefaultTemplate()
  return renderInvoiceHtml({
    invoice,
    company: settings.company,
    template: template.definition,
    currency: currencyInfo(invoice.currency),
    language,
    assets: { logoDataUrl: brandAsset('logo'), signatureDataUrl: brandAsset('signature'), stampDataUrl: brandAsset('stamp') }
  })
}

/** PDF متجهي حقيقي بتشكيل عربي صحيح عبر محرك WebKit الأصلي (UIPrintPageRenderer). */
export async function invoicePdf(invoice: Invoice, language: Language): Promise<{ name: string; bytes: Uint8Array }> {
  if (!isNative()) throw Object.assign(new Error('pdf'), { messageKey: 'ios.inv.pdfUnavailable' })
  const template = (invoice.templateId ? getTemplate(invoice.templateId) : null) ?? getDefaultTemplate()
  const mm = pageSizeMm(template.definition.page)
  const pt = (v: number) => (v * 72) / 25.4
  const fileName = suggestedFileName(invoice)
  const file = await NovaDocuments.htmlToPdf({ html: invoiceHtml(invoice, language), fileName, widthPt: pt(mm.width), heightPt: pt(mm.height), marginPt: 0 })
  return { name: fileName, bytes: await readNativeFile(file) }
}

/** يقرأ فاتورة PDF قديمة (نصية أو بعد OCR) ويحوّلها إلى مسودة فاتورة. */
export async function extractInvoiceFromPdf(bytes: Uint8Array, defaultCurrency: string): Promise<{ input: InvoiceInput; found: number; totalMinor: number | null }> {
  await ensureDatabase()
  const engine = await loadEngine(bytes)
  const pages: Span[][] = []
  for (let i = 0; i < Math.min(engine.pageCount, 5); i++) pages.push((await engine.textSpans(i)).map((s) => ({ text: s.text, x: s.x, y: s.y, width: s.width, height: s.height })))
  engine.destroy()
  const ex = autoExtract(pages, currencyInfo(defaultCurrency).decimals)
  const f = ex.fields
  const today = new Date().toISOString().slice(0, 10)
  const input: InvoiceInput = {
    issueDate: f.issueDate?.value && /^\d{4}-\d{2}-\d{2}$/.test(f.issueDate.value) ? f.issueDate.value : today,
    dueDate: f.dueDate?.value && /^\d{4}-\d{2}-\d{2}$/.test(f.dueDate.value) ? f.dueDate.value : null,
    number: f.number?.value || null,
    reference: f.reference?.value ?? '',
    currency: defaultCurrency,
    customerSnapshot: f.customerName ? { displayName: f.customerName.value, phone: f.customerPhone?.value, address: f.customerAddress?.value, taxId: f.customerTaxId?.value } : null,
    source: 'pdf_import',
    items: ex.items.map((it) => ({ name: it.name || it.raw, description: it.description, quantityMilli: it.quantityMilli, unitPriceMinor: it.unitPriceMinor, discountBps: it.discountBps, taxBps: it.taxBps }))
  }
  const total = f.total?.value ? Math.round(Number(f.total.value) * 10 ** currencyInfo(defaultCurrency).decimals) : null
  return { input, found: ex.items.length, totalMinor: Number.isFinite(total) ? total : null }
}
