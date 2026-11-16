/**
 * اختبار ذاتي لـ OCR داخل WKWebView على iOS الحقيقي (المحاكي في CI) — **نسخة Debug فقط**:
 * لا يُستدعى إلا إذا وضع NovaBridgeViewController (داخل #if DEBUG) العلم window.__NOVA_DEBUG__.
 *
 * يرسم صفحة بنص معروف (عربي/فرنسي/إنجليزي) ← Tesseract WASM ← CER لكل سطر ← PDF قابل للبحث يُحفظ في المكتبة
 * ← يُستخرج نصه بـ pdf.js للتحقق ← النتيجة في السجل وعلى الشاشة (تظهر في لقطة CI).
 */
import { PDFDocument } from 'pdf-lib'
import { characterErrorRate, makeSearchablePdf } from './ocrCore'
import { recognizeRobust } from './ocr'
import { loadArabicFont } from './ocrDocument'
import { writeLibraryFile } from '../platform/library'
import { useLibrary } from '../stores/library'
import { loadEngine } from './docs'

const LINES = [
  { lang: 'fra', text: 'Facture 2026-015 Bou Saada', dir: 'ltr' as const },
  { lang: 'eng', text: 'NOVA Docs searchable PDF', dir: 'ltr' as const },
  { lang: 'ara', text: 'فاتورة للعميل مكتبة النور', dir: 'rtl' as const }
]

async function pageImage(): Promise<{ png: Uint8Array; width: number; height: number }> {
  const width = 1400
  const height = 520
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  // الخط العربي المضمّن في التطبيق: رسم متطابق على كل منصة (لا يعتمد على خطوط النظام)
  const naskh = new FontFace('NovaNaskhSelfTest', 'url(./fonts/NotoNaskhArabic-Regular.ttf)')
  await naskh.load()
  document.fonts.add(naskh)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#111111'
  LINES.forEach((l, i) => {
    ctx.font = l.dir === 'rtl' ? '60px NovaNaskhSelfTest' : '56px -apple-system, "Helvetica Neue", Arial, sans-serif'
    ctx.direction = l.dir
    ctx.textAlign = l.dir === 'rtl' ? 'right' : 'left'
    ctx.fillText(l.text, l.dir === 'rtl' ? width - 60 : 60, 120 + i * 150)
  })
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/png'))
  return { png: new Uint8Array(await blob.arrayBuffer()), width, height }
}

export async function runOcrSelfTest(): Promise<Record<string, unknown>> {
  const t0 = performance.now()
  const img = await pageImage()
  // المسار المتين نفسه المستعمل في التطبيق، مع فرض Tesseract (Vision الأصلي يتطلب Pro)
  const ocr = await recognizeRobust(img.png, { width: img.width, height: img.height }, ['ara', 'fra', 'eng'], undefined, { tesseractOnly: true })
  const got = ocr.lines.map((l) => l.text)
  const perLine = LINES.map((l) => {
    const best = got.reduce((m, g) => Math.min(m, characterErrorRate(l.text, g)), 1)
    return { lang: l.lang, expected: l.text, cer: +(best * 100).toFixed(1) }
  })
  // PDF قابل للبحث من الصورة (pdf-lib + fontkit + الخط العربي داخل WebKit)
  const doc = await PDFDocument.create()
  const png = await doc.embedPng(img.png)
  const pw = 595.28
  const ph = (img.height / img.width) * pw
  doc.addPage([pw, ph]).drawImage(png, { x: 0, y: 0, width: pw, height: ph })
  const searchable = await makeSearchablePdf(await doc.save(), [{ index: 0, result: ocr, pageWidthPt: pw, pageHeightPt: ph }], await loadArabicFont())
  const name = await writeLibraryFile('OCR self-test.pdf', searchable)
  await useLibrary.getState().refresh()
  const engine = await loadEngine(searchable)
  const extracted = (await engine.pageText(0)).replace(/\s+/g, ' ').trim()
  const result = {
    engine: ocr.engine,
    confidence: Math.round(ocr.confidence),
    ocrMs: ocr.durationMs,
    totalMs: Math.round(performance.now() - t0),
    perLine,
    recognized: got,
    pdfFile: name,
    pdfTextHas2026: extracted.includes('2026'),
    pdfTextHasArabic: /[؀-ۿ]{3,}/.test(extracted),
    extracted: extracted.slice(0, 200)
  }
  console.log(`[nova-selftest] ${JSON.stringify(result)}`)
  return result
}

/**
 * اختبار ذاتي لتصدير الفاتورة PDF على iOS (WKWebView + UIPrintPageRenderer الأصلي) — نسخة Debug فقط.
 * ثم «رحلة العودة»: نستورد الملف الناتج بمستخرج الفواتير القديمة ونقارن المجموع ورقم الفاتورة.
 */
export async function runInvoicePdfSelfTest(): Promise<Record<string, unknown>> {
  const t0 = performance.now()
  const { ensureDatabase } = await import('../platform/db')
  await ensureDatabase()
  const { demoStatus, loadDemoData } = await import('@modules/database/main/demo-data')
  if (!demoStatus().loaded) loadDemoData()
  const { getInvoice, listInvoices } = await import('@modules/invoices/main/repository')
  const row = listInvoices({ limit: 20, sort: 'date_desc' }).rows.find((r) => r.status !== 'cancelled') ?? listInvoices({ limit: 1 }).rows[0]
  const invoice = getInvoice(row.id)!
  const { invoicePdf, extractInvoiceFromPdf } = await import('./invoicing')
  const { usePrefs } = await import('../stores/prefs')
  const pdf = await invoicePdf(invoice, usePrefs.getState().language)
  const engine = await loadEngine(pdf.bytes)
  const pages = engine.pageCount
  const text = (await engine.pageText(0)).replace(/\s+/g, ' ')
  engine.destroy()
  const back = await extractInvoiceFromPdf(pdf.bytes, invoice.currency)
  const name = await writeLibraryFile(`Invoice self-test ${invoice.number}.pdf`, pdf.bytes)
  await useLibrary.getState().refresh()
  const result = {
    invoice: invoice.number,
    pdfKB: Math.round(pdf.bytes.length / 1024),
    pages,
    textHasNumber: text.includes(invoice.number),
    grandTotalMinor: invoice.grandTotalMinor,
    reimport: { number: back.input.number, items: back.found, totalMinor: back.totalMinor, totalMatches: back.totalMinor === invoice.grandTotalMinor },
    file: name,
    ms: Math.round(performance.now() - t0)
  }
  console.log(`[nova-selftest] ${JSON.stringify(result)}`)
  return result
}

/** صورة «ورقة مصوّرة بالهاتف» (ظل، إضاءة غير متساوية، ضجيج) لعرض شاشة مراجعة المسح على المحاكي — نسخة Debug فقط. */
/** صفحة «مصوّرة بالهاتف» مولَّدة (ظل + ضجيج) بالمقاس المطلوب، JPEG. */
async function photoPage(w: number, h: number): Promise<Uint8Array> {
  const k = w / 1200
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#f4f1ea'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = '#123D36'
  ctx.font = `bold ${Math.round(54 * k)}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.fillText('FACTURE N° 2026-015', 90 * k, 170 * k)
  ctx.font = `${Math.round(36 * k)}px -apple-system, "Helvetica Neue", Arial, sans-serif`
  ctx.fillStyle = '#222'
  const lines = ['Librairie En-Nour — Bou Saada', 'Date : 16/11/2026', '', 'Ramette A4 80 g      3 × 750,50', 'Livraison               1 × 500,00', '', 'Total HT             2 751,50 DA', 'TVA 19 %                 522,79 DA', 'Total TTC            3 274,29 DA']
  lines.forEach((l, i) => ctx.fillText(l, 90 * k, (300 + i * 70) * k))
  const naskh = new FontFace('NovaNaskhDemo', 'url(./fonts/NotoNaskhArabic-Regular.ttf)')
  await naskh.load()
  document.fonts.add(naskh)
  ctx.font = `${Math.round(44 * k)}px NovaNaskhDemo`
  ctx.direction = 'rtl'
  ctx.textAlign = 'right'
  ctx.fillText('شكرًا لثقتكم — مكتبة النور', w - 90 * k, 1050 * k)
  // ظل مائل وإضاءة غير متساوية كصورة هاتف حقيقية
  const g = ctx.createLinearGradient(0, 0, w, h)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.12)')
  g.addColorStop(1, 'rgba(0,0,0,0.45)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 18
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  const blob: Blob = await new Promise((res) => c.toBlob((b) => res(b!), 'image/jpeg', 0.9))
  return new Uint8Array(await blob.arrayBuffer())
}

export async function runScanDemo(): Promise<void> {
  const jpeg = await photoPage(1200, 1600)
  const { injectScanPagesForDebug } = await import('../features/scan/ScanScreen')
  await injectScanPagesForDebug([jpeg], 'enhanced')
}

/**
 * زمن مرشحات المسح داخل WKWebView (نسخة Debug فقط): صفحة 1800×2400 (أقصى مقاس يعالجه التطبيق)،
 * التسلسل الكامل كما في شاشة المسح: فك JPEG ← المرشح ← ترميز JPEG.
 */
export async function runFilterTiming(): Promise<Record<string, unknown>> {
  const jpeg = await photoPage(1800, 2400)
  const { filterImageBytes } = await import('./enhance')
  const ms: Record<string, number> = {}
  for (const f of ['original', 'enhanced', 'grayscale', 'bw'] as const) {
    const t0 = performance.now()
    await filterImageBytes(jpeg, f)
    ms[f] = Math.round(performance.now() - t0)
  }
  const result = { page: '1800x2400', ms, userAgent: navigator.userAgent.slice(0, 80) }
  console.log(`[nova-selftest] ${JSON.stringify(result)}`)
  return result
}

/** خطوط المحرّر داخل WKWebView: كل خط يُحمَّل ويُرسم في PDF حقيقي عبر مسار الحفظ نفسه (bakeEdits). Debug فقط. */
export async function runFontsSelfTest(): Promise<{ file: string; fonts: number; loaded: number; ms: number }> {
  const t0 = performance.now()
  const { EDITOR_FONTS, ensureFontLoaded, editorCssFont } = await import('./editorFonts')
  const { bakeEdits } = await import('../features/viewer/saveDocument')
  const doc = await PDFDocument.create()
  doc.addPage([595, 842])
  const bytes = await doc.save()
  const objects = EDITOR_FONTS.map((f, i) => ({
    id: `f${i}`, kind: 'text' as const, page: 0, x: 40, y: 40 + i * 56, width: 515, height: 40,
    text: `${f.label.split(' — ')[1]}: بسم الله الرحمن الرحيم · ${f.family}`, fontSize: 18, fontFamily: 'sans' as const,
    bold: i % 4 === 3, italic: false, underline: false, align: 'right' as 'left' | 'right', color: '#123D36', background: null, direction: 'auto' as const, fontName: f.family
  }))
  objects.push({ ...objects[1], id: 'latin', y: 40 + EDITOR_FONTS.length * 56, text: 'Latin text in Amiri — 2026', align: 'left' })
  let loaded = 0
  for (const o of objects) {
    await ensureFontLoaded(o)
    if (document.fonts.check(editorCssFont(o, 1), o.text)) loaded++
  }
  const out = await bakeEdits(bytes, { objects, ink: [], notes: [] } as never)
  const file = await writeLibraryFile('NOVA fonts self-test.pdf', out, { overwrite: true })
  await useLibrary.getState().refresh()
  return { file, fonts: EDITOR_FONTS.length, loaded, ms: Math.round(performance.now() - t0) }
}
