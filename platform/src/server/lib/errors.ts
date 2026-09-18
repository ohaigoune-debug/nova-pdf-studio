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
