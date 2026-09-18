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

export interface AIProvider {
  readonly name: string
  readonly model: string
  evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput>
  generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput>
}
