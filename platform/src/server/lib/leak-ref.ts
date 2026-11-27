import { createHash } from 'node:crypto'

/**
 * «رمز النسخة» (27 نوفمبر 2026): رمز قصير خاص بكل حساب يُكتب داخل كل صفحة PDF يفتحها،
 * بخط عادي معتم يشبه رقم الوثيقة («Ref. 7K3Q-29») لا علامة مائية، فلا يحذفه من يطلب من
 * الذكاء الاصطناعي «إزالة العلامة المائية» عادةً. من الرمز نعرف الحساب في «كشف التسريب».
 *
 * - مشتقّ من معرّف الحساب (sha256) فلا يحتاج عمودًا ولا هجرة، ويبقى ثابتًا لنفس الحساب دائمًا.
 * - 6 خانات من أبجدية Crockford (30 بتًا): لا O ولا I ولا L ولا U، فقراءته من صورة ضبابية سهلة
 *   (O تُقرأ 0، وI/L تُقرأ 1).
 * - لا يُعكس: الكشف يحسب الرمز لكل حساب ويقارن (عملية نادرة للمشرف وحده).
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const LEAK_REF_LENGTH = 6
/** وسم خفي في بيانات الملف ونصّه الشفاف: «mdz-ref:7K3Q29» */
export const LEAK_REF_TAG = 'mdz-ref'

export function leakRefOf(userId: string): string {
  const h = createHash('sha256').update(`madrasa-leak-ref:${userId.toLowerCase()}`).digest()
  let n = h.readUInt32BE(0) >>> 2
  let out = ''
  for (let i = 0; i < LEAK_REF_LENGTH; i++) {
    out = ALPHABET[n & 31] + out
    n >>>= 5
  }
  return out
}

/** «7K3Q29» → «7K3Q-29» كما يُكتب على الصفحة */
export function formatLeakRef(ref: string): string {
  return `${ref.slice(0, 4)}-${ref.slice(4)}`
}

/** يقبل ما يُقرأ من الصفحة بأي شكل: «ref. 7k3q-29»، «7K3Q 29»، «7KOQ29» (O بدل 0) */
export function normalizeLeakRef(raw: string): string | null {
  const s = raw
    .toUpperCase()
    .replace(/^(?:MDZ-REF:?|REF\.?)/, '')
    .replace(/[\s\-–—_.:]/g, '')
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
  return new RegExp(`^[${ALPHABET}]{${LEAK_REF_LENGTH}}$`).test(s) ? s : null
}

/**
 * «أرقام التهميش» (27 نوفمبر 2026، فكرة الدكتور حيقون): في الدروس المصنوعة بهويته تُترك أماكن لأرقام
 * تهميش حقيقية (انظر pdf-footnotes.ts)، وتُملأ لكل تلميذ بأرقام خاصة به بين 10 و99؛ فإذا جُمعت
 * بترتيب ظهورها في الدرس أعطت رقمه: (51) (95) (82) (18) ← 51958218. تبدو جزءًا من الدرس فلا تُحذف
 * مع العلامة المائية. 8 أرقام لكل حساب (يُستعمل منها ما في الملف من أماكن).
 */
export const FOOTNOTE_COUNT = 8
export const PUBLIC_FOOTNOTE_OWNER = 'public'

export function leakFootnotesOf(userId: string): number[] {
  const h = createHash('sha256').update(`madrasa-fn:${userId.toLowerCase()}`).digest()
  return Array.from({ length: FOOTNOTE_COUNT }, (_, i) => 10 + (h.readUInt32BE(i * 4) % 90))
}

/** يقبل «51 95 82 18» و«(51) (95) (82) (18)» و«51·95·82·18» و«519582» (ثلاثة أرقام فأكثر) */
export function parseFootnoteNumbers(raw: string): number[] | null {
  const s = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).trim()
  let nums: number[] | null = null
  if (/^[\s(]*\d{2}(?:[\s)·•,،+\-–(]+\d{2}){2,7}[\s)]*$/.test(s)) nums = s.match(/\d{2}/g)!.map(Number)
  else {
    const d = s.replace(/\s/g, '')
    // 8 أرقام متصلة تُترك لرمز الحساب (8 خانات) — البحث هناك يشمل أرقام التهميش أيضًا
    if (/^\d+$/.test(d) && d.length % 2 === 0 && d.length >= 6 && d.length <= 16 && d.length !== 8) nums = d.match(/\d{2}/g)!.map(Number)
  }
  return nums && nums.every((n) => n >= 10) ? nums : null
}

export function footnotesMatch(userId: string, seen: number[]): boolean {
  const own = leakFootnotesOf(userId)
  return seen.length > 0 && seen.length <= own.length && seen.every((n, i) => own[i] === n)
}

/** كل ما يُختم به ملف PDF لصاحبه */
export interface LeakMark {
  ref: string
  footnotes: number[]
}

export function leakMarkOf(userId: string): LeakMark {
  return { ref: leakRefOf(userId), footnotes: leakFootnotesOf(userId) }
}
