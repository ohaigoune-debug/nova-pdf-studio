/**
 * محرك استخراج بيانات الفاتورة من نص PDF (مقاطع بإحداثيات) أو من نتائج OCR:
 * تجميع الأسطر، قراءة المبالغ بصيغ ar/fr/en (1 250,50 · 1,250.50 · ١٢٥٠٫٥٠)، التواريخ، كشف الحقول بالكلمات المفتاحية،
 * كشف جدول البنود، الاستخراج بالمناطق (قوالب)، والتحقق الحسابي بوحدات صحيحة عبر محرك المال.
 */
import { applyBps, divRound, minorToDecimalString, multiplyQuantity, normalizeDigits, parseMinor, parsePercent, parseQuantity, sumMinor } from '@shared/money'
import type { CustomerSnapshot, InvoiceItemInput } from '@shared/invoicing'
import type { ExtractedField, ExtractedInvoice, ExtractedItem, ExtractionDefinition, ExtractionWarning, ItemColumn, Rect, Zone, ZoneColumn, ZoneField } from '@shared/extraction'
import { AMOUNT_FIELDS, DATE_FIELDS } from '@shared/extraction'

export interface Span {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export interface TextLine {
  y: number
  x0: number
  x1: number
  height: number
  spans: Span[]
  text: string     // بترتيب x (بصري)
  textRev: string  // بترتيب معكوس (للعربية المجزّأة إلى مقاطع)
}

// ------------------------------------------------------------------ أرقام ومبالغ
export function normalizeNumberText(raw: string): string {
  return normalizeDigits(raw).replace(/[٫]/g, '.').replace(/[٬']/g, ',').replace(/[  ]/g, ' ')
}

/** يحوّل رمزًا رقميًا بأي فاصل شائع إلى صيغة قياسية "1250.50". */
export function normalizeSeparators(token: string): string {
  let t = token.replace(/\s/g, '')
  const neg = t.startsWith('-')
  if (neg) t = t.slice(1)
  const lc = t.lastIndexOf(',')
  const ld = t.lastIndexOf('.')
  let out: string
  if (lc >= 0 && ld >= 0) {
    const dec = lc > ld ? ',' : '.'
    const thou = dec === ',' ? '.' : ','
    out = t.split(thou).join('').replace(dec, '.')
  } else if (lc >= 0 || ld >= 0) {
    const sep = lc >= 0 ? ',' : '.'
    const parts = t.split(sep)
    const after = parts[parts.length - 1].length
    if (parts.length === 2) out = after === 3 ? parts.join('') : parts.join('.')
    else out = parts.slice(0, -1).join('') + (after === 3 ? parts[parts.length - 1] : `.${parts[parts.length - 1]}`)
  } else out = t
  return (neg ? '-' : '') + out
}

const NUM_TOKEN = /-?\d[\d\s.,]*\d|\d/g

export function numberTokens(raw: string): string[] {
  return normalizeNumberText(raw).match(NUM_TOKEN)?.map((t) => t.trim()) ?? []
}

export function parseAmountText(raw: string, decimals = 2, pick: 'last' | 'first' | 'max' = 'last'): { minor: number; normalized: string } | null {
  // التواريخ (12/05/2026) تُزال قبل قراءة الأرقام حتى لا تُحسب أجزاؤها مبالغ
  const tokens = numberTokens(normalizeNumberText(raw).replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, ' '))
  if (!tokens.length) return null
  const candidates = tokens.map((t) => {
    const normalized = normalizeSeparators(t)
    try {
      return { minor: parseMinor(normalized, decimals), normalized }
    } catch {
      return null
    }
  }).filter((c): c is { minor: number; normalized: string } => !!c)
  if (!candidates.length) return null
  if (pick === 'first') return candidates[0]
  if (pick === 'max') return candidates.reduce((a, b) => (Math.abs(b.minor) > Math.abs(a.minor) ? b : a))
  return candidates[candidates.length - 1]
}

export function parseQtyText(raw: string): number | null {
  const tokens = numberTokens(raw)
  if (!tokens.length) return null
  try {
    const q = parseQuantity(normalizeSeparators(tokens[0]))
    return q > 0 ? q : null
  } catch {
    return null
  }
}

export function parsePercentText(raw: string): number | null {
  const tokens = numberTokens(raw)
  if (!tokens.length) return null
  try {
    const bps = parsePercent(normalizeSeparators(tokens[0]))
    return bps >= 0 && bps <= 10_000 ? bps : null
  } catch {
    return null
  }
}

/** هل النص رقمي محض (كمية/سعر/نسبة) وليس تاريخًا أو رمزًا؟ */
export function isNumericText(text: string): boolean {
  const t = normalizeNumberText(text).trim()
  return t.length > 0 && t.length <= 18 && /\d/.test(t) && /^[-\d\s.,%]+$/.test(t) && !/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(t.replace(/\s/g, ''))
}

// ------------------------------------------------------------------ تواريخ
const MONTHS: Record<string, number> = {
  jan: 1, janv: 1, january: 1, janvier: 1, feb: 2, fév: 2, fev: 2, february: 2, février: 2, fevrier: 2, mar: 3, mars: 3, march: 3, apr: 4, avr: 4, avril: 4, april: 4,
  may: 5, mai: 5, jun: 6, juin: 6, june: 6, jul: 7, juil: 7, juillet: 7, july: 7, aug: 8, août: 8, aout: 8, august: 8, sep: 9, sept: 9, septembre: 9, september: 9,
  oct: 10, octobre: 10, october: 10, nov: 11, novembre: 11, november: 11, dec: 12, déc: 12, décembre: 12, decembre: 12, december: 12,
  'يناير': 1, 'جانفي': 1, 'كانون الثاني': 1, 'فبراير': 2, 'فيفري': 2, 'شباط': 2, 'مارس': 3, 'آذار': 3, 'أبريل': 4, 'ابريل': 4, 'أفريل': 4, 'نيسان': 4, 'مايو': 5, 'ماي': 5, 'أيار': 5,
  'يونيو': 6, 'جوان': 6, 'حزيران': 6, 'يوليو': 7, 'جويلية': 7, 'تموز': 7, 'أغسطس': 8, 'أوت': 8, 'آب': 8, 'سبتمبر': 9, 'أيلول': 9, 'أكتوبر': 10, 'تشرين الأول': 10,
  'نوفمبر': 11, 'تشرين الثاني': 11, 'ديسمبر': 12, 'كانون الأول': 12
}

function monthOf(name: string): number | null {
  const key = name.toLowerCase().replace(/\.$/, '').trim()
  if (MONTHS[key]) return MONTHS[key]
  const latin = key.slice(0, 3)
  return /^[a-zé]+$/.test(key) && MONTHS[latin] ? MONTHS[latin] : null
}

function iso(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export function parseDateText(raw: string): string | null {
  const s = normalizeDigits(raw)
  let m = /(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = /(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/.exec(s)
  if (m) {
    const a = +m[1]
    const b = +m[2]
    let y = +m[3]
    if (y < 100) y += 2000
    const [d, mo] = a <= 12 && b > 12 ? [b, a] : [a, b]
    return iso(y, mo, d)
  }
  m = /(\d{1,2})\s+([^\s\d,.]+(?:\s[^\s\d,.]+)?)\.?,?\s+(\d{4})/u.exec(s)
  if (m) {
    const mo = monthOf(m[2]) ?? monthOf(m[2].split(' ')[0])
    if (mo) return iso(+m[3], mo, +m[1])
  }
  m = /([A-Za-zéû]+)\.?\s+(\d{1,2}),?\s+(\d{4})/.exec(s)
  if (m) {
    const mo = monthOf(m[1])
    if (mo) return iso(+m[3], mo, +m[2])
  }
  return null
}

export function findDateInText(text: string): string | null {
  return parseDateText(text)
}

// ------------------------------------------------------------------ أسطر
const ARABIC = /[؀-ۿ]/

export function groupLines(spans: Span[]): TextLine[] {
  const sorted = spans.filter((s) => s.text.trim()).sort((a, b) => a.y - b.y || a.x - b.x)
  const lines: TextLine[] = []
  for (const s of sorted) {
    const cy = s.y + s.height / 2
    const line = lines.find((l) => Math.abs(l.y + l.height / 2 - cy) < Math.max(2, Math.min(l.height, s.height) * 0.6))
    if (line) {
      line.spans.push(s)
      const bottom = Math.max(line.y + line.height, s.y + s.height)
      line.y = Math.min(line.y, s.y)
      line.height = bottom - line.y
      line.x0 = Math.min(line.x0, s.x)
      line.x1 = Math.max(line.x1, s.x + s.width)
    } else lines.push({ y: s.y, height: s.height, x0: s.x, x1: s.x + s.width, spans: [s], text: '', textRev: '' })
  }
  for (const l of lines) {
    l.spans.sort((a, b) => a.x - b.x)
    // مقاطع رقمية متجاورة بفراغ ضيق (185 | 000,00) هي رقم واحد مقسوم من محرك النص؛ ندمجها
    const merged: Span[] = []
    for (const s of l.spans) {
      const prev = merged[merged.length - 1]
      if (prev && isNumericText(prev.text) && isNumericText(s.text) && s.x - (prev.x + prev.width) <= Math.max(prev.height, s.height) * 0.35) {
        merged[merged.length - 1] = { text: `${prev.text} ${s.text}`, x: prev.x, y: Math.min(prev.y, s.y), width: s.x + s.width - prev.x, height: Math.max(prev.height, s.height) }
      } else merged.push({ ...s })
    }
    l.spans = merged
    const parts = l.spans.map((s) => s.text.trim()).filter(Boolean)
    l.text = parts.join(' ')
    l.textRev = [...parts].reverse().join(' ')
  }
  return lines.sort((a, b) => a.y - b.y)
}

/** يجمع نص الأسطر بالترتيب المنطقي: للعربية المجزأة يُعكس ترتيب المقاطع. */
export function lineLogicalText(line: TextLine): string {
  const arabicCount = line.spans.filter((s) => ARABIC.test(s.text)).length
  return arabicCount > line.spans.length / 2 ? line.textRev : line.text
}

export function spansInRect(spans: Span[], rect: Rect, pageW: number, pageH: number): Span[] {
  const x0 = rect.x * pageW
  const y0 = rect.y * pageH
  const x1 = (rect.x + rect.w) * pageW
  const y1 = (rect.y + rect.h) * pageH
  return spans.filter((s) => {
    const cx = s.x + s.width / 2
    const cy = s.y + s.height / 2
    return cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1
  })
}

export function textInRect(spans: Span[], rect: Rect, pageW: number, pageH: number): string {
  return groupLines(spansInRect(spans, rect, pageW, pageH)).map(lineLogicalText).join('\n')
}

// ------------------------------------------------------------------ كلمات مفتاحية
type FieldKey = Exclude<ZoneField, 'items'>
const SHORT_NUMBER = /(?:^|\s)(?:no\.|n[°º]|رقم)\s*:?\s*([a-z]{0,6}[-/_]?\d{2,}(?:[-/_.]\d+)*)\b/i
const SHORT_NUMBER_REV = /([a-z]{0,6}[-/_]?\d{2,}(?:[-/_.]\d+)*)\s*:?\s*رقم/i
const NOT_INVOICE_NUMBER = /(customer|client|العميل|الزبون|commande|order|t[ée]l|phone|هاتف|fiscal|nif|tax|الجبائي|compte|account|iban|rib)/i

const KW: Record<FieldKey, RegExp> = {
  number: /(رقم\s*الفاتورة|فاتورة\s*رقم|الفاتورة\s*رقم|رقم\s*الوثيقة|facture\s*n[°ºo]?\.?|n[°ºo]\s*(de\s*)?facture|invoice\s*(no\.?|n[°º]|#|number|num)|inv(oice)?\s*#|\bn[°º]\s*:)/i,
  issueDate: /(تاريخ\s*(الإصدار|الفاتورة)|التاريخ|تاريخ\s*:|date\s*(de\s*)?(facturation|d.?émission|of\s*issue|invoice)|date\s*:|émis(e)?\s*le|fait\s*le|issued?\s*(on)?\b|الإصدار)/i,
  dueDate: /(تاريخ\s*الاستحقاق|الاستحقاق|échéance|echeance|due\s*date|payable\s*(avant|le)|à\s*payer\s*avant)/i,
  reference: /(مرجع|المرجع|réf(érence)?\.?\s*:|\bref(erence)?\.?\s*:|bon\s*de\s*commande|purchase\s*order|p\.?o\.?\s*(no|#))/i,
  customerName: /(العميل|الزبون|السادة|المشتري|إلى\s*:|client\s*:?|facturé\s*à|facturer\s*à|destinataire|bill(ed)?\s*to|customer|sold\s*to|\bdoit\b)/i,
  customerPhone: /(هاتف|الهاتف|جوال|tél(éphone)?\.?|\btel\.?\b|phone|mobile|\bgsm\b)/i,
  customerAddress: /(عنوان|العنوان|adresse|address)/i,
  customerTaxId: /(الرقم\s*الجبائي|رقم\s*التعريف\s*الجبائي|\bnif\b|n\.i\.f|tax\s*id|vat\s*(no|number)|matricule\s*fiscal|رقم\s*ضريبي)/i,
  subtotal: /(المجموع\s*(الفرعي|قبل\s*الضريبة)|الفرعي|sous[-\s]?total|total\s*h\.?t\b|montant\s*h\.?t|subtotal|sub\s*total|net\s*h\.?t)/i,
  discount: /(خصم|الخصم|remise|rabais|discount)/i,
  tax: /(ضريبة|الضريبة|القيمة\s*المضافة|ض\.?ق\.?م|t\.?v\.?a\.?|\bvat\b|\btaxe?\b(?!\s*id))/i,
  total: /(المجموع\s*(الكلي|الإجمالي|العام|النهائي)|الإجمالي|المبلغ\s*الإجمالي|صافي\s*(المبلغ|الدفع)|المطلوب\s*دفعه|total\s*t\.?t\.?c|net\s*à\s*payer|montant\s*(total|à\s*payer|ttc)|total\s*(amount|due|général|general)|grand\s*total|amount\s*due|balance\s*due|\btotal\b|المجموع)/i,
  notes: /(ملاحظات|ملاحظة|\bnotes?\b|remarques?|observations?)/i
}

const COL_KW: Record<ItemColumn, RegExp> = {
  ref: /^(réf\.?|ref\.?|référence|reference|code|sku|المرجع|مرجع|الرمز|رمز|n°)$/i,
  description: /(désignation|designation|description|libellé|libelle|article|produit|item|البند|الوصف|البيان|المنتج|الصنف|التعيين|الخدمة)/i,
  qty: /(qté|qte|quantité|quantite|\bqty\b|quantity|الكمية|كمية|العدد)/i,
  unitPrice: /(p\.?u\.?(\s*h\.?t)?|prix\s*(unitaire|unit)|unit\s*price|\bprice\b|سعر|السعر|الثمن)/i,
  discount: /(remise|\brem\.?|disc(ount)?|خصم)/i,
  tax: /(\btva\b|\bvat\b|\btax\b|ضريبة|ض\.?ق\.?م)/i,
  total: /(montant|total|amount|المجموع|الإجمالي|المبلغ)/i
}

function matchesAny(line: TextLine, re: RegExp): boolean {
  return re.test(line.text) || re.test(line.textRev) || line.spans.some((s) => re.test(s.text))
}

/** يصنّف سطر مبلغ: HT/فرعي → subtotal، TVA → tax، خصم → discount، TTC/إجمالي → total. */
export function classifyAmountLine(line: TextLine): 'subtotal' | 'tax' | 'discount' | 'total' | null {
  const t = `${line.text} ${line.textRev}`
  if (/h\.?t\b|فرعي|قبل\s*الضريبة|sous[-\s]?total|sub\s*total|subtotal/i.test(t)) return 'subtotal'
  if (/t\.?t\.?c|الإجمالي|الكلي|النهائي|net\s*à\s*payer|à\s*payer|grand\s*total|amount\s*due|balance\s*due|المطلوب/i.test(t)) return 'total'
  if (/t\.?v\.?a|\bvat\b|ضريبة|مضافة|\btaxe?\b|ض\.?ق\.?م/i.test(t)) return 'tax'
  if (/خصم|remise|rabais|discount/i.test(t)) return 'discount'
  if (matchesAny(line, KW.total)) return 'total'
  return null
}

function afterKeyword(text: string, re: RegExp): string | null {
  const m = re.exec(text)
  if (!m) return null
  const rest = text.slice(m.index + m[0].length).replace(/^[\s:：\-–—.]+/, '').trim()
  return rest || null
}

function numberToken(text: string): string | null {
  const s = normalizeDigits(text).replace(/\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/g, ' ')
  const m = /[A-Z]{0,6}[-/_]?\d{2,}(?:[-/_.]\d+)*/i.exec(s)
  return m ? m[0] : null
}

function field(fieldName: ZoneField, raw: string, value: string, confidence: number, source: ExtractedField['source'] = 'auto'): ExtractedField {
  return { field: fieldName, raw: raw.trim(), value, confidence, source }
}

// ------------------------------------------------------------------ الكشف التلقائي
export function detectFields(lines: TextLine[], decimals = 2): Partial<Record<ZoneField, ExtractedField>> {
  const out: Partial<Record<ZoneField, ExtractedField>> = {}
  const dates: string[] = []
  const totalCandidates: { minor: number; f: ExtractedField }[] = []
  let customerLine = -1
  lines.forEach((line, i) => {
    const text = line.text
    const next = lines[i + 1]
    const cls = classifyAmountLine(line)
    if (cls) {
      const amt = parseAmountText(text, decimals, 'last')
      if (amt) {
        const f = field(cls, text, amt.normalized, 0.75)
        if (cls === 'total') totalCandidates.push({ minor: amt.minor, f })
        else if (!out[cls]) out[cls] = f
      }
    }
    if (!out.number && matchesAny(line, KW.number)) {
      const tok = numberToken(afterKeyword(text, KW.number) ?? afterKeyword(line.textRev, KW.number) ?? '') ?? numberToken(text) ?? (next ? numberToken(next.text) : null)
      if (tok) out.number = field('number', text, tok, 0.8)
    }
    // التسميات القصيرة التي تطبعها قوالب NOVA نفسها وكثير من البرامج: «No. INV-…» / «N° 2026-015» / «رقم …»
    // (بلا lookbehind في التعبير لأن Safari على iOS 16.0–16.3 لا يدعمه)
    if (!out.number && !NOT_INVOICE_NUMBER.test(`${text} ${line.textRev}`)) {
      const short = SHORT_NUMBER.exec(normalizeDigits(text)) ?? SHORT_NUMBER_REV.exec(normalizeDigits(line.textRev))
      if (short) out.number = field('number', text, short[1], 0.6)
    }
    const d = parseDateText(text)
    if (d) {
      // قد يحمل السطر تاريخين (إصدار + استحقاق): نقرأ التاريخ الذي يلي كل كلمة مفتاحية
      const dueAfter = afterKeyword(text, KW.dueDate)
      const dueDate = dueAfter ? parseDateText(dueAfter) : null
      if (matchesAny(line, KW.dueDate) && !out.dueDate && dueDate) out.dueDate = field('dueDate', text, dueDate, 0.8)
      if (matchesAny(line, KW.issueDate) && !out.issueDate) {
        const issueAfter = afterKeyword(text.replace(KW.dueDate, ' '), KW.issueDate)
        const issue = (issueAfter ? parseDateText(issueAfter) : null) ?? (dueDate && dueDate === d ? null : d)
        if (issue) out.issueDate = field('issueDate', text, issue, 0.8)
      }
      dates.push(d)
    } else if (matchesAny(line, KW.dueDate) && next && !out.dueDate) {
      const nd = parseDateText(next.text)
      if (nd) out.dueDate = field('dueDate', next.text, nd, 0.6)
    } else if (matchesAny(line, KW.issueDate) && next && !out.issueDate) {
      const nd = parseDateText(next.text)
      if (nd) out.issueDate = field('issueDate', next.text, nd, 0.6)
    }
    if (!out.customerName && matchesAny(line, KW.customerName)) {
      const after = afterKeyword(lineLogicalText(line), KW.customerName) ?? afterKeyword(text, KW.customerName)
      const candidate = after && !isNumericText(after) ? after : next && !classifyAmountLine(next) && !matchesAny(next, KW.customerPhone) ? lineLogicalText(next) : null
      if (candidate) {
        out.customerName = field('customerName', text, candidate.replace(/^[:\s]+/, ''), after ? 0.7 : 0.5)
        customerLine = i
      }
    }
    if (matchesAny(line, KW.customerPhone)) {
      // هاتف المورّد يسبق كتلة العميل عادةً؛ نفضّل أول هاتف يأتي بعد سطر العميل
      const m = /(\+?\d[\d\s().-]{6,}\d)/.exec(normalizeDigits(text))
      const afterCustomer = customerLine >= 0 && i > customerLine
      if (m && (!out.customerPhone || (afterCustomer && out.customerPhone.confidence < 0.8))) out.customerPhone = field('customerPhone', text, m[1].trim(), afterCustomer ? 0.8 : 0.4)
    }
    if (!out.customerTaxId && matchesAny(line, KW.customerTaxId)) {
      const after = afterKeyword(normalizeDigits(text), KW.customerTaxId)
      const m = after ? /[\dA-Z][\dA-Z/ .-]{4,}/i.exec(after) : null
      if (m) out.customerTaxId = field('customerTaxId', text, m[0].trim(), 0.7)
    }
    if (!out.reference && matchesAny(line, KW.reference) && !matchesAny(line, KW.number)) {
      const after = afterKeyword(text, KW.reference)
      if (after) out.reference = field('reference', text, after.split(/\s{2,}/)[0], 0.6)
    }
  })
  if (totalCandidates.length) {
    // الإجمالي الأكبر بين أسطر "total" هو الأرجح (TTC فوق HT)
    const best = totalCandidates.reduce((a, b) => (b.minor > a.minor ? b : a))
    out.total = best.f
  }
  if (!out.issueDate && dates.length) out.issueDate = field('issueDate', dates[0], dates[0], 0.4)
  return out
}

function columnOfHeaderSpan(text: string): ItemColumn | null {
  const t = text.trim()
  if (!t) return null
  if (COL_KW.ref.test(t)) return 'ref'
  if (COL_KW.qty.test(t)) return 'qty'
  if (COL_KW.unitPrice.test(t)) return 'unitPrice'
  if (COL_KW.discount.test(t)) return 'discount'
  if (COL_KW.tax.test(t)) return 'tax'
  if (COL_KW.total.test(t)) return 'total'
  if (COL_KW.description.test(t)) return 'description'
  return null
}

interface ColumnCenter { column: ItemColumn; x: number }

function headerColumns(line: TextLine): ColumnCenter[] {
  const cols: ColumnCenter[] = []
  for (const s of line.spans) {
    const c = columnOfHeaderSpan(s.text)
    if (c && !cols.some((k) => k.column === c)) cols.push({ column: c, x: s.x + s.width / 2 })
  }
  return cols
}

function nearestColumn(cols: ColumnCenter[], x: number, allowed: ItemColumn[]): ItemColumn | null {
  let best: ColumnCenter | null = null
  for (const c of cols) {
    if (!allowed.includes(c.column)) continue
    if (!best || Math.abs(c.x - x) < Math.abs(best.x - x)) best = c
  }
  return best?.column ?? null
}

function buildItem(cells: Partial<Record<ItemColumn, string>>, raw: string, decimals: number): ExtractedItem | null {
  const name = (cells.description ?? '').trim()
  if (!name) return null
  const qty = cells.qty ? parseQtyText(cells.qty) : null
  const price = cells.unitPrice ? parseAmountText(cells.unitPrice, decimals, 'first') : null
  const total = cells.total ? parseAmountText(cells.total, decimals, 'last') : null
  const quantityMilli = qty ?? 1000
  let unitPriceMinor = price?.minor ?? 0
  if (!price && total) unitPriceMinor = divRound(total.minor * 1000, quantityMilli)
  return {
    name,
    description: (cells.ref ?? '').trim(),
    quantityMilli,
    unitPriceMinor,
    discountBps: cells.discount ? parsePercentText(cells.discount) ?? 0 : 0,
    taxBps: cells.tax ? parsePercentText(cells.tax) ?? 0 : 0,
    totalMinor: total?.minor ?? null,
    raw
  }
}

export function detectItems(lines: TextLine[], decimals = 2): ExtractedItem[] {
  const headerIdx = lines.findIndex((l) => headerColumns(l).length >= 2)
  const cols = headerIdx >= 0 ? headerColumns(lines[headerIdx]) : []
  const start = headerIdx + 1
  const items: ExtractedItem[] = []
  for (let i = start; i < lines.length; i++) {
    const line = lines[i]
    if (classifyAmountLine(line) && line.spans.filter((s) => isNumericText(s.text)).length <= 2) break
    const numeric = line.spans.filter((s) => isNumericText(s.text))
    const textual = line.spans.filter((s) => !isNumericText(s.text))
    if (numeric.length < 2) {
      // سطر وصف تابع للبند السابق
      if (items.length && textual.length && headerIdx >= 0 && !numeric.length) items[items.length - 1].name += ` ${lineLogicalText(line)}`
      continue
    }
    const cells: Partial<Record<ItemColumn, string>> = {}
    const numericCols: ItemColumn[] = ['qty', 'unitPrice', 'discount', 'tax', 'total']
    if (cols.filter((c) => numericCols.includes(c.column)).length >= 2) {
      for (const s of numeric) {
        const c = nearestColumn(cols, s.x + s.width / 2, numericCols)
        if (c && !cells[c]) cells[c] = s.text
      }
      const refCol = cols.find((c) => c.column === 'ref')
      const descParts: string[] = []
      for (const s of textual) {
        if (refCol && Math.abs(s.x + s.width / 2 - refCol.x) < 40 && !cells.ref && /^[A-Z0-9][\w/-]{1,}$/i.test(s.text.trim())) cells.ref = s.text
        else descParts.push(s.text.trim())
      }
      const arabic = descParts.filter((p) => ARABIC.test(p)).length > descParts.length / 2
      cells.description = (arabic ? [...descParts].reverse() : descParts).join(' ')
    } else {
      // بلا رأس معروف: ترتيب شائع كمية · سعر · إجمالي، أو (سعر، إجمالي)
      const values = numeric.map((s) => s.text)
      if (values.length >= 3) {
        cells.qty = values[0]
        cells.unitPrice = values[1]
        cells.total = values[values.length - 1]
      } else {
        const a = parseAmountText(values[0], decimals)
        const b = parseAmountText(values[1], decimals)
        if (a && b && a.minor > 0 && b.minor % a.minor === 0 && b.minor / a.minor <= 100_000 && !normalizeSeparators(values[0]).includes('.')) {
          cells.qty = String(b.minor / a.minor)
          cells.unitPrice = values[0]
          cells.total = values[1]
        } else {
          cells.qty = '1'
          cells.unitPrice = values[0]
          cells.total = values[1]
        }
      }
      const descParts = textual.map((s) => s.text.trim())
      const arabic = descParts.filter((p) => ARABIC.test(p)).length > descParts.length / 2
      const parts = arabic ? [...descParts].reverse() : descParts
      if (parts.length > 1 && /^[A-Z0-9][\w/-]{1,}$/i.test(parts[0]) && !ARABIC.test(parts[0])) cells.ref = parts.shift()
      cells.description = parts.join(' ')
    }
    const item = buildItem(cells, line.text, decimals)
    if (item) items.push(item)
  }
  return items
}

// ------------------------------------------------------------------ الاستخراج بالمناطق
function valueForField(fieldName: FieldKey, raw: string, decimals: number): { value: string; confidence: number } | null {
  if (AMOUNT_FIELDS.includes(fieldName)) {
    const amt = parseAmountText(raw, decimals, fieldName === 'total' ? 'max' : 'last')
    return amt ? { value: amt.normalized, confidence: 0.9 } : null
  }
  if (DATE_FIELDS.includes(fieldName)) {
    const d = parseDateText(raw)
    return d ? { value: d, confidence: 0.9 } : { value: raw.trim(), confidence: 0.3 }
  }
  if (fieldName === 'number') {
    const tok = numberToken(afterKeyword(raw, KW.number) ?? raw) ?? raw.trim()
    return tok ? { value: tok, confidence: 0.85 } : null
  }
  if (fieldName === 'customerPhone') {
    const m = /(\+?\d[\d\s().-]{6,}\d)/.exec(normalizeDigits(raw))
    return m ? { value: m[1].trim(), confidence: 0.9 } : { value: raw.trim(), confidence: 0.4 }
  }
  const stripped = (afterKeyword(raw, KW[fieldName]) ?? raw).trim()
  return stripped ? { value: stripped, confidence: 0.8 } : null
}

/** يقترح أعمدة منطقة البنود من صف العناوين الأول داخلها (حدود الأعمدة عند منتصف المسافات بين العناوين). */
export function detectZoneColumns(spans: Span[], zone: Zone, pageW: number, pageH: number): ZoneColumn[] {
  const lines = groupLines(spansInRect(spans, zone.rect, pageW, pageH))
  if (!lines.length) return []
  const header = lines.find((l) => headerColumns(l).length >= 2) ?? lines[0]
  const cols = headerColumns(header).sort((a, b) => a.x - b.x)
  if (cols.length < 2) return []
  const zx = zone.rect.x * pageW
  const zw = zone.rect.w * pageW
  const out: ZoneColumn[] = []
  for (let i = 0; i < cols.length; i++) {
    const start = i === 0 ? zx : (cols[i - 1].x + cols[i].x) / 2
    const end = i === cols.length - 1 ? zx + zw : (cols[i].x + cols[i + 1].x) / 2
    out.push({ column: cols[i].column, x: Math.max(0, (start - zx) / zw), w: Math.min(1, (end - start) / zw) })
  }
  return out
}

export function itemsFromZone(spans: Span[], zone: Zone, pageW: number, pageH: number, decimals: number): ExtractedItem[] {
  const inside = spansInRect(spans, zone.rect, pageW, pageH)
  let lines = groupLines(inside)
  if (zone.hasHeaderRow) lines = lines.slice(1)
  const zx = zone.rect.x * pageW
  const zw = zone.rect.w * pageW
  const columns = zone.columns ?? []
  const items: ExtractedItem[] = []
  for (const line of lines) {
    const cells: Partial<Record<ItemColumn, string>> = {}
    if (columns.length) {
      for (const col of columns) {
        const x0 = zx + col.x * zw
        const x1 = zx + (col.x + col.w) * zw
        const parts = line.spans.filter((s) => {
          const cx = s.x + s.width / 2
          return cx >= x0 && cx <= x1
        }).map((s) => s.text.trim())
        if (!parts.length) continue
        const arabic = parts.filter((p) => ARABIC.test(p)).length > parts.length / 2
        cells[col.column] = (arabic ? [...parts].reverse() : parts).join(' ')
      }
    } else {
      const numeric = line.spans.filter((s) => isNumericText(s.text)).map((s) => s.text)
      const textual = line.spans.filter((s) => !isNumericText(s.text)).map((s) => s.text.trim())
      if (numeric.length < 2) continue
      cells.description = textual.join(' ')
      cells.qty = numeric.length >= 3 ? numeric[0] : '1'
      cells.unitPrice = numeric.length >= 3 ? numeric[1] : numeric[0]
      cells.total = numeric[numeric.length - 1]
    }
    const item = buildItem(cells, line.text, decimals)
    if (item) items.push(item)
  }
  return items
}

/** هجين: الكشف التلقائي أولًا، ثم المناطق المعرَّفة في القالب تُغلِّب قيمها (والبنود تُستبدل إن وُجدت منطقة بنود). */
export function extractWithDefinition(pages: Span[][], pageSizes: { w: number; h: number }[], def: ExtractionDefinition): ExtractedInvoice {
  const auto = autoExtract(pages, def.decimals)
  const fields: Partial<Record<ZoneField, ExtractedField>> = { ...auto.fields }
  let items: ExtractedItem[] = []
  const hasItemsZone = def.zones.some((z) => z.field === 'items')
  for (const zone of def.zones) {
    const spans = pages[zone.page] ?? []
    const size = pageSizes[zone.page] ?? { w: def.pageWidthPt, h: def.pageHeightPt }
    if (zone.field === 'items') {
      items = items.concat(itemsFromZone(spans, zone, size.w, size.h, def.decimals))
      continue
    }
    const raw = textInRect(spans, zone.rect, size.w, size.h)
    if (!raw.trim()) continue
    const v = valueForField(zone.field, raw, def.decimals)
    if (v) fields[zone.field] = field(zone.field, raw, v.value, v.confidence, 'zone')
  }
  return finalize(fields, hasItemsZone ? items : auto.items, auto.pageText, def.decimals)
}

export function autoExtract(pages: Span[][], decimals = 2): ExtractedInvoice {
  const first = groupLines(pages[0] ?? [])
  const fields = detectFields(first, decimals)
  let items = detectItems(first, decimals)
  for (let p = 1; p < pages.length && items.length; p++) items = items.concat(detectItems(groupLines(pages[p]), decimals))
  const pageText = pages.map((p) => groupLines(p).map(lineLogicalText).join('\n')).join('\n\n')
  return finalize(fields, items, pageText, decimals)
}

// ------------------------------------------------------------------ التحقق
export function itemTotalMinor(it: Pick<ExtractedItem, 'quantityMilli' | 'unitPriceMinor' | 'discountBps' | 'taxBps'>): number {
  const base = multiplyQuantity(it.quantityMilli, it.unitPriceMinor)
  const net = base - applyBps(base, it.discountBps)
  return net + applyBps(net, it.taxBps)
}

/** إن كانت البنود بلا ضريبة والمستند يحمل ضريبة إجمالية، نستنتج النسبة (مثل 19%) ونطبّقها على البنود. */
export function inferItemTax(items: ExtractedItem[], subtotalMinor: number | null, taxMinor: number | null): ExtractedItem[] {
  if (!items.length || items.some((it) => it.taxBps > 0) || !subtotalMinor || taxMinor === null || taxMinor <= 0) return items
  const rate = Math.round((taxMinor * 10_000) / subtotalMinor)
  const snapped = Math.round(rate / 25) * 25 // نسب الضرائب تكون عادةً بمضاعفات 0.25%
  if (snapped <= 0 || snapped > 5000) return items
  return items.map((it) => ({ ...it, taxBps: snapped }))
}

function finalize(fields: Partial<Record<ZoneField, ExtractedField>>, rawItems: ExtractedItem[], pageText: string, decimals: number): ExtractedInvoice {
  const warnings: ExtractionWarning[] = []
  const minorOf = (f?: ExtractedField) => {
    if (!f) return null
    try {
      return parseMinor(f.value, decimals)
    } catch {
      return null
    }
  }
  const subtotal = minorOf(fields.subtotal)
  const tax = minorOf(fields.tax)
  const discount = minorOf(fields.discount) ?? 0
  const total = minorOf(fields.total)
  const items = inferItemTax(rawItems, subtotal, tax)
  const computed = sumMinor(items.map(itemTotalMinor))
  if (!items.length) warnings.push({ code: 'no_items' })
  else {
    const tolerance = items.length + 2
    const reference = subtotal ?? total
    const matchesSubtotal = subtotal !== null && Math.abs(subtotal - computed) <= tolerance
    const matchesTotal = total !== null && Math.abs(total - computed) <= tolerance
    if (reference !== null && !matchesSubtotal && !matchesTotal) {
      warnings.push({ code: 'items_total_mismatch', params: { computed: minorToDecimalString(computed, decimals), extracted: minorToDecimalString(reference, decimals) } })
    }
  }
  if (subtotal !== null && tax !== null && total !== null && Math.abs(subtotal - discount + tax - total) > 2) warnings.push({ code: 'total_mismatch' })
  if (total === null) warnings.push({ code: 'missing_total' })
  if (!fields.number) warnings.push({ code: 'missing_number' })
  if (!fields.customerName) warnings.push({ code: 'missing_customer' })
  for (const f of [fields.issueDate, fields.dueDate]) if (f && !/^\d{4}-\d{2}-\d{2}$/.test(f.value)) warnings.push({ code: 'date_unparsed', params: { raw: f.raw } })
  return { fields, items, warnings, computedItemsTotalMinor: computed, pageText }
}

// ------------------------------------------------------------------ القوالب
export function normalizeForMatch(text: string): string {
  return normalizeDigits(text).normalize('NFKC').replace(/[ً-ْـ]/g, '').replace(/[آأإٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').toLowerCase()
}

export function templateScore(pageText: string, keywords: string[]): number {
  if (!keywords.length) return 0
  const hay = normalizeForMatch(pageText)
  const found = keywords.filter((k) => hay.includes(normalizeForMatch(k))).length
  return found / keywords.length
}

const STOP = /^(facture|invoice|فاتورة|date|total|client|tva|ttc|montant|page|tél|tel|email|www|http|https|com|the|and|des|les|pour|avec|من|إلى|على|رقم|تاريخ)$/i

export function suggestKeywords(lines: TextLine[], max = 8): string[] {
  const out: string[] = []
  for (const line of lines.slice(0, 8)) {
    for (const raw of lineLogicalText(line).split(/\s+/)) {
      const tok = raw.replace(/[^\p{L}\p{N}&'.-]/gu, '')
      if (tok.length < 4 || /^\d+$/.test(tok) || STOP.test(tok) || out.includes(tok)) continue
      out.push(tok)
      if (out.length >= max) return out
    }
  }
  return out
}

// ------------------------------------------------------------------ إلى فاتورة
export interface PrefillHeader {
  reference: string
  issueDate?: string
  dueDate?: string
  notes: string
  customerSnapshot: CustomerSnapshot | null
  source: 'pdf_import'
}

export function toInvoicePrefill(inv: ExtractedInvoice, defaults: { taxBps: number; taxName: string }): { header: PrefillHeader; items: InvoiceItemInput[] } {
  const f = inv.fields
  const isoDate = (v?: ExtractedField) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v.value) ? v.value : undefined)
  const customerName = f.customerName?.value.trim()
  return {
    header: {
      reference: f.number?.value ?? f.reference?.value ?? '',
      issueDate: isoDate(f.issueDate),
      dueDate: isoDate(f.dueDate),
      notes: f.notes?.value ?? '',
      customerSnapshot: customerName ? { displayName: customerName, companyName: customerName, phone: f.customerPhone?.value, address: f.customerAddress?.value, taxId: f.customerTaxId?.value } : null,
      source: 'pdf_import'
    },
    items: inv.items.map((it) => ({
      name: it.name,
      description: it.description,
      quantityMilli: it.quantityMilli,
      unitPriceMinor: it.unitPriceMinor,
      discountBps: it.discountBps,
      taxBps: it.taxBps || defaults.taxBps,
      taxName: it.taxBps ? `${it.taxBps / 100}%` : defaults.taxName,
      productId: null
    }))
  }
}
