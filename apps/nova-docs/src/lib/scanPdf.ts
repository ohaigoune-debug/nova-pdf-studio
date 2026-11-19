/** تحويل صفحات المسح إلى PDF: كل صورة صفحة كاملة بعرض A4 (595 نقطة) وارتفاع يتبع نسبة الصورة. */
import { PDFDocument } from 'pdf-lib'

export const SCAN_PAGE_WIDTH = 595.28

export async function scanImagesToPdf(pages: { jpeg: Uint8Array; width: number; height: number }[], title?: string): Promise<{ bytes: Uint8Array; sizes: { w: number; h: number }[] }> {
  const doc = await PDFDocument.create()
  const sizes: { w: number; h: number }[] = []
  for (const p of pages) {
    const img = await doc.embedJpg(p.jpeg)
    const w = SCAN_PAGE_WIDTH
    const h = (SCAN_PAGE_WIDTH * p.height) / p.width
    const page = doc.addPage([w, h])
    page.drawImage(img, { x: 0, y: 0, width: w, height: h })
    sizes.push({ w, h })
  }
  if (title) doc.setTitle(title)
  doc.setCreator('NOVA Docs')
  doc.setProducer('NOVA Docs')
  return { bytes: await doc.save({ useObjectStreams: true }), sizes }
}
