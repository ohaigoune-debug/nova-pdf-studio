/**
 * الكود الذي كتبه زائر قبل أن يكون له حساب (21 نوفمبر 2026): يُحفظ ساعتين في كعكة،
 * فيجده مكتوبًا بعد التسجيل أو الدخول ولا يعيد كتابته. لا يُفحص الكود للزائر (لا تخمين للأكواد).
 */
import { cookies } from 'next/headers'
import { codeDigits, codeKind } from '@/lib/code-input'

export const PENDING_CODE_COOKIE = 'mdz_pending_code'
const MAX_AGE = 2 * 60 * 60

export async function readPendingCode(): Promise<string | null> {
  const raw = (await cookies()).get(PENDING_CODE_COOKIE)?.value ?? ''
  const digits = codeDigits(raw)
  return codeKind(digits) ? digits : null
}

export async function savePendingCode(digits: string): Promise<void> {
  ;(await cookies()).set(PENDING_CODE_COOKIE, digits, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE })
}

export async function clearPendingCode(): Promise<void> {
  ;(await cookies()).delete(PENDING_CODE_COOKIE)
}
