/**
 * MADRASADZ PLAY — ثوابت التصنيف الدراسي وأنواع الألعاب.
 * المراحل/السنوات/الشعب نصوص ثابتة (لا ENUM في قاعدة البيانات) حتى تُضاف سنوات جديدة بلا هجرة.
 */

export const PLAY_CYCLES = ['PRIMARY', 'MIDDLE', 'SECONDARY'] as const
export type PlayCycle = (typeof PLAY_CYCLES)[number]

export interface PlayGrade {
  code: string
  cycle: PlayCycle
  nameAr: string
  shortAr: string
  /** الشعب المتاحة في هذه السنة (فارغة = لا شعب) */
  streams: readonly string[]
  sortOrder: number
  /** تظهر للطالب (قد تُعطَّل سنة بلا محتوى بعد) */
  isActive: boolean
}

export const PLAY_GRADES: readonly PlayGrade[] = [
  { code: '1AP', cycle: 'PRIMARY', nameAr: 'السنة الأولى ابتدائي', shortAr: '1 ابتدائي', streams: [], sortOrder: 1, isActive: false },
  { code: '2AP', cycle: 'PRIMARY', nameAr: 'السنة الثانية ابتدائي', shortAr: '2 ابتدائي', streams: [], sortOrder: 2, isActive: false },
  { code: '3AP', cycle: 'PRIMARY', nameAr: 'السنة الثالثة ابتدائي', shortAr: '3 ابتدائي', streams: [], sortOrder: 3, isActive: false },
  { code: '4AP', cycle: 'PRIMARY', nameAr: 'السنة الرابعة ابتدائي', shortAr: '4 ابتدائي', streams: [], sortOrder: 4, isActive: false },
  { code: '5AP', cycle: 'PRIMARY', nameAr: 'السنة الخامسة ابتدائي', shortAr: '5 ابتدائي', streams: [], sortOrder: 5, isActive: false },
  { code: '1AM', cycle: 'MIDDLE', nameAr: 'السنة الأولى متوسط', shortAr: '1 متوسط', streams: [], sortOrder: 6, isActive: false },
  { code: '2AM', cycle: 'MIDDLE', nameAr: 'السنة الثانية متوسط', shortAr: '2 متوسط', streams: [], sortOrder: 7, isActive: false },
  { code: '3AM', cycle: 'MIDDLE', nameAr: 'السنة الثالثة متوسط', shortAr: '3 متوسط', streams: [], sortOrder: 8, isActive: false },
  { code: '4AM', cycle: 'MIDDLE', nameAr: 'السنة الرابعة متوسط (BEM)', shortAr: '4 متوسط', streams: [], sortOrder: 9, isActive: true },
  { code: '1AS', cycle: 'SECONDARY', nameAr: 'السنة الأولى ثانوي', shortAr: '1 ثانوي', streams: ['TC_SCI', 'TC_LIT'], sortOrder: 10, isActive: true },
  { code: '2AS', cycle: 'SECONDARY', nameAr: 'السنة الثانية ثانوي', shortAr: '2 ثانوي', streams: ['SCI', 'MATH', 'TM', 'GE', 'LIT', 'LANG'], sortOrder: 11, isActive: true },
  { code: '3AS', cycle: 'SECONDARY', nameAr: 'السنة الثالثة ثانوي (BAC)', shortAr: '3 ثانوي', streams: ['SCI', 'MATH', 'TM', 'GE', 'LIT', 'LANG'], sortOrder: 12, isActive: true }
]

export const PLAY_STREAMS: readonly { code: string; nameAr: string; sortOrder: number }[] = [
  { code: 'TC_SCI', nameAr: 'جذع مشترك علوم وتكنولوجيا', sortOrder: 1 },
  { code: 'TC_LIT', nameAr: 'جذع مشترك آداب', sortOrder: 2 },
  { code: 'SCI', nameAr: 'علوم تجريبية', sortOrder: 3 },
  { code: 'MATH', nameAr: 'رياضيات', sortOrder: 4 },
  { code: 'TM', nameAr: 'تقني رياضي', sortOrder: 5 },
  { code: 'GE', nameAr: 'تسيير واقتصاد', sortOrder: 6 },
  { code: 'LIT', nameAr: 'آداب وفلسفة', sortOrder: 7 },
  { code: 'LANG', nameAr: 'لغات أجنبية', sortOrder: 8 }
]

export const PLAY_CYCLE_NAMES: Record<PlayCycle, string> = { PRIMARY: 'الطور الابتدائي', MIDDLE: 'الطور المتوسط', SECONDARY: 'الطور الثانوي' }

export function gradeByCode(code: string): PlayGrade | undefined {
  return PLAY_GRADES.find((g) => g.code === code)
}

export function streamName(code: string | null | undefined): string {
  if (!code) return ''
  return PLAY_STREAMS.find((s) => s.code === code)?.nameAr ?? code
}

export interface PlaySubjectDef {
  code: string
  nameAr: string
  nameFr: string
  language: PlayLanguage
  color: string
  icon: string
  sortOrder: number
}

/** المواد (تُزامَن إلى جدول play_subjects) */
export const PLAY_SUBJECTS: readonly PlaySubjectDef[] = [
  { code: 'AR', nameAr: 'اللغة العربية وآدابها', nameFr: 'Arabe', language: 'ar', color: 'emerald', icon: 'Feather', sortOrder: 1 },
  { code: 'MATH', nameAr: 'الرياضيات', nameFr: 'Mathématiques', language: 'ar', color: 'blue', icon: 'Sigma', sortOrder: 2 },
  { code: 'PHYS', nameAr: 'العلوم الفيزيائية', nameFr: 'Sciences physiques', language: 'ar', color: 'violet', icon: 'Atom', sortOrder: 3 },
  { code: 'SVT', nameAr: 'علوم الطبيعة والحياة', nameFr: 'Sciences de la nature et de la vie', language: 'ar', color: 'green', icon: 'Leaf', sortOrder: 4 },
  { code: 'FR', nameAr: 'اللغة الفرنسية', nameFr: 'Français', language: 'fr', color: 'sky', icon: 'Languages', sortOrder: 5 },
  { code: 'EN', nameAr: 'اللغة الإنجليزية', nameFr: 'Anglais', language: 'en', color: 'rose', icon: 'Languages', sortOrder: 6 },
  { code: 'HIST', nameAr: 'التاريخ', nameFr: 'Histoire', language: 'ar', color: 'amber', icon: 'Landmark', sortOrder: 7 },
  { code: 'GEO', nameAr: 'الجغرافيا', nameFr: 'Géographie', language: 'ar', color: 'teal', icon: 'Globe', sortOrder: 8 },
  { code: 'ISL', nameAr: 'العلوم الإسلامية', nameFr: 'Sciences islamiques', language: 'ar', color: 'lime', icon: 'Star', sortOrder: 9 },
  { code: 'CIV', nameAr: 'التربية المدنية', nameFr: 'Éducation civique', language: 'ar', color: 'cyan', icon: 'Scale', sortOrder: 10 },
  { code: 'PHILO', nameAr: 'الفلسفة', nameFr: 'Philosophie', language: 'ar', color: 'fuchsia', icon: 'Lightbulb', sortOrder: 11 },
  { code: 'ECO', nameAr: 'الاقتصاد والمناجمنت', nameFr: 'Économie et management', language: 'ar', color: 'orange', icon: 'TrendingUp', sortOrder: 12 },
  { code: 'ACC', nameAr: 'التسيير المحاسبي والمالي', nameFr: 'Gestion comptable et financière', language: 'ar', color: 'yellow', icon: 'Calculator', sortOrder: 13 },
  { code: 'LAW', nameAr: 'القانون', nameFr: 'Droit', language: 'ar', color: 'slate', icon: 'Gavel', sortOrder: 14 },
  { code: 'TECH', nameAr: 'التكنولوجيا / الهندسة', nameFr: 'Technologie', language: 'ar', color: 'zinc', icon: 'Cog', sortOrder: 15 },
  { code: 'INFO', nameAr: 'الإعلام الآلي', nameFr: 'Informatique', language: 'ar', color: 'indigo', icon: 'Cpu', sortOrder: 16 }
]

export function subjectName(code: string): string {
  return PLAY_SUBJECTS.find((s) => s.code === code)?.nameAr ?? code
}

/** أنواع الأسئلة/الألعاب */
export const PLAY_QUESTION_TYPES = ['MCQ', 'FILL_BLANK', 'MATCHING', 'ORDERING'] as const
export type PlayQuestionType = (typeof PLAY_QUESTION_TYPES)[number]

export const PLAY_DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const
export type PlayDifficulty = (typeof PLAY_DIFFICULTIES)[number]

export const PLAY_LANGUAGES = ['ar', 'fr', 'en'] as const
export type PlayLanguage = (typeof PLAY_LANGUAGES)[number]

export const PLAY_REVIEW_STATUSES = ['DRAFT', 'AUTO_VALIDATED', 'NEEDS_REVIEW', 'APPROVED', 'PUBLISHED', 'REJECTED'] as const
export type PlayReviewStatus = (typeof PLAY_REVIEW_STATUSES)[number]

/** الحالات التي تُقدَّم للطالب افتراضياً (قابلة للتضييق من الإعدادات) */
export const PLAY_SERVABLE_STATUSES: readonly PlayReviewStatus[] = ['AUTO_VALIDATED', 'APPROVED', 'PUBLISHED']

export const PLAY_SOURCES = ['AI_AUTHORED', 'TEACHER', 'IMPORT', 'LEGACY_QCM'] as const
export type PlaySource = (typeof PLAY_SOURCES)[number]

export const PLAY_CHALLENGE_TYPES = ['QUICK10', 'LESSON_MASTERY', 'UNIT_REVIEW', 'DAILY', 'BAC', 'HARD', 'MISTAKES'] as const
export type PlayChallengeType = (typeof PLAY_CHALLENGE_TYPES)[number]

export const PLAY_SESSION_STATUSES = ['ACTIVE', 'COMPLETED', 'ABANDONED', 'EXPIRED'] as const
export type PlaySessionStatus = (typeof PLAY_SESSION_STATUSES)[number]

/* ─────────── الفروض والاختبارات والبكالوريا (مجموعات تدريب مشتقة من مصادر أصلية) ─────────── */

/** نوع المصدر الأصلي: بكالوريا، فرض، اختبار فصلي */
export const PLAY_EXAM_KINDS = ['BAC', 'DEVOIR', 'TEST'] as const
export type PlayExamKind = (typeof PLAY_EXAM_KINDS)[number]

/**
 * مسار التحويل (04_CONTENT_PIPELINE): discovered → extracted → linked → decomposed → generated → auto_validated
 * → needs_human_review → approved → staged، و blocked عند فشل المصدر. لا يرى التلميذ إلا APPROVED/STAGED.
 */
export const PLAY_EXAM_SET_STATUSES = ['DISCOVERED', 'EXTRACTED', 'LINKED', 'DECOMPOSED', 'GENERATED', 'AUTO_VALIDATED', 'NEEDS_HUMAN_REVIEW', 'APPROVED', 'STAGED', 'BLOCKED'] as const
export type PlayExamSetStatus = (typeof PLAY_EXAM_SET_STATUSES)[number]
export const PLAY_EXAM_PUBLISHED_STATUSES: readonly PlayExamSetStatus[] = ['APPROVED', 'STAGED']

/** تدريب بتغذية راجعة فورية، أو محاكاة امتحان بتصحيح مؤجل */
export const PLAY_EXAM_MODES = ['PRACTICE', 'EXAM'] as const
export type PlayExamMode = (typeof PLAY_EXAM_MODES)[number]

export const PLAY_EXAM_ATTEMPT_STATUSES = ['ACTIVE', 'COMPLETED', 'ABANDONED'] as const
export type PlayExamAttemptStatus = (typeof PLAY_EXAM_ATTEMPT_STATUSES)[number]

/* ─────────── الوصول: مجاني لمشتركي الدورة الملائمة، وتجربة 72 ساعة لغيرهم ─────────── */

/** مدة التجربة المجانية بالساعات، تبدأ من أول بدء لعب فعلي على الخادم، مرة واحدة لكل تلميذ */
export const PLAY_TRIAL_HOURS = 72
export const PLAY_TRIAL_MS = PLAY_TRIAL_HOURS * 3_600_000

/**
 * رموز مواد PLAY ← رموز مواد المنهاج (جدول subjects) لمطابقة الدورة بالمادة.
 * التاريخ والجغرافيا مادة واحدة في المنهاج (HISTGEO) ومادتان في PLAY.
 */
export const PLAY_TO_CURRICULUM_SUBJECT: Readonly<Record<string, readonly string[]>> = {
  AR: ['ARABIC'],
  MATH: ['MATH'],
  PHYS: ['PHYSICS'],
  SVT: ['SCIENCES'],
  FR: ['FRENCH'],
  EN: ['ENGLISH'],
  HIST: ['HISTGEO'],
  GEO: ['HISTGEO'],
  ISL: ['ISLAMIC'],
  CIV: ['CIVIC'],
  PHILO: ['PHILO'],
  ECO: ['ECONOMICS'],
  ACC: ['ACCOUNTING'],
  LAW: ['LAW'],
  TECH: ['TECHNOLOGY', 'TECH_CIVIL', 'TECH_MECA', 'TECH_ELEC', 'TECH_PROC', 'SCI_TECH'],
  INFO: ['COMPUTING']
}

export const PLAY_REPORT_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'] as const
export type PlayReportStatus = (typeof PLAY_REPORT_STATUSES)[number]

export const PLAY_REPORT_REASONS = ['WRONG_ANSWER', 'AMBIGUOUS', 'TYPO', 'OFF_LESSON', 'OTHER'] as const
export type PlayReportReason = (typeof PLAY_REPORT_REASONS)[number]

/** عدد أسئلة كل نوع تحدٍّ */
export const CHALLENGE_SIZES: Record<PlayChallengeType, number> = {
  QUICK10: 10,
  LESSON_MASTERY: 12,
  UNIT_REVIEW: 15,
  DAILY: 8,
  BAC: 20,
  HARD: 10,
  MISTAKES: 10
}

export const CHALLENGE_NAMES: Record<PlayChallengeType, string> = {
  QUICK10: 'تحدي 10 أسئلة',
  LESSON_MASTERY: 'تحدي إتقان درس',
  UNIT_REVIEW: 'تحدي مراجعة الوحدة',
  DAILY: 'التحدي اليومي',
  BAC: 'تحدي البكالوريا',
  HARD: 'تحدي الأسئلة الصعبة',
  MISTAKES: 'عالج أخطاءك'
}

/** ثوانٍ لكل سؤال في الوضع بالمؤقت */
export const TIMED_SECONDS_PER_QUESTION = 45

/** مفتاح الإعدادات في جدول settings */
export const PLAY_SETTINGS_KEY = 'play.rules'

export interface PlayRules {
  xp: { correct: number; correctHard: number; sessionComplete: number; lessonMastery: number; repeatMastered: number }
  levels: { title: string; minXp: number }[]
  /** نسبة الإتقان المطلوبة للدرس (0–100) والحد الأدنى من الإجابات */
  mastery: { minAnswered: number; minPct: number }
  /** الحالات المقدّمة للطالب */
  servableStatuses: PlayReviewStatus[]
  /** إظهار لوحة ترتيب عامة بأسماء الطلاب (معطّلة افتراضياً — قُصّر) */
  publicLeaderboard: boolean
}

export const DEFAULT_PLAY_RULES: PlayRules = {
  xp: { correct: 10, correctHard: 15, sessionComplete: 30, lessonMastery: 100, repeatMastered: 2 },
  levels: [
    { title: 'مبتدئ', minXp: 0 },
    { title: 'مستكشف', minXp: 200 },
    { title: 'مجتهد', minXp: 600 },
    { title: 'متقدم', minXp: 1500 },
    { title: 'متميز', minXp: 3500 },
    { title: 'عبقري مدرسة', minXp: 8000 }
  ],
  mastery: { minAnswered: 8, minPct: 80 },
  servableStatuses: [...PLAY_SERVABLE_STATUSES],
  publicLeaderboard: false
}

export interface PlayBadge {
  code: string
  nameAr: string
  descriptionAr: string
  icon: string
  /** شرط: مادة محددة أو عام */
  rule: { kind: 'SUBJECT_CORRECT'; subject: string; count: number } | { kind: 'LESSON_MASTERED'; count: number } | { kind: 'TOTAL_CORRECT'; count: number } | { kind: 'STREAK_DAYS'; days: number } | { kind: 'HARD_CORRECT'; count: number } | { kind: 'SESSIONS'; count: number }
}

export const PLAY_BADGES: readonly PlayBadge[] = [
  { code: 'FIRST_SESSION', nameAr: 'أول خطوة', descriptionAr: 'أكملتَ أول تحدٍّ لك', icon: 'Footprints', rule: { kind: 'SESSIONS', count: 1 } },
  { code: 'TEN_SESSIONS', nameAr: 'مثابر', descriptionAr: 'أكملتَ 10 تحديات', icon: 'Flame', rule: { kind: 'SESSIONS', count: 10 } },
  { code: 'STREAK_7', nameAr: 'أسبوع متواصل', descriptionAr: 'لعبتَ 7 أيام متتالية', icon: 'CalendarCheck', rule: { kind: 'STREAK_DAYS', days: 7 } },
  { code: 'CORRECT_100', nameAr: 'مئوية', descriptionAr: '100 إجابة صحيحة', icon: 'Target', rule: { kind: 'TOTAL_CORRECT', count: 100 } },
  { code: 'CORRECT_500', nameAr: 'خمسمائة', descriptionAr: '500 إجابة صحيحة', icon: 'Trophy', rule: { kind: 'TOTAL_CORRECT', count: 500 } },
  { code: 'LESSON_MASTER', nameAr: 'متقن درس كامل', descriptionAr: 'أتقنتَ درساً كاملاً', icon: 'Award', rule: { kind: 'LESSON_MASTERED', count: 1 } },
  { code: 'LESSON_MASTER_10', nameAr: 'متقن 10 دروس', descriptionAr: 'أتقنتَ 10 دروس', icon: 'Medal', rule: { kind: 'LESSON_MASTERED', count: 10 } },
  { code: 'HARD_50', nameAr: 'صائد الصعاب', descriptionAr: '50 إجابة صحيحة في أسئلة صعبة', icon: 'Mountain', rule: { kind: 'HARD_CORRECT', count: 50 } },
  { code: 'HERO_AR', nameAr: 'بطل البلاغة', descriptionAr: '100 إجابة صحيحة في اللغة العربية', icon: 'Feather', rule: { kind: 'SUBJECT_CORRECT', subject: 'AR', count: 100 } },
  { code: 'HERO_MATH', nameAr: 'محترف الرياضيات', descriptionAr: '100 إجابة صحيحة في الرياضيات', icon: 'Sigma', rule: { kind: 'SUBJECT_CORRECT', subject: 'MATH', count: 100 } },
  { code: 'HERO_PHYS', nameAr: 'متفوق الفيزياء', descriptionAr: '100 إجابة صحيحة في العلوم الفيزيائية', icon: 'Atom', rule: { kind: 'SUBJECT_CORRECT', subject: 'PHYS', count: 100 } },
  { code: 'HERO_SVT', nameAr: 'متفوق العلوم', descriptionAr: '100 إجابة صحيحة في علوم الطبيعة والحياة', icon: 'Leaf', rule: { kind: 'SUBJECT_CORRECT', subject: 'SVT', count: 100 } },
  { code: 'HERO_HIST', nameAr: 'عاشق التاريخ', descriptionAr: '100 إجابة صحيحة في التاريخ', icon: 'Landmark', rule: { kind: 'SUBJECT_CORRECT', subject: 'HIST', count: 100 } },
  { code: 'HERO_GEO', nameAr: 'رحّالة الجغرافيا', descriptionAr: '100 إجابة صحيحة في الجغرافيا', icon: 'Globe', rule: { kind: 'SUBJECT_CORRECT', subject: 'GEO', count: 100 } },
  { code: 'HERO_LANG', nameAr: 'بطل اللغات', descriptionAr: '100 إجابة صحيحة في الفرنسية أو الإنجليزية', icon: 'Languages', rule: { kind: 'SUBJECT_CORRECT', subject: 'FR+EN', count: 100 } },
  { code: 'HERO_PHILO', nameAr: 'فيلسوف', descriptionAr: '100 إجابة صحيحة في الفلسفة', icon: 'Lightbulb', rule: { kind: 'SUBJECT_CORRECT', subject: 'PHILO', count: 100 } },
  { code: 'HERO_ISL', nameAr: 'نجم العلوم الإسلامية', descriptionAr: '100 إجابة صحيحة في العلوم الإسلامية', icon: 'Star', rule: { kind: 'SUBJECT_CORRECT', subject: 'ISL', count: 100 } }
]

/** ثوابت الذاكرة المتباعدة (Leitner): أيام الاستحقاق لكل صندوق */
export const LEITNER_INTERVALS_DAYS = [0, 1, 3, 7, 14, 30] as const
export const LEITNER_MASTERED_BOX = 4
