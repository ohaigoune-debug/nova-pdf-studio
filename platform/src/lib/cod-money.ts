/**
 * أين مال الدفع عند الاستلام؟ (قرار المالك 24 نوفمبر 2026)
 * EcoTrack يفرّق بعد التسليم: livre_non_encaisse ← encaisse_non_paye ← paiements_prets ← paye_et_archive.
 * WITH_DRIVER: سُلّم ولم يحصّله السائق بعد للشركة · AT_CARRIER: عند شركة التوصيل · READY: جاهز للدفع · RECEIVED: وصلك.
 * null على طلب مسلَّم = غير متابَع (شركة بلا EcoTrack أو لم يُستطلع بعد) ⇒ يُعدّ «عند شركة التوصيل» حتى تعلّمه.
 */
export const COD_MONEY_STATUSES = ['WITH_DRIVER', 'AT_CARRIER', 'READY', 'RECEIVED'] as const
export type CodMoneyStatus = (typeof COD_MONEY_STATUSES)[number]
export const COD_MONEY_LABELS: Record<CodMoneyStatus, string> = {
  WITH_DRIVER: 'عند السائق',
  AT_CARRIER: 'عند شركة التوصيل',
  READY: 'جاهز للدفع',
  RECEIVED: 'وصلني'
}

/** يقرأ حالة EcoTrack (نصّ حرّ) ⇒ حالة المال، أو null إن لم تكن حالة ما بعد التسليم */
export function ecotrackMoneyStatus(label: string | null | undefined): CodMoneyStatus | null {
  const s = String(label ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return null
  if (/retour|return/.test(s)) return null
  // الترتيب مهمّ: «livre non encaisse» فيها «encaisse»، و«encaisse non paye» فيها «paye»
  if (/livre?s? (non|pas) encaiss/.test(s)) return 'WITH_DRIVER'
  if (/encaiss\w* (non|pas) pay/.test(s)) return 'AT_CARRIER'
  if (/paiements? prets?|pret\w* (a|pour) (etre )?(verse|pay)|a verser/.test(s)) return 'READY'
  if (/^pay\w*( et archiv\w*)?$|^paid$|verse$|^archiv/.test(s)) return 'RECEIVED'
  if (/^encaiss/.test(s)) return 'AT_CARRIER'
  if (/^livre?s?$|^delivered$/.test(s)) return 'WITH_DRIVER'
  return null
}

/** المبلغ الذي يصلك من الطرد: ما دفعه الزبون ناقص رسم الشركة (أو رسم التوصيل المحسوب إن جُهل) */
export function codNetDzd(o: { totalDzd: number; shippingDzd: number; codFeeDzd: number | null }): number {
  return Math.max(0, o.totalDzd - (o.codFeeDzd ?? o.shippingDzd))
}
