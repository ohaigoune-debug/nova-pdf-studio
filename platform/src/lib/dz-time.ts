/**
 * مواعيد المنصة بتوقيت الجزائر (إصلاح 22 نوفمبر 2026، بلاغ المالك: حصة مبرمجة 12:00 ظهرت 13:00).
 *
 * خانة «datetime-local» ترسل وقتًا بلا منطقة («2026-11-22T12:00»). الخادم في الإنتاج يعمل بتوقيت UTC،
 * فكان يقرؤها 12:00 UTC = 13:00 بالجزائر. هنا تُقرأ دائمًا بتوقيت الجزائر، وتُعرض القيم المحفوظة في
 * الخانة بتوقيت الجزائر أيضًا، مهما كان توقيت الخادم أو هاتف المشرف (في سفر مثلًا). دوال نقية تُختبر وحدها.
 */
export const DZ_TZ = 'Africa/Algiers'

const NAIVE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/

const PARTS = new Intl.DateTimeFormat('en-US', {
  timeZone: DZ_TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit'
})

function wallParts(instant: number): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const p = Object.fromEntries(PARTS.formatToParts(new Date(instant)).map((x) => [x.type, x.value]))
  return { y: Number(p.year), mo: Number(p.month), d: Number(p.day), h: Number(p.hour) % 24, mi: Number(p.minute), s: Number(p.second) }
}

/** فرق توقيت الجزائر عن UTC بالمللي ثانية عند هذه اللحظة (+1 ساعة اليوم) */
function dzOffsetMs(instant: number): number {
  const w = wallParts(instant)
  return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) - Math.floor(instant / 1000) * 1000
}

/**
 * يقرأ قيمة خانة الموعد: وقت بلا منطقة = بتوقيت الجزائر؛ وقت بمنطقة (Z أو +01:00) يُقرأ كما هو.
 * يعيد Date غير صالح إن لم تكن القيمة تاريخًا.
 */
export function parseDzDateTime(value: string): Date {
  const v = value.trim()
  const m = NAIVE.exec(v)
  if (!m) return new Date(v)
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0))
  return new Date(guess - dzOffsetMs(guess))
}

/** قيمة لخانة «datetime-local» بتوقيت الجزائر: «2026-11-22T12:00» */
export function toDzInput(value: string | Date | null | undefined): string {
  if (!value) return ''
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ''
  const w = wallParts(t)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${w.y}-${pad(w.mo)}-${pad(w.d)}T${pad(w.h)}:${pad(w.mi)}`
}
