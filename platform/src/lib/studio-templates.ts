/**
 * قوالب Madrasadz الرسمية للاستوديو (معرّفة في الكود، بلا صفوف في القاعدة):
 * تُستنسخ إلى مساحة الأستاذ امتحاناً كاملاً (ترويسة، تخطيط، كتل، تمارين فارغة بنقاطها) يعدّله كما يشاء.
 * المرحلة 1: الرياضيات 3AS (بكالوريا تجريبية، اختبار فصلي، فرض) + قالب عربي أساسي.
 */
import type { ExamHeader, ExamItemSnapshot, ExamLayout } from '@/server/db/schema/exams'
import type { StudioBlock } from './exam-blocks'

export interface StudioTemplateItem {
  kind: 'EXERCISE' | 'QUESTION' | 'TEXT' | 'PAGE_BREAK' | 'BLOCK'
  title?: string | null
  points?: number | null
  snapshot: ExamItemSnapshot
}

export interface StudioTemplate {
  id: string
  title: string
  description: string
  subjectCode: string
  levelCode: string
  streamCodes: string[] | null
  kind: 'TEST' | 'HOMEWORK' | 'BAC_MOCK' | 'BEM_MOCK' | 'QUIZ' | 'PRACTICE'
  schoolTerm?: 1 | 2 | 3 | null
  durationMinutes: number
  targetPoints?: number
  instructions?: string | null
  header: ExamHeader
  layout?: ExamLayout
  items: StudioTemplateItem[]
}

const block = (b: StudioBlock): StudioTemplateItem => ({ kind: 'BLOCK', snapshot: { body: '', block: b } })
const exercise = (title: string, points: number, body: string, children: { body: string; points: number }[] = [], figures?: StudioBlock[]): StudioTemplateItem => ({
  kind: 'EXERCISE',
  title,
  points: children.length ? null : points,
  snapshot: { kind: 'EXERCISE', type: 'OPEN', title: null, body, points, difficulty: 2, options: [], children: children.map((c) => ({ kind: 'QUESTION', type: 'OPEN', body: c.body, points: c.points, options: [] })), ...(figures?.length ? { figures } : {}) }
})

const MATH_BAC_HEADER: ExamHeader = { heading: 'بكالوريا تجريبية', showSources: false }
const MATH_LAYOUT: ExamLayout = { headerLayout: 'classic', showRepublic: true, showMinistry: true, studentFields: false, fontSize: 13, numbering: 'words', footer: { pageNumbers: true, text: '' } }

export const STUDIO_TEMPLATES: StudioTemplate[] = [
  {
    id: 'math-3as-bac-sci',
    title: 'بكالوريا تجريبية — رياضيات 3 علوم تجريبية',
    description: 'الهيكلة الرسمية: 4 تمارين (متتاليات، احتمالات، هندسة في الفضاء، دراسة دالة) بمجموع 20 ومدة 3 ساعات، مع منحنى وجدول تغيّرات جاهزين للتعديل.',
    subjectCode: 'MATH',
    levelCode: '3AS',
    streamCodes: ['SCI', 'GE', 'LIT'],
    kind: 'BAC_MOCK',
    durationMinutes: 210,
    targetPoints: 20,
    instructions: 'يعالج المترشح الموضوع الآتي: أربعة تمارين مستقلة.',
    header: MATH_BAC_HEADER,
    layout: MATH_LAYOUT,
    items: [
      block({ type: 'NOTE', text: 'يُسمح باستعمال الآلة الحاسبة غير المبرمجة. التمارين مستقلّة ويمكن معالجتها بأي ترتيب.', style: 'box' }),
      exercise('التمرين الأول', 4, 'نعتبر المتتالية العددية $(u_n)$ المعرّفة على $\\mathbb{N}$ بـ: $u_0 = 1$ و $u_{n+1} = \\frac{1}{2}u_n + 3$.', [
        { body: 'احسب $u_1$ و $u_2$.', points: 1 },
        { body: 'نضع $v_n = u_n - 6$. بيّن أن $(v_n)$ متتالية هندسية يُطلب تعيين أساسها وحدّها الأول.', points: 1.5 },
        { body: 'اكتب $v_n$ ثم $u_n$ بدلالة $n$، واحسب $\\lim_{n \\to +\\infty} u_n$.', points: 1.5 }
      ]),
      exercise('التمرين الثاني', 5, 'يحتوي كيس على 5 كرات بيضاء و3 كرات سوداء لا نفرّق بينها باللمس. نسحب عشوائياً وفي آن واحد كرتين من الكيس.', [
        { body: 'احسب احتمال الحادثة $A$: «الكرتان المسحوبتان من اللون نفسه».', points: 2 },
        { body: 'ليكن $X$ المتغيّر العشوائي الذي يرفق بكل سحبة عدد الكرات البيضاء المسحوبة. عيّن قانون احتمال $X$.', points: 2 },
        { body: 'احسب الأمل الرياضياتي $E(X)$.', points: 1 }
      ]),
      exercise(
        'التمرين الثالث',
        4,
        'الفضاء منسوب إلى معلم متعامد ومتجانس $(O;\\vec{i},\\vec{j},\\vec{k})$. نعتبر النقط $A(1;0;2)$، $B(0;1;1)$ و $C(2;1;0)$.',
        [
          { body: 'بيّن أن النقط $A$، $B$ و $C$ تعيّن مستوياً $(ABC)$.', points: 1 },
          { body: 'بيّن أن الشعاع $\\vec{n}(1;1;1)$ ناظمي للمستوي $(ABC)$ ثم اكتب معادلة ديكارتية له.', points: 1.5 },
          { body: 'احسب المسافة بين النقطة $O$ والمستوي $(ABC)$.', points: 1.5 }
        ]
      ),
      { kind: 'PAGE_BREAK', snapshot: { body: '' } },
      exercise(
        'التمرين الرابع',
        7,
        'نعتبر الدالة $f$ المعرّفة على $]0;+\\infty[$ بـ: $f(x) = x - 1 - \\frac{\\ln x}{x}$، و $(C_f)$ تمثيلها البياني في معلم متعامد ومتجانس $(O;\\vec{i},\\vec{j})$.',
        [
          { body: 'احسب $\\lim_{x \\to 0^+} f(x)$ و $\\lim_{x \\to +\\infty} f(x)$.', points: 1 },
          { body: 'ادرس اتجاه تغيّر $f$ ثم شكّل جدول تغيّراتها.', points: 2 },
          { body: 'بيّن أن المستقيم $(\\Delta)$ ذا المعادلة $y = x - 1$ مقارب مائل لـ $(C_f)$ بجوار $+\\infty$، وادرس وضعيته بالنسبة إلى $(C_f)$.', points: 1.5 },
          { body: 'أنشئ $(\\Delta)$ و $(C_f)$.', points: 1.5 },
          { body: 'ناقش بيانياً، حسب قيم الوسيط الحقيقي $m$، عدد حلول المعادلة $f(x) = x + m$.', points: 1 }
        ],
        [
          { type: 'GRAPH', graph: { functions: [{ expr: 'x - 1 - ln(x)/x', label: '(C_f)', domain: [0.05, 6] }, { expr: 'x - 1', label: '(Δ)', dashed: true }], xMin: -1, xMax: 6, yMin: -3, yMax: 5, grid: true, stepX: 1, stepY: 1, width: 100, verticalAsymptotes: [0], frameLabels: true }, caption: 'منحنى الدالة $f$ والمستقيم المقارب' },
          { type: 'VARIATION_TABLE', table: { variable: 'x', xs: ['0', '1', '+\\infty'], sign: { label: "f'(x)", signs: ['+', '+'], marks: ['||', '', ''] }, variation: { label: 'f(x)', values: ['+\\infty', '', '+\\infty'], arrows: ['up', 'up'] } } }
        ]
      )
    ]
  },
  {
    id: 'math-3as-bac-math',
    title: 'بكالوريا تجريبية — رياضيات / تقني رياضي',
    description: 'الهيكلة الرسمية للشعبتين: أعداد مركّبة، متتاليات أو حساب، هندسة في الفضاء، ومسألة دوال — 4 ساعات ونصف.',
    subjectCode: 'MATH',
    levelCode: '3AS',
    streamCodes: ['MATH', 'TM'],
    kind: 'BAC_MOCK',
    durationMinutes: 270,
    targetPoints: 20,
    instructions: 'يعالج المترشح الموضوع الآتي: أربعة تمارين مستقلة.',
    header: MATH_BAC_HEADER,
    layout: MATH_LAYOUT,
    items: [
      block({ type: 'NOTE', text: 'يُسمح باستعمال الآلة الحاسبة غير المبرمجة.', style: 'box' }),
      exercise('التمرين الأول', 5, 'المستوي المركّب منسوب إلى معلم متعامد ومتجانس $(O;\\vec{u},\\vec{v})$. نعتبر النقط $A$، $B$ و $C$ التي لواحقها على الترتيب $z_A = 1 + i\\sqrt{3}$، $z_B = \\overline{z_A}$ و $z_C = -2$.', [
        { body: 'اكتب $z_A$ على الشكل الأسّي.', points: 1 },
        { body: 'بيّن أن المثلث $ABC$ متقايس الأضلاع.', points: 2 },
        { body: 'عيّن طبيعة التحويل $S$ الذي يحوّل $A$ إلى $B$ و $B$ إلى $C$ وعناصره المميّزة.', points: 2 }
      ]),
      exercise('التمرين الثاني', 4, 'نعتبر المتتالية $(u_n)$ المعرّفة بـ $u_0 = 2$ و $u_{n+1} = \\sqrt{2u_n + 3}$ لكل عدد طبيعي $n$.', [
        { body: 'بيّن بالتراجع أن $0 < u_n < 3$ لكل $n$.', points: 1.5 },
        { body: 'ادرس اتجاه تغيّر $(u_n)$ واستنتج أنها متقاربة.', points: 1.5 },
        { body: 'احسب نهايتها.', points: 1 }
      ]),
      exercise('التمرين الثالث', 5, 'الفضاء منسوب إلى معلم متعامد ومتجانس $(O;\\vec{i},\\vec{j},\\vec{k})$. نعتبر المستوي $(P)$: $x + 2y - z + 1 = 0$ والنقطة $A(2;1;3)$.', [
        { body: 'اكتب تمثيلاً وسيطياً للمستقيم $(D)$ المارّ من $A$ والعمودي على $(P)$.', points: 1.5 },
        { body: 'عيّن إحداثيات النقطة $H$ المسقط العمودي لـ $A$ على $(P)$.', points: 2 },
        { body: 'استنتج المسافة $d(A,(P))$.', points: 1.5 }
      ]),
      { kind: 'PAGE_BREAK', snapshot: { body: '' } },
      exercise(
        'التمرين الرابع',
        6,
        'نعتبر الدالة $g$ المعرّفة على $\\mathbb{R}$ بـ $g(x) = (x+1)e^{-x}$ و $(C_g)$ تمثيلها البياني.',
        [
          { body: 'احسب النهايتين عند $-\\infty$ و $+\\infty$ وفسّر بيانياً.', points: 1.5 },
          { body: 'ادرس تغيّرات $g$ وشكّل جدول تغيّراتها.', points: 2 },
          { body: 'اكتب معادلة المماس $(T)$ عند النقطة ذات الفاصلة $0$.', points: 1 },
          { body: 'احسب $\\int_0^1 g(x)\\,dx$ وفسّر النتيجة بيانياً.', points: 1.5 }
        ],
        [{ type: 'GRAPH', graph: { functions: [{ expr: '(x+1)*exp(-x)', label: '(C_g)' }], xMin: -3, xMax: 5, yMin: -3, yMax: 3, grid: true, stepX: 1, stepY: 1, width: 100, horizontalAsymptotes: [0], frameLabels: true } }]
      )
    ]
  },
  {
    id: 'math-3as-test-t1',
    title: 'اختبار الفصل الأول — رياضيات 3AS',
    description: 'ساعتان، ثلاثة تمارين (متتاليات، دوال، احتمالات) بمجموع 20، مع ملاحظة الآلة الحاسبة ومساحة إجابة.',
    subjectCode: 'MATH',
    levelCode: '3AS',
    streamCodes: null,
    kind: 'TEST',
    schoolTerm: 1,
    durationMinutes: 120,
    targetPoints: 20,
    header: { heading: 'اختبار الفصل الأول' },
    layout: { ...MATH_LAYOUT, studentFields: true },
    items: [
      block({ type: 'NOTE', text: 'تُراعى الدقّة في التعليل ووضوح الخطّ. يُسمح باستعمال الآلة الحاسبة.', style: 'box' }),
      exercise('التمرين الأول', 6, 'متتالية عددية $(u_n)$ معرّفة بحدّها الأول $u_0$ وعلاقة تراجعية (يكملها الأستاذ).', [
        { body: 'احسب الحدود الأولى.', points: 2 },
        { body: 'بيّن أن المتتالية المساعدة $(v_n)$ هندسية.', points: 2 },
        { body: 'استنتج $u_n$ بدلالة $n$ ونهايتها.', points: 2 }
      ]),
      exercise('التمرين الثاني', 8, 'دالة $f$ معرّفة على مجال (يكملها الأستاذ) وتمثيلها البياني $(C_f)$.', [
        { body: 'احسب النهايات عند أطراف مجال التعريف.', points: 2 },
        { body: 'ادرس اتجاه التغيّر وشكّل جدول التغيّرات.', points: 3 },
        { body: 'أنشئ $(C_f)$.', points: 3 }
      ]),
      exercise('التمرين الثالث', 6, 'تجربة عشوائية (يكملها الأستاذ).', [
        { body: 'احسب احتمال الحوادث المطلوبة.', points: 3 },
        { body: 'عيّن قانون احتمال المتغيّر العشوائي $X$ واحسب أمله الرياضياتي.', points: 3 }
      ])
    ]
  },
  {
    id: 'math-3as-homework',
    title: 'فرض محروس — رياضيات 3AS',
    description: 'ساعة واحدة، تمرينان بمجموع 20 ومساحة إجابة على الورقة نفسها.',
    subjectCode: 'MATH',
    levelCode: '3AS',
    streamCodes: null,
    kind: 'HOMEWORK',
    durationMinutes: 60,
    targetPoints: 20,
    header: { heading: 'فرض محروس' },
    layout: { ...MATH_LAYOUT, studentFields: true, headerLayout: 'compact' },
    items: [
      exercise('التمرين الأول', 10, 'نصّ التمرين الأول (يكمله الأستاذ).', [
        { body: 'السؤال 1', points: 5 },
        { body: 'السؤال 2', points: 5 }
      ]),
      block({ type: 'ANSWER_SPACE', lines: 10, style: 'lines', label: 'الإجابة' }),
      exercise('التمرين الثاني', 10, 'نصّ التمرين الثاني (يكمله الأستاذ).', [
        { body: 'السؤال 1', points: 5 },
        { body: 'السؤال 2', points: 5 }
      ]),
      block({ type: 'ANSWER_SPACE', lines: 10, style: 'lines', label: 'الإجابة' })
    ]
  },
  {
    id: 'arabic-3as-bac-lit',
    title: 'بكالوريا تجريبية — اللغة العربية وآدابها (آداب وفلسفة)',
    description: 'النصّ (كتلة شعر صدر|عجز) ثم البناء الفكري 8، البناء اللغوي 4، التقويم النقدي 4، الوضعية الإدماجية 4.',
    subjectCode: 'ARABIC',
    levelCode: '3AS',
    streamCodes: ['LIT', 'LANG'],
    kind: 'BAC_MOCK',
    durationMinutes: 210,
    targetPoints: 20,
    instructions: 'يعالج المترشح الموضوع الآتي: النصّ ثم الأسئلة.',
    header: { heading: 'بكالوريا تجريبية' },
    layout: { headerLayout: 'classic', fontSize: 13.5, numbering: 'words' },
    items: [
      block({ type: 'HEADING', text: 'النصّ', level: 1 }),
      block({ type: 'POETRY', poet: 'اسم الشاعر', title: 'عنوان القصيدة', verses: [{ sadr: 'الصدر الأول…', ajz: 'العجز الأول…' }, { sadr: 'الصدر الثاني…', ajz: 'العجز الثاني…' }], notes: '**الشرح:** …' }),
      block({ type: 'HEADING', text: 'الأسئلة', level: 1 }),
      exercise('البناء الفكري', 8, 'أجب عن الأسئلة الآتية:', [
        { body: 'ما القضية التي يعالجها الشاعر؟ وما موقفه منها؟', points: 2 },
        { body: 'ما النمط الغالب على النصّ؟ اذكر مؤشّرين له.', points: 2 },
        { body: 'استخرج الأفكار الأساسية.', points: 2 },
        { body: 'ما المذهب الأدبي الذي ينتمي إليه النصّ؟ علّل.', points: 2 }
      ]),
      exercise('البناء اللغوي', 4, 'أجب عن الأسئلة الآتية:', [
        { body: 'أعرب ما تحته خطّ.', points: 1.5 },
        { body: 'حدّد صورة بيانية واشرحها وبيّن أثرها.', points: 1.5 },
        { body: 'ما دلالة تكرار … في النصّ؟', points: 1 }
      ]),
      exercise('التقويم النقدي', 4, 'ناقش في فقرة قصيرة (يكملها الأستاذ).', []),
      exercise('الوضعية الإدماجية', 4, 'اكتب نصّاً حجاجياً من اثني عشر سطراً (يحدّد الأستاذ الموضوع) موظّفاً حجّتين وأسلوب الشرط وصورة بيانية.', [])
    ]
  }
]

export function studioTemplateById(id: string): StudioTemplate | undefined {
  return STUDIO_TEMPLATES.find((t) => t.id === id)
}
