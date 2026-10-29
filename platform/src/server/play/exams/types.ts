/**
 * MADRASA PLAY — بنية مجموعة تدريب مشتقة من فرض أو اختبار أو بكالوريا (05_QUESTION_SCHEMA).
 * ملف واحد = موضوع واحد (مصدر أصلي + أسئلته الأصلية + عناصر سلّم التنقيط + خطوات تدريبية).
 * لا يستورد هذا الملف شيئًا من الخادم حتى تستعمله الواجهة للأنواع فقط.
 */
import type { PlayExamKind, PlayExamSetStatus } from '../constants'
import type { StepExcerpt } from './excerpt'

/** درجة الثقة في المصدر */
/** owner_authored = من إعداد صاحب المنصة (فروضه واختباراته وحلوله النموذجية) */
export type ExamTrust = 'official' | 'official_mirror' | 'owner_authored' | 'teacher_verified' | 'third_party' | 'synthetic_fixture'

export interface ExamSource {
  source_id: string
  kind: PlayExamKind
  /** سنة الامتحان (البكالوريا) أو السنة الدراسية التي يبدأ بها الموسم (الفروض والاختبارات) */
  year: number | null
  level: string
  /** شعب PLAY (SCI، MATH، LIT…)؛ فارغة = كل شعب المستوى */
  streams: string[]
  /** رمز مادة PLAY (HIST، GEO، MATH…) */
  subject: string
  /** الفصل 1–3 للفروض والاختبارات */
  term: number | null
  /** الموضوع الأول أو الثاني في البكالوريا */
  paper: 1 | 2 | null
  title: string
  original_url: string | null
  original_file_ref: string | null
  correction_url: string | null
  correction_file_ref: string | null
  trust: ExamTrust
  /** تحقق بشري من مطابقة النص والتصحيح للأصل */
  verified: boolean
  verified_by: string | null
  verified_at: string | null
  notes: string | null
}

export interface RubricElement {
  id: string
  label: string
  /** العلامة في سلّم التصحيح الأصلي */
  max_points: number
  verified: boolean
  /**
   * عنصر خاص ببعض الشعب (سؤال بفرعين: «أ) لشعبة آداب وفلسفة / ب) لشعبة لغات أجنبية»).
   * غائب أو فارغ = لكل شعب الموضوع. لكل شعبة يجب أن يساوي مجموع عناصرها علامة السؤال.
   */
  streams?: string[]
}

export interface SourceDocument {
  id: string
  kind: 'text' | 'table' | 'image' | 'map' | 'graph'
  caption: string
  /** نص الوثيقة كما هو، أو جدول [صف][عمود] */
  text?: string
  table?: string[][]
  /** صورة أو خريطة محفوظة محليًا (public/…) مع إسنادها */
  media?: MediaRef
}

export interface OriginalQuestion {
  id: string
  /** الترقيم الأصلي: «الجزء الأول — التاريخ — 1» */
  number: string
  part: string
  /** نص السؤال الأصلي حرفيًا كما في الورقة (لا يُعدَّل) */
  verbatim_text: string
  documents: SourceDocument[]
  rubric_total: number
  rubric_elements: RubricElement[]
}

export interface MediaRef {
  /** المسار المحلي في public/ (يُخدم كـ /…) */
  local_path: string
  source_url: string
  attribution: string
  license: string
  image_verified_at: string | null
  sha256: string | null
  width: number | null
  height: number | null
  /** ما تمثله الصورة بالضبط (شخصية لا نصب تذكاري…) */
  depicts: string
  alt: string
}

/* ───────────────────────────── التفاعلات ───────────────────────────── */

/** الأنواع التي تعرضها الواجهة الآن */
export const SUPPORTED_STEP_TYPES = ['mcq', 'multi', 'fill_blank', 'ordering', 'matching', 'portrait', 'numeric', 'short_text'] as const
/** أنواع في طابور العمل: لا تُحوَّل قسرًا إلى اختيار من متعدد ولا تُنشر قبل دعمها */
export const QUEUED_STEP_TYPES = ['table_fill', 'bar_chart', 'variation_table', 'function_plot', 'map_locate', 'essay_builder'] as const
export type StepType = (typeof SUPPORTED_STEP_TYPES)[number] | (typeof QUEUED_STEP_TYPES)[number]

export type StepPayload =
  | { type: 'mcq'; options: string[] }
  | { type: 'multi'; options: string[] }
  | { type: 'fill_blank'; text: string; bank: string[] }
  | { type: 'ordering'; items: string[] }
  | { type: 'matching'; lefts: string[]; rights: string[] }
  | { type: 'portrait'; media: MediaRef; options: string[] }
  | { type: 'numeric'; unit: string | null }
  | { type: 'short_text' }
  | { type: (typeof QUEUED_STEP_TYPES)[number]; spec: Record<string, unknown> }

export type StepAnswerKey =
  | { type: 'mcq'; correct: number }
  | { type: 'multi'; correct: number[] }
  | { type: 'fill_blank'; blanks: string[][] }
  | { type: 'ordering'; order: number[] }
  | { type: 'matching'; pairs: number[] }
  | { type: 'portrait'; correct: number }
  | { type: 'numeric'; value: number; tolerance: number; unit: string | null }
  | { type: 'short_text'; accepted: string[] }
  | { type: (typeof QUEUED_STEP_TYPES)[number]; spec: Record<string, unknown> }

/** إجابة التلميذ كما تصل للخادم */
export type StepAnswer =
  | { type: 'mcq'; choice: number }
  | { type: 'multi'; choices: number[] }
  | { type: 'fill_blank'; blanks: string[] }
  | { type: 'ordering'; order: number[] }
  | { type: 'matching'; pairs: number[] }
  | { type: 'portrait'; choice: number }
  | { type: 'numeric'; value: number }
  | { type: 'short_text'; text: string }

export type StepReviewStatus = 'generated' | 'auto_validated' | 'needs_human_review' | 'needs_media_review' | 'needs_engine_support' | 'approved' | 'rejected'

export interface TrainingStep {
  id: string
  source_question_id: string
  rubric_element_id: string
  /** معرّف المتغيّر عند تعدد الخطوات للعنصر نفسه */
  variant: string
  type: StepType
  prompt: string
  payload: StepPayload
  answer: StepAnswerKey
  explanation: string
  /** وزن الخطوة من علامة العنصر الأصلي (مجموع أوزان العنصر = علامته) */
  points: number
  skill_id: string | null
  /** درس PLAY المرتبط (GRADE-SUBJECT-UNIT-LESSON) عند وجوده، بلا نسخ للسؤال */
  lesson_ref: string | null
  /** true فقط إن كانت الخطوة هي نص السؤال الأصلي حرفيًا */
  is_verbatim_original: boolean
  review_status: StepReviewStatus
}

export interface ExamSetDocument {
  schema_version: 1
  set_id: string
  status: PlayExamSetStatus
  /** مجموعة اختبار للمحرك فقط: لا تُستورد للإنتاج ولا تُنسب لأي امتحان */
  fixture?: boolean
  source: ExamSource
  original_questions: OriginalQuestion[]
  steps: TrainingStep[]
  /** 20 للبكالوريا؛ مجموع سلّم الفرض/الاختبار الأصلي لغيرها */
  score_total: number
  modes: ('PRACTICE' | 'EXAM')[]
  /** خطوات التدقيق البشري */
  review_log: { at: string; by: string; action: string; note: string | null }[]
}

/** ما يُرسل للمتصفح: بلا مفاتيح إجابة */
export interface PublicStep {
  id: string
  index: number
  type: StepType
  prompt: string
  payload: StepPayload
  points: number
  source_question: { id: string; number: string; part: string; verbatim_text: string; documents: SourceDocument[] }
  rubric_label: string
  is_verbatim_original: boolean
  /** الأبيات أو الجمل التي يحيل إليها السؤال، من نصّ الموضوع نفسه (انظر excerpt.ts) */
  excerpt: StepExcerpt | null
}
