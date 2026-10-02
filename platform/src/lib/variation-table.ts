/** جدول تغيّرات/إشارة ← HTML (الخلايا تُصيَّر بدالة خارجية كي لا يعتمد الملف على KaTeX) */
import type { VariationTable } from './exam-blocks'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function variationTableHtml(t: VariationTable, cell: (s: string) => string = esc): string {
  const n = t.xs.length
  const colspan = 2 * n - 1
  const head = `<tr><th class="vt-var">${cell(t.variable ?? 'x')}</th>${t.xs.map((x, i) => `<th class="vt-x"${i < n - 1 ? ' colspan="2"' : ''}>${cell(x)}</th>`).join('')}</tr>`
  let sign = ''
  if (t.sign) {
    const cells: string[] = []
    for (let i = 0; i < n; i++) {
      const mark = t.sign.marks?.[i] ?? ''
      cells.push(`<td class="vt-mark${mark === '||' ? ' vt-bar' : ''}">${mark === '||' ? '' : esc(mark)}</td>`)
      if (i < n - 1) cells.push(`<td class="vt-sign">${esc(t.sign.signs[i] === '-' ? '−' : (t.sign.signs[i] ?? ''))}</td>`)
    }
    sign = `<tr><th class="vt-var">${cell(t.sign.label ?? "f'(x)")}</th>${cells.join('')}</tr>`
  }
  const vcells: string[] = []
  for (let i = 0; i < n; i++) {
    const v = t.variation.values[i] ?? ''
    // موضع القيمة: أعلى إن كان السهم قبلها صاعداً أو بعدها هابطاً
    const before = t.variation.arrows[i - 1]
    const after = t.variation.arrows[i]
    const top = before === 'up' || (before == null && after === 'down') || (before === 'flat' && after === 'down')
    const bottom = before === 'down' || (before == null && after === 'up') || (before === 'flat' && after === 'up')
    vcells.push(`<td class="vt-val ${top ? 'vt-top' : bottom ? 'vt-bottom' : 'vt-mid'}">${v ? cell(v) : ''}</td>`)
    if (i < n - 1) {
      const a = t.variation.arrows[i] ?? ''
      vcells.push(`<td class="vt-arrow">${a === 'up' ? '<span class="vt-up">➚</span>' : a === 'down' ? '<span class="vt-down">➘</span>' : a === 'flat' ? '<span class="vt-flat">➝</span>' : ''}</td>`)
    }
  }
  const variation = `<tr class="vt-variation"><th class="vt-var">${cell(t.variation.label ?? 'f(x)')}</th>${vcells.join('')}</tr>`
  void colspan
  return `<table class="vt" dir="ltr"><tbody>${head}${sign}${variation}</tbody></table>`
}

export const VARIATION_CSS = `
.vt { border-collapse: collapse; margin: 2mm auto; font-family: 'Times New Roman', serif; font-size: 12pt; direction: ltr; }
.vt th, .vt td { border: 1px solid #000; padding: 1mm 2.5mm; text-align: center; min-width: 9mm; }
.vt .vt-var { background: #f2f2f2; font-style: italic; text-align: center; min-width: 14mm; }
.vt .vt-x { font-style: italic; }
.vt .vt-mark, .vt .vt-val { border-left: none; border-right: none; }
.vt .vt-sign, .vt .vt-arrow { border-left: none; border-right: none; }
.vt .vt-bar { background: linear-gradient(to right, transparent 45%, #000 45%, #000 55%, transparent 55%); }
.vt .vt-variation td { height: 14mm; vertical-align: middle; }
.vt .vt-top { vertical-align: top; }
.vt .vt-bottom { vertical-align: bottom; }
.vt .vt-arrow { font-size: 22pt; line-height: 1; }
.vt .vt-up { display: inline-block; transform: translateY(-1mm); }
.vt .vt-down { display: inline-block; transform: translateY(1mm); }
`
