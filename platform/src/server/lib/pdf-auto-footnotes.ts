import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { StandardFonts, rgb, type PDFDocument, type PDFFont } from 'pdf-lib'
import { FOOTNOTE_NOTE_PDF_BASE64 } from './footnote-note-asset'
import type { FootnoteSlot } from './pdf-footnotes'
import { stampCacheDir, stampCacheMaxBytes } from './pdf-stamp-cache'

/**
 * أرقام التهميش في ملفات PDF غير المجهّزة (ملفات Word وغيرها) — 27 نوفمبر 2026.
 * الخادم يقرأ مواضع الأسطر من الملف نفسه (pdf.js) ويختار في كل صفحة حتى 4 أسطر تنتهي قبل حافة عمودها
 * (آخر سطر في فقرة أو خانة)، فيضع بعد آخر كلمة فيها رقمًا صغيرًا مرفوعًا خاصًّا بصاحب النسخة، ثم يكتب في
 * أوسع فراغ أسفل الصفحة سطر تهميش: «(51) (95) (82) يُنظر شرح هذه المواضع في الحصّة المسجّلة…».
 * لا يُلمس نص الأستاذ. الصفحة الممسوحة ضوئيًا (بلا نص) أو المملوءة بلا فراغ تبقى بلا أرقام.
 * التخطيط يُحسب مرة لكل ملف (بصمة بايتاته: نحو 70ms للصفحة) ويُحفظ في الذاكرة وعلى القرص بجانب كاش الختم؛
 * الأرقام تختلف لكل تلميذ والأماكن ثابتة. أي تعديل في طريقة الاختيار ⇒ غيّر LAYOUT_VERSION.
 */

export interface AutoNote {
  p: number
  /** الحافة اليمنى لسطر التهميش وخط أساسه */
  xRight: number
  y: number
  ks: number[]
}

export interface AutoFootnoteLayout {
  markers: FootnoteSlot[]
  notes: AutoNote[]
}

interface Item {
  x: number
  y: number
  w: number
  h: number
  str: string
}

/** ما يشغل الصفحة من غير النص: الصور والخطوط والمربعات المرسومة (حدود الجداول، التظليل) */
interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface Line {
  y: number
  xMin: number
  xMax: number
  h: number
  arabic: boolean
  items: Item[]
}

const AR = /[؀-ۿ]/
const MAX_PAGES = 300
const PER_PAGE = 4
const NOTE_SIZE = 10.5
const NOTE_INK = '374151'
const MARK_INK = '1f2937'
/** عرض «(88)» بخط Times Bold نسبةً إلى حجمه — أعرض رقمين ممكنين */
const MARK_EM = 1.667

function linesOf(items: Item[]): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y)
  const lines: Line[] = []
  for (const it of sorted) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(1.5, Math.min(l.h, it.h) * 0.2))
    if (line) {
      line.items.push(it)
      line.xMin = Math.min(line.xMin, it.x)
      line.xMax = Math.max(line.xMax, it.x + it.w)
      line.h = Math.max(line.h, it.h)
      line.arabic ||= AR.test(it.str)
    } else lines.push({ y: it.y, xMin: it.x, xMax: it.x + it.w, h: it.h, arabic: AR.test(it.str), items: [it] })
  }
  return lines
}

const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
/** عرض سطر التهميش تقريبًا: الجملة (226pt) + أربعة أرقام */
const NOTE_WIDTH = 226 + 4 * (MARK_EM * NOTE_SIZE + 3) + 6

function pageLayout(p: number, width: number, height: number, items: Item[], boxes: Box[] = []): { markers: FootnoteSlot[]; note: AutoNote | null } {
  // الخطوط الرفيعة (حدود الخانات) والصور تمنع الرقم؛ التظليل الواسع لا يمنعه (الرقم يُرسم فوقه)
  const thin = boxes.filter((b) => b.x1 - b.x0 < 4 || b.y1 - b.y0 < 4)
  const solid = boxes.filter((b) => (b.x1 - b.x0) * (b.y1 - b.y0) < width * height * 0.5)
  const empty = { markers: [], note: null }
  if (items.length < 6) return empty
  const lines = linesOf(items).filter((l) => l.h >= 6 && l.h <= 30)
  // حافة العمود اليسرى لكل مجموعة أسطر تبدأ من الحافة اليمنى نفسها (نص عربي مضبوط يمينًا)
  const colLeft = (l: Line): number | null => {
    const same = lines.filter((o) => Math.abs(o.xMax - l.xMax) <= 4)
    return same.length >= 2 ? Math.min(...same.map((o) => o.xMin)) : null
  }
  // حجم خط المتن (الوسيط): العناوين الكبيرة لا تأخذ أرقام تهميش
  const sizes = lines.filter((l) => l.arabic).map((l) => l.h).sort((a, b) => a - b)
  const body = sizes[Math.floor(sizes.length / 2)] ?? 12
  const candidates: { line: Line; x: number; y: number; s: number }[] = []
  for (const l of lines) {
    if (!l.arabic || l.h < 8 || l.h > 22 || l.h > body * 1.2) continue
    if (l.y < height * 0.08 || l.y > height * 0.9) continue
    const left = colLeft(l)
    if (left === null) continue
    const s = Math.round(l.h * 0.62 * 10) / 10
    const need = MARK_EM * s + 3
    if (l.xMin - need < left || l.xMin - left < need + 8) continue
    // لا نصّ آخر على السطر نفسه في المكان المختار (خانة مجاورة، كلمة من عمود آخر)
    const blocked = items.some((it) => !l.items.includes(it) && Math.abs(it.y - l.y) < l.h * 0.9 && it.x + it.w > l.xMin - need && it.x < l.xMin)
    if (blocked) continue
    const x = l.xMin - 2 - MARK_EM * s
    const box = { x0: x - 1, y0: l.y + l.h * 0.25, x1: l.xMin - 1, y1: l.y + l.h * 0.33 + s * 0.85 }
    if (thin.some((b) => overlaps(b, box))) continue
    candidates.push({ line: l, x: Math.round((l.xMin - 2 - MARK_EM * s) * 100) / 100, y: Math.round((l.y + l.h * 0.33) * 100) / 100, s })
  }
  if (!candidates.length) return empty
  // حتى 4 أماكن موزّعة على الصفحة من أعلاها إلى أسفلها؛ الترتيب = ترتيب القراءة
  candidates.sort((a, b) => b.line.y - a.line.y || b.line.xMax - a.line.xMax)
  const picked = candidates.length <= PER_PAGE ? candidates : Array.from({ length: PER_PAGE }, (_, i) => candidates[Math.round((i * (candidates.length - 1)) / (PER_PAGE - 1))]!)
  const markers = picked.map((c, k) => ({ p, x: c.x, y: c.y, k, s: c.s, c: MARK_INK }))

  // سطر التهميش: أوسع فراغ في الثلث الأسفل من الصفحة لا نصّ فيه ولا صورة ولا خطّ، على عرض السطر كله
  const xRight = Math.max(...lines.map((l) => l.xMax))
  const band = { x0: xRight - NOTE_WIDTH, x1: xRight }
  const obstacles = [
    ...lines.filter((l) => l.xMin < band.x1 && l.xMax > band.x0).map((l) => ({ top: l.y + l.h * 0.85, bottom: l.y - l.h * 0.3 })),
    ...solid.filter((b) => b.x0 < band.x1 && b.x1 > band.x0).map((b) => ({ top: b.y1, bottom: b.y0 }))
  ].sort((a, b) => a.bottom - b.bottom)
  let note: AutoNote | null = null
  const gaps: { from: number; to: number }[] = []
  let floor = height * 0.03
  for (const o of obstacles) {
    if (o.bottom - floor >= 19 && floor < height * 0.35) gaps.push({ from: floor, to: o.bottom })
    floor = Math.max(floor, o.top)
  }
  const gap = gaps.sort((a, b) => b.to - b.from - (a.to - a.from))[0]
  if (gap && band.x0 > width * 0.03) {
    // تحت آخر المحتوى مباشرة كالتهميش المعتاد، أو في وسط الفراغ إن كان ضيّقًا
    const y = Math.max((gap.from + gap.to) / 2 - NOTE_SIZE * 0.3, gap.to - 14 - NOTE_SIZE)
    note = { p, xRight: Math.round(xRight * 100) / 100, y: Math.round(y * 100) / 100, ks: markers.map((m) => m.k) }
  }
  return { markers, note }
}

type Matrix = [number, number, number, number, number, number]
const mul = (m: Matrix, n: Matrix): Matrix => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]]
function boxOf(m: Matrix, x0: number, y0: number, x1: number, y1: number): Box {
  const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => [m[0] * x! + m[2] * y! + m[4], m[1] * x! + m[3] * y! + m[5]] as const)
  return { x0: Math.min(...pts.map((q) => q[0])), y0: Math.min(...pts.map((q) => q[1])), x1: Math.max(...pts.map((q) => q[0])), y1: Math.max(...pts.map((q) => q[1])) }
}

/** الصور والأشكال المرسومة في الصفحة (بإحداثيات PDF) من قائمة أوامر pdf.js */
async function drawnBoxes(page: { getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }> }): Promise<Box[]> {
  const { getResolvedPDFJS } = await import('unpdf')
  const { OPS } = (await getResolvedPDFJS()) as unknown as { OPS: Record<string, number> }
  const paint = new Set(['fill', 'eoFill', 'stroke', 'fillStroke', 'eoFillStroke', 'closeStroke', 'closeFillStroke', 'closeEOFillStroke'].map((k) => OPS[k]))
  const images = new Set(['paintImageXObject', 'paintInlineImageXObject', 'paintImageMaskXObject'].map((k) => OPS[k]))
  const { fnArray, argsArray } = await page.getOperatorList()
  const boxes: Box[] = []
  const stack: Matrix[] = []
  let ctm: Matrix = [1, 0, 0, 1, 0, 0]
  for (let i = 0; i < fnArray.length; i++) {
    const f = fnArray[i]
    const a = argsArray[i] ?? []
    if (f === OPS.save) stack.push(ctm)
    else if (f === OPS.restore) ctm = stack.pop() ?? ctm
    else if (f === OPS.transform) ctm = mul(a as unknown as Matrix, ctm)
    else if (f === OPS.paintFormXObjectBegin) {
      stack.push(ctm)
      if (Array.isArray(a[0]) && a[0].length === 6) ctm = mul(a[0] as Matrix, ctm)
    } else if (f === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? ctm
    else if (images.has(f!)) boxes.push(boxOf(ctm, 0, 0, 1, 1))
    else if (f === OPS.constructPath && paint.has(a[0] as number)) {
      const mm = a[2] as Record<number, number> | undefined
      if (mm && Number.isFinite(mm[0]) && Number.isFinite(mm[3])) boxes.push(boxOf(ctm, mm[0]!, mm[1]!, mm[2]!, mm[3]!))
    }
  }
  return boxes
}

const cache = new Map<string, AutoFootnoteLayout | null>()
const CACHE_MAX = 300
export const LAYOUT_VERSION = 3

function layoutPath(key: string): string {
  return path.join(stampCacheDir(), 'layouts', `${key}.v${LAYOUT_VERSION}.json`)
}

async function readDisk(key: string): Promise<AutoFootnoteLayout | null | undefined> {
  if (stampCacheMaxBytes() === 0) return undefined
  try {
    const v = JSON.parse(await fs.readFile(layoutPath(key), 'utf8')) as { layout: AutoFootnoteLayout | null }
    return v.layout
  } catch {
    return undefined
  }
}

async function writeDisk(key: string, layout: AutoFootnoteLayout | null): Promise<void> {
  if (stampCacheMaxBytes() === 0) return
  try {
    const file = layoutPath(key)
    await fs.mkdir(path.dirname(file), { recursive: true })
    const tmp = `${file}.${process.pid}.part`
    await fs.writeFile(tmp, JSON.stringify({ layout }))
    await fs.rename(tmp, file)
  } catch {
    // القرص للقراءة فقط أو ممتلئ: يبقى التخطيط في الذاكرة
  }
}

function remember(key: string, layout: AutoFootnoteLayout | null): void {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!)
  cache.set(key, layout)
}

/** تخطيط أرقام التهميش لملف غير مجهّز — يُحسب مرة لكل ملف */
export async function autoFootnoteLayout(bytes: Uint8Array): Promise<AutoFootnoteLayout | null> {
  const key = createHash('sha256').update(bytes).digest('hex')
  if (cache.has(key)) return cache.get(key)!
  const saved = await readDisk(key)
  if (saved !== undefined) {
    remember(key, saved)
    return saved
  }
  let layout: AutoFootnoteLayout | null = null
  try {
    const { getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(bytes))
    const markers: FootnoteSlot[] = []
    const notes: AutoNote[] = []
    for (let i = 1; i <= Math.min(pdf.numPages, MAX_PAGES); i++) {
      const page = await pdf.getPage(i)
      const [x0, y0, x1, y1] = page.view as [number, number, number, number]
      const raw = (await page.getTextContent()).items as { str?: string; transform?: number[]; width?: number; height?: number }[]
      const items = raw
        .filter((t) => t.str?.trim() && t.transform && Number.isFinite(t.width) && Number.isFinite(t.height))
        .map((t) => ({ x: t.transform![4]! - x0, y: t.transform![5]! - y0, w: t.width!, h: t.height!, str: t.str! }))
      const boxes = items.length >= 6 ? (await drawnBoxes(page as never)).map((b) => ({ x0: b.x0 - x0, y0: b.y0 - y0, x1: b.x1 - x0, y1: b.y1 - y0 })) : []
      const r = pageLayout(i - 1, x1 - x0, y1 - y0, items, boxes)
      markers.push(...r.markers.map((m) => ({ ...m, x: m.x + x0, y: m.y + y0 })))
      if (r.note) notes.push({ ...r.note, xRight: r.note.xRight + x0, y: r.note.y + y0 })
    }
    layout = markers.length ? { markers, notes } : null
  } catch {
    layout = null
  }
  remember(key, layout)
  await writeDisk(key, layout)
  return layout
}

export function resetAutoFootnoteCache(): void {
  cache.clear()
}

/** يرسم أسطر التهميش: الأرقام يمينًا بترتيبها ثم الجملة العربية الجاهزة يسارها */
export async function drawAutoNotes(doc: PDFDocument, notes: AutoNote[], numbers: number[], font?: PDFFont): Promise<void> {
  if (!notes.length) return
  const f = font ?? (await doc.embedFont(StandardFonts.TimesRomanBold))
  const [sentence] = await doc.embedPdf(Buffer.from(FOOTNOTE_NOTE_PDF_BASE64, 'base64'))
  const c = parseInt(NOTE_INK, 16)
  const color = rgb(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255)
  const pages = doc.getPages()
  for (const n of notes) {
    const page = pages[n.p]
    if (!page || !sentence) continue
    let cursor = n.xRight
    for (const k of n.ks) {
      const v = numbers[k]
      if (v === undefined) continue
      const t = `(${v})`
      const w = f.widthOfTextAtSize(t, NOTE_SIZE)
      page.drawText(t, { x: cursor - w, y: n.y, size: NOTE_SIZE, font: f, color })
      cursor -= w + 3
    }
    page.drawPage(sentence, { x: cursor - 3 - sentence.width, y: n.y - 4.6 })
  }
}

