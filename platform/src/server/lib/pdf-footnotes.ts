import { PDFDict, PDFHexString, PDFName, PDFString, StandardFonts, rgb, type PDFDocument } from 'pdf-lib'

/**
 * أماكن «أرقام التهميش» في ملف PDF (27 نوفمبر 2026) — انظر leakFootnotesOf في leak-ref.ts.
 *
 * كيف يُصنع الدرس الجاهز للبصمة:
 * 1) في HTML الدرس يوضع مكان كل رقم تهميش (في النص وفي قائمة التهميشات أسفله) عنصرٌ فارغ بعرض الرقم،
 *    بداخله «وسم» بخط 1px لا يُرى:
 *      <sup class="mdz-fn"><span>mdzfn0s93c1f2937</span></sup>        ← في النص
 *      <span class="mdz-fn"><span>mdzfn0s109c374151</span></span>     ← في قائمة التهميشات
 *    .mdz-fn{display:inline-block;width:1.75em;direction:ltr;text-align:left}
 *    .mdz-fn>span{font-size:1px;color:#fff}
 *    الوسم: mdzfn + رقم الترتيب (0…7) + s + حجم الخط بالنقطة×10 + c + لون الرقم (hex).
 * 2) يُطبع HTML إلى PDF (Chromium)، ثم: npm run lessons:fingerprint -- in.pdf out.pdf
 *    يقرأ الأداة الوسوم ومواضعها ويكتبها في بيانات الملف (MdzFootnotes). هذا الملف هو الذي يُرفع.
 * 3) عند فتح التلميذ للملف يرسم stampPdf أرقامه في تلك الأماكن، ويحذف MdzFootnotes من نسخته.
 */
export const FOOTNOTE_SLOTS_KEY = 'MdzFootnotes'
const TOKEN_RE = /mdzfn(\d)s(\d{2,3})c([0-9a-f]{6})/gi
const MAX_SLOTS = 64

export interface FootnoteSlot {
  /** رقم الصفحة من 0 */
  p: number
  /** خط الأساس بنقاط PDF من أسفل يسار الصفحة */
  x: number
  y: number
  /** ترتيب الرقم في الدرس (0…7): يتكرّر في النص وفي قائمة التهميشات */
  k: number
  /** حجم الخط بالنقطة */
  s: number
  /** لون الرقم hex بلا # */
  c: string
}

function infoDict(doc: PDFDocument, create: boolean): PDFDict | null {
  if (create) return (doc as unknown as { getInfoDict(): PDFDict }).getInfoDict()
  const ref = doc.context.trailerInfo.Info
  if (!ref) return null
  const d = doc.context.lookup(ref)
  return d instanceof PDFDict ? d : null
}

function validSlot(v: unknown, pages: number): v is FootnoteSlot {
  const s = v as FootnoteSlot
  return (
    !!s &&
    Number.isInteger(s.p) && s.p >= 0 && s.p < pages &&
    Number.isFinite(s.x) && Number.isFinite(s.y) &&
    Number.isInteger(s.k) && s.k >= 0 && s.k < 8 &&
    Number.isFinite(s.s) && s.s >= 3 && s.s <= 40 &&
    typeof s.c === 'string' && /^[0-9a-f]{6}$/i.test(s.c)
  )
}

export function readFootnoteSlots(doc: PDFDocument): FootnoteSlot[] | null {
  const v = infoDict(doc, false)?.get(PDFName.of(FOOTNOTE_SLOTS_KEY))
  if (!(v instanceof PDFString || v instanceof PDFHexString)) return null
  try {
    const parsed = JSON.parse(v.decodeText()) as { v?: number; slots?: unknown[] }
    const pages = doc.getPageCount()
    const slots = (parsed.slots ?? []).filter((s) => validSlot(s, pages)).slice(0, MAX_SLOTS)
    return slots.length ? slots : null
  } catch {
    return null
  }
}

export function writeFootnoteSlots(doc: PDFDocument, slots: FootnoteSlot[]): void {
  infoDict(doc, true)!.set(PDFName.of(FOOTNOTE_SLOTS_KEY), PDFHexString.fromText(JSON.stringify({ v: 1, slots })))
}

export function clearFootnoteSlots(doc: PDFDocument): void {
  infoDict(doc, false)?.delete(PDFName.of(FOOTNOTE_SLOTS_KEY))
}

/** يرسم «(51)» في كل مكان بخط Times Bold (الأرقام اللاتينية لا تحتاج تشكيلًا) */
export async function drawFootnotes(doc: PDFDocument, slots: FootnoteSlot[], numbers: number[]): Promise<void> {
  const font = await doc.embedFont(StandardFonts.TimesRomanBold)
  const pages = doc.getPages()
  for (const s of slots) {
    const n = numbers[s.k]
    const page = pages[s.p]
    if (n === undefined || !page) continue
    const c = parseInt(s.c, 16)
    page.drawText(`(${n})`, { x: s.x, y: s.y, size: s.s, font, color: rgb(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255) })
  }
}

/** للأداة: يقرأ الوسوم من نص الصفحات ومواضعها (pdf.js يعطي المواضع بنقاط PDF) */
export async function findFootnoteTokens(bytes: Uint8Array): Promise<FootnoteSlot[]> {
  const { getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const slots: FootnoteSlot[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const items = (await (await pdf.getPage(i)).getTextContent()).items as { str?: string; transform?: number[] }[]
    for (const item of items) {
      if (!item.str || !item.transform) continue
      for (const m of item.str.matchAll(TOKEN_RE)) {
        slots.push({ p: i - 1, x: Math.round(item.transform[4]! * 100) / 100, y: Math.round(item.transform[5]! * 100) / 100, k: Number(m[1]), s: Number(m[2]) / 10, c: m[3]!.toLowerCase() })
      }
    }
  }
  return slots
}
