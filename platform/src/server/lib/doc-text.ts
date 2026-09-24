/**
 * نصّ مستند من بايتاته: PDF (ذو نصّ لا مصوّر)، Word (docx)، نص عادي.
 * مشترك بين ملفات المنصة المرفوعة وملفات Google Drive.
 */
import { fixArabicPdfOrder } from './arabic-pdf'

export const TEXT_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  text: 'text/plain'
} as const

export function isTextExtractable(mime: string): boolean {
  return mime === TEXT_MIME.pdf || mime === TEXT_MIME.docx || mime.startsWith('text/plain')
}

/**
 * نصوص PDF العربية تخرج غالباً بأشكال العرض (ﻻ، ﺍ…) — NFKC يعيدها حروفاً عادية
 * فيفهمها النموذج ويعمل عليها البحث.
 */
export function cleanText(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/\u0000/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export async function extractDocText(bytes: Uint8Array, mime: string): Promise<string> {
  if (mime.startsWith('text/plain')) return cleanText(new TextDecoder().decode(bytes))
  if (mime === TEXT_MIME.pdf) {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(bytes)
    const { text } = await extractText(pdf, { mergePages: true })
    return cleanText(fixArabicPdfOrder(text.normalize('NFKC')))
  }
  if (mime === TEXT_MIME.docx) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return cleanText(value)
  }
  return ''
}
