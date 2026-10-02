/**
 * تصدير ورقة الامتحان إلى Word (.docx) بالعربية من اليمين إلى اليسار.
 * المعادلات تُكتب نصّاً خطّياً (f(x) = eˣ − x) والمنحنيات/الأشكال الهندسية تُشار إليها بنصّ (الشكل الكامل في PDF)؛
 * الجداول والشعر والصور والأسئلة الفرعية والاختيارات تُصدَّر كاملة.
 */
import { AlignmentType, BorderStyle, Document, ImageRun, Packer, PageBreak, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, convertMillimetersToTwip } from 'docx'
import { resolveLayout, type StudioBlock } from '@/lib/exam-blocks'
import { itemPoints } from '@/lib/exam-points'
import { bodyToText, latexToText } from '@/lib/latex-text'
import { markingSummary } from '@/lib/marking'
import type { ExamItemSnapshot } from '@/server/db/schema'
import type { ExamView } from '@/server/services/exams.service'
import { ARABIC_LETTERS, answerKeyText, durationAr } from './exam-render'

export type DocxMode = 'subject' | 'correction' | 'marking'

const FONT = 'Amiri'
const rtl = { bidirectional: true as const }

function runs(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): TextRun[] {
  const out: TextRun[] = []
  const parts = text.split(/(\*\*.+?\*\*)/g)
  for (const p of parts) {
    if (!p) continue
    const bold = p.startsWith('**') && p.endsWith('**')
    const t = bold ? p.slice(2, -2) : p
    out.push(new TextRun({ text: t, bold: opts.bold || bold, size: opts.size, color: opts.color, font: FONT, rightToLeft: true }))
  }
  return out
}

/** نصّ بمعادلات وفقرات ← فقرات Word */
function paragraphsOf(text: string, opts: { bold?: boolean; size?: number; color?: string; indent?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spacingAfter?: number } = {}): Paragraph[] {
  const plain = bodyToText(text)
  return plain
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map(
      (p) =>
        new Paragraph({
          ...rtl,
          alignment: opts.align ?? AlignmentType.RIGHT,
          indent: opts.indent ? { start: convertMillimetersToTwip(opts.indent) } : undefined,
          spacing: { after: opts.spacingAfter ?? 80, line: 320 },
          children: p.split('\n').flatMap((line, i) => (i ? [new TextRun({ break: 1 }), ...runs(line, opts)] : runs(line, opts)))
        })
    )
}

const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const cell = (text: string, opts: { bold?: boolean; width?: number; shade?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) =>
  new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shade ? { fill: 'F2F2F2' } : undefined,
    children: [new Paragraph({ ...rtl, alignment: opts.align ?? AlignmentType.CENTER, children: runs(bodyToText(text), { bold: opts.bold }) })]
  })

function blockParagraphs(b: StudioBlock, assets: Map<string, { data: Uint8Array; type: 'png' | 'jpg' }>): (Paragraph | Table)[] {
  switch (b.type) {
    case 'HEADING':
      return paragraphsOf(b.text, { bold: true, size: b.level === 1 ? 30 : b.level === 3 ? 24 : 27, align: b.align === 'center' ? AlignmentType.CENTER : AlignmentType.RIGHT, spacingAfter: 120 })
    case 'PARAGRAPH':
      return paragraphsOf(b.text, { size: b.size === 'small' ? 22 : b.size === 'large' ? 28 : undefined, align: b.align === 'center' ? AlignmentType.CENTER : b.align === 'justify' ? AlignmentType.JUSTIFIED : AlignmentType.RIGHT })
    case 'EQUATION':
      return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 120 }, children: [new TextRun({ text: latexToText(b.latex), font: 'Cambria Math', size: 26 }), ...(b.label ? [new TextRun({ text: `   (${b.label})`, font: FONT })] : [])] }), ...(b.caption ? paragraphsOf(b.caption, { size: 20, align: AlignmentType.CENTER }) : [])]
    case 'GRAPH':
      return paragraphsOf(`[منحنى: ${b.graph.functions.map((f) => (f.label ? `${f.label}: ` : '') + latexToText(f.expr)).join(' ، ')} — انظر نسخة PDF للشكل]${b.caption ? `\n${b.caption}` : ''}`, { color: '555555', size: 22, align: AlignmentType.CENTER })
    case 'GEOMETRY':
      return paragraphsOf(`[شكل هندسي: ${b.figure.points.map((p) => p.label ?? p.id).join(' ')} — انظر نسخة PDF للشكل]${b.caption ? `\n${b.caption}` : ''}`, { color: '555555', size: 22, align: AlignmentType.CENTER })
    case 'TABLE': {
      const cols = Math.max(...b.rows.map((r) => r.length))
      const t = new Table({
        alignment: AlignmentType.CENTER,
        width: { size: b.width ?? 90, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: true,
        borders: b.borders === 'none' ? { top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }, insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } } : { top: border, bottom: border, left: border, right: border, insideHorizontal: b.borders === 'outer' ? { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } : border, insideVertical: b.borders === 'outer' ? { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } : border },
        rows: b.rows.map((row, ri) => new TableRow({ children: Array.from({ length: cols }, (_, ci) => cell(row[ci] ?? '', { bold: Boolean((b.headerRow && ri === 0) || (b.headerCol && ci === 0)), shade: Boolean((b.headerRow && ri === 0) || (b.headerCol && ci === 0)) })) }))
      })
      return [...(b.caption ? paragraphsOf(b.caption, { size: 22, align: AlignmentType.CENTER }) : []), t, new Paragraph({ spacing: { after: 80 } })]
    }
    case 'VARIATION_TABLE': {
      const t = b.table
      const n = t.xs.length
      const rows: TableRow[] = [new TableRow({ children: [cell(t.variable ?? 'x', { bold: true, shade: true }), ...t.xs.map((x) => cell(latexToText(x), { bold: true }))] })]
      if (t.sign) rows.push(new TableRow({ children: [cell(latexToText(t.sign.label ?? "f'(x)"), { bold: true, shade: true }), ...Array.from({ length: n }, (_, i) => cell(`${t.sign!.marks?.[i] === '0' ? '0 ' : t.sign!.marks?.[i] === '||' ? '‖ ' : ''}${i < n - 1 ? (t.sign!.signs[i] === '-' ? '−' : (t.sign!.signs[i] ?? '')) : ''}`))] }))
      rows.push(new TableRow({ children: [cell(latexToText(t.variation.label ?? 'f(x)'), { bold: true, shade: true }), ...Array.from({ length: n }, (_, i) => cell(`${latexToText(t.variation.values[i] ?? '')}${i < n - 1 ? (t.variation.arrows[i] === 'up' ? '  ↗' : t.variation.arrows[i] === 'down' ? '  ↘' : t.variation.arrows[i] === 'flat' ? '  →' : '') : ''}`))] }))
      return [new Table({ alignment: AlignmentType.CENTER, visuallyRightToLeft: false, rows }), new Paragraph({ spacing: { after: 80 } })]
    }
    case 'POETRY': {
      const head = [b.title ? `«${b.title}»` : '', b.poet ?? '', b.meter ? `(${b.meter})` : ''].filter(Boolean).join(' — ')
      const rows = b.verses.map((v) => new TableRow({ children: [cell(v.sadr, { width: 48, align: AlignmentType.RIGHT }), cell('', { width: 4 }), cell(v.ajz, { width: 48, align: AlignmentType.RIGHT })] }))
      const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
      return [...(head ? paragraphsOf(head, { bold: true, align: AlignmentType.CENTER }) : []), new Table({ alignment: AlignmentType.CENTER, visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }, rows }), ...(b.source ? paragraphsOf(b.source, { size: 20, align: AlignmentType.CENTER }) : []), ...(b.notes ? paragraphsOf(b.notes, { size: 22 }) : [])]
    }
    case 'IMAGE': {
      const a = assets.get(b.fileId)
      if (!a) return paragraphsOf('[صورة غير متاحة]', { color: '777777', align: AlignmentType.CENTER })
      const widthMm = (170 * (b.widthPercent ?? 60)) / 100
      const px = Math.round(widthMm * 3.78)
      return [new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: a.type, data: a.data, transformation: { width: px, height: Math.round(px * 0.66) } })] }), ...(b.caption ? paragraphsOf(b.caption, { size: 20, align: AlignmentType.CENTER }) : [])]
    }
    case 'ANSWER_SPACE':
      return Array.from({ length: b.lines }, () => new Paragraph({ ...rtl, children: [new TextRun({ text: '…'.repeat(60), color: '999999' })] }))
    case 'SEPARATOR':
      return [new Paragraph({ border: b.style === 'space' ? undefined : { bottom: { style: b.style === 'dots' ? BorderStyle.DOTTED : BorderStyle.SINGLE, size: 6, color: '000000' } }, spacing: { before: 60, after: 120 } })]
    case 'NOTE':
      return [...(b.title ? paragraphsOf(b.title, { bold: true }) : []), ...paragraphsOf(b.text, { size: 23, indent: 4 })]
  }
}

function itemParagraphs(it: { snapshot: ExamItemSnapshot; kind: string; id: string }, label: string, pts: number, mode: DocxMode, assets: Map<string, { data: Uint8Array; type: 'png' | 'jpg' }>, columns: number): (Paragraph | Table)[] {
  const s = it.snapshot
  const out: (Paragraph | Table)[] = []
  out.push(new Paragraph({ ...rtl, alignment: AlignmentType.RIGHT, spacing: { before: 200, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: '999999' } }, children: [...runs(label, { bold: true, size: 27 }), new TextRun({ text: `   (${pts} ن)`, font: FONT, size: 22, rightToLeft: true })] }))
  if (s.title) out.push(...paragraphsOf(s.title, { bold: true }))
  out.push(...paragraphsOf(s.body, mode === 'correction' ? { color: '444444', size: 23 } : {}))
  if (s.figures?.length && mode === 'subject') for (const f of s.figures) out.push(...blockParagraphs(f, assets))
  if (s.options?.length) {
    const opts = s.options.map((o, i) => `${ARABIC_LETTERS[i] ?? i + 1}) ${bodyToText(o.label)}${mode === 'correction' && o.isCorrect ? ' ✓' : ''}`)
    if (columns > 1) {
      const rows: TableRow[] = []
      for (let i = 0; i < opts.length; i += columns) rows.push(new TableRow({ children: Array.from({ length: columns }, (_, k) => cell(opts[i + k] ?? '', { align: AlignmentType.RIGHT })) }))
      const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
      out.push(new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }, rows }))
    } else for (const o of opts) out.push(...paragraphsOf(o, { indent: 6 }))
  }
  if (s.type === 'TRUE_FALSE' && mode === 'subject') out.push(...paragraphsOf('صحيح ☐      خطأ ☐', { indent: 6 }))
  if (mode === 'correction') {
    const key = answerKeyText(s.type, s.answerKey, s.options)
    if (key) out.push(...paragraphsOf(`**الإجابة:** ${key}`))
    if (s.solution) out.push(...paragraphsOf(s.solution, { indent: 4 }))
  }
  if (s.children?.length) {
    s.children.forEach((c, i) => {
      out.push(...paragraphsOf(`${i + 1}) ${bodyToText(c.body)}   (${c.points ?? 0} ن)`, { indent: 6 }))
      if (c.options?.length) for (const [j, o] of c.options.entries()) out.push(...paragraphsOf(`${ARABIC_LETTERS[j] ?? j + 1}) ${bodyToText(o.label)}${mode === 'correction' && o.isCorrect ? ' ✓' : ''}`, { indent: 12 }))
      if (mode === 'correction') {
        const ck = answerKeyText(c.type, c.answerKey, c.options)
        if (ck) out.push(...paragraphsOf(`**الإجابة:** ${ck}`, { indent: 10 }))
        if (c.solution) out.push(...paragraphsOf(c.solution, { indent: 10, color: '222222', size: 23 }))
        if (c.bareme?.length) for (const b of c.bareme) out.push(...paragraphsOf(`— ${b.label}: ${b.points} ن`, { indent: 12, size: 21 }))
      }
    })
  }
  if (mode === 'correction' && s.bareme?.length) for (const b of s.bareme) out.push(...paragraphsOf(`— ${b.label}: ${b.points} ن`, { indent: 6, size: 21 }))
  return out
}

/** يبني المستند؛ الصور تُعطى جاهزة (بايتات) كي يبقى الملف بلا اعتماد على التخزين */
export async function buildExamDocx(exam: ExamView, mode: DocxMode, variant: string, assets: Map<string, { data: Uint8Array; type: 'png' | 'jpg' }> = new Map()): Promise<Buffer> {
  const L = resolveLayout(exam.layout)
  const h = exam.header
  const children: (Paragraph | Table)[] = []
  const center = (text: string, opts: { bold?: boolean; size?: number } = {}) => new Paragraph({ ...rtl, alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: runs(text, opts) })
  if (L.showRepublic) children.push(center('الجمهورية الجزائرية الديمقراطية الشعبية', { bold: true, size: 28 }))
  if (L.showMinistry) children.push(center('وزارة التربية الوطنية', { size: 22 }))
  if (L.directorate) children.push(center(L.directorate, { size: 22 }))
  const meta = [
    [`المؤسسة: ${h.school || '……………'}`, `السنة الدراسية: ${exam.academicYear ?? '…………'}`],
    [`المادة: ${exam.subjectName ?? '…………'}`, `المستوى: ${[exam.levelName, exam.streamName].filter(Boolean).join(' — ') || '…………'}`],
    [`الأستاذ: ${h.teacherName || '…………'}`, `المدة: ${durationAr(exam.durationMinutes)}`]
  ]
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  children.push(new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: none, bottom: none, left: none, right: none, insideHorizontal: none, insideVertical: none }, rows: meta.map((r) => new TableRow({ children: r.map((c) => cell(c, { align: AlignmentType.RIGHT, width: 50 })) })) }))
  const title = mode === 'correction' ? `التصحيح النموذجي وسلّم التنقيط — ${exam.heading}` : mode === 'marking' ? `سلّم التنقيط — ${exam.heading}` : exam.heading
  children.push(new Paragraph({ ...rtl, alignment: AlignmentType.CENTER, spacing: { before: 120, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 8, color: '000000' } }, children: runs(`${title}${variant !== 'A' && L.variantLabel ? ` — النسخة ${variant}` : ''}`, { bold: true, size: 32 }) }))
  children.push(center(exam.title, { bold: true }))
  if (L.studentFields && mode === 'subject') children.push(center(`الاسم واللقب: …………………………   القسم: ………   الرقم: ……   العلامة: …… / ${Number(exam.targetPoints)}`, { size: 22 }))
  if (mode === 'subject' && exam.instructions) children.push(center(exam.instructions, { size: 22 }))
  children.push(new Paragraph({ spacing: { after: 120 } }))

  if (mode === 'marking') {
    const m = markingSummary(exam)
    const rows: TableRow[] = [new TableRow({ children: [cell('العنصر', { bold: true, shade: true }), cell('البند', { bold: true, shade: true }), cell('النقاط', { bold: true, shade: true })] })]
    for (const r of m.rows) {
      rows.push(new TableRow({ children: [cell(r.label, { bold: true }), cell(''), cell(String(r.points), { bold: true })] }))
      r.children.forEach((c, i) => rows.push(new TableRow({ children: [cell(''), cell(`${i + 1}) ${bodyToText(c.body).slice(0, 90)}`, { align: AlignmentType.RIGHT }), cell(String(c.points))] })))
      for (const b of r.bareme) rows.push(new TableRow({ children: [cell(''), cell(`— ${b.label}`, { align: AlignmentType.RIGHT }), cell(String(b.points))] }))
    }
    rows.push(new TableRow({ children: [cell('المجموع', { bold: true }), cell(''), cell(`${m.total} / ${m.target}`, { bold: true })] }))
    children.push(new Table({ visuallyRightToLeft: true, width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
    if (m.warnings.length) children.push(...paragraphsOf(`⚠ ${m.warnings.join(' · ')}`, { color: 'B3261E', size: 22 }))
  } else {
    for (const it of exam.items) {
      if (it.kind === 'PAGE_BREAK') {
        children.push(new Paragraph({ children: [new PageBreak()] }))
        continue
      }
      const s = it.snapshot
      if (it.kind === 'BLOCK' && s.block) {
        if (mode === 'subject' || s.block.type === 'HEADING') children.push(...blockParagraphs(s.block, assets))
        continue
      }
      if (it.kind === 'TEXT') {
        if (mode === 'subject') children.push(...paragraphsOf(s.body, { size: 23, indent: 4 }))
        continue
      }
      children.push(...itemParagraphs(it, exam.numbering[it.id] ?? '', itemPoints(it), mode, assets, s.optionsColumns ?? L.optionsColumns))
    }
    children.push(new Paragraph({ spacing: { before: 240 } }))
    children.push(center(mode === 'subject' ? 'بالتوفيق' : `المجموع: ${Number(exam.totalPoints)} نقطة`, { bold: true }))
  }
  if (L.footer.text) children.push(center(L.footer.text, { size: 20 }))

  const doc = new Document({
    creator: 'Madrasadz',
    title: exam.title,
    styles: { default: { document: { run: { font: FONT, size: Math.round(L.fontSize * 2), rightToLeft: true } } } },
    sections: [
      {
        properties: { page: { size: { width: convertMillimetersToTwip(210), height: convertMillimetersToTwip(297) }, margin: { top: convertMillimetersToTwip(L.margins.top), bottom: convertMillimetersToTwip(L.margins.bottom), left: convertMillimetersToTwip(L.margins.side), right: convertMillimetersToTwip(L.margins.side) } } },
        children
      }
    ]
  })
  return Packer.toBuffer(doc)
}
