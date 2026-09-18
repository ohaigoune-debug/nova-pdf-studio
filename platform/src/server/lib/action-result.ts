import type { ZodError } from 'zod'
import { errorMessage } from '@/i18n'
import { kickJobsSoon } from '@/server/jobs/kick'
import { isAppError, toAppError, type ErrorCode } from './errors'

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: ErrorCode | 'VALIDATION'; message: string; fieldErrors?: Record<string, string> } }

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data }
}

export function fail(code: ErrorCode, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error: { code, message: errorMessage(code), fieldErrors } }
}

export function failValidation(err: ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of err.issues) {
    const key = issue.path.join('.') || '_'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { ok: false, error: { code: 'VALIDATION', message: errorMessage('VALIDATION'), fieldErrors } }
}

/** يغلّف تنفيذ Server Action: AppError → رسالة عربية آمنة، وأي خطأ آخر → INTERNAL. بعد النجاح يوقظ عامل المهام. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn()
    kickJobsSoon()
    return ok(data)
  } catch (err) {
    if (isAppError(err)) return fail(err.code)
    const e = toAppError(err)
    return fail(e.code)
  }
}
