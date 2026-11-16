/**
 * التعليقات: ملاحظات PDF حقيقية (Text annotations / «Sticky notes») تظهر في Preview وAcrobat وFiles،
 * وتحتفظ بنص التعليق والكاتب والتاريخ — وليست رسمًا فوق الصفحة.
 */
import { PDFDocument, PDFHexString, PDFName, PDFNumber, PDFString } from 'pdf-lib'
import { hexToRgb01 } from '@modules/pdf/shared/editModel'

export interface NoteAnnotation {
  id: string
  page: number
  x: number          // نقاط من اليسار
  y: number          // نقاط من الأعلى
  text: string
  author?: string
  color?: string
}

export const NOTE_SIZE = 22

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
}

export async function addNoteAnnotations(bytes: Uint8Array, notes: NoteAnnotation[]): Promise<Uint8Array> {
  const valid = notes.filter((n) => n.text.trim())
  if (valid.length === 0) return bytes
  const doc = await PDFDocument.load(bytes, { updateMetadata: false })
  const now = pdfDate(new Date())
  for (const n of valid) {
    if (n.page < 0 || n.page >= doc.getPageCount()) continue
    const page = doc.getPage(n.page)
    const h = page.getHeight()
    const [r, g, b] = hexToRgb01(n.color ?? '#F5C518')
    const annot = doc.context.obj({
      Type: 'Annot',
      Subtype: 'Text',
      Rect: [n.x, h - n.y - NOTE_SIZE, n.x + NOTE_SIZE, h - n.y],
      Contents: PDFHexString.fromText(n.text),
      T: PDFHexString.fromText(n.author ?? 'NOVA Docs'),
      Name: 'Comment',
      C: [r, g, b],
      F: 4,
      Open: false,
      M: PDFString.of(now),
      CreationDate: PDFString.of(now)
    })
    annot.set(PDFName.of('CA'), PDFNumber.of(1))
    page.node.addAnnot(doc.context.register(annot))
  }
  return doc.save({ useObjectStreams: true, addDefaultPage: false })
}
