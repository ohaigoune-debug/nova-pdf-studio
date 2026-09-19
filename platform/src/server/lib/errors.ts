export const ERROR_CODES = [
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'NOT_FOUND',
  'VALIDATION',
  'RATE_LIMITED',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'ACCOUNT_DISABLED',
  'WEAK_PASSWORD',
  'CODE_INVALID',
  'CODE_USED',
  'CODE_EXPIRED',
  'CODE_DISABLED',
  'CODE_WRONG_GROUP',
  'GROUP_NOT_ACTIVE',
  'GROUP_FULL',
  'ALREADY_ENROLLED',
  'ENROLLMENT_NOT_FOUND',
  'ENROLLMENT_NOT_SUSPENDED',
  'SESSION_ALREADY_OPEN',
  'SESSION_NOT_OPEN',
  'SESSION_CLOSED',
  'SESSION_NOT_FOUND',
  'ATTENDANCE_CLOSED',
  'QR_INVALID',
  'QR_EXPIRED',
  'QR_REPLAYED',
  'STUDENT_NOT_IN_GROUP',
  'STUDENT_NOT_ACTIVE',
  'ATTENDANCE_DUPLICATE',
  'ATTENDANCE_NOT_FOUND',
  'ASSIGNMENT_NOT_FOUND',
  'NOT_TARGETED',
  'SUBMISSION_NOT_FOUND',
  'SUBMISSION_LOCKED',
  'SUBMISSION_NOT_SUBMITTED',
  'EMPTY_ANSWER',
  'INVALID_SCORE',
  'CONTENT_NOT_FOUND',
  'FILE_NOT_FOUND',
  'FILE_TOO_LARGE',
  'FILE_TYPE_NOT_ALLOWED',
  'QUIZ_NOT_FOUND',
  'QUIZ_NOT_PUBLISHED',
  'QUIZ_NO_QUESTIONS',
  'QUIZ_HAS_ATTEMPTS',
  'QUIZ_CLOSED',
  'ATTEMPT_NOT_FOUND',
  'ATTEMPT_LIMIT',
  'ATTEMPT_CLOSED',
  'ATTEMPT_NOT_SUBMITTED',
  'RUBRIC_NOT_FOUND',
  'RUBRIC_MISMATCH',
  'AI_EVAL_NOT_FOUND',
  'AI_EVAL_NOT_READY',
  'AI_EVAL_ALREADY_DECIDED',
  'AI_UNAVAILABLE',
  'RESET_TOKEN_INVALID',
  'RESET_TOKEN_EXPIRED',
  'ASSISTANT_EMAIL_MISMATCH',
  'ASSISTANT_EMAIL_TAKEN',
  'ASSISTANT_ALREADY_ACTIVE',
  'ASSISTANT_NOT_FOUND',
  'ASSISTANT_NO_WORKSPACE',
  'INVALID_YOUTUBE_URL',
  'MEDIA_TOO_MANY_DEVICES',
  'MEDIA_NOT_READY',
  'UPLOAD_INCOMPLETE',
  'INTERNAL'
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

const HTTP_STATUS: Partial<Record<ErrorCode, number>> = {
  AUTH_REQUIRED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SESSION_NOT_FOUND: 404,
  ATTENDANCE_NOT_FOUND: 404,
  ASSIGNMENT_NOT_FOUND: 404,
  SUBMISSION_NOT_FOUND: 404,
  CONTENT_NOT_FOUND: 404,
  FILE_NOT_FOUND: 404,
  QUIZ_NOT_FOUND: 404,
  ATTEMPT_NOT_FOUND: 404,
  RUBRIC_NOT_FOUND: 404,
  AI_EVAL_NOT_FOUND: 404,
  ASSISTANT_NOT_FOUND: 404,
  ASSISTANT_NO_WORKSPACE: 403,
  MEDIA_TOO_MANY_DEVICES: 429,
  MEDIA_NOT_READY: 409,
  UPLOAD_INCOMPLETE: 409,
  AI_UNAVAILABLE: 503,
  VALIDATION: 422,
  RATE_LIMITED: 429,
  INTERNAL: 500
}

/**
 * الخطأ الوحيد الذي يُسمح بوصوله إلى المستخدم. الرسالة العربية تُستخرج من i18n
 * عبر المفتاح `errors.<code>` — لا تفاصيل داخلية أبداً.
 */
export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly details?: Record<string, unknown>

  constructor(code: ErrorCode, details?: Record<string, unknown>) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.status = HTTP_STATUS[code] ?? 400
    this.details = details
  }
}

/**
 * فشل نهائي لمهمة خلفية: إعادة المحاولة بنفس المدخل لن تنفع وقد تُكلّف من جديد
 * (ردّ مبتور، رفض، طلب مرفوض 4xx). الطابور يعلّمها FAILED فوراً بلا إعادة.
 */
export class PermanentJobError extends Error {
  readonly permanent = true as const

  constructor(message: string) {
    super(message)
    this.name = 'PermanentJobError'
  }
}

export function isPermanentJobError(err: unknown): boolean {
  return err instanceof PermanentJobError || (typeof err === 'object' && err !== null && (err as { permanent?: unknown }).permanent === true)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** يرمي الخطأ المناسب قبل الوصول إلى قاعدة البيانات إذا لم يكن المعرّف UUID صالحاً */
export function assertUuid(id: string | null | undefined, code: ErrorCode = 'NOT_FOUND'): asserts id is string {
  if (!id || !UUID_RE.test(id)) throw new AppError(code)
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'AppError')
}

/** يحوّل أي خطأ إلى AppError آمن للعرض (ويسجّل الأصل في السجل). */
export function toAppError(err: unknown): AppError {
  if (isAppError(err)) return err as AppError
  if (process.env.NODE_ENV !== 'test') {
    console.error('[unhandled]', err)
  }
  return new AppError('INTERNAL')
}
