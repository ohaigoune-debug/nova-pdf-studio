/**
 * أجزاء OCR المستقلة عن المنصة (تُختبر في Node):
 * تحويل أسطر OCR إلى مقاطع نص بإحداثيات الصفحة، وإنشاء PDF قابل للبحث بطبقة نص خفية
 * (يعيد استخدام addInvisibleTextLayer من نسخة Windows كما هي).
 */
import type { OcrResult } from '@shared/ocr'
import type { TextSpan } from '@modules/pdf/renderer/pdfEngine'
import { addInvisibleTextLayer, type TextLayerPage } from '@modules/ocr/renderer/searchablePdf'

const ARABIC = /[؀-ۿ]/

export type OcrLanguage = 'ara' | 'fra' | 'eng'
export const OCR_LANGS: OcrLanguage[] = ['ara', 'fra', 'eng']

/** رموز Tesseract → رموز Apple Vision. */
export const VISION_CODES: Record<OcrLanguage, string[]> = {
  ara: ['ar-SA', 'ars-SA'],
  fra: ['fr-FR'],
  eng: ['en-US']
}

export function ocrLinesToSpans(result: Pick<OcrResult, 'lines' | 'widthPx'>, pageWidthPt: number): TextSpan[] {
  const f = pageWidthPt / result.widthPx
  return result.lines
    .filter((l) => l.text.trim())
    .map((l) => {
      const height = (l.y1 - l.y0) * f
      return {
        text: l.text.trim(),
        x: l.x0 * f,
        y: l.y0 * f,
        width: (l.x1 - l.x0) * f,
        height,
        fontSize: Math.max(4, height * 0.85),
        dir: ARABIC.test(l.text) ? 'rtl' : 'ltr',
        fontName: 'ocr'
      } satisfies TextSpan
    })
}

export interface PageOcrInput {
  index: number
  result: Pick<OcrResult, 'lines' | 'widthPx' | 'heightPx'>
  pageWidthPt: number
  pageHeightPt: number
}

/** يضيف نص OCR كطبقة خفية: الملف يبقى بصريًا كما هو، لكن يصبح قابلًا للبحث والتحديد والنسخ في أي قارئ. */
export async function makeSearchablePdf(pdf: Uint8Array, pages: PageOcrInput[], arabicFont: Uint8Array | null): Promise<Uint8Array> {
  const layer: TextLayerPage[] = pages.map((p) => ({
    index: p.index,
    spans: ocrLinesToSpans(p.result, p.pageWidthPt),
    pageWidthPt: p.pageWidthPt,
    pageHeightPt: p.pageHeightPt
  }))
  return addInvisibleTextLayer(pdf, layer, arabicFont)
}

/** معدّل خطأ الحروف (CER) بمسافة Levenshtein — لقياس دقة OCR في الاختبارات. */
export function characterErrorRate(expected: string, actual: string): number {
  // نتجاهل التشكيل والتطويل وعلامات الاتجاه (LRM/RLM/ALM) والمسافات المكررة
  const norm = (s: string) => s.normalize('NFKC').replace(/[\u064B-\u0652\u0640\u200E\u200F\u061C]/g, '').replace(/\s+/g, ' ').trim()
  const a = [...norm(expected)]
  const b = [...norm(actual)]
  if (a.length === 0) return b.length === 0 ? 0 : 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    prev = cur
  }
  return prev[b.length] / a.length
}

// ------------------------------------------------------------------ OCR متعدد المقاييس
/**
 * Tesseract حساس لارتفاع السطر: العناوين الكبيرة جدًا (> ~45 بكسل) قد تُسقَط بالكامل دون أي خطأ
 * (لاحظنا ذلك فعلًا في سطر عربي يحتوي أرقامًا). لذلك نعدّ «أشرطة النص» بإسقاط أفقي للبكسلات الداكنة،
 * وإن أعاد OCR أسطرًا أقل منها نعيد المحاولة بمقياس يعيد ارتفاع السطر إلى ~30 بكسل وندمج الأسطر الناقصة.
 */
export interface Band {
  y0: number
  y1: number
}

export function grayFromRgba(data: Uint8Array | Uint8ClampedArray, w: number, h: number): Uint8Array {
  const g = new Uint8Array(w * h)
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 299 + data[j + 1] * 587 + data[j + 2] * 114) / 1000
  return g
}

export function textBands(gray: Uint8Array, w: number, h: number, threshold = 128): Band[] {
  const minInk = Math.max(2, Math.round(w * 0.002))
  const rows = new Uint32Array(h)
  for (let y = 0; y < h; y++) {
    let n = 0
    for (let x = 0; x < w; x++) if (gray[y * w + x] < threshold) n++
    rows[y] = n
  }
  const bands: Band[] = []
  let start = -1
  for (let y = 0; y <= h; y++) {
    const ink = y < h && rows[y] >= minInk
    if (ink && start < 0) start = y
    if (!ink && start >= 0) {
      if (y - start >= 6) bands.push({ y0: start, y1: y })
      start = -1
    }
  }
  // دمج الأشرطة المتقاربة جدًا (نقاط الحروف العربية فوق/تحت السطر)
  const merged: Band[] = []
  for (const b of bands) {
    const last = merged[merged.length - 1]
    if (last && b.y0 - last.y1 < Math.max(4, (last.y1 - last.y0) * 0.35)) last.y1 = b.y1
    else merged.push({ ...b })
  }
  return merged
}

export function medianHeight(bands: Band[]): number {
  if (bands.length === 0) return 0
  const hs = bands.map((b) => b.y1 - b.y0).sort((a, b) => a - b)
  return hs[Math.floor(hs.length / 2)]
}

/** المقياس المقترح لإعادة المحاولة: يعيد الارتفاع الوسيط للسطر إلى ~30 بكسل (ضمن 0.35..2.5). */
export function retryScale(bands: Band[]): number {
  const m = medianHeight(bands)
  if (!m) return 1
  return Math.max(0.35, Math.min(2.5, 30 / m))
}

const overlap = (a: { y0: number; y1: number }, b: { y0: number; y1: number }) => Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0)) / Math.max(1, Math.min(a.y1 - a.y0, b.y1 - b.y0))

/** يضيف من التمريرة الثانية (بعد إعادتها لمقياس الصورة الأصلية) الأسطرَ غير الموجودة في الأولى، ويرتّب من الأعلى. */
export function mergeOcrLines(primary: OcrResult['lines'], secondary: OcrResult['lines'], secondaryScale: number): OcrResult['lines'] {
  const back = secondary.map((l) => ({
    ...l,
    x0: l.x0 / secondaryScale, x1: l.x1 / secondaryScale, y0: l.y0 / secondaryScale, y1: l.y1 / secondaryScale,
    words: l.words.map((w) => ({ ...w, x0: w.x0 / secondaryScale, x1: w.x1 / secondaryScale, y0: w.y0 / secondaryScale, y1: w.y1 / secondaryScale }))
  }))
  const out = primary.filter((l) => l.text.trim())
  for (const l of back) {
    if (!l.text.trim()) continue
    if (!out.some((p) => overlap(p, l) > 0.5)) out.push(l)
  }
  return out.sort((a, b) => a.y0 - b.y0)
}

/** يحتاج إعادة محاولة إن كان عدد الأسطر المقروءة أقل من أشرطة النص في الصورة. */
export function needsRetry(lines: OcrResult['lines'], bands: Band[]): boolean {
  const covered = bands.filter((b) => lines.some((l) => l.text.trim() && overlap(l, b) > 0.4)).length
  return covered < bands.length
}

/** تصغير/تكبير RGBA (ثنائي الخطية) — يُستعمل في الاختبارات وخارج المتصفح؛ في الواجهة نستعمل Canvas. */
export function scaleRgba(src: Uint8Array | Uint8ClampedArray, w: number, h: number, scale: number): { data: Uint8ClampedArray; width: number; height: number } {
  const W = Math.max(1, Math.round(w * scale))
  const H = Math.max(1, Math.round(h * scale))
  const out = new Uint8ClampedArray(W * H * 4)
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, (y + 0.5) / scale - 0.5)
    const y0 = Math.max(0, Math.floor(sy)), y1 = Math.min(h - 1, y0 + 1), fy = Math.max(0, sy - y0)
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, (x + 0.5) / scale - 0.5)
      const x0 = Math.max(0, Math.floor(sx)), x1 = Math.min(w - 1, x0 + 1), fx = Math.max(0, sx - x0)
      for (let c = 0; c < 4; c++) {
        const a = src[(y0 * w + x0) * 4 + c] * (1 - fx) + src[(y0 * w + x1) * 4 + c] * fx
        const b = src[(y1 * w + x0) * 4 + c] * (1 - fx) + src[(y1 * w + x1) * 4 + c] * fx
        out[(y * W + x) * 4 + c] = a * (1 - fy) + b * fy
      }
    }
  }
  return { data: out, width: W, height: H }
}
