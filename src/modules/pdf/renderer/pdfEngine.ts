/**
 * غلاف pdf.js: تحميل المستند (مع كلمة سر)، تصيير الصفحات، طبقة النص للتحديد والنسخ، البحث، الإشارات المرجعية.
 * كل التصيير يجري في Web Worker الخاص بـ pdf.js حتى لا تتجمّد الواجهة مع الملفات الكبيرة.
 */
import * as pdfjs from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { AppError } from '@shared/errors'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

export interface PageInfo {
  index: number
  widthPt: number
  heightPt: number
  rotation: number      // دوران الصفحة الأصلي في الملف
}

export interface TextSpan {
  text: string
  x: number
  y: number
  width: number
  height: number
  fontSize: number
  dir: 'ltr' | 'rtl'
  fontName: string
}

export interface SearchHit {
  page: number
  spanIndex: number
  start: number
  length: number
  snippet: string
}

export interface OutlineItem {
  title: string
  page: number | null
  children: OutlineItem[]
}

export class PdfEngine {
  private constructor(
    readonly doc: PDFDocumentProxy,
    readonly bytes: Uint8Array
  ) {}

  private pageCache = new Map<number, PDFPageProxy>()
  private textCache = new Map<number, TextSpan[]>()
  private ocrSpans = new Map<number, TextSpan[]>()

  /** نص OCR لصفحة ممسوحة: يُدمج مع طبقة النص فيصبح قابلًا للبحث والتحديد والنسخ داخل العارض. */
  setOcrSpans(index: number, spans: TextSpan[]): void {
    this.ocrSpans.set(index, spans)
    this.textCache.delete(index)
  }

  hasOcr(index: number): boolean {
    return this.ocrSpans.has(index)
  }

  /**
   * @param extra خيارات pdf.js إضافية اختيارية (مثل cMapUrl/standardFontDataUrl في تطبيق iOS)؛
   *              نسخة Windows تستدعيها دون هذا المعامل فيبقى سلوكها كما هو.
   */
  static async load(bytes: Uint8Array, password?: string, extra?: { cMapUrl?: string; cMapPacked?: boolean; standardFontDataUrl?: string }): Promise<PdfEngine> {
    try {
      const task = pdfjs.getDocument({ data: bytes.slice(), password, useSystemFonts: true, isEvalSupported: false, ...(extra ?? {}) })
      const doc = await task.promise
      return new PdfEngine(doc, bytes)
    } catch (error) {
      const name = (error as { name?: string })?.name
      if (name === 'PasswordException') {
        const code = (error as { code?: number }).code
        throw new AppError(code === 2 ? 'PDF_PASSWORD' : 'PDF_PASSWORD', code === 2 ? 'errors.pdf.wrong_password' : 'errors.PDF_PASSWORD')
      }
      if (name === 'InvalidPDFException' || name === 'FormatError') throw new AppError('PDF_CORRUPTED', undefined, undefined, String(error))
      if (name === 'UnexpectedResponseException' || name === 'MissingPDFException') throw new AppError('FILE_NOT_FOUND', undefined, undefined, String(error))
      throw new AppError('PDF_UNSUPPORTED', undefined, undefined, String(error))
    }
  }

  get pageCount(): number {
    return this.doc.numPages
  }

  async page(index: number): Promise<PDFPageProxy> {
    let page = this.pageCache.get(index)
    if (!page) {
      page = await this.doc.getPage(index + 1)
      this.pageCache.set(index, page)
    }
    return page
  }

  async pageInfos(): Promise<PageInfo[]> {
    const infos: PageInfo[] = []
    // الصفحة الأولى فقط تُحمَّل فورًا؛ الباقي يُفترض بنفس المقاس حتى يُحمَّل عند الحاجة
    const first = await this.page(0)
    const view = first.getViewport({ scale: 1 })
    for (let i = 0; i < this.pageCount; i++) infos.push({ index: i, widthPt: view.width, heightPt: view.height, rotation: first.rotate })
    return infos
  }

  async pageInfo(index: number): Promise<PageInfo> {
    const page = await this.page(index)
    const view = page.getViewport({ scale: 1 })
    return { index, widthPt: view.width, heightPt: view.height, rotation: page.rotate }
  }

  /** يصيّر صفحة على canvas بمقياس (بكسل/نقطة) ودوران إضافي. يعيد دالة إلغاء. */
  async render(index: number, canvas: HTMLCanvasElement, scale: number, rotation = 0): Promise<{ cancel: () => void; done: Promise<void> }> {
    const page = await this.page(index)
    const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 })
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(viewport.width * dpr)
    canvas.height = Math.floor(viewport.height * dpr)
    canvas.style.width = `${Math.floor(viewport.width)}px`
    canvas.style.height = `${Math.floor(viewport.height)}px`
    const context = canvas.getContext('2d', { alpha: false })!
    context.setTransform(dpr, 0, 0, dpr, 0, 0)
    const task = page.render({ canvasContext: context, viewport })
    return { cancel: () => task.cancel(), done: task.promise.catch(() => undefined) }
  }

  /** مقاطع النص بإحداثيات الصفحة (نقاط، الأصل أعلى-يسار) للتحديد والبحث وطبقة النص. */
  async textSpans(index: number): Promise<TextSpan[]> {
    const cached = this.textCache.get(index)
    if (cached) return cached
    const page = await this.page(index)
    const viewport = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const spans: TextSpan[] = []
    for (const item of content.items as TextItem[]) {
      if (!('str' in item) || !item.str) continue
      // بعد تطبيق تحويل العرض (مقياس 1) تصبح e,f موضع خط الأساس بالنقاط من أعلى-يسار الصفحة
      const [, , c, d, e, f] = pdfjs.Util.transform(viewport.transform, item.transform)
      const fontSize = Math.hypot(c, d) || item.height || 10
      spans.push({
        text: item.str,
        x: e,
        y: f - fontSize * 0.8,    // خط الأساس → أعلى المستطيل (تقريب الصاعد 80%)
        width: item.width,        // pdf.js يعطي العرض بالنقاط عند مقياس 1
        height: fontSize,
        fontSize,
        dir: item.dir === 'rtl' ? 'rtl' : 'ltr',
        fontName: item.fontName
      })
    }
    const ocr = this.ocrSpans.get(index)
    const merged = ocr ? [...spans, ...ocr] : spans
    this.textCache.set(index, merged)
    return merged
  }

  async pageText(index: number): Promise<string> {
    const spans = await this.textSpans(index)
    return spans.map((s) => s.text).join(' ').replace(/\s+/g, ' ').trim()
  }

  /** هل الصفحة بلا نص فعلي (ممسوحة ضوئيًا)؟ */
  async isScanned(index: number): Promise<boolean> {
    const text = await this.pageText(index)
    return text.replace(/[\s\W_]/g, '').length < 8
  }

  async search(query: string, onProgress?: (page: number, total: number) => void, signal?: { cancelled: boolean }): Promise<SearchHit[]> {
    const q = normalize(query)
    if (!q) return []
    const hits: SearchHit[] = []
    for (let i = 0; i < this.pageCount; i++) {
      if (signal?.cancelled) break
      const spans = await this.textSpans(i)
      spans.forEach((span, spanIndex) => {
        const hay = normalize(span.text)
        let pos = hay.indexOf(q)
        while (pos >= 0) {
          hits.push({ page: i, spanIndex, start: pos, length: q.length, snippet: snippet(span.text, pos, q.length) })
          pos = hay.indexOf(q, pos + q.length)
        }
      })
      onProgress?.(i + 1, this.pageCount)
    }
    return hits
  }

  async outline(): Promise<OutlineItem[]> {
    const raw = await this.doc.getOutline().catch(() => null)
    if (!raw) return []
    const convert = async (items: typeof raw): Promise<OutlineItem[]> => {
      const out: OutlineItem[] = []
      for (const item of items) {
        let page: number | null = null
        try {
          const dest = typeof item.dest === 'string' ? await this.doc.getDestination(item.dest) : item.dest
          if (dest && dest[0]) page = await this.doc.getPageIndex(dest[0])
        } catch {
          page = null
        }
        out.push({ title: item.title, page, children: item.items?.length ? await convert(item.items) : [] })
      }
      return out
    }
    return convert(raw)
  }

  async metadata(): Promise<Record<string, string>> {
    try {
      const meta = await this.doc.getMetadata()
      const info = (meta.info ?? {}) as Record<string, unknown>
      return Object.fromEntries(Object.entries(info).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, String(v)]))
    } catch {
      return {}
    }
  }

  destroy(): void {
    void this.doc.destroy()
    this.pageCache.clear()
    this.textCache.clear()
  }
}

export function normalize(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[آأإٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
}

function snippet(text: string, pos: number, len: number): string {
  const start = Math.max(0, pos - 30)
  const end = Math.min(text.length, pos + len + 30)
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`
}
