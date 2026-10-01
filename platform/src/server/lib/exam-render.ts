/**
 * تحويل نصّ السؤال (نصّ عادي مع $…$ للمعادلات و**غامق**) إلى HTML آمن للطباعة.
 * KaTeX يُنفَّذ في الخادم: لا سكربت في صفحة الطباعة ولا CDN (CSP صارم)، والخطوط مستضافة معنا.
 */
import katex from 'katex'

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function math(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, throwOnError: false, output: 'html', strict: 'ignore' })
  } catch {
    return `<code>${escapeHtml(tex)}</code>`
  }
}

/** سطر واحد: معادلات ثم غامق؛ كل ما عداهما نصّ مهرَّب */
function inline(line: string): string {
  const parts: string[] = []
  // $$…$$ (معروض) و $…$ (ضمن السطر) — بلا تداخل
  const re = /\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g
  let last = 0
  for (const m of line.matchAll(re)) {
    parts.push(bold(escapeHtml(line.slice(last, m.index))))
    parts.push(m[1] !== undefined ? math(m[1], true) : math(m[2]!, false))
    last = m.index! + m[0].length
  }
  parts.push(bold(escapeHtml(line.slice(last))))
  return parts.join('')
}

const bold = (s: string) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

/** فقرات: سطر فارغ يفصل الفقرات، وسطر واحد = <br> */
export function renderBody(text: string): string {
  const paragraphs = text.replace(/\r/g, '').trim().split(/\n{2,}/)
  return paragraphs.map((p) => `<p dir="auto">${p.split('\n').map(inline).join('<br>')}</p>`).join('')
}

/** هل في النصّ معادلة؟ (لتحميل CSS الخاص بـKaTeX عند الحاجة فقط) */
export const hasMath = (texts: (string | null | undefined)[]): boolean => texts.some((t) => t && /\$[^$]+\$/.test(t))

/** ترقيم أبجدي للاختيارات: أ، ب، ج، د… */
export const ARABIC_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و', 'ز', 'ح']

/** مدة بالعربية: 180 ← «3 سا»، 90 ← «1 سا و30 د» */
export function durationAr(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} د`
  return m ? `${h} سا و${m} د` : `${h} سا`
}

/** مفتاح الإجابة نصّاً لورقة التصحيح */
export function answerKeyText(type: string | undefined, key: Record<string, unknown> | null | undefined, options?: { label: string; isCorrect: boolean }[]): string | null {
  if (type === 'MCQ' || type === 'IMAGE') {
    const correct = (options ?? []).map((o, i) => (o.isCorrect ? `${ARABIC_LETTERS[i] ?? i + 1}) ${o.label}` : null)).filter(Boolean)
    return correct.length ? correct.join('، ') : null
  }
  if (!key) return null
  if (type === 'TRUE_FALSE' && typeof key.value === 'boolean') return key.value ? 'صحيح' : 'خطأ'
  if (Array.isArray(key.accepted)) return (key.accepted as string[]).join(' / ')
  if (Array.isArray(key.blanks)) return (key.blanks as string[][]).map((b, i) => `(${i + 1}) ${b.join(' / ')}`).join(' · ')
  if (Array.isArray(key.pairs)) return (key.pairs as { left: string; right: string }[]).map((p) => `${p.left} ← ${p.right}`).join('، ')
  return null
}

/* ------------------------------ النسخ A/B/C/D ------------------------------ */

export const VARIANTS = ['A', 'B', 'C', 'D'] as const
export type Variant = (typeof VARIANTS)[number]

/** مولّد عشوائي حتمي (mulberry32): نفس الحرف ⇒ نفس الترتيب دائماً، فتتطابق ورقة التصحيح */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffleWith<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  const r = rng(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

const seedOf = (examId: string, variant: Variant, salt: number) => {
  let h = 2166136261 ^ (VARIANTS.indexOf(variant) + 1) ^ (salt * 7919)
  for (const ch of examId) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  return h >>> 0
}

/**
 * النسخة A هي الأصل؛ B/C/D تخلط ترتيب العناصر المرقّمة (داخل كل صفحة، فواصل الصفحات ثابتة)
 * وترتيب اختيارات MCQ، بنفس الصعوبة والنقاط. الحلّ والسلّم يتبعان الخلط نفسه.
 */
export function applyVariant<T extends { kind: string; snapshot: { options?: { label: string; isCorrect: boolean }[]; children?: { options?: { label: string; isCorrect: boolean }[] }[] } }>(items: T[], examId: string, variant: Variant): T[] {
  if (variant === 'A') return items
  const groups: T[][] = [[]]
  for (const it of items) {
    if (it.kind === 'PAGE_BREAK') groups.push([it], [])
    else groups[groups.length - 1]!.push(it)
  }
  let salt = 0
  const shuffled = groups.flatMap((g) => (g.length === 1 && g[0]!.kind === 'PAGE_BREAK' ? g : shuffleWith(g, seedOf(examId, variant, salt++))))
  return shuffled.map((it, i) => {
    const s = it.snapshot
    const shuffleOpts = (opts?: { label: string; isCorrect: boolean }[], k = 0) => (opts && opts.length > 1 ? shuffleWith(opts, seedOf(examId, variant, 1000 + i * 10 + k)) : opts)
    return { ...it, snapshot: { ...s, options: shuffleOpts(s.options), children: s.children?.map((c, k) => ({ ...c, options: shuffleOpts(c.options, k + 1) })) } }
  })
}
