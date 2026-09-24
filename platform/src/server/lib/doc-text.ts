/**
 * نصّ مستند من بايتاته: PDF (ذو نصّ لا مصوّر)، Word (docx)، نص عادي.
 * مشترك بين ملفات المنصة المرفوعة وملفات Google Drive.
 */
import { fixArabicPdfOrder } from './arabic-pdf'

export const TEXT_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  text: 'text/plain'
} as const

/** ما يُستخرج نصّه. صيغ أوفيس القديمة (.doc و.ppt) ثنائية مغلقة: تُرفع وتُنزَّل لكن لا تُقرأ */
export function isTextExtractable(mime: string): boolean {
  return mime === TEXT_MIME.pdf || mime === TEXT_MIME.docx || mime === TEXT_MIME.pptx || mime.startsWith('text/plain')
}

/** نصّ عرض PowerPoint: فقرات كل شريحة بالترتيب (الملف أرشيف XML) */
async function pptxText(bytes: Uint8Array): Promise<string> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(bytes)
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)![1]) - Number(/(\d+)\.xml$/.exec(b)![1]))
  const out: string[] = []
  for (const name of slides) {
    const xml = await zip.file(name)!.async('string')
    const paras = [...xml.matchAll(/<a:p\b[\s\S]*?<\/a:p>/g)].map((p) => [...p[0].matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join('')).filter((x) => x.trim())
    if (paras.length) out.push(paras.join('\n'))
  }
  return out
    .join('\n\n')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
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
  if (mime === TEXT_MIME.pptx) return cleanText(await pptxText(bytes))
  if (mime === TEXT_MIME.docx) {
    const mammoth = await import('mammoth')
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) })
    return cleanText(value)
  }
  return ''
}
