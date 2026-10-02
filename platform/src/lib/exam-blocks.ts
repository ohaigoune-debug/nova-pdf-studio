/**
 * مخطط كتل ورقة الامتحان (Teacher Exam Studio).
 * الورقة = `exam_items` مرتّبة؛ العنصر من نوع `BLOCK` يحمل كتلة منظّمة في `snapshot.block`،
 * والتمرين/السؤال قد يحمل أشكالاً (منحنى/جدول/معادلة…) في `snapshot.figures` بين نصّه وأسئلته الفرعية.
 * ملف خالص (zod فقط) ليُستعمل في الخادم والمتصفح: التحقّق هنا هو الحقيقة الوحيدة.
 */
import { z } from 'zod'

export const BLOCK_TYPES = ['HEADING', 'PARAGRAPH', 'EQUATION', 'GRAPH', 'GEOMETRY', 'TABLE', 'VARIATION_TABLE', 'POETRY', 'IMAGE', 'ANSWER_SPACE', 'SEPARATOR', 'NOTE'] as const
export type BlockType = (typeof BLOCK_TYPES)[number]

const short = z.string().max(300)
const text = z.string().max(8000)
const num = z.number().finite()
const color = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/)
  .optional()

/* ------------------------------- المنحنى ------------------------------- */

export const graphFunctionSchema = z.object({
  /** تعبير بالمتغيّر x (أو LaTeX بسيط: \frac{1}{x}، e^{x}…) */
  expr: z.string().min(1).max(200),
  label: short.optional(),
  color,
  /** مجال الرسم إن ضاق عن مجال الشكل */
  domain: z.tuple([num, num]).nullish(),
  dashed: z.boolean().optional()
})
export const graphSchema = z.object({
  functions: z.array(graphFunctionSchema).max(6),
  xMin: num,
  xMax: num,
  yMin: num,
  yMax: num,
  /** خطوة التدريج على المحورين (وحدة) */
  stepX: z.number().positive().max(1000).optional(),
  stepY: z.number().positive().max(1000).optional(),
  grid: z.boolean().optional(),
  /** عرض الشكل بالملمتر (الارتفاع يُشتقّ من النسبة) */
  width: z.number().min(40).max(180).optional(),
  height: z.number().min(30).max(200).optional(),
  points: z.array(z.object({ x: num, y: num, label: short.optional() })).max(30).optional(),
  verticalAsymptotes: z.array(num).max(8).optional(),
  horizontalAsymptotes: z.array(num).max(8).optional(),
  showLegend: z.boolean().optional(),
  axisLabels: z.object({ x: short.optional(), y: short.optional() }).optional(),
  /** أسماء المعلم: O، i، j */
  frameLabels: z.boolean().optional()
})
export type GraphDefinition = z.infer<typeof graphSchema>

/* ------------------------------- الهندسة ------------------------------- */

const pid = z.string().min(1).max(12)
export const geometrySchema = z.object({
  width: z.number().min(40).max(180).optional(),
  height: z.number().min(30).max(200).optional(),
  xMin: num,
  xMax: num,
  yMin: num,
  yMax: num,
  grid: z.boolean().optional(),
  axes: z.boolean().optional(),
  points: z.array(z.object({ id: pid, x: num, y: num, label: short.optional(), hidden: z.boolean().optional() })).max(40),
  segments: z.array(z.object({ from: pid, to: pid, dashed: z.boolean().optional(), label: short.optional(), arrow: z.boolean().optional() })).max(60).optional(),
  circles: z.array(z.object({ center: pid, radius: z.number().positive().max(1000), label: short.optional(), dashed: z.boolean().optional() })).max(20).optional(),
  polygons: z.array(z.object({ points: z.array(pid).min(3).max(20), fill: z.boolean().optional() })).max(20).optional(),
  /** زوايا قائمة عند رأس (بين ضلعين) */
  rightAngles: z.array(z.object({ at: pid, from: pid, to: pid })).max(20).optional()
})
export type GeometryDefinition = z.infer<typeof geometrySchema>

/* --------------------------- جدول التغيّرات --------------------------- */

export const variationTableSchema = z.object({
  variable: z.string().max(10).optional(),
  /** الحدود: −∞، 0، +∞… (نصّ أو LaTeX) */
  xs: z.array(z.string().max(40)).min(2).max(10),
  /** صفّ الإشارة (المشتقّة): إشارة بين كل حدّين */
  sign: z
    .object({
      label: z.string().max(40).optional(),
      /** طول = عدد الحدود − 1 */
      signs: z.array(z.enum(['+', '-', ''])).max(9),
      /** علامة عند كل حدّ: 0، || (غير معرّفة)، أو فارغ — طول = عدد الحدود */
      marks: z.array(z.string().max(4)).max(10).optional()
    })
    .optional(),
  /** صفّ التغيّرات: قيمة عند كل حدّ وسهم بين كل حدّين */
  variation: z.object({
    label: z.string().max(40).optional(),
    values: z.array(z.string().max(40)).max(10),
    arrows: z.array(z.enum(['up', 'down', 'flat', ''])).max(9)
  })
})
export type VariationTable = z.infer<typeof variationTableSchema>

/* --------------------------------- الكتل --------------------------------- */

const align = z.enum(['start', 'center', 'end', 'justify']).optional()

export const blockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('HEADING'), text: short.min(1), level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), align }),
  z.object({ type: z.literal('PARAGRAPH'), text: text.min(1), align, size: z.enum(['small', 'normal', 'large']).optional(), dir: z.enum(['auto', 'rtl', 'ltr']).optional() }),
  z.object({ type: z.literal('EQUATION'), latex: z.string().min(1).max(2000), numbered: z.boolean().optional(), label: short.optional(), caption: short.optional() }),
  z.object({ type: z.literal('GRAPH'), graph: graphSchema, caption: short.optional(), align }),
  z.object({ type: z.literal('GEOMETRY'), figure: geometrySchema, caption: short.optional(), align }),
  z.object({
    type: z.literal('TABLE'),
    rows: z.array(z.array(z.string().max(1000)).min(1).max(12)).min(1).max(40),
    headerRow: z.boolean().optional(),
    headerCol: z.boolean().optional(),
    align,
    borders: z.enum(['all', 'outer', 'none']).optional(),
    caption: short.optional(),
    /** عرض الجدول % من عرض الورقة */
    width: z.number().min(20).max(100).optional()
  }),
  z.object({ type: z.literal('VARIATION_TABLE'), table: variationTableSchema, caption: short.optional() }),
  z.object({
    type: z.literal('POETRY'),
    poet: short.optional(),
    title: short.optional(),
    meter: short.optional(),
    verses: z.array(z.object({ sadr: z.string().max(300), ajz: z.string().max(300) })).min(1).max(60),
    source: short.optional(),
    notes: text.optional()
  }),
  z.object({ type: z.literal('IMAGE'), fileId: z.string().uuid(), alt: short.optional(), widthPercent: z.number().min(10).max(100).optional(), align, caption: short.optional() }),
  z.object({ type: z.literal('ANSWER_SPACE'), lines: z.number().int().min(1).max(40), style: z.enum(['lines', 'blank', 'grid', 'box']).optional(), label: short.optional() }),
  z.object({ type: z.literal('SEPARATOR'), style: z.enum(['line', 'dots', 'space']).optional(), size: z.number().min(1).max(40).optional() }),
  z.object({ type: z.literal('NOTE'), text: text.min(1), style: z.enum(['box', 'quote', 'warning', 'plain']).optional(), title: short.optional() })
])
export type StudioBlock = z.infer<typeof blockSchema>

export const figuresSchema = z.array(blockSchema).max(6)

/** يتحقّق من كتلة قادمة من العميل؛ يُرجع null إن كانت غير صالحة */
export function parseBlock(input: unknown): StudioBlock | null {
  const r = blockSchema.safeParse(input)
  return r.success ? r.data : null
}

/* ------------------------------- التخطيط ------------------------------- */

export const layoutSchema = z.object({
  /** حجم الخطّ بالنقطة (الافتراضي 13.5) */
  fontSize: z.number().min(10).max(18).optional(),
  lineHeight: z.number().min(1.2).max(2.4).optional(),
  margins: z.object({ top: z.number().min(5).max(40).optional(), bottom: z.number().min(5).max(40).optional(), side: z.number().min(5).max(40).optional() }).optional(),
  headerLayout: z.enum(['classic', 'boxed', 'compact', 'bilingual']).optional(),
  showRepublic: z.boolean().optional(),
  showMinistry: z.boolean().optional(),
  /** مديرية التربية لولاية … */
  directorate: short.optional(),
  /** الاسم واللقب / القسم / الرقم */
  studentFields: z.boolean().optional(),
  showDate: z.boolean().optional(),
  logoFileId: z.string().uuid().nullish(),
  footer: z.object({ text: short.optional(), pageNumbers: z.boolean().optional() }).optional(),
  /** رمز QR في الترويسة يشير إلى رابط (المنصة أو صفحة الامتحان) */
  qr: z.boolean().optional(),
  qrUrl: z.string().url().max(300).optional(),
  numbering: z.enum(['words', 'digits']).optional(),
  /** تمييز رقم النسخة في الورقة (B/C/D) */
  variantLabel: z.boolean().optional(),
  /** عدد أعمدة اختيارات QCM افتراضياً */
  optionsColumns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional()
})
export type ExamLayout = z.infer<typeof layoutSchema>

export const DEFAULT_LAYOUT: Required<Pick<ExamLayout, 'fontSize' | 'lineHeight' | 'headerLayout' | 'showRepublic' | 'showMinistry' | 'studentFields' | 'showDate' | 'numbering' | 'variantLabel' | 'optionsColumns'>> & { margins: { top: number; bottom: number; side: number }; footer: { text: string; pageNumbers: boolean } } = {
  fontSize: 13.5,
  lineHeight: 1.75,
  margins: { top: 14, bottom: 16, side: 14 },
  headerLayout: 'classic',
  showRepublic: true,
  showMinistry: true,
  studentFields: false,
  showDate: false,
  footer: { text: '', pageNumbers: true },
  numbering: 'words',
  variantLabel: true,
  optionsColumns: 1
}

export function resolveLayout(l: ExamLayout | null | undefined): typeof DEFAULT_LAYOUT & ExamLayout {
  return { ...DEFAULT_LAYOUT, ...(l ?? {}), margins: { ...DEFAULT_LAYOUT.margins, ...(l?.margins ?? {}) }, footer: { ...DEFAULT_LAYOUT.footer, ...(l?.footer ?? {}) } }
}

/* ------------------------------- التسميات ------------------------------- */

export const BLOCK_AR: Record<BlockType, { label: string; hint: string }> = {
  HEADING: { label: 'عنوان', hint: 'عنوان جزء أو قسم في الورقة' },
  PARAGRAPH: { label: 'فقرة', hint: 'نصّ حرّ: عربي، فرنسي، ومعادلات بين $…$' },
  EQUATION: { label: 'معادلة', hint: 'معادلة معروضة في سطر مستقلّ (LaTeX)' },
  GRAPH: { label: 'منحنى', hint: 'تمثيل بياني لدالة أو أكثر في معلم' },
  GEOMETRY: { label: 'شكل هندسي', hint: 'نقاط، قطع، دوائر، مضلّعات' },
  TABLE: { label: 'جدول', hint: 'جدول بيانات أو قيم' },
  VARIATION_TABLE: { label: 'جدول تغيّرات', hint: 'إشارة المشتقّة وتغيّرات الدالة بالأسهم' },
  POETRY: { label: 'أبيات شعر', hint: 'صدر | عجز بترتيب الأبيات' },
  IMAGE: { label: 'صورة', hint: 'صورة من جهازك (jpg/png/webp)' },
  ANSWER_SPACE: { label: 'مساحة إجابة', hint: 'سطور أو فراغ يجيب فيه التلميذ' },
  SEPARATOR: { label: 'فاصل', hint: 'خطّ أو فراغ بين الأجزاء' },
  NOTE: { label: 'ملاحظة', hint: 'إطار تنبيه أو تعليمات' }
}

/** ترتيب الكتل في الشريط حسب المادة: الأنسب أولاً (الوضع المركّز يُخفي البقية) */
export function blocksForSubject(subjectCode: string | null | undefined): { primary: BlockType[]; secondary: BlockType[] } {
  const all = [...BLOCK_TYPES]
  const pick = (primary: BlockType[]) => ({ primary, secondary: all.filter((t) => !primary.includes(t)) })
  switch (subjectCode) {
    case 'MATH':
      return pick(['EQUATION', 'GRAPH', 'VARIATION_TABLE', 'GEOMETRY', 'TABLE', 'PARAGRAPH', 'HEADING', 'ANSWER_SPACE'])
    case 'PHYSICS':
    case 'SCIENCES':
    case 'TECH':
      return pick(['EQUATION', 'TABLE', 'GRAPH', 'IMAGE', 'PARAGRAPH', 'HEADING', 'ANSWER_SPACE'])
    case 'ARABIC':
      return pick(['POETRY', 'PARAGRAPH', 'HEADING', 'NOTE', 'ANSWER_SPACE', 'TABLE'])
    case 'FRENCH':
    case 'ENGLISH':
    case 'SPANISH':
    case 'GERMAN':
    case 'ITALIAN':
      return pick(['PARAGRAPH', 'HEADING', 'TABLE', 'NOTE', 'ANSWER_SPACE'])
    case 'PHILO':
    case 'HISTGEO':
    case 'ISLAMIC':
      return pick(['PARAGRAPH', 'HEADING', 'NOTE', 'TABLE', 'IMAGE', 'ANSWER_SPACE'])
    default:
      return pick(['PARAGRAPH', 'HEADING', 'TABLE', 'EQUATION', 'IMAGE', 'ANSWER_SPACE'])
  }
}

/** كتلة افتراضية جاهزة للتعديل من نوع معيّن */
export function defaultBlock(type: BlockType): StudioBlock {
  switch (type) {
    case 'HEADING':
      return { type, text: 'الجزء الأول', level: 2, align: 'start' }
    case 'PARAGRAPH':
      return { type, text: 'اكتب النصّ هنا…', align: 'start' }
    case 'EQUATION':
      return { type, latex: 'f(x) = \\ln\\left(x^2+1\\right) - x' }
    case 'GRAPH':
      return { type, graph: { functions: [{ expr: 'x^2 - 2', label: '(C_f)' }], xMin: -4, xMax: 4, yMin: -3, yMax: 5, grid: true, stepX: 1, stepY: 1, width: 110, frameLabels: true } }
    case 'GEOMETRY':
      return { type, figure: { xMin: -1, xMax: 6, yMin: -1, yMax: 5, grid: false, axes: false, width: 90, points: [{ id: 'A', x: 0, y: 0 }, { id: 'B', x: 4, y: 0 }, { id: 'C', x: 4, y: 3 }], segments: [{ from: 'A', to: 'B' }, { from: 'B', to: 'C' }, { from: 'C', to: 'A' }], rightAngles: [{ at: 'B', from: 'A', to: 'C' }] } }
    case 'TABLE':
      return { type, rows: [['x', '0', '1', '2'], ['f(x)', '', '', '']], headerRow: true, headerCol: true, align: 'center', borders: 'all' }
    case 'VARIATION_TABLE':
      return { type, table: { variable: 'x', xs: ['-\\infty', '0', '+\\infty'], sign: { label: "f'(x)", signs: ['-', '+'], marks: ['', '0', ''] }, variation: { label: 'f(x)', values: ['+\\infty', '-1', '+\\infty'], arrows: ['down', 'up'] } } }
    case 'POETRY':
      return { type, poet: '', title: '', verses: [{ sadr: '', ajz: '' }, { sadr: '', ajz: '' }] }
    case 'IMAGE':
      return { type, fileId: '00000000-0000-4000-8000-000000000000', widthPercent: 60, align: 'center' }
    case 'ANSWER_SPACE':
      return { type, lines: 5, style: 'lines' }
    case 'SEPARATOR':
      return { type, style: 'line' }
    case 'NOTE':
      return { type, text: 'ملاحظة: يُسمح باستعمال الآلة الحاسبة غير المبرمجة.', style: 'box' }
  }
}

/** وصف قصير للكتلة في قائمة الورقة والمكتبة */
export function blockSummary(b: StudioBlock): string {
  switch (b.type) {
    case 'HEADING':
      return b.text
    case 'PARAGRAPH':
    case 'NOTE':
      return b.text.slice(0, 80)
    case 'EQUATION':
      return b.latex.slice(0, 60)
    case 'GRAPH':
      return b.graph.functions.map((f) => f.expr).join(' · ') || 'منحنى'
    case 'GEOMETRY':
      return `${b.figure.points.length} نقاط`
    case 'TABLE':
      return `${b.rows.length}×${b.rows[0]?.length ?? 0}`
    case 'VARIATION_TABLE':
      return b.table.variation.label ?? 'جدول تغيّرات'
    case 'POETRY':
      return [b.poet, b.title].filter(Boolean).join(' — ') || `${b.verses.length} أبيات`
    case 'IMAGE':
      return b.caption ?? b.alt ?? 'صورة'
    case 'ANSWER_SPACE':
      return `${b.lines} أسطر`
    case 'SEPARATOR':
      return b.style === 'space' ? 'فراغ' : 'خطّ'
  }
}

/** معرّفات الصور التي تحتاج روابط موقّعة في العرض */
export function imageIdsOf(blocks: (StudioBlock | undefined | null)[]): string[] {
  return [...new Set(blocks.flatMap((b) => (b && b.type === 'IMAGE' ? [b.fileId] : [])))]
}
