import { createHash, randomInt } from 'node:crypto'

/** طول الكود الرقمي الجديد */
export const CODE_DIGITS = 11

/** الأبجدية القديمة (أكواد XXX-XXXX التي وُزّعت قبل الأكواد الرقمية تبقى صالحة) */
const LEGACY_ALPHABET = /^[A-Z0-9]{7}$/

/**
 * يولّد كوداً رقمياً من 11 رقماً (مثال: 48203917562).
 * الرقم الأول ليس صفراً حتى لا يضيع عند فتح ملف CSV في Excel، ولا حروف تلتبس عند الإملاء أو الكتابة.
 */
export function generateEnrollmentCode(): string {
  let out = String(randomInt(1, 10))
  for (let i = 1; i < CODE_DIGITS; i++) out += String(randomInt(0, 10))
  return out
}

/** الأرقام العربية المشرقية والفارسية ← 0-9 (لوحة مفاتيح الهاتف بالعربية تكتبها هكذا) */
function westernDigits(s: string): string {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
}

/**
 * يطبّع مدخل المستخدم: يقبل المسافات والشرطات والأرقام العربية.
 * 11 رقماً ← الكود الرقمي كما هو؛ 7 خانات ← الكود القديم بصيغته XXX-XXXX.
 */
export function normalizeEnrollmentCode(input: string): string {
  const raw = westernDigits(input.trim())
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (/^\d{11}$/.test(raw)) return raw
  if (LEGACY_ALPHABET.test(raw)) return `${raw.slice(0, 3)}-${raw.slice(3)}`
  return raw
}

/** كود صالح الشكل: 11 رقماً (الجديد) أو XXX-XXXX (القديم) — بعد normalizeEnrollmentCode */
export function isValidCodeShape(code: string): boolean {
  return /^\d{11}$/.test(code) || /^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(code)
}

export function hashEnrollmentCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

export function codePrefix(code: string): string {
  return code.slice(0, 3)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
