/**
 * الحالات والأنواع كقيم نصية (مع قيود CHECK في قاعدة البيانات).
 * إضافة قيمة جديدة = تعديل هنا + Migration بسيط لقيد CHECK.
 */

export const USER_ROLES = ['SUPER_ADMIN', 'TEACHER', 'STUDENT', 'PUBLIC', 'PARENT'] as const
export type UserRole = (typeof USER_ROLES)[number]

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
  'SYSTEM'
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
