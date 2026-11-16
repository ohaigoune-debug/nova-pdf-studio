/**
 * OCR: قياس فعلي للدقة بمحرك Tesseract المضمّن في التطبيق (نفس حزم ara/fra/eng ونفس الإصدار 5.1.1)
 * على صور اختبار عربية وفرنسية وإنجليزية ومختلطة، ثم إنشاء PDF قابل للبحث والتحقق من أن النص قابل للاستخراج.
 * ملاحظة: Apple Vision لا يمكن تشغيله على Linux؛ يُختبر على الجهاز/المحاكي (انظر docs/ios/TEST_RESULTS.md).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { createWorker } from 'tesseract.js'
import { PDFDocument } from 'pdf-lib'
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { OcrLine } from '@shared/ocr'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { characterErrorRate, grayFromRgba, makeSearchablePdf, mergeOcrLines, needsRetry, retryScale, scaleRgba, textBands } from '../src/lib/ocrCore'
import { applyScanFilter, type ScanFilter } from '../src/lib/enhance'

const FIX = resolve(__dirname, 'fixtures')
const TESSDATA = resolve(__dirname, '../../../resources/tessdata')
const truth = JSON.parse(readFileSync(resolve(FIX, 'ocr-truth.json'), 'utf8')) as Record<string, string>
const report: Record<string, unknown> = {}

type Worker = Awaited<ReturnType<typeof createWorker>>
const workers = new Map<string, Worker>()
async function worker(langs: string): Promise<Worker> {
  if (!workers.has(langs)) workers.set(langs, await createWorker(langs, 1, { langPath: TESSDATA, gzip: true, cacheMethod: 'none' }))
  return workers.get(langs)!
}

interface Tess { text: string; confidence: number; blocks?: { paragraphs: { lines: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] }

async function ocr(file: string, langs: string): Promise<{ text: string; confidence: number; lines: OcrLine[]; ms: number }> {
  const t0 = Date.now()
  const res = await (await worker(langs)).recognize(readFileSync(resolve(FIX, file)), {}, { text: true, blocks: true })
  const data = res.data as unknown as Tess
  const lines: OcrLine[] = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) lines.push({ text: l.text.trim(), confidence: l.confidence, ...l.bbox, words: [] })
  return { text: data.text, confidence: data.confidence, lines, ms: Date.now() - t0 }
}

function decode(file: string): { data: Uint8Array; width: number; height: number } {
  const buf = readFileSync(resolve(FIX, file))
  if (file.endsWith('.png')) {
    const png = PNG.sync.read(buf)
    return { data: new Uint8Array(png.data), width: png.width, height: png.height }
  }
  const img = jpeg.decode(buf, { useTArray: true })
  return { data: img.data, width: img.width, height: img.height }
}

function encodePng(data: Uint8Array | Uint8ClampedArray, width: number, height: number): Buffer {
  const png = new PNG({ width, height })
  png.data = Buffer.from(data)
  return PNG.sync.write(png)
}

async function ocrBuffer(buf: Buffer, langs: string) {
  const res = await (await worker(langs)).recognize(buf, {}, { text: true, blocks: true })
  const data = res.data as unknown as Tess
  const lines: OcrLine[] = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) lines.push({ text: l.text.trim(), confidence: l.confidence, ...l.bbox, words: [] })
  return { text: data.text, confidence: data.confidence, lines }
}

/** نفس خوارزمية التطبيق: تمريرة أولى، ثم إعادة بمقياس مناسب إن نقصت أسطر، ثم دمج. */
async function robustOcr(file: string, langs: string, filter: ScanFilter = 'original') {
  const t0 = Date.now()
  const img = decode(file)
  const filtered = applyScanFilter({ data: new Uint8ClampedArray(img.data), width: img.width, height: img.height }, filter)
  const first = await ocrBuffer(encodePng(filtered.data, img.width, img.height), langs)
  const bands = textBands(grayFromRgba(filtered.data, img.width, img.height), img.width, img.height)
  let lines = first.lines
  let retried = false
  if (needsRetry(lines, bands)) {
    const scale = retryScale(bands)
    const scaled = scaleRgba(filtered.data, img.width, img.height, scale)
    const second = await ocrBuffer(encodePng(scaled.data, scaled.width, scaled.height), langs)
    lines = mergeOcrLines(lines, second.lines, scale)
    retried = true
  }
  return { text: lines.map((l) => l.text).join('\n'), lines, bands: bands.length, retried, confidence: first.confidence, ms: Date.now() - t0, width: img.width, height: img.height }
}

afterAll(async () => {
  for (const w of workers.values()) await w.terminate()
  mkdirSync(resolve(__dirname, '../test-results'), { recursive: true })
  writeFileSync(resolve(__dirname, '../test-results/ocr-accuracy.json'), JSON.stringify(report, null, 2))
})

const CASES: [key: string, file: string, langs: string, maxCer: number][] = [
  ['arabic', 'ocr-ar.png', 'ara', 0.12],
  ['french', 'ocr-fr.png', 'fra', 0.05],
  ['english', 'ocr-en.png', 'eng', 0.05],
  ['mixed ar+fr', 'ocr-mixed.png', 'ara+fra', 0.15],
  ['phone photo (shadow, noise)', 'scan-photo-fr.jpg', 'fra', 0.12]
]
const TRUTH_KEY: Record<string, string> = { 'ocr-ar.png': 'ar', 'ocr-fr.png': 'fr', 'ocr-en.png': 'en', 'ocr-mixed.png': 'mixed', 'scan-photo-fr.jpg': 'scan-photo-fr' }

describe('offline OCR accuracy (Tesseract, bundled language packs)', () => {
  for (const [name, file, langs, maxCer] of CASES) {
    const title = name.startsWith('phone') ? `${name}: raw photo, no enhancement — measured only (threshold applies after enhancement, next test)` : `${name}: CER ≤ ${maxCer * 100}% (multi-scale pipeline)`
    it(title, async () => {
      const single = await ocr(file, langs)
      const res = await robustOcr(file, langs)
      const cer = characterErrorRate(truth[TRUTH_KEY[file]], res.text)
      report[name] = { file, langs, cerSinglePass: Number(characterErrorRate(truth[TRUTH_KEY[file]], single.text).toFixed(4)), cer: Number(cer.toFixed(4)), retried: res.retried, textBands: res.bands, confidence: Math.round(res.confidence), ms: res.ms, text: res.text.trim() }
      if (!name.startsWith('phone')) expect(cer).toBeLessThanOrEqual(maxCer)
    })
  }

  it('phone photo: lighting enhancement improves OCR (measured)', async () => {
    const results: Record<string, number> = {}
    for (const f of ['original', 'enhanced', 'grayscale', 'bw'] as ScanFilter[]) {
      const r = await robustOcr('scan-photo-fr.jpg', 'fra', f)
      results[f] = Number(characterErrorRate(truth['scan-photo-fr'], r.text).toFixed(4))
    }
    report['photo filters CER'] = results
    expect(Math.min(results.enhanced, results.bw)).toBeLessThan(results.original)
    expect(Math.min(results.enhanced, results.bw)).toBeLessThanOrEqual(0.12)
  })

  it('builds a searchable PDF from a scanned (image-only) page', async () => {
    const png = readFileSync(resolve(FIX, 'ocr-mixed.png'))
    const doc = await PDFDocument.create()
    const img = await doc.embedPng(png)
    const page = doc.addPage([595.28, (595.28 * img.height) / img.width])
    page.drawImage(img, { x: 0, y: 0, width: page.getWidth(), height: page.getHeight() })
    const scanned = await doc.save()
    const res = await robustOcr('ocr-mixed.png', 'ara+fra')
    const font = readFileSync(resolve(__dirname, '../../../resources/fonts/NotoNaskhArabic-Regular.ttf'))
    const searchable = await makeSearchablePdf(scanned, [{ index: 0, result: { lines: res.lines, widthPx: img.width, heightPx: img.height }, pageWidthPt: page.getWidth(), pageHeightPt: page.getHeight() }], font)
    const pdf = await pdfjs.getDocument({ data: searchable.slice(), standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/' }).promise
    const tc = await (await pdf.getPage(1)).getTextContent()
    const extracted = tc.items.map((it) => ('str' in it ? it.str : '')).join(' ')
    report['searchable pdf'] = { extracted }
    expect(extracted).toMatch(/Librairie|Client/)
    expect(extracted).toMatch(/[؀-ۿ]{3,}/)
    // الأرقام داخل سطر عربي تُستخرج بترتيبها الصحيح (كانت تخرج 00521 و6202 قبل الإصلاح)
    expect(extracted).toContain('12500')
    expect(extracted).toContain('2026')
    expect(extracted).not.toContain('00521')
  })
})
