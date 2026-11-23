/**
 * دمج طبقة التعديل في ملف PDF فعلي (pdf-lib).
 *
 * - الأشكال والإبراز والتنقيح تُرسم كرسومات متجهية أصلية.
 * - النص اللاتيني يُكتب بخطوط PDF القياسية (نص حقيقي قابل للبحث).
 * - النص العربي/غير اللاتيني: pdf-lib لا يشكّل الحروف، لذلك يُرسم عبر `rasterizeText` (Canvas في الواجهة)
 *   ويُدمج كصورة PNG عالية الدقة تحافظ على الشكل الصحيح للحروف والاتجاه.
 * - الصور تُدمج كما هي (PNG/JPEG).
 *
 * الإحداثيات في النموذج من أعلى-يسار؛ pdf-lib من أسفل-يسار، فنحوّل y.
 */
import { concatTransformationMatrix, degrees, PDFDocument, type PDFFont, type PDFPage, popGraphicsState, pushGraphicsState, rgb, StandardFonts } from 'pdf-lib'
import { displaySize, displayToUserMatrix, normalizeRotation } from './pageSpace'
import { AppError } from '@shared/errors'
import { type EditLayer, type EditObject, type FontFamily, hexToRgb01, isStandardFontSafe, type TextObject } from './editModel'

export interface RasterizedText {
  png: Uint8Array
  widthPt: number
  heightPt: number
}

/** ترسم نصًا إلى PNG بمقاس النقاط المطلوب (تُنفَّذ في الواجهة عبر Canvas). */
export type TextRasterizer = (object: TextObject, scale: number) => Promise<RasterizedText>

export interface ApplyOptions {
  rasterizeText?: TextRasterizer
  rasterScale?: number     // بكسل لكل نقطة عند رسم النص كصورة (3 ≈ 216 DPI)
  /**
   * 'unrotated' (الافتراضي، سلوك Windows): الإحداثيات على الصفحة غير المدوّرة.
   * 'display' (iOS): الإحداثيات كما تُعرض الصفحة المدوّرة (/Rotate) على الشاشة؛ تُحوَّل بمصفوفة لكل صفحة
   * فيبقى النص والأشكال في مكانها وبالاتجاه الصحيح كما رآها المستخدم.
   */
  coordinateSpace?: 'unrotated' | 'display'
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.includes(',') ? b64.slice(b64.indexOf(',') + 1) : b64
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(clean, 'base64'))
  const bin = atob(clean)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function fontFor(doc: PDFDocument, cache: Map<string, PDFFont>, family: FontFamily, bold: boolean, italic: boolean): Promise<PDFFont> {
  const key = `${family}-${bold}-${italic}`
  const cached = cache.get(key)
  if (cached) return cached
  const table: Record<FontFamily, [StandardFonts, StandardFonts, StandardFonts, StandardFonts]> = {
    sans: [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique, StandardFonts.HelveticaBoldOblique],
    serif: [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic, StandardFonts.TimesRomanBoldItalic],
    mono: [StandardFonts.Courier, StandardFonts.CourierBold, StandardFonts.CourierOblique, StandardFonts.CourierBoldOblique]
  }
  const variants = table[family]
  const chosen = bold && italic ? variants[3] : bold ? variants[1] : italic ? variants[2] : variants[0]
  const font = await doc.embedFont(chosen)
  cache.set(key, font)
  return font
}

/** يلفّ النص اللاتيني على أسطر ضمن عرض الكائن. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = []
  for (const paragraph of text.split(/\r?\n/)) {
    const words = paragraph.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) line = candidate
      else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

function drawLatinText(page: PDFPage, o: TextObject, font: PDFFont, pageHeight: number): void {
  const [r, g, b] = hexToRgb01(o.color)
  const lineHeight = o.fontSize * 1.25
  const lines = wrapText(o.text, font, o.fontSize, Math.max(1, o.width))
  if (o.background) {
    const [br, bg, bb] = hexToRgb01(o.background)
    page.drawRectangle({ x: o.x, y: pageHeight - o.y - o.height, width: o.width, height: o.height, color: rgb(br, bg, bb) })
  }
  lines.forEach((line, i) => {
    const textWidth = font.widthOfTextAtSize(line, o.fontSize)
    const x = o.align === 'center' ? o.x + (o.width - textWidth) / 2 : o.align === 'right' ? o.x + o.width - textWidth : o.x
    const baseline = pageHeight - o.y - o.fontSize - i * lineHeight
    page.drawText(line, { x, y: baseline, size: o.fontSize, font, color: rgb(r, g, b) })
    if (o.underline) {
      page.drawLine({ start: { x, y: baseline - 2 }, end: { x: x + textWidth, y: baseline - 2 }, thickness: Math.max(0.5, o.fontSize / 14), color: rgb(r, g, b) })
    }
  })
}

export async function applyEdits(bytes: Uint8Array, layer: EditLayer, options: ApplyOptions = {}): Promise<Uint8Array> {
  let doc: PDFDocument
  try {
    doc = await PDFDocument.load(bytes, { updateMetadata: false })
  } catch (error) {
    throw new AppError('PDF_CORRUPTED', undefined, undefined, String(error))
  }
  const fonts = new Map<string, PDFFont>()
  const pageCount = doc.getPageCount()

  // نرسم بترتيب الكائنات (الأقدم أسفل)، لكن التنقيح أولًا ثم الإبراز ثم البقية حتى لا يغطي الأبيض نصًا جديدًا
  const order = (o: EditObject) => (o.kind === 'redact' ? 0 : o.kind === 'highlight' ? 1 : 2)
  const objects = [...layer.objects].sort((a, b) => order(a) - order(b))

  const wrapped = new Set<number>()
  for (const o of objects) {
    if (o.page < 0 || o.page >= pageCount) continue
    const page = doc.getPage(o.page)
    const size = page.getSize()
    const turn = options.coordinateSpace === 'display' ? normalizeRotation(page.getRotation().angle) : 0
    const pageHeight = displaySize(turn, size.width, size.height).height
    if (turn && !wrapped.has(o.page)) {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...displayToUserMatrix(turn, size.width, size.height)))
      wrapped.add(o.page)
    }
    const yBottom = pageHeight - o.y - o.height
    const rotate = o.rotation ? degrees(o.rotation) : undefined

    switch (o.kind) {
      case 'redact': {
        const [r, g, b] = hexToRgb01(o.color)
        page.drawRectangle({ x: o.x, y: yBottom, width: o.width, height: o.height, color: rgb(r, g, b), rotate })
        break
      }
      case 'highlight': {
        const [r, g, b] = hexToRgb01(o.color)
        page.drawRectangle({ x: o.x, y: yBottom, width: o.width, height: o.height, color: rgb(r, g, b), opacity: o.opacity, rotate })
        break
      }
      case 'rect': {
        const [sr, sg, sb] = hexToRgb01(o.stroke)
        const fill = o.fill ? hexToRgb01(o.fill) : null
        page.drawRectangle({
          x: o.x, y: yBottom, width: o.width, height: o.height, borderColor: rgb(sr, sg, sb), borderWidth: o.strokeWidth,
          color: fill ? rgb(fill[0], fill[1], fill[2]) : undefined, opacity: o.opacity, borderOpacity: o.opacity, rotate
        })
        break
      }
      case 'ellipse': {
        const [sr, sg, sb] = hexToRgb01(o.stroke)
        const fill = o.fill ? hexToRgb01(o.fill) : null
        page.drawEllipse({
          x: o.x + o.width / 2, y: yBottom + o.height / 2, xScale: o.width / 2, yScale: o.height / 2,
          borderColor: rgb(sr, sg, sb), borderWidth: o.strokeWidth, color: fill ? rgb(fill[0], fill[1], fill[2]) : undefined, opacity: o.opacity, borderOpacity: o.opacity
        })
        break
      }
      case 'line': {
        const [sr, sg, sb] = hexToRgb01(o.stroke)
        page.drawLine({ start: { x: o.x, y: pageHeight - o.y }, end: { x: o.x + o.width, y: pageHeight - (o.y + o.height) }, thickness: o.strokeWidth, color: rgb(sr, sg, sb), opacity: o.opacity })
        break
      }
      case 'check': {
        const [sr, sg, sb] = hexToRgb01(o.stroke)
        // علامة صح بخطّين داخل الصندوق
        const x0 = o.x + o.width * 0.15
        const y0 = pageHeight - (o.y + o.height * 0.55)
        const x1 = o.x + o.width * 0.4
        const y1 = pageHeight - (o.y + o.height * 0.8)
        const x2 = o.x + o.width * 0.85
        const y2 = pageHeight - (o.y + o.height * 0.2)
        page.drawLine({ start: { x: x0, y: y0 }, end: { x: x1, y: y1 }, thickness: o.strokeWidth, color: rgb(sr, sg, sb), opacity: o.opacity })
        page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: o.strokeWidth, color: rgb(sr, sg, sb), opacity: o.opacity })
        break
      }
      case 'image': {
        const data = base64ToBytes(o.dataBase64)
        const embedded = o.mime === 'image/png' ? await doc.embedPng(data) : await doc.embedJpg(data)
        page.drawImage(embedded, { x: o.x, y: yBottom, width: o.width, height: o.height, opacity: o.opacity, rotate })
        break
      }
      case 'text': {
        if (!o.text.trim()) break
        if (isStandardFontSafe(o.text)) {
          const font = await fontFor(doc, fonts, o.fontFamily, o.bold, o.italic)
          drawLatinText(page, o, font, pageHeight)
        } else {
          if (!options.rasterizeText) throw new AppError('PDF_UNSUPPORTED', 'errors.pdf.text_raster_unavailable')
          const raster = await options.rasterizeText(o, options.rasterScale ?? 3)
          const embedded = await doc.embedPng(raster.png)
          page.drawImage(embedded, { x: o.x, y: pageHeight - o.y - raster.heightPt, width: raster.widthPt, height: raster.heightPt, rotate })
        }
        break
      }
    }
  }

  for (const index of wrapped) doc.getPage(index).pushOperators(popGraphicsState())
  doc.setModificationDate(new Date())
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}
