import { blobOf } from '../platform/bytes'
/**
 * محرك OCR في التطبيق:
 *   1) Apple Vision (أصلي، سريع) إن دعم الجهاز كل اللغات المطلوبة.
 *   2) وإلا Tesseract.js المضمّن بحزم ara/fra/eng المحلية (نفس حزم نسخة Windows) — دون إنترنت إطلاقًا.
 * كلا المحركين يعيدان OcrResult بإحداثيات بكسل من أعلى-يسار.
 */
import type { OcrLine, OcrResult } from '@shared/ocr'
import { isNative, NovaOcr } from '../platform/native'
import { bytesToBase64 } from '../platform/bytes'
import { VISION_CODES, grayFromRgba, mergeOcrLines, needsRetry, retryScale, textBands, type OcrLanguage } from './ocrCore'

export type OcrEngine = 'vision' | 'tesseract'

export interface OcrOutcome extends OcrResult {
  engine: OcrEngine
}

let visionLanguages: string[] | null = null

export async function visionSupported(): Promise<string[]> {
  if (!isNative()) return []
  if (visionLanguages) return visionLanguages
  try {
    visionLanguages = (await NovaOcr.supportedLanguages()).languages
  } catch {
    visionLanguages = []
  }
  return visionLanguages
}

/** يختار المحرك: Vision فقط إذا دعم كل لغة مطلوبة (وإلا قد يتجاهل العربية بصمت). */
export function chooseEngine(langs: OcrLanguage[], supportedVision: string[]): OcrEngine {
  if (supportedVision.length === 0) return 'tesseract'
  const ok = langs.every((l) => VISION_CODES[l].some((code) => supportedVision.includes(code)))
  return ok ? 'vision' : 'tesseract'
}

// ------------------------------------------------------------------ Tesseract (WASM داخل WKWebView)
type TessWorker = Awaited<ReturnType<typeof import('tesseract.js')['createWorker']>>
let worker: { key: string; w: TessWorker } | null = null
let progressCb: ((p: number) => void) | null = null

async function tesseractWorker(langs: OcrLanguage[]): Promise<TessWorker> {
  const key = [...langs].sort().join('+')
  if (worker?.key === key) return worker.w
  if (worker) await worker.w.terminate().catch(() => undefined)
  const { createWorker } = await import('tesseract.js')
  const base = new URL('./', window.location.href).href
  const w = await createWorker(key, 1, {
    workerPath: `${base}tesseract/worker.min.js`,
    corePath: `${base}tesseract`,
    langPath: `${base}tessdata`,
    gzip: true,
    cacheMethod: 'none',
    workerBlobURL: false,
    logger: (m: { status: string; progress: number }) => {
      if (m.status === 'recognizing text') progressCb?.(m.progress)
    }
  })
  await w.setParameters({ preserve_interword_spaces: '1' })
  worker = { key, w }
  return w
}

interface TessLine { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number }; words: { text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }

async function recognizeTesseract(image: Uint8Array, langs: OcrLanguage[], size: { width: number; height: number }): Promise<OcrOutcome> {
  const started = performance.now()
  const w = await tesseractWorker(langs)
  const res = await w.recognize(blobOf(image), {}, { text: true, blocks: true })
  const data = res.data as unknown as { text: string; confidence: number; blocks?: { paragraphs: { lines: TessLine[] }[] }[] }
  const lines: OcrLine[] = []
  for (const b of data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) {
    lines.push({
      text: l.text.trim(), confidence: l.confidence, x0: l.bbox.x0, y0: l.bbox.y0, x1: l.bbox.x1, y1: l.bbox.y1,
      words: l.words.map((wd) => ({ text: wd.text, confidence: wd.confidence, x0: wd.bbox.x0, y0: wd.bbox.y0, x1: wd.bbox.x1, y1: wd.bbox.y1 }))
    })
  }
  return { engine: 'tesseract', text: data.text, confidence: data.confidence, lines, widthPx: size.width, heightPx: size.height, durationMs: Math.round(performance.now() - started), languages: langs }
}

export async function recognizeImage(
  image: Uint8Array,
  size: { width: number; height: number },
  langs: OcrLanguage[],
  onProgress?: (p: number) => void
): Promise<OcrOutcome> {
  const engine = chooseEngine(langs, await visionSupported())
  if (engine === 'vision') {
    try {
      const res = await NovaOcr.recognize({ base64: bytesToBase64(image), languages: langs.flatMap((l) => VISION_CODES[l]) })
      if (res.unsupportedLanguages.length === 0 || res.text.trim()) {
        return { engine: 'vision', text: res.text, confidence: res.confidence, lines: res.lines, widthPx: res.widthPx, heightPx: res.heightPx, durationMs: res.durationMs, languages: langs }
      }
    } catch (error) {
      // PRO_REQUIRED يجب أن يصل للواجهة كما هو؛ غير ذلك ننتقل إلى Tesseract
      if (String((error as { code?: string })?.code) === 'PRO_REQUIRED') throw error
    }
  }
  progressCb = onProgress ?? null
  try {
    return await recognizeTesseract(image, langs, size)
  } finally {
    progressCb = null
  }
}

export async function releaseOcr(): Promise<void> {
  if (worker) await worker.w.terminate().catch(() => undefined)
  worker = null
}

/**
 * التعرّف «المتين» المستعمل في التطبيق: تمريرة أولى، ثم إن بقيت أشرطة نص دون قراءة نعيد بمقياس يعيد ارتفاع
 * السطر إلى ~30 بكسل وندمج (نفس الخوارزمية المختبرة في tests/ocr-accuracy.test.ts).
 */
export async function recognizeRobust(image: Uint8Array, size: { width: number; height: number }, langs: OcrLanguage[], onProgress?: (p: number) => void): Promise<OcrOutcome> {
  const first = await recognizeImage(image, size, langs, onProgress)
  if (first.engine === 'vision') return first
  const bitmap = await createImageBitmap(blobOf(image))
  const canvas = document.createElement('canvas')
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.drawImage(bitmap, 0, 0)
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const bands = textBands(grayFromRgba(data, canvas.width, canvas.height), canvas.width, canvas.height)
  if (!needsRetry(first.lines, bands)) {
    bitmap.close()
    return first
  }
  const scale = retryScale(bands)
  const scaled = document.createElement('canvas')
  scaled.width = Math.round(bitmap.width * scale)
  scaled.height = Math.round(bitmap.height * scale)
  const sctx = scaled.getContext('2d')!
  sctx.imageSmoothingQuality = 'high'
  sctx.drawImage(bitmap, 0, 0, scaled.width, scaled.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((r) => scaled.toBlob(r, 'image/png'))
  const second = await recognizeTesseract(new Uint8Array(await blob!.arrayBuffer()), langs, { width: scaled.width, height: scaled.height })
  const lines = mergeOcrLines(first.lines, second.lines, scale)
  return { ...first, lines, text: lines.map((l) => l.text).join('\n'), durationMs: first.durationMs + second.durationMs }
}
