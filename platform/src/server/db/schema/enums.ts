/**
 * الحالات والأنواع كقيم نصية (مع قيود CHECK في قاعدة البيانات).
 * إضافة قيمة جديدة = تعديل هنا + Migration بسيط لقيد CHECK.
 */

export const USER_ROLES = ['SUPER_ADMIN', 'TEACHER', 'ASSISTANT', 'STUDENT', 'PUBLIC', 'PARENT'] as const
export type UserRole = (typeof USER_ROLES)[number]

/** حالة عضوية مساعد الأستاذ في مساحة العمل */
export const ASSISTANT_STATUSES = ['ACTIVE', 'REVOKED'] as const
export type AssistantStatus = (typeof ASSISTANT_STATUSES)[number]

export const USER_STATUSES = ['ACTIVE', 'DISABLED'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const WORKSPACE_STATUSES = ['ACTIVE', 'SUSPENDED', 'CLOSED'] as const
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number]

export const STUDENT_TYPES = ['IN_PERSON', 'COURSE', 'ONLINE', 'FREE', 'EXTERNAL'] as const
export type StudentType = (typeof STUDENT_TYPES)[number]

export const GROUP_STATUSES = ['ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'] as const
export type GroupStatus = (typeof GROUP_STATUSES)[number]

export const ENROLLMENT_STATUSES = [
  'ACTIVE',
  'SUSPENDED',
  'SUSPENDED_DUE_TO_ABSENCE',
  'INACTIVE',
  'COMPLETED',
  'LEFT_GROUP'
] as const
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number]

export const CODE_STATUSES = ['ACTIVE', 'USED', 'DISABLED', 'EXPIRED'] as const
export type CodeStatus = (typeof CODE_STATUSES)[number]

export const SESSION_STATUSES = ['PLANNED', 'OPEN', 'CLOSED', 'CANCELLED'] as const
export type ClassSessionStatus = (typeof SESSION_STATUSES)[number]

export const ATTENDANCE_STATUSES = ['PRESENT', 'LATE', 'ABSENT', 'EXCUSED', 'UNEXCUSED'] as const
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number]

export const ATTENDANCE_SOURCES = ['SCAN', 'MANUAL', 'AUTO_CLOSE'] as const
export type AttendanceSource = (typeof ATTENDANCE_SOURCES)[number]

export const SCHOOL_TYPES = ['LYCEE', 'CEM', 'PRIVATE', 'OTHER'] as const
export type SchoolType = (typeof SCHOOL_TYPES)[number]

export const FILE_STATUSES = ['PENDING', 'READY'] as const
export type FileStatus = (typeof FILE_STATUSES)[number]

export const VIDEO_PROVIDERS = ['YOUTUBE', 'UPLOAD'] as const
export type VideoProvider = (typeof VIDEO_PROVIDERS)[number]

export const CONTENT_TYPES = [
  'ARTICLE',
  'LESSON',
  'PDF',
  'VIDEO',
  'AUDIO',
  'QUIZ',
  'EXERCISE',
  'IMAGE',
  'LINK'
] as const
export type ContentType = (typeof CONTENT_TYPES)[number]

export const VISIBILITIES = [
  'PUBLIC',
  'STUDENTS_ONLY',
  'GROUP_ONLY',
  'SPECIFIC_STUDENTS',
  'TEACHERS_ONLY'
] as const
export type Visibility = (typeof VISIBILITIES)[number]

export const QUESTION_TYPES = [
  'MCQ',
  'TRUE_FALSE',
  'SHORT_ANSWER',
  'LONG_ANSWER',
  'FILL_BLANK',
  'MATCHING',
  'IMAGE'
] as const
export type QuestionType = (typeof QUESTION_TYPES)[number]

export const SUBMISSION_STATUSES = ['DRAFT', 'SUBMITTED', 'AI_EVALUATED', 'REVIEWED', 'RETURNED'] as const
export type SubmissionStatus = (typeof SUBMISSION_STATUSES)[number]
export const SUBMISSION_MESSAGE_KINDS = ['ANSWER', 'FEEDBACK', 'REPLY', 'SYSTEM'] as const
export type SubmissionMessageKind = (typeof SUBMISSION_MESSAGE_KINDS)[number]
export const ATTEMPT_STATUSES = ['IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'EXPIRED'] as const
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number]
export const GRADE_SOURCES = ['AUTO', 'AI', 'TEACHER'] as const
export const REVIEW_DECISIONS = ['APPROVED', 'EDITED', 'REJECTED'] as const
export const AI_EVAL_STATUSES = ['PENDING', 'COMPLETED', 'FAILED'] as const

export const JOB_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

export const NOTIFICATION_TYPES = [
  'NEW_ASSIGNMENT',
  'NEW_QUIZ',
  'NEW_FILE',
  'GRADED',
  'NEW_GRADE',
  'SESSION_REMINDER',
  'REMINDER',
  'ABSENCE',
  'ABSENCE_WARNING',
  'SUSPENDED_ABSENCE',
  'ENROLLED',
  'REACTIVATED',
  'SYSTEM',
  'ANNOUNCEMENT',
  'CLASS_POST',
  'CLASS_COMMENT'
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const TIMELINE_TYPES = [
  'ENROLLED',
  'ATTENDED',
  'LATE',
  'ABSENT',
  'EXCUSED',
  'SUSPENDED',
  'REACTIVATED',
  'LEFT',
  'ASSIGNMENT_SUBMITTED',
  'GRADED',
  'LESSON_VIEWED',
  'QUIZ_COMPLETED'
] as const
export type TimelineType = (typeof TIMELINE_TYPES)[number]

/* ---------------- المكتبة الوطنية وتصنيف المنهاج (الإصدار الثاني) ---------------- */

export const EDUCATION_STAGES = ['PRIMARY', 'MIDDLE', 'SECONDARY'] as const
export type EducationStage = (typeof EDUCATION_STAGES)[number]

/** أنواع عُقد المنهاج: شجرة واحدة لأن عمقها يختلف من مادة لأخرى */
export const CURRICULUM_NODE_KINDS = ['UNIT', 'CHAPTER', 'LESSON', 'TOPIC'] as const
export type CurriculumNodeKind = (typeof CURRICULUM_NODE_KINDS)[number]

export const CONTENT_SOURCE_TYPES = ['DZEXAMS', 'YOUTUBE', 'HAIGOUN', 'MADRASADZ', 'OFFICIAL_EXAM', 'OTHER'] as const
export type ContentSourceType = (typeof CONTENT_SOURCE_TYPES)[number]

/** نوع المورد في المكتبة */
export const RESOURCE_TYPES = ['LESSON', 'SUMMARY', 'EXERCISE', 'HOMEWORK', 'TEST', 'EXAM', 'SOLUTION', 'VIDEO', 'PEDAGOGICAL', 'OTHER'] as const
export type ResourceType = (typeof RESOURCE_TYPES)[number]

/** أستاذ في الدليل: مرشّح ← معتمد (قناة محدّدة) أو مرفوض */
export const EDUCATOR_STATUSES = ['SUGGESTED', 'APPROVED', 'REJECTED'] as const
export type EducatorStatus = (typeof EDUCATOR_STATUSES)[number]

/* ───────────── بنك الأسئلة (Exam Builder) ───────────── */
/** طبيعة العنصر: سؤال مفرد، تمرين (بأسئلة فرعية)، نصّ/سند بأسئلته، مسألة، وضعية إدماجية، وثيقة */
export const BANK_KINDS = ['QUESTION', 'EXERCISE', 'PASSAGE', 'PROBLEM', 'INTEGRATIVE', 'DOCUMENT'] as const
export type BankKind = (typeof BANK_KINDS)[number]
/** أنواع الاختبار الإلكتروني + OPEN (سؤال ورقي مفتوح يُصحَّح بسلّم) */
export const BANK_QUESTION_TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'LONG_ANSWER', 'FILL_BLANK', 'MATCHING', 'IMAGE', 'OPEN'] as const
export type BankQuestionType = (typeof BANK_QUESTION_TYPES)[number]
export const BANK_STATUSES = ['DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED'] as const
export type BankStatus = (typeof BANK_STATUSES)[number]
export const BANK_VISIBILITIES = ['PRIVATE', 'PUBLIC'] as const
export type BankVisibility = (typeof BANK_VISIBILITIES)[number]
export const BANK_EXAM_KINDS = ['BAC', 'BEM', 'TEST', 'HOMEWORK', 'QUIZ', 'PRACTICE', 'OTHER'] as const
export type BankExamKind = (typeof BANK_EXAM_KINDS)[number]
export const RIGHTS_STATUSES = ['OWN', 'LICENSED', 'PUBLIC_DOMAIN', 'THIRD_PARTY', 'UNKNOWN'] as const
export type RightsStatus = (typeof RIGHTS_STATUSES)[number]
export const BANK_DIFFICULTIES = [1, 2, 3, 4] as const

/* ───────────── ورقة الامتحان (Exam Builder) ───────────── */
export const EXAM_KINDS = ['TEST', 'HOMEWORK', 'BAC_MOCK', 'BEM_MOCK', 'QUIZ', 'PRACTICE'] as const
export type ExamKind = (typeof EXAM_KINDS)[number]
export const EXAM_STATUSES = ['DRAFT', 'READY', 'ARCHIVED'] as const
export type ExamStatus = (typeof EXAM_STATUSES)[number]
export const EXAM_ITEM_KINDS = ['EXERCISE', 'QUESTION', 'TEXT', 'PAGE_BREAK', 'BLOCK'] as const
/** سبب المراجعة المحفوظة لورقة الامتحان (الاستوديو) */
export const EXAM_REVISION_REASONS = ['AUTO', 'MANUAL', 'RESTORE'] as const
export type ExamRevisionReason = (typeof EXAM_REVISION_REASONS)[number]
/** أنواع عناصر مكتبة الأستاذ: كتلة قابلة لإعادة الاستعمال أو ترويسة */
export const LIBRARY_ITEM_KINDS = ['BLOCK', 'HEADER'] as const
export type LibraryItemKind = (typeof LIBRARY_ITEM_KINDS)[number]
export type ExamItemKind = (typeof EXAM_ITEM_KINDS)[number]

export const RESOURCE_STATUSES = ['DRAFT', 'NEEDS_REVIEW', 'PUBLISHED', 'ARCHIVED', 'BROKEN'] as const
export type ResourceStatus = (typeof RESOURCE_STATUSES)[number]

/** من يصل إلى المورد: العموم، المسجّلون، تلاميذ الأكاديمية، أفواج محدّدة، مدفوع */
export const ACCESS_LEVELS = ['PUBLIC', 'REGISTERED', 'STUDENTS', 'GROUP', 'PREMIUM'] as const
export type AccessLevel = (typeof ACCESS_LEVELS)[number]

/** دورة الامتحان: الرسمية، الاستدراكية، التجريبية (البكالوريا البيضاء) */
export const EXAM_SESSIONS = ['NORMAL', 'MAKEUP', 'MOCK'] as const
export type ExamSession = (typeof EXAM_SESSIONS)[number]

/* ───────────── التدريب الذاتي للتلميذ (Student Practice) ───────────── */
export const PRACTICE_STATUSES = ['ACTIVE', 'FINISHED'] as const
export type PracticeStatus = (typeof PRACTICE_STATUSES)[number]

/* ───────────── متجر الكتب (Book Store) ───────────── */
export const PRODUCT_TYPES = ['BOOK', 'PDF', 'PACK'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]
export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export const ORDER_STATUSES = ['PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]
/** الدفع عند الاستلام (مادي)، تحويل (CCP/BaridiMob يؤكّده المشرف)، مجاني */
export const PAYMENT_METHODS = ['COD', 'TRANSFER', 'FREE'] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/* ───────────── سوق الأساتذة (Marketplace) ───────────── */
export const LISTING_KINDS = ['EXAM', 'EXERCISE_SET', 'SUMMARY', 'QUESTION_BANK'] as const
export type ListingKind = (typeof LISTING_KINDS)[number]
export const LISTING_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'ARCHIVED'] as const
export type ListingStatus = (typeof LISTING_STATUSES)[number]
export const PAYOUT_STATUSES = ['PENDING', 'PAID'] as const
export type PayoutStatus = (typeof PAYOUT_STATUSES)[number]

/* ───────────── محرّك الامتحانات (Exam Engine) ───────────── */
/** أصل السؤال: من تأليف الأستاذ، مستخرج من وثيقة/مورد، مولَّد بالذكاء الاصطناعي، أو معدَّل عن أصل */
export const QUESTION_ORIGINS = ['ORIGINAL', 'SOURCED', 'AI_GENERATED', 'ADAPTED'] as const
export type QuestionOrigin = (typeof QUESTION_ORIGINS)[number]
/** وثيقة في سجلّ المعالجة: معلّقة ← قيد المعالجة ← للمراجعة ← منشورة، أو فاشلة */
export const EXAM_DOC_STATUSES = ['PENDING', 'PROCESSING', 'NEEDS_REVIEW', 'VERIFIED', 'PUBLISHED', 'FAILED'] as const
export type ExamDocStatus = (typeof EXAM_DOC_STATUSES)[number]
/** نوع الوثيقة (مستقلّ عن الفصل الدراسي) */
export const EXAM_DOC_TYPES = ['BAC', 'BEM', 'TEST', 'HOMEWORK', 'EXERCISE_SET', 'OTHER'] as const
export type ExamDocType = (typeof EXAM_DOC_TYPES)[number]
export const FEEDBACK_KINDS = ['BUG', 'SUGGESTION', 'RATING'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const FEEDBACK_STATUSES = ['NEW', 'REVIEWED', 'DONE'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
