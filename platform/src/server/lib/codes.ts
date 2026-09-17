import { createHash, randomInt } from 'node:crypto'

/** أبجدية بلا حروف ملتبسة (بدون 0/O/1/I/L) */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** يولّد كوداً بصيغة XXX-XXXX (مثال: HG8-KP72) */
export function generateEnrollmentCode(): string {
  const pick = () => ALPHABET[randomInt(0, ALPHABET.length)] ?? 'A'
  const a = Array.from({ length: 3 }, pick).join('')
  const b = Array.from({ length: 4 }, pick).join('')
  return `${a}-${b}`
}

/** يطبّع مدخل المستخدم: أحرف كبيرة، يقبل بلا شرطة أو بمسافات */
export function normalizeEnrollmentCode(input: string): string {
  const raw = input
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (raw.length !== 7) return raw
  return `${raw.slice(0, 3)}-${raw.slice(3)}`
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
