/**
 * تحويل نصّ السؤال (نصّ عادي مع $…$ للمعادلات و**غامق**) إلى HTML آمن للطباعة.
 * KaTeX يُنفَّذ في الخادم: لا سكربت في صفحة الطباعة ولا CDN (CSP صارم)، والخطوط مستضافة معنا.
 */
import katex from 'katex'
import type { StudioBlock } from '@/lib/exam-blocks'
import { geometrySvg } from '@/lib/geometry'
import { plotSvg } from '@/lib/graph'
import { VARIATION_CSS, variationTableHtml } from '@/lib/variation-table'

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
  // يُخلط المرقّم فقط (التمارين والأسئلة)؛ العناوين والفقرات والأشكال والتعليمات تبقى في مواضعها
  const shuffled = groups.flatMap((g) => {
    if (g.length === 1 && g[0]!.kind === 'PAGE_BREAK') return g
    const graded = g.filter((it) => it.kind === 'EXERCISE' || it.kind === 'QUESTION')
    const mixed = shuffleWith(graded, seedOf(examId, variant, salt++))
    let k = 0
    return g.map((it) => (it.kind === 'EXERCISE' || it.kind === 'QUESTION' ? mixed[k++]! : it))
  })
  return shuffled.map((it, i) => {
    const s = it.snapshot
    const shuffleOpts = (opts?: { label: string; isCorrect: boolean }[], k = 0) => (opts && opts.length > 1 ? shuffleWith(opts, seedOf(examId, variant, 1000 + i * 10 + k)) : opts)
    return { ...it, snapshot: { ...s, options: shuffleOpts(s.options), children: s.children?.map((c, k) => ({ ...c, options: shuffleOpts(c.options, k + 1) })) } }
  })
}

/* ------------------------------ كتل الاستوديو ------------------------------ */

export interface RenderContext {
  /** روابط موقّعة للصور بمعرّف الملف */
  assets?: Record<string, string>
}

const alignStyle = (a?: string) => (a && a !== 'start' ? ` style="text-align:${a === 'end' ? 'end' : a}"` : '')

/** كتلة منظّمة ← HTML للطباعة والمعاينة (كل النصوص مهرَّبة؛ المعادلات بـKaTeX في الخادم) */
export function renderBlock(b: StudioBlock, ctx: RenderContext = {}): string {
  switch (b.type) {
    case 'HEADING': {
      const tag = b.level === 1 ? 'h2' : b.level === 3 ? 'h4' : 'h3'
      return `<${tag} class="blk blk-heading lvl-${b.level ?? 2}"${alignStyle(b.align)} dir="auto">${inline(b.text)}</${tag}>`
    }
    case 'PARAGRAPH':
      return `<div class="blk blk-paragraph size-${b.size ?? 'normal'}"${alignStyle(b.align)}${b.dir && b.dir !== 'auto' ? ` dir="${b.dir}"` : ''}>${renderBody(b.text)}</div>`
    case 'EQUATION':
      return `<div class="blk blk-equation">${b.label ? `<span class="eq-label">${escapeHtml(b.label)}</span>` : ''}${math(b.latex, true)}${b.caption ? `<p class="caption" dir="auto">${inline(b.caption)}</p>` : ''}</div>`
    case 'GRAPH': {
      const r = plotSvg(b.graph)
      return `<figure class="blk blk-figure"${alignStyle(b.align ?? 'center')}>${r.svg}${b.caption ? `<figcaption dir="auto">${inline(b.caption)}</figcaption>` : ''}${r.errors.length ? `<p class="fig-error">${escapeHtml(r.errors.join(' · '))}</p>` : ''}</figure>`
    }
    case 'GEOMETRY': {
      const r = geometrySvg(b.figure)
      return `<figure class="blk blk-figure"${alignStyle(b.align ?? 'center')}>${r.svg}${b.caption ? `<figcaption dir="auto">${inline(b.caption)}</figcaption>` : ''}</figure>`
    }
    case 'TABLE': {
      const cols = Math.max(...b.rows.map((r) => r.length))
      const rows = b.rows
        .map((row, ri) => {
          const cells = Array.from({ length: cols }, (_, ci) => {
            const v = row[ci] ?? ''
            const th = (b.headerRow && ri === 0) || (b.headerCol && ci === 0)
            return `<${th ? 'th' : 'td'} dir="auto">${inline(v)}</${th ? 'th' : 'td'}>`
          })
          return `<tr>${cells.join('')}</tr>`
        })
        .join('')
      return `<div class="blk blk-table"${alignStyle(b.align ?? 'center')}>${b.caption ? `<p class="caption" dir="auto">${inline(b.caption)}</p>` : ''}<table class="tbl borders-${b.borders ?? 'all'}"${b.width ? ` style="width:${b.width}%"` : ''}><tbody>${rows}</tbody></table></div>`
    }
    case 'VARIATION_TABLE':
      return `<div class="blk blk-vt">${variationTableHtml(b.table, (s) => (/[\\^_]/.test(s) ? math(s, false) : escapeHtml(s)))}${b.caption ? `<p class="caption" dir="auto">${inline(b.caption)}</p>` : ''}</div>`
    case 'POETRY': {
      const head = [b.poet, b.title].filter(Boolean).length ? `<p class="poem-head">${[b.title ? `«${escapeHtml(b.title)}»` : '', b.poet ? escapeHtml(b.poet) : '', b.meter ? `(${escapeHtml(b.meter)})` : ''].filter(Boolean).join(' — ')}</p>` : ''
      const verses = b.verses.map((v, i) => `<tr><td class="n">${i + 1}</td><td class="sadr">${inline(v.sadr)}</td><td class="gap"></td><td class="ajz">${inline(v.ajz)}</td></tr>`).join('')
      return `<div class="blk blk-poem" dir="rtl">${head}<table class="poem"><tbody>${verses}</tbody></table>${b.source ? `<p class="caption">${escapeHtml(b.source)}</p>` : ''}${b.notes ? `<div class="poem-notes">${renderBody(b.notes)}</div>` : ''}</div>`
    }
    case 'IMAGE': {
      const src = ctx.assets?.[b.fileId]
      const w = b.widthPercent ?? 60
      return `<figure class="blk blk-image"${alignStyle(b.align ?? 'center')}>${src ? `<img src="${escapeHtml(src)}" alt="${escapeHtml(b.alt ?? '')}" style="width:${w}%">` : `<div class="img-missing" style="width:${w}%">[صورة]</div>`}${b.caption ? `<figcaption dir="auto">${inline(b.caption)}</figcaption>` : ''}</figure>`
    }
    case 'ANSWER_SPACE': {
      const style = b.style ?? 'lines'
      const h = style === 'blank' || style === 'box' ? b.lines * 7.5 : b.lines * 7.5
      return `<div class="blk blk-answer ${style}" style="height:${h}mm">${b.label ? `<span class="answer-label">${escapeHtml(b.label)}</span>` : ''}</div>`
    }
    case 'SEPARATOR': {
      const style = b.style ?? 'line'
      if (style === 'space') return `<div class="blk blk-space" style="height:${b.size ?? 6}mm"></div>`
      return `<hr class="blk blk-sep ${style}" style="margin:${(b.size ?? 4) / 2}mm 0">`
    }
    case 'NOTE':
      return `<div class="blk blk-note ${b.style ?? 'box'}" dir="auto">${b.title ? `<p class="note-title">${escapeHtml(b.title)}</p>` : ''}${renderBody(b.text)}</div>`
  }
}

export function renderFigures(figures: StudioBlock[] | undefined, ctx: RenderContext = {}): string {
  if (!figures?.length) return ''
  return `<div class="figures">${figures.map((f) => renderBlock(f, ctx)).join('')}</div>`
}

/** هل في الكتل/الأشكال ما يحتاج KaTeX؟ */
export function blocksHaveMath(blocks: (StudioBlock | undefined)[]): boolean {
  return blocks.some((b) => b && (b.type === 'EQUATION' || b.type === 'VARIATION_TABLE' || ((b.type === 'PARAGRAPH' || b.type === 'NOTE' || b.type === 'HEADING') && /\$[^$]+\$/.test(b.text)) || (b.type === 'TABLE' && b.rows.some((r) => r.some((c) => /\$[^$]+\$/.test(c)))) || (b.type === 'POETRY' && b.verses.some((v) => /\$[^$]+\$/.test(v.sadr + v.ajz)))))
}

/** CSS الكتل: يُدرج في صفحة الطباعة ومعاينة الاستوديو معاً */
export const BLOCK_CSS = `
.blk { margin: 0 0 3mm; }
.blk-heading { margin: 3mm 0 1.5mm; font-weight: 700; }
.blk-heading.lvl-1 { font-size: 1.25em; border-bottom: 1.5px solid #000; padding-bottom: 1mm; }
.blk-heading.lvl-2 { font-size: 1.12em; }
.blk-heading.lvl-3 { font-size: 1em; text-decoration: underline; }
.blk-paragraph p { margin: 0 0 1.5mm; }
.blk-paragraph.size-small { font-size: 0.88em; }
.blk-paragraph.size-large { font-size: 1.15em; }
.blk-equation { text-align: center; position: relative; margin: 2mm 0; }
.blk-equation .eq-label { position: absolute; inset-inline-end: 0; top: 50%; transform: translateY(-50%); font-size: 0.85em; color: #333; }
.blk-figure { margin: 2mm auto; text-align: center; page-break-inside: avoid; break-inside: avoid; }
.blk-figure svg { max-width: 100%; height: auto; }
.blk-figure figcaption, .caption { font-size: 0.85em; color: #333; margin: 1mm 0 0; text-align: center; }
.fig-error { color: #b3261e; font-size: 0.8em; }
.blk-table .tbl { border-collapse: collapse; margin: 1mm auto; }
.blk-table .tbl td, .blk-table .tbl th { padding: 1mm 3mm; text-align: center; vertical-align: middle; }
.blk-table .tbl.borders-all td, .blk-table .tbl.borders-all th { border: 1px solid #000; }
.blk-table .tbl.borders-outer { border: 1px solid #000; }
.blk-table .tbl th { background: #f2f2f2; font-weight: 700; }
.blk-poem .poem { margin: 1mm auto; border-collapse: collapse; }
.blk-poem .poem td { padding: 0.6mm 2mm; white-space: nowrap; }
.blk-poem .poem .n { font-size: 0.75em; color: #666; width: 6mm; }
.blk-poem .poem .gap { width: 10mm; }
.blk-poem .poem .sadr, .blk-poem .poem .ajz { font-size: 1.05em; }
.blk-poem .poem-head { font-weight: 700; text-align: center; margin: 0 0 1mm; }
.blk-poem .poem-notes { font-size: 0.85em; margin-top: 1.5mm; }
.blk-answer { position: relative; margin: 1.5mm 0 3mm; }
.blk-answer.lines { background: repeating-linear-gradient(to bottom, transparent 0, transparent 7.5mm, #999 7.5mm, #999 calc(7.5mm + 1px)); }
.blk-answer.grid { background-image: linear-gradient(#ccc 1px, transparent 1px), linear-gradient(90deg, #ccc 1px, transparent 1px); background-size: 5mm 5mm; border: 1px solid #999; }
.blk-answer.box { border: 1px solid #000; }
.blk-answer .answer-label { position: absolute; top: -4mm; inset-inline-start: 0; font-size: 0.8em; color: #555; }
.blk-sep.line { border: 0; border-top: 1px solid #000; }
.blk-sep.dots { border: 0; border-top: 1.5px dotted #000; }
.blk-note { padding: 2mm 3mm; margin: 2mm 0; font-size: 0.95em; }
.blk-note.box { border: 1px solid #000; }
.blk-note.warning { border: 1.5px solid #000; background: #f6f6f6; }
.blk-note.quote { border-inline-start: 3px solid #000; padding-inline-start: 4mm; font-style: italic; }
.blk-note .note-title { font-weight: 700; margin: 0 0 1mm; }
.blk-note p { margin: 0; }
.blk-image img { max-width: 100%; height: auto; }
.img-missing { display: inline-block; border: 1px dashed #999; padding: 6mm; color: #777; }
.figures { margin: 1.5mm 0; }
${VARIATION_CSS}
`
