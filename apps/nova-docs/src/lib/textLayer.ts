/**
 * النص العربي (وغير اللاتيني) المضاف بالمحرر يُرسم صورةً (pdf-lib لا يشكّل الحروف) فلم يكن قابلًا للبحث أو النسخ.
 * هنا نضيف فوقه طبقة نص خفية بالمحرك نفسه المستعمل لـ OCR (addInvisibleTextLayer): الشكل يبقى صورة دقيقة،
 * والنص يصبح قابلًا للبحث والتحديد في أي قارئ PDF.
 */
import { PDFDocument } from 'pdf-lib'
import { addInvisibleTextLayer, type TextLayerPage } from '@modules/ocr/renderer/searchablePdf'
import { isStandardFontSafe, type EditObject, type TextObject } from '@modules/pdf/shared/editModel'
import { displaySize, normalizeRotation } from '@modules/pdf/shared/pageSpace'

export async function addSearchableTextForObjects(bytes: Uint8Array, objects: EditObject[], arabicFont: Uint8Array | null): Promise<Uint8Array> {
  const texts = objects.filter((o): o is TextObject => o.kind === 'text' && !!o.text.trim() && !isStandardFontSafe(o.text) && !o.rotation)
  if (!texts.length || !arabicFont) return bytes
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const byPage = new Map<number, TextLayerPage>()
  for (const o of texts) {
    if (o.page >= doc.getPageCount()) continue
    const page = doc.getPage(o.page)
    // إحداثيات العرض (كما في المحرر): الصفحة المدوّرة تُعالج بمصفوفة داخل addInvisibleTextLayer
    const turn = normalizeRotation(page.getRotation().angle)
    const { width, height } = displaySize(turn, page.getSize().width, page.getSize().height)
    const entry = byPage.get(o.page) ?? { index: o.page, spans: [], pageWidthPt: width, pageHeightPt: height }
    const lineHeight = o.fontSize * 1.25
    o.text.split('\n').forEach((line, i) => {
      if (!line.trim()) return
      entry.spans.push({ text: line, x: o.x, y: o.y + i * lineHeight, width: o.width, height: o.fontSize, fontSize: o.fontSize, dir: /[\u0600-\u06FF]/.test(line) ? 'rtl' : 'ltr', fontName: 'NotoNaskhArabic' })
    })
    byPage.set(o.page, entry)
  }
  if (!byPage.size) return bytes
  return addInvisibleTextLayer(bytes, [...byPage.values()], arabicFont, { coordinateSpace: 'display' })
}
