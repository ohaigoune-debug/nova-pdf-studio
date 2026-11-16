/** OCR لمستند PDF كامل داخل التطبيق: تصيير كل صفحة بدقة 200 DPI ← تعرّف (Vision/Tesseract متعدد المقاييس) ← PDF قابل للبحث. */
import type { PdfEngine } from '@modules/pdf/renderer/pdfEngine'
import { OCR_DPI } from '@shared/ocr'
import { recognizeRobust } from './ocr'
import { makeSearchablePdf, type OcrLanguage, type PageOcrInput } from './ocrCore'

let arabicFont: Uint8Array | null = null
export async function loadArabicFont(): Promise<Uint8Array | null> {
  if (arabicFont) return arabicFont
  try {
    arabicFont = new Uint8Array(await (await fetch('./fonts/NotoNaskhArabic-Regular.ttf')).arrayBuffer())
  } catch {
    arabicFont = null
  }
  return arabicFont
}

async function renderPagePng(engine: PdfEngine, index: number): Promise<{ png: Uint8Array; width: number; height: number }> {
  const page = await engine.page(index)
  const viewport = page.getViewport({ scale: OCR_DPI / 72 })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  const ctx = canvas.getContext('2d', { alpha: false })!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  await page.render({ canvasContext: ctx, viewport }).promise
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'))
  return { png: new Uint8Array(await blob!.arrayBuffer()), width: canvas.width, height: canvas.height }
}

export async function ocrPdf(engine: PdfEngine, langs: OcrLanguage[], onPage: (done: number, total: number) => void): Promise<{ bytes: Uint8Array; text: string; engines: Set<string> }> {
  const pages: PageOcrInput[] = []
  const texts: string[] = []
  const engines = new Set<string>()
  for (let i = 0; i < engine.pageCount; i++) {
    onPage(i, engine.pageCount)
    const info = await engine.pageInfo(i)
    const img = await renderPagePng(engine, i)
    const res = await recognizeRobust(img.png, { width: img.width, height: img.height }, langs)
    engines.add(res.engine)
    texts.push(res.lines.map((l) => l.text).join('\n'))
    pages.push({ index: i, result: res, pageWidthPt: info.widthPt, pageHeightPt: info.heightPt })
  }
  onPage(engine.pageCount, engine.pageCount)
  const bytes = await makeSearchablePdf(engine.bytes, pages, await loadArabicFont())
  return { bytes, text: texts.join('\n\n'), engines }
}
