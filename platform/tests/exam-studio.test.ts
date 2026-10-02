import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { BLOCK_TYPES, blockSchema, blocksForSubject, defaultBlock, parseBlock, resolveLayout, type StudioBlock } from '@/lib/exam-blocks'
import { geometrySvg } from '@/lib/geometry'
import { compileExpr, graphErrors, latexToExpr, parseExpr, plotSvg } from '@/lib/graph'
import { bodyToText, latexToText } from '@/lib/latex-text'
import { STUDIO_TEMPLATES } from '@/lib/studio-templates'
import { variationTableHtml } from '@/lib/variation-table'
import type { DatabaseHandle } from '@/server/db/connect'
import { examItems, examRevisions, levels, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { applyVariant, blocksHaveMath, renderBlock, renderFigures } from '@/server/lib/exam-render'
import { createFromStudioTemplate, createRevision, deleteLibraryItem, insertLibraryBlock, listLibraryItems, listRevisions, listStudioTemplates, markingSummary, restoreRevision, saveLibraryItem, updateLibraryItem } from '@/server/services/exam-studio.service'
import { addBlock, addFreeItem, addItemFromBank, createExam, getExam, removeItem, restoreItems, updateExam, updateItem } from '@/server/services/exams.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

describe('الاستوديو — مخطط الكتل', () => {
  it('كل كتلة افتراضية صالحة، والمجهول يُرفض', () => {
    for (const t of BLOCK_TYPES) expect(parseBlock(defaultBlock(t))?.type).toBe(t)
    expect(parseBlock({ type: 'VIDEO', url: 'x' })).toBeNull()
    expect(parseBlock({ type: 'HEADING', text: '' })).toBeNull()
    expect(parseBlock({ type: 'TABLE', rows: [] })).toBeNull()
    expect(blockSchema.safeParse({ type: 'IMAGE', fileId: 'not-uuid' }).success).toBe(false)
    expect(blocksForSubject('MATH').primary[0]).toBe('EQUATION')
    expect(blocksForSubject('ARABIC').primary[0]).toBe('POETRY')
    const L = resolveLayout({ fontSize: 12, margins: { top: 20 } })
    expect(L.fontSize).toBe(12)
    expect(L.margins).toEqual({ top: 20, bottom: 16, side: 14 })
    expect(L.headerLayout).toBe('classic')
  })
})

describe('الاستوديو — محرّك المنحنيات', () => {
  it('يحلّل التعابير بلا eval: ضرب ضمني، دوال، ثوابت، LaTeX بسيط', () => {
    expect(compileExpr('x^2 - 2x + 1')(3)).toBe(4)
    expect(compileExpr('2(x+1)')(2)).toBe(6)
    expect(compileExpr('e^x')(0)).toBe(1)
    expect(compileExpr('ln(x)/x')(1)).toBe(0)
    expect(compileExpr('sin x')(0)).toBe(0)
    expect(compileExpr('\\frac{1}{x}')(4)).toBe(0.25)
    expect(compileExpr('\\sqrt{x+1}')(3)).toBe(2)
    expect(latexToExpr('e^{-x}\\cdot x')).toBe('e^(-x)* x')
    expect(compileExpr('-x^2')(2)).toBe(-4)
    expect(compileExpr('abs(x - 1)')(0)).toBe(1)
    expect(() => parseExpr('y + 1')).toThrow(/متغيّر/)
    expect(() => parseExpr('foo(x)')).toThrow(/دالة/)
    expect(() => parseExpr('(x + 1')).toThrow(/قوس/)
    expect(() => parseExpr('x +')).toThrow()
  })

  it('يرسم SVG بمحاور وتدريج ومسار لكل دالة ويقطع عند الانقطاع', () => {
    const r = plotSvg({ functions: [{ expr: '1/x', label: 'C' }, { expr: 'x^2' }], xMin: -3, xMax: 3, yMin: -3, yMax: 3, grid: true, stepX: 1, stepY: 1, width: 100, verticalAsymptotes: [0], points: [{ x: 1, y: 1, label: 'A' }] })
    expect(r.errors).toEqual([])
    expect(r.svg.startsWith('<svg')).toBe(true)
    expect(r.svg).toContain('width="100mm"')
    expect((r.svg.match(/<path d="M/g) ?? []).length).toBeGreaterThanOrEqual(2)
    // 1/x: المسار يحوي أكثر من مقطع (M مرّتين على الأقل داخل المسار الأول)
    const first = /<path d="([^"]+)" fill="none" stroke="#1b5e52"/.exec(r.svg)![1]!
    expect((first.match(/M/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(r.svg).toContain('>A<')
    expect(r.svg).toContain('stroke-dasharray')
    expect(r.svg).toContain('>O<')
    const bad = plotSvg({ functions: [{ expr: 'x +' }], xMin: 0, xMax: 1, yMin: 0, yMax: 1 })
    expect(bad.errors.length).toBe(1)
    expect(graphErrors({ functions: [{ expr: 'z' }], xMin: 1, xMax: 0, yMin: 0, yMax: 1 })).toHaveLength(2)
  })

  it('الهندسة وجدول التغيّرات والنصّ الخطّي', () => {
    const g = geometrySvg({ xMin: -1, xMax: 5, yMin: -1, yMax: 4, points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 0 }, { id: 'C', x: 4, y: 3 }], segments: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'A' }], circles: [{ center: 'A', radius: 1 }], polygons: [{ points: ['A', 'B', 'C'], fill: true }], rightAngles: [{ at: 'B', from: 'A', to: 'C' }] })
    expect(g.errors).toEqual([])
    expect((g.svg.match(/<line /g) ?? []).length).toBe(3)
    expect(g.svg).toContain('<circle cx')
    expect(g.svg).toContain('<polygon')
    expect(geometrySvg({ xMin: 0, xMax: 1, yMin: 0, yMax: 1, points: [], segments: [{ from: 'A', to: 'B' }] }).errors[0]).toMatch(/A غير معرّفة/)
    const html = variationTableHtml({ variable: 'x', xs: ['-∞', '0', '+∞'], sign: { signs: ['-', '+'], marks: ['', '0', ''] }, variation: { values: ['+∞', '-1', '+∞'], arrows: ['down', 'up'] } })
    expect(html).toContain('<table class="vt"')
    expect(html).toContain('vt-down')
    expect(html).toContain('vt-up')
    expect(html).toContain('>−<')
    expect(latexToText('f(x)=e^{x}-x')).toBe('f(x) = eˣ − x')
    expect(latexToText('\\frac{\\ln x}{x^2}')).toBe('(ln x)/x²')
    expect(latexToText('\\lim_{x \\to +\\infty} f(x) = -\\infty')).toContain('lim')
    expect(latexToText('u_{n+1} = \\sqrt{2u_n + 3}')).toBe('uₙ₊₁ = √(2uₙ + 3)')
    expect(latexToText('x \\in \\mathbb{R}')).toBe('x ∈ ℝ')
    expect(bodyToText('ادرس **الدالة** $f(x)=x^2$.')).toBe('ادرس الدالة f(x) = x².')
  })
})

describe('الاستوديو — التصيير', () => {
  it('كل أنواع الكتل تُصيَّر HTML آمناً، والمعادلات بـKaTeX', () => {
    for (const t of BLOCK_TYPES) expect(renderBlock(defaultBlock(t), { assets: {} }).length).toBeGreaterThan(10)
    expect(renderBlock({ type: 'HEADING', text: '<b>x</b>', level: 1 })).toContain('&lt;b&gt;')
    expect(renderBlock({ type: 'EQUATION', latex: '\\int_0^1 x\\,dx' })).toContain('katex-display')
    expect(renderBlock({ type: 'PARAGRAPH', text: 'نصّ عربي مع $x^2$ et français' })).toContain('dir="auto"')
    const poem = renderBlock({ type: 'POETRY', poet: 'الشابي', verses: [{ sadr: 'إذا الشعب يوماً أراد الحياة', ajz: 'فلا بدّ أن يستجيب القدر' }] })
    expect(poem).toContain('class="sadr"')
    expect(poem).toContain('class="ajz"')
    const img = renderBlock({ type: 'IMAGE', fileId: '11111111-1111-4111-8111-111111111111', widthPercent: 50 }, { assets: { '11111111-1111-4111-8111-111111111111': '/api/v1/files/x?sig=1' } })
    expect(img).toContain('<img src="/api/v1/files/x?sig=1"')
    expect(renderBlock({ type: 'IMAGE', fileId: '11111111-1111-4111-8111-111111111111' })).toContain('img-missing')
    expect(renderBlock({ type: 'TABLE', rows: [['x', '$x^2$'], ['1', '1']], headerRow: true })).toContain('<th dir="auto">')
    expect(renderBlock({ type: 'GRAPH', graph: { functions: [{ expr: 'x' }], xMin: -1, xMax: 1, yMin: -1, yMax: 1 } })).toContain('<figure')
    expect(renderBlock({ type: 'ANSWER_SPACE', lines: 4 })).toContain('height:30mm')
    expect(renderFigures([{ type: 'SEPARATOR' }])).toContain('class="figures"')
    expect(blocksHaveMath([{ type: 'TABLE', rows: [['$x$']] }])).toBe(true)
    expect(blocksHaveMath([{ type: 'SEPARATOR' }])).toBe(false)
  })

  it('النسخ B/C/D تخلط المرقّم فقط وتُبقي العناوين والكتل في مواضعها', () => {
    const items = [
      { id: 'h', kind: 'BLOCK', snapshot: {} },
      { id: '1', kind: 'EXERCISE', snapshot: {} },
      { id: 't', kind: 'TEXT', snapshot: {} },
      { id: '2', kind: 'EXERCISE', snapshot: {} },
      { id: '3', kind: 'QUESTION', snapshot: {} },
      { id: 'f', kind: 'BLOCK', snapshot: {} }
    ]
    for (const v of ['B', 'C', 'D'] as const) {
      const out = applyVariant(items, '22222222-2222-4222-8222-222222222222', v)
      expect(out[0]!.id).toBe('h')
      expect(out[2]!.id).toBe('t')
      expect(out[5]!.id).toBe('f')
      expect([out[1]!.id, out[3]!.id, out[4]!.id].sort()).toEqual(['1', '2', '3'])
    }
  })
})

let h: DatabaseHandle
let teacher: Actor
let math: string
let l3: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
})

afterAll(async () => {
  await h.close()
})

describe('الاستوديو — الورقة والمراجعات والمكتبة', () => {
  it('كتل في الورقة: إضافة، تعديل، أشكال داخل التمرين، فرعيات وسلّم وQCM بأعمدة', async () => {
    const ex = await createExam(h.db, teacher, { title: 'بكالوريا تجريبية', kind: 'BAC_MOCK', subjectId: math, levelId: l3, durationMinutes: 210 })
    const heading = await addBlock(h.db, teacher, ex.id, { type: 'HEADING', text: 'الجزء الأول', level: 1 })
    expect(heading.kind).toBe('BLOCK')
    expect(heading.snapshot.block?.type).toBe('HEADING')
    await expect(addBlock(h.db, teacher, ex.id, { type: 'NOPE' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(addFreeItem(h.db, teacher, ex.id, { kind: 'BLOCK', body: 'x' })).rejects.toMatchObject({ code: 'VALIDATION' })
    const exo = await addFreeItem(h.db, teacher, ex.id, { kind: 'EXERCISE', body: 'ادرس الدالة $f(x)=x^2$.', points: 6 })
    const graph: StudioBlock = { type: 'GRAPH', graph: { functions: [{ expr: 'x^2' }], xMin: -2, xMax: 2, yMin: -1, yMax: 4 } }
    await updateItem(h.db, teacher, exo.id, { figures: [graph], children: [{ body: 'احسب $f(1)$.', points: 2 }, { body: 'ادرس التغيّرات.', points: 4, solution: 'f متزايدة على [0;+∞[' }], bareme: [{ label: 'الدقّة', points: 1 }], estimatedMinutes: 30 })
    let v = await getExam(h.db, teacher, ex.id)
    const e = v.items.find((i) => i.id === exo.id)!
    expect(e.snapshot.figures?.[0]?.type).toBe('GRAPH')
    expect(e.snapshot.children).toHaveLength(2)
    expect(e.snapshot.children![1]!.solution).toBe('f متزايدة على [0;+∞[')
    expect(e.points).toBeNull() // الفرعيات تحدّد المجموع
    expect(Number(v.totalPoints)).toBe(6)
    expect(v.subjectCode).toBe('MATH')
    // الكتلة لا تحمل أشكالاً؛ التمرين لا يحمل كتلة
    await expect(updateItem(h.db, teacher, heading.id, { figures: [graph] })).resolves.toBeTruthy()
    await expect(updateItem(h.db, teacher, exo.id, { block: { type: 'SEPARATOR' } })).rejects.toMatchObject({ code: 'VALIDATION' })
    await updateItem(h.db, teacher, heading.id, { block: { type: 'HEADING', text: 'الجزء الأول: الجبر', level: 2 } })
    v = await getExam(h.db, teacher, ex.id)
    expect(v.items[0]!.snapshot.block).toMatchObject({ text: 'الجزء الأول: الجبر' })
    // QCM بأعمدة
    const q = await addFreeItem(h.db, teacher, ex.id, { kind: 'QUESTION', body: 'نهاية $\\frac{1}{x}$ عند $+\\infty$؟', points: 1 })
    await updateItem(h.db, teacher, q.id, { type: 'MCQ', options: [{ label: '0', isCorrect: true }, { label: '1', isCorrect: false }, { label: '$+\\infty$', isCorrect: false }], optionsColumns: 3 })
    v = await getExam(h.db, teacher, ex.id)
    const qq = v.items.find((i) => i.id === q.id)!
    expect(qq.snapshot.type).toBe('MCQ')
    expect(qq.snapshot.optionsColumns).toBe(3)
    // سلّم التنقيط: المجموع 7 ≠ 20
    const m = markingSummary(v)
    expect(m.total).toBe(7)
    expect(m.ok).toBe(false)
    expect(m.warnings[0]).toContain('20')
    expect(m.rows[0]!.children).toHaveLength(2)
  })

  it('تراجع/إعادة: استرجاع عنصر محذوف بالمعرّف نفسه وفي موضعه، واستبدال حالة عنصر', async () => {
    const ex = await createExam(h.db, teacher, { title: 'تراجع', subjectId: math, levelId: l3 })
    const a = await addBlock(h.db, teacher, ex.id, { type: 'HEADING', text: 'أ' })
    const b = await addBlock(h.db, teacher, ex.id, { type: 'PARAGRAPH', text: 'ب' })
    const c = await addBlock(h.db, teacher, ex.id, { type: 'PARAGRAPH', text: 'ج' })
    await removeItem(h.db, teacher, b.id)
    expect((await getExam(h.db, teacher, ex.id)).items.map((i) => i.id)).toEqual([a.id, c.id])
    const restored = await restoreItems(h.db, teacher, ex.id, [{ itemId: b.id, kind: 'BLOCK', snapshot: b.snapshot, position: 1 }])
    expect(restored[0]!.id).toBe(b.id)
    expect((await getExam(h.db, teacher, ex.id)).items.map((i) => i.id)).toEqual([a.id, b.id, c.id])
    await restoreItems(h.db, teacher, ex.id, [{ itemId: a.id, kind: 'BLOCK', snapshot: { body: '', block: { type: 'HEADING', text: 'أ2' } } }])
    expect((await getExam(h.db, teacher, ex.id)).items[0]!.snapshot.block).toMatchObject({ text: 'أ2' })
    await expect(restoreItems(h.db, teacher, ex.id, [{ itemId: null, kind: 'BLOCK', snapshot: { body: '', block: { type: 'X' } as never } }])).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('التخطيط والمفضّلة، ومراجعة تلقائية قبل أول تغيير ثم يدوية واسترجاع', async () => {
    const ex = await createExam(h.db, teacher, { title: 'مراجعات', subjectId: math, levelId: l3 })
    expect((await listRevisions(h.db, teacher, ex.id)).length).toBe(0)
    await updateExam(h.db, teacher, ex.id, { layout: { fontSize: 12, studentFields: true, headerLayout: 'boxed' }, isFavorite: true })
    let row = await getExam(h.db, teacher, ex.id)
    expect(row.layout).toMatchObject({ fontSize: 12, studentFields: true, headerLayout: 'boxed' })
    expect(row.isFavorite).toBe(true)
    await expect(updateExam(h.db, teacher, ex.id, { layout: { fontSize: 99 } })).rejects.toMatchObject({ code: 'VALIDATION' })
    // تغيير الإعدادات أنشأ مراجعة تلقائية واحدة (قبل التغيير)؛ التغييرات التالية في النافذة نفسها لا تضيف
    await addBlock(h.db, teacher, ex.id, { type: 'PARAGRAPH', text: 'أ' })
    await addBlock(h.db, teacher, ex.id, { type: 'PARAGRAPH', text: 'ب' })
    let revs = await listRevisions(h.db, teacher, ex.id)
    expect(revs).toHaveLength(1)
    expect(revs[0]!.reason).toBe('AUTO')
    expect(revs[0]!.itemsCount).toBe(0)
    const manual = await createRevision(h.db, teacher, ex.id, 'قبل الطباعة')
    expect(manual.number).toBe(2)
    expect(manual.snapshot.items).toHaveLength(2)
    expect(manual.snapshot.exam.layout).toMatchObject({ fontSize: 12 })
    await addBlock(h.db, teacher, ex.id, { type: 'PARAGRAPH', text: 'ج' })
    await updateExam(h.db, teacher, ex.id, { title: 'بعد', layout: { fontSize: 14 } })
    expect((await getExam(h.db, teacher, ex.id)).items).toHaveLength(3)
    const r = await restoreRevision(h.db, teacher, ex.id, manual.id)
    expect(r.restoredNumber).toBe(2)
    row = await getExam(h.db, teacher, ex.id)
    expect(row.title).toBe('مراجعات')
    expect(row.items).toHaveLength(2)
    expect(row.layout.fontSize).toBe(12)
    revs = await listRevisions(h.db, teacher, ex.id)
    expect(revs[0]!.reason).toBe('RESTORE')
    // تجاوز الحدّ: المراجعة تُقبل في جدولها بمعرّف الامتحان فقط
    expect((await h.db.select().from(examRevisions).where(eq(examRevisions.examId, ex.id))).length).toBe(revs.length)
  })

  it('مكتبة الأستاذ: حفظ كتلة، قائمة بالمادة، إدراج في الورقة، مفضّلة، حذف', async () => {
    const ex = await createExam(h.db, teacher, { title: 'مكتبة', subjectId: math, levelId: l3 })
    const item = await saveLibraryItem(h.db, teacher, { kind: 'BLOCK', title: 'ملاحظة الآلة الحاسبة', subjectId: math, tags: ['تعليمات'], block: { type: 'NOTE', text: 'يُسمح باستعمال الآلة الحاسبة.', style: 'box' } })
    expect(item.kind).toBe('BLOCK')
    await expect(saveLibraryItem(h.db, teacher, { kind: 'BLOCK', title: 'x', block: { type: 'X' } as never })).rejects.toMatchObject({ code: 'VALIDATION' })
    const hdr = await saveLibraryItem(h.db, teacher, { kind: 'HEADER', title: 'ترويسة ثانويتي', header: { school: 'ثانوية الأمير عبد القادر', wilaya: 'قالمة' }, layout: { headerLayout: 'boxed', directorate: 'مديرية التربية لولاية قالمة' } })
    let list = await listLibraryItems(h.db, teacher, { subjectId: math })
    expect(list.map((l) => l.title).sort()).toEqual(['ترويسة ثانويتي', 'ملاحظة الآلة الحاسبة'])
    expect(list.find((l) => l.id === item.id)!.subjectName).toBeTruthy()
    const inserted = await insertLibraryBlock(h.db, teacher, ex.id, item.id)
    expect(inserted.snapshot.block).toMatchObject({ type: 'NOTE' })
    expect((await listLibraryItems(h.db, teacher, { kind: 'BLOCK' }))[0]!.usageCount).toBe(1)
    await updateLibraryItem(h.db, teacher, item.id, { isFavorite: true, title: 'آلة حاسبة' })
    list = await listLibraryItems(h.db, teacher, { favorites: true })
    expect(list).toHaveLength(1)
    expect(list[0]!.title).toBe('آلة حاسبة')
    await deleteLibraryItem(h.db, teacher, hdr.id)
    expect((await listLibraryItems(h.db, teacher)).length).toBe(1)
    const admin = await makeAdmin(h.db)
    const other = await makeTeacher(h.db, admin, 'آخر')
    await expect(insertLibraryBlock(h.db, other, ex.id, item.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('قالب Madrasadz ← امتحان كامل في مساحة الأستاذ بالترويسة والتخطيط والكتل', async () => {
    expect(STUDIO_TEMPLATES.every((t) => t.items.every((i) => i.kind !== 'BLOCK' || parseBlock(i.snapshot.block)))).toBe(true)
    const cards = listStudioTemplates('MATH')
    expect(cards.filter((c) => c.matches).length).toBeGreaterThanOrEqual(4)
    const ex = await createFromStudioTemplate(h.db, teacher, 'math-3as-bac-sci')
    const v = await getExam(h.db, teacher, ex.id)
    expect(v.subjectCode).toBe('MATH')
    expect(v.streamName).toBe('علوم تجريبية')
    expect(v.academicYear).toBe('2026/2027')
    expect(v.header.teacherName).toBe(teacher.fullName)
    expect(v.layout.headerLayout).toBe('classic')
    expect(v.items.filter((i) => i.kind === 'EXERCISE')).toHaveLength(4)
    expect(v.items.some((i) => i.kind === 'PAGE_BREAK')).toBe(true)
    expect(Number(v.totalPoints)).toBe(20)
    expect(v.numbering[v.items.find((i) => i.kind === 'EXERCISE')!.id]).toBe('التمرين الأول')
    const last = v.items.filter((i) => i.kind === 'EXERCISE')[3]!
    expect(last.snapshot.figures?.map((f) => f.type)).toEqual(['GRAPH', 'VARIATION_TABLE'])
    expect(markingSummary(v).ok).toBe(true)
    await expect(createFromStudioTemplate(h.db, teacher, 'nope')).rejects.toMatchObject({ code: 'EXAM_NOT_FOUND' })
    // البنك والقالب يتعايشان: إدراج سؤال من البنك بعد الكتل
    const q = await createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'احسب $\\int_0^1 x\\,dx$.', points: 2, subjectId: math, levelId: l3 })
    await addItemFromBank(h.db, teacher, ex.id, q.id)
    expect((await h.db.select().from(examItems).where(eq(examItems.examId, ex.id))).length).toBe(v.items.length + 1)
  })
})

/* ------------------------------ التصدير والمساعد ------------------------------ */

import JSZip from 'jszip'
import { paginate } from '@/lib/paginate'
import { buildExamDocx } from '@/server/lib/exam-docx'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, ExamCopilotInput } from '@/server/ai/types'
import { copilotPropose } from '@/server/services/exam-studio.service'

describe('الاستوديو — التقسيم إلى صفحات', () => {
  it('لا يقسم الكتلة، ينزل ما لا يتّسع، ويعلّم الأطول من صفحة والفراغ الكبير', () => {
    const r = paginate(
      [
        { id: 'h', height: 40 },
        { id: 'a', height: 100 },
        { id: 'b', height: 100, label: 'التمرين الثاني' },
        { id: 'pb', height: 0, forceBreak: true },
        { id: 'c', height: 300, label: 'التمرين الثالث' },
        { id: 'd', height: 10 }
      ],
      230
    )
    expect(r.pages.map((p) => p.ids)).toEqual([['h', 'a'], ['b', 'pb'], ['c'], ['d']])
    expect(r.overflow[0]).toMatchObject({ id: 'c' })
    expect(r.pushed[0]).toMatchObject({ id: 'b', gapLeft: 90 })
  })
})

describe('الاستوديو — Word والمساعد', () => {
  it('DOCX: ملف صالح يحوي النصّ العربي من اليمين والمعادلات نصّاً خطّياً والجداول', async () => {
    const ex = await createFromStudioTemplate(h.db, teacher, 'math-3as-bac-sci')
    const v = await getExam(h.db, teacher, ex.id)
    const buf = await buildExamDocx(v, 'subject', 'A')
    expect(buf.length).toBeGreaterThan(5000)
    const zip = await JSZip.loadAsync(buf)
    const xml = await zip.file('word/document.xml')!.async('string')
    expect(xml).toContain('الجمهورية الجزائرية الديمقراطية الشعبية')
    expect(xml).toContain('<w:bidi')
    expect(xml).toContain('التمرين الأول')
    expect(xml).toContain('uₙ₊₁')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('انظر نسخة PDF')
    const corr = await JSZip.loadAsync(await buildExamDocx(v, 'correction', 'B'))
    const cx = await corr.file('word/document.xml')!.async('string')
    expect(cx).toContain('التصحيح النموذجي')
    expect(cx).toContain('النسخة B')
    const mk = await JSZip.loadAsync(await buildExamDocx(v, 'marking', 'A'))
    expect(await mk.file('word/document.xml')!.async('string')).toContain('سلّم التنقيط')
  })

  it('المساعد: مقترح فقط بمزوّد حقيقي، ولا شيء يُكتب قبل القبول؛ بلا مزوّد يُرفض', async () => {
    const ex = await createExam(h.db, teacher, { title: 'مساعد', subjectId: math, levelId: l3 })
    const exo = await addFreeItem(h.db, teacher, ex.id, { kind: 'EXERCISE', body: 'احسب $\\lim_{x\\to+\\infty} \\frac{\\ln x}{x}$.', points: 3 })
    setAiProviderForTests(null)
    await expect(copilotPropose(h.db, teacher, ex.id, exo.id, 'solution', null)).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' })
    let seen: ExamCopilotInput | null = null
    const fake = {
      name: 'openai',
      model: 'fake',
      async examCopilot(input: ExamCopilotInput) {
        seen = input
        return { title: null, body: null, children: null, options: null, solution: 'النهاية تساوي 0 لأن $\\ln x$ أبطأ من $x$.', bareme: [{ label: 'التعليل', points: 2 }, { label: 'النتيجة', points: 1 }], points: null, estimatedMinutes: 8, difficulty: 2, note: 'حلّ مباشر بالنهايات المرجعية.' }
      }
    } as unknown as AIProvider
    setAiProviderForTests(fake)
    try {
      const p = await copilotPropose(h.db, teacher, ex.id, exo.id, 'solution', 'باختصار')
      expect(p.solution).toContain('النهاية')
      expect(p.bareme).toHaveLength(2)
      expect(seen!.op).toBe('solution')
      expect(seen!.instructions).toBe('باختصار')
      expect(seen!.item.points).toBe(3)
      expect(seen!.exam.targetPoints).toBe(20)
      // لم يتغيّر العنصر
      const after = (await getExam(h.db, teacher, ex.id)).items[0]!
      expect(after.snapshot.solution ?? null).toBeNull()
      await expect(copilotPropose(h.db, teacher, ex.id, '11111111-1111-4111-8111-111111111111', 'solution', null)).rejects.toMatchObject({ code: 'EXAM_ITEM_NOT_FOUND' })
    } finally {
      setAiProviderForTests(null)
    }
  })
})
