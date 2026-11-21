/**
 * كتابة كود التفعيل كيفما كان (قرار المالك 21 نوفمبر 2026 بعد معاناة التلاميذ):
 * الأرقام العربية ٠١٢٣ والفارسية ۰۱۲۳ تُحوَّل، والفراغات والشرطات والنقاط تُحذف.
 * كود الدورة 11 رقمًا، وكود الطلب (وصل بالـSMS بعد تسليم الكتاب) 6 أرقام. دوال نقية للمتصفح والخادم.
 */
export type CodeKind = 'COURSE' | 'ORDER'

export const COURSE_CODE_DIGITS = 11
export const ORDER_CODE_DIGITS = 6

export function toWesternDigits(s: string): string {
  return s.replace(/[٠-٩۰-۹]/g, (d) => String((d.charCodeAt(0) & 0xf) % 10))
}

/** الأرقام وحدها، بعد التحويل */
export function codeDigits(raw: string): string {
  return toWesternDigits(raw).replace(/\D/g, '')
}

export function codeKind(digits: string): CodeKind | null {
  if (digits.length === COURSE_CODE_DIGITS) return 'COURSE'
  if (digits.length === ORDER_CODE_DIGITS) return 'ORDER'
  return null
}

/** للعرض فقط: 123 4567 8901 */
export function formatCode(digits: string): string {
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 7)} ${digits.slice(7)}`
}
