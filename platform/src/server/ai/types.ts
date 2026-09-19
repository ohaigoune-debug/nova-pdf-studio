/**
 * واجهة الذكاء الاصطناعي المجرّدة. النظام لا يرتبط بنموذج واحد:
 * كل مزوّد (تجريبي، Anthropic، …) يحقّق هذه الواجهة، والاختيار عبر متغيّرات البيئة فقط.
 * لا يصل أي مفتاح إلى المتصفح؛ الاستدعاءات كلها من الخادم داخل Jobs.
 */

export interface EssayRubricItem {
  id: string
  label: string
  description: string | null
  maxPoints: number
  skillName: string | null
}

export interface EvaluateEssayInput {
  assignmentTitle: string
  /** نص الواجب / السؤال كما كتبه الأستاذ */
  prompt: string | null
  /** إجابة الطالب النصية */
  answerText: string
  maxScore: number
  rubric: EssayRubricItem[] | null
  /** المهارة العامة للواجب إن وُجدت */
  skillName: string | null
  /** المهارات المتاحة في النظام (بالأسماء) ليختار منها النموذج */
  knownSkills: string[]
}

export interface EvaluateEssayOutput {
  suggestedScore: number
  /** 0–1 */
  confidence: number
  rubricBreakdown: Record<string, number> | null
  strengths: string[]
  weaknesses: string[]
  mistakes: string[]
  skillsDetected: string[]
  skillsToImprove: string[]
  teacherNotesSuggestion: string
  raw?: Record<string, unknown>
}

export interface TeacherInsightsInput {
  teacherName: string
  /** حقائق مستخرجة من قاعدة البيانات (لا يخترع النموذج أرقاماً) */
  facts: string[]
}

export interface TeacherInsightsOutput {
  summary: string
  nextLessonSuggestions: string[]
  raw?: Record<string, unknown>
}

export interface GenerateExercisesInput {
  skillName: string
  /** وصف المهارة أو فئتها إن وُجد */
  skillCategory: string | null
  levelName: string | null
  count: number
}

export interface GeneratedQuestion {
  type: 'MCQ' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'FILL_BLANK'
  prompt: string
  options?: { label: string; isCorrect: boolean }[]
  answerKey: Record<string, unknown> | null
  explanation?: string
}

export interface GenerateExercisesOutput {
  title: string
  description: string
  questions: GeneratedQuestion[]
  raw?: Record<string, unknown>
}

export interface AnalyzeStudentInput {
  studentName: string
  facts: string[]
}

export interface AnalyzeStudentOutput {
  summary: string
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  raw?: Record<string, unknown>
}

export interface EssayBatchItem {
  /** معرّف يعود مع النتيجة (معرّف سجل التقييم) */
  customId: string
  input: EvaluateEssayInput
}

export type EssayBatchOutcome =
  | { type: 'succeeded'; output: EvaluateEssayOutput }
  /** permanent: الطلب نفسه مرفوض فلا تُعاد محاولته؛ وإلا فالفشل غير مفوتَر ويمكن إعادته فرادى */
  | { type: 'failed'; error: string; permanent: boolean }

export interface EssayBatchStatus {
  ended: boolean
  /** مفتاحها customId؛ فارغة ما دامت الدفعة قيد المعالجة */
  outcomes: Record<string, EssayBatchOutcome>
}

export interface AIProvider {
  readonly name: string
  readonly model: string
  evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput>
  generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput>
  /** تمارين علاجية لمهارة ضعيفة تُحفظ كمسودة اختبار يراجعها الأستاذ قبل النشر */
  generateExercises(input: GenerateExercisesInput): Promise<GenerateExercisesOutput>
  /** تحليل سردي لملف طالب من حقائق حقيقية (لا يخترع أرقاماً) */
  analyzeStudent(input: AnalyzeStudentInput): Promise<AnalyzeStudentOutput>
  /**
   * اختياري: تصحيح دفعة كاملة بنصف السعر؛ النتائج تُجلب لاحقاً بالاستطلاع.
   * المزوّد الذي لا يوفّرها يُعالَج فرادى.
   */
  submitEssayBatch?(items: EssayBatchItem[]): Promise<{ batchId: string }>
  fetchEssayBatch?(batchId: string, items: EssayBatchItem[]): Promise<EssayBatchStatus>
}
