/**
 * نصيب الأستاذ من مبيعات دوراته (قرار المالك 24 نوفمبر 2026):
 * - الدفع بالبطاقة: تُحذف TVA أوّلًا (19%)، ثمّ للأستاذ 80% ممّا بقي.
 * - غير البطاقة (عند الاستلام، تحويل…): للأستاذ 70% من المبلغ.
 * يُحسب على ثمن المنتج وحده (بلا رسوم التوصيل)، للطلبات المسلَّمة، وللأساتذة الشركاء الذين يختارهم المالك فقط.
 * كلّ الأرقام من الإدارة.
 */
export const VAT_MODES = ['SUBTRACT', 'INCLUDED'] as const
export type VatMode = (typeof VAT_MODES)[number]
export const VAT_MODE_LABELS: Record<VatMode, string> = {
  SUBTRACT: 'تُطرح النسبة من المبلغ (3900 ← 3159)',
  INCLUDED: 'المبلغ شامل للضريبة (3900 ← 3277)'
}

export interface TeacherShareConfig {
  /** نصيب الأستاذ عند الدفع بالبطاقة (%) بعد حذف TVA */
  cardPct: number
  /** نصيب الأستاذ عند غير البطاقة (%) */
  otherPct: number
  /** TVA على الدفع بالبطاقة (%) */
  vatPct: number
  vatMode: VatMode
  /** الأساتذة الشركاء (معرّفات مساحاتهم): لهم نصيب */
  partners: string[]
}

export const DEFAULT_TEACHER_SHARE: TeacherShareConfig = { cardPct: 80, otherPct: 70, vatPct: 19, vatMode: 'SUBTRACT', partners: [] }

function pct(v: unknown, fallback: number): number {
  const n = typeof v === 'string' ? Number(v.trim()) : typeof v === 'number' ? v : Number.NaN
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) / 100 : fallback
}

export function cleanTeacherShare(input: unknown): TeacherShareConfig {
  const o = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>
  const d = DEFAULT_TEACHER_SHARE
  const partners = Array.isArray(o.partners) ? [...new Set(o.partners.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/i.test(x)))] : d.partners
  return {
    cardPct: pct(o.cardPct, d.cardPct),
    otherPct: pct(o.otherPct, d.otherPct),
    vatPct: pct(o.vatPct, d.vatPct),
    vatMode: VAT_MODES.includes(o.vatMode as VatMode) ? (o.vatMode as VatMode) : d.vatMode,
    partners
  }
}

/** البطاقة = دفع إلكترونيّ (ONLINE) */
export const isCardPayment = (method: string) => method === 'ONLINE'

/** المبلغ بعد حذف TVA (للبطاقة فقط) ثمّ نصيب الأستاذ */
export function shareOf(amountDzd: number, method: string, cfg: TeacherShareConfig): { baseDzd: number; shareDzd: number; card: boolean } {
  const amount = Math.max(0, amountDzd)
  const card = isCardPayment(method)
  if (!card) return { baseDzd: amount, shareDzd: Math.round((amount * cfg.otherPct) / 100), card }
  const baseDzd = cfg.vatMode === 'INCLUDED' ? Math.round(amount / (1 + cfg.vatPct / 100)) : Math.round(amount * (1 - cfg.vatPct / 100))
  return { baseDzd, shareDzd: Math.round((baseDzd * cfg.cardPct) / 100), card }
}
