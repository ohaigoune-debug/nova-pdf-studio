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
  /** مادة الأستاذ (من مساحة عمله أو الواجب)؛ بدونها تبقى التعليمات عامة */
  subject?: string | null
  assignmentTitle: string
  /** نص الواجب / السؤال كما كتبه الأستاذ */
  prompt: string | null
  /** إجابة الطالب النصية */
  answerText: string
  /** الحل النموذجي للأستاذ — إن وُجد فهو المرجع الوحيد للمقارنة والعلامة */
  modelAnswer?: string | null
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
  /** مقارنة بالحل النموذجي: ما وافقه التلميذ، وما غاب أو خالف */
  matched?: string[]
  missing?: string[]
  raw?: Record<string, unknown>
}

export interface TeacherInsightsInput {
  /** مادة الأستاذ (من مساحة عمله أو الواجب)؛ بدونها تبقى التعليمات عامة */
  subject?: string | null
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
  /** مادة الأستاذ (من مساحة عمله أو الواجب)؛ بدونها تبقى التعليمات عامة */
  subject?: string | null
  skillName: string
  /** وصف المهارة أو فئتها إن وُجد */
  skillCategory: string | null
  levelName: string | null
  count: number
  /**
   * مقاطع من مجلد Drive الأستاذ — المصدر الوحيد للأسئلة: لا يُسأل عن شيء ليس فيها.
   * (تُختار بما يخصّ المهارة؛ الخدمة ترفض الطلب إن لم يوجد شيء.)
   */
  sources: { title: string; text: string }[]
  /** أنواع الأسئلة المسموحة (فارغة ⇒ كلّها) */
  questionTypes?: GeneratedQuestion['type'][]
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
  /** مادة الأستاذ (من مساحة عمله أو الواجب)؛ بدونها تبقى التعليمات عامة */
  subject?: string | null
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

export interface OrganizePlaylistItem {
  youtubeId: string
  /** العنوان كما هو على يوتيوب */
  title: string
  description: string | null
}

export interface OrganizeLessonsInput {
  /** مادة الأستاذ (من مساحة عمله أو الواجب)؛ بدونها تبقى التعليمات عامة */
  subject?: string | null
  playlistTitle: string | null
  levelName: string | null
  streamName: string | null
  items: OrganizePlaylistItem[]
  /** فيديوهات يوتيوب (الافتراضي) أو ملفات دروس؛ للملفات يكون youtubeId مفتاحاً داخلياً والوصف مقتطفاً من النص */
  kind?: 'videos' | 'files'
}

export interface OrganizedLesson {
  youtubeId: string
  /** عنوان عربي نظيف بلا زخارف ولا اسم القناة */
  title: string
  /** سطران يصفان ما يتعلّمه الطالب */
  summary: string
  /** المحور/الوحدة */
  topic: string | null
  /** ترتيب بيداغوجي مقترح يبدأ من 1 */
  order: number
}

export interface OrganizeLessonsOutput {
  lessons: OrganizedLesson[]
  raw?: Record<string, unknown>
}

/** مسودة من ملف واحد يختاره الأستاذ: واجب (نص + حل نموذجي) أو شرح للتلاميذ */
export interface DraftFromSourceInput {
  subject?: string | null
  mode: 'assignment' | 'explanation'
  fileTitle: string
  text: string
}

export interface DraftFromSourceOutput {
  title: string
  /** واجب: نص الموضوع/التمرين كما يُعطى للتلميذ */
  statement: string
  /** واجب: الحل النموذجي — من الملف إن وُجد فيه، وإلا مقترح يراجعه الأستاذ */
  modelAnswer: string
  /** هل الحل مأخوذ من الملف نفسه؟ */
  solutionInSource: boolean
  /** شرح: ملخّص سطرين ونصّ الشرح */
  summary: string
  body: string
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
   * تنظيم قائمة تشغيل يوتيوب دروساً: عنوان عربي وملخّص ومحور وترتيب بيداغوجي.
   * المزوّد الذي لا يوفّرها ⇒ يُستورد كما هو بترتيب القائمة.
   */
  organizeLessons?(input: OrganizeLessonsInput): Promise<OrganizeLessonsOutput>
  /** مسودة واجب أو شرح من ملف واحد — يراجعها الأستاذ قبل أي نشر */
  draftFromSource?(input: DraftFromSourceInput): Promise<DraftFromSourceOutput>
  /**
   * اختياري: تصحيح دفعة كاملة بنصف السعر؛ النتائج تُجلب لاحقاً بالاستطلاع.
   * المزوّد الذي لا يوفّرها يُعالَج فرادى.
   */
  submitEssayBatch?(items: EssayBatchItem[]): Promise<{ batchId: string }>
  fetchEssayBatch?(batchId: string, items: EssayBatchItem[]): Promise<EssayBatchStatus>
}
