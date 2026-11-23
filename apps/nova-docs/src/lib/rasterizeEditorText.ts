/**
 * نسخة iOS من rasterizeText (Windows): نفس الرسم تمامًا، لكن بخط المحرّر المختار (fontName) بعد التأكد من تحميله.
 */
import { resolveDirection, wrapLines } from '@modules/pdf/renderer/rasterizeText'
import type { RasterizedText } from '@modules/pdf/shared/applyEdits'
import type { TextObject } from '@modules/pdf/shared/editModel'
import { editorCssFont, ensureFontLoaded } from './editorFonts'

export async function rasterizeEditorText(o: TextObject, scale = 3): Promise<RasterizedText> {
  await ensureFontLoaded(o)
  const font = editorCssFont(o, scale)
  const lineHeight = o.fontSize * 1.25
  const widthPx = Math.max(1, Math.ceil(o.width * scale))
  const measure = document.createElement('canvas').getContext('2d')!
  measure.font = font
  const lines = wrapLines(measure, o.text, widthPx)
  const heightPt = Math.max(o.height, lines.length * lineHeight)
  const heightPx = Math.ceil(heightPt * scale)
  const canvas = document.createElement('canvas')
  canvas.width = widthPx
  canvas.height = heightPx
  const ctx = canvas.getContext('2d')!
  if (o.background) {
    ctx.fillStyle = o.background
    ctx.fillRect(0, 0, widthPx, heightPx)
  }
  ctx.font = font
  ctx.fillStyle = o.color
  ctx.textBaseline = 'alphabetic'
  ctx.direction = resolveDirection(o)
  const align = o.align
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
  const x = align === 'center' ? widthPx / 2 : align === 'right' ? widthPx : 0
  lines.forEach((line, i) => {
    const baseline = (o.fontSize + i * lineHeight) * scale
    ctx.fillText(line, x, baseline)
    if (o.underline) {
      const w = ctx.measureText(line).width
      const startX = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x
      ctx.fillRect(startX, baseline + 2 * scale, w, Math.max(1, (o.fontSize / 14) * scale))
    }
  })
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('rasterizeEditorText: toBlob failed')
  return { png: new Uint8Array(await blob.arrayBuffer()), widthPt: o.width, heightPt }
}
