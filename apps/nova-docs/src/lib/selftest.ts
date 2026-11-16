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
