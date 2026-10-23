/**
 * MADRASADZ PLAY — بنية السؤال (مشتركة بين ملفات المحتوى، المدقق، الخدمات، والواجهة).
 * لا يستورد هذا الملف أي شيء من الخادم حتى تستعمله مكوّنات العميل للأنواع فقط.
 */
import type { PlayDifficulty, PlayLanguage, PlayQuestionType, PlayReviewStatus, PlaySource } from './constants'

/** ما يُرسل للمتصفح (بلا مفتاح إجابة) */
export type PlayPublicPayload =
  | { type: 'MCQ'; options: { key: string; text: string }[] }
  | { type: 'FILL_BLANK'; segments: FillSegment[]; blanks: number; bank: string[] }
  | { type: 'MATCHING'; lefts: { key: string; text: string }[]; rights: { key: string; text: string }[] }
  | { type: 'ORDERING'; items: { key: string; text: string }[] }

export type FillSegment = { t: string } | { b: number }

/** مفتاح الإجابة (يبقى في الخادم حتى التصحيح) */
export type PlayAnswerKey =
  | { type: 'MCQ'; correct: string }
  | { type: 'FILL_BLANK'; answers: string[][] }
  | { type: 'MATCHING'; pairs: Record<string, string> }
  | { type: 'ORDERING'; order: string[] }

/** إجابة الطالب كما تصل من الواجهة */
export type PlayStudentAnswer =
  | { type: 'MCQ'; key: string }
  | { type: 'FILL_BLANK'; blanks: string[] }
  | { type: 'MATCHING'; matches: Record<string, string> }
  | { type: 'ORDERING'; order: string[] }

/** السؤال كما يُكتب في ملفات المحتوى content/play/**.json */
export interface PlayContentQuestion {
  /** مفتاح ثابت فريد عبر البنك كله، مثل 3AS-AR-U1-L2-0001 */
  key: string
  type: PlayQuestionType
  grade: string
  /** فارغة = كل شعب السنة */
  streams?: string[]
  subject: string
  unit: string
  lesson: string
  objective?: string
  difficulty: PlayDifficulty
  language?: PlayLanguage
  question: string
  /** MCQ */
  options?: string[]
  correct?: number
  /** FILL_BLANK: النص مع ____ لكل فراغ، الإجابات بترتيب الفراغات (كل فراغ قد يقبل بدائل)، وبنك الكلمات الكامل (الصحيحة + المشتتات) */
  blanks?: (string | string[])[]
  bank?: string[]
  /** MATCHING */
  pairs?: { left: string; right: string }[]
  /** ORDERING: العناصر بالترتيب الصحيح */
  order?: string[]
  explanation: string
  tags?: string[]
  /** تحقق حسابي اختياري: expression تُقيَّم ويُقارن الناتج بـ expected */
  verify?: { expression: string; expected: string | number; tolerance?: number }
  source?: PlaySource
  reviewStatus?: PlayReviewStatus
  note?: string
}

/** الصفوف المطبّعة الجاهزة للإدراج في قاعدة البيانات */
export interface NormalizedPlayQuestion {
  key: string
  type: PlayQuestionType
  gradeCode: string
  streamCodes: string[]
  subjectCode: string
  unitCode: string
  lessonCode: string
  objective: string | null
  difficulty: PlayDifficulty
  language: PlayLanguage
  questionText: string
  payload: PlayPublicPayload
  answerKey: PlayAnswerKey
  explanation: string
  tags: string[]
  contentHash: string
  source: PlaySource
  reviewStatus: PlayReviewStatus
  qualityFlags: string[]
  note: string | null
}

export interface GradeOutcome {
  isCorrect: boolean
  /** 0..1 للأسئلة المركّبة (ملء فراغات متعددة/مطابقة/ترتيب) */
  score: number
}
