/**
 * الكتابة اليدوية (إصبع / Apple Pencil): خطوط متجهية حقيقية تُدمج في الصفحة عند الحفظ (ليست صورة).
 * الإحداثيات بالنقاط من أعلى-يسار الصفحة غير المدوّرة — نفس نظام طبقة التعديل الأصلية (editModel).
 */
import { LineCapStyle, PDFDocument, rgb } from 'pdf-lib'
import { hexToRgb01 } from '@modules/pdf/shared/editModel'

export interface InkStroke {
  id: string
  page: number
  points: [number, number][]
  color: string
  width: number
  opacity: number
}

/** يحوّل النقاط إلى مسار SVG ناعم (منحنيات تربيعية عبر نقاط المنتصف). */
export function strokeToSvgPath(points: [number, number][]): string {
  if (points.length === 0) return ''
  const f = (n: number) => Number(n.toFixed(2))
  if (points.length === 1) {
    const [x, y] = points[0]
    return `M ${f(x)} ${f(y)} L ${f(x + 0.01)} ${f(y + 0.01)}`
  }
  let d = `M ${f(points[0][0])} ${f(points[0][1])}`
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    d += ` Q ${f(x)} ${f(y)} ${f((x + nx) / 2)} ${f((y + ny) / 2)}`
  }
  const last = points[points.length - 1]
  d += ` L ${f(last[0])} ${f(last[1])}`
  return d
}

/** يخفف النقاط المتقاربة جدًا (أقل من minDist نقطة) لتصغير حجم الملف دون فقد الشكل. */
export function simplify(points: [number, number][], minDist = 0.6): [number, number][] {
  if (points.length < 3) return points
  const out: [number, number][] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1]
    const [x, y] = points[i]
    if (Math.hypot(x - px, y - py) >= minDist) out.push(points[i])
  }
  out.push(points[points.length - 1])
  return out
}

export async function applyInk(bytes: Uint8Array, strokes: InkStroke[]): Promise<Uint8Array> {
  if (strokes.length === 0) return bytes
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const count = doc.getPageCount()
  for (const s of strokes) {
    if (s.page < 0 || s.page >= count || s.points.length === 0) continue
    const page = doc.getPage(s.page)
    const [r, g, b] = hexToRgb01(s.color)
    page.drawSvgPath(strokeToSvgPath(simplify(s.points)), {
      x: 0,
      y: page.getHeight(),
      borderColor: rgb(r, g, b),
      borderWidth: s.width,
      borderOpacity: s.opacity,
      borderLineCap: LineCapStyle.Round
    })
  }
  doc.setModificationDate(new Date())
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}
