/**
 * كل العملات العالمية النشطة (ISO 4217، نوفمبر 2026) — قائمة مضمّنة تعمل دون إنترنت.
 * الأسماء المترجمة من Intl.DisplayNames (مدمجة في iOS)، وعدد الخانات العشرية حسب المعيار.
 * لا مصدر خارجي (XE وأمثاله تتطلب مفاتيح API مدفوعة وتمنع شروطها السحب).
 * عند اختيار عملة جديدة تُضاف إلى جدول currencies حتى يعمل محرك الفواتير الأصلي (Windows) كما هو.
 */
import { getCurrency, saveCurrency } from '@modules/settings/main/taxes-currencies'

const CODES = `AED AFN ALL AMD AOA ARS AUD AWG AZN BAM BBD BDT BHD BIF BMD BND BOB BRL BSD BTN BWP BYN BZD CAD CDF CHF CLP CNY COP CRC CUP CVE CZK DJF DKK DOP DZD EGP ERN ETB EUR FJD FKP GBP GEL GHS GIP GMD GNF GTQ GYD HKD HNL HTG HUF IDR ILS INR IQD IRR ISK JMD JOD JPY KES KGS KHR KMF KPW KRW KWD KYD KZT LAK LBP LKR LRD LSL LYD MAD MDL MGA MKD MMK MNT MOP MRU MUR MVR MWK MXN MYR MZN NAD NGN NIO NOK NPR NZD OMR PAB PEN PGK PHP PKR PLN PYG QAR RON RSD RUB RWF SAR SBD SCR SDG SEK SGD SHP SLE SOS SRD SSP STN SVC SYP SZL THB TJS TMT TND TOP TRY TTD TWD TZS UAH UGX USD UYU UZS VES VND VUV WST XAF XCD XCG XOF XPF YER ZAR ZMW ZWG`.split(' ')

/** الاستثناءات من خانتين عشريتين (ISO 4217) */
const DECIMALS: Record<string, number> = {
  BIF: 0, CLP: 0, DJF: 0, GNF: 0, ISK: 0, JPY: 0, KMF: 0, KRW: 0, PYG: 0, RWF: 0, UGX: 0, VND: 0, VUV: 0, XAF: 0, XOF: 0, XPF: 0,
  BHD: 3, IQD: 3, JOD: 3, KWD: 3, LYD: 3, OMR: 3, TND: 3
}

/** تظهر أولًا في القائمة (السوق الجزائري والعربي ثم الأكثر تداولًا) */
export const COMMON_CURRENCIES = ['DZD', 'EUR', 'USD', 'GBP', 'SAR', 'AED', 'QAR', 'KWD', 'BHD', 'OMR', 'MAD', 'TND', 'EGP', 'LYD', 'JOD', 'TRY', 'CAD', 'CHF', 'CNY']

export const WORLD_CURRENCY_CODES: readonly string[] = CODES

export function currencyDecimals(code: string): number {
  return DECIMALS[code.toUpperCase()] ?? 2
}

const nameCache = new Map<string, Intl.DisplayNames | null>()
export function currencyName(code: string, locale: string): string {
  if (!nameCache.has(locale)) {
    try {
      nameCache.set(locale, new Intl.DisplayNames([locale], { type: 'currency' }))
    } catch {
      nameCache.set(locale, null)
    }
  }
  try {
    return nameCache.get(locale)?.of(code) ?? code
  } catch {
    return code
  }
}

export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(1).find((p) => p.type === 'currency')
    return part?.value || code
  } catch {
    return code
  }
}

export interface WorldCurrencyOption { code: string; label: string }

/** خيارات القائمة: الشائعة أولًا ثم الباقي مرتبًا حسب الاسم في لغة الواجهة. */
export function currencyOptions(locale: string): { common: WorldCurrencyOption[]; others: WorldCurrencyOption[] } {
  const label = (code: string) => {
    const name = currencyName(code, locale)
    return name && name !== code ? `${code} — ${name}` : code
  }
  const common = COMMON_CURRENCIES.map((code) => ({ code, label: label(code) }))
  const collator = new Intl.Collator(locale)
  const others = CODES.filter((c) => !COMMON_CURRENCIES.includes(c))
    .map((code) => ({ code, label: label(code), name: currencyName(code, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name))
    .map(({ code, label }) => ({ code, label }))
  return { common, others }
}

/** يضمن وجود العملة في قاعدة البيانات (رمزها وخاناتها) قبل استعمالها في فاتورة أو منتج. */
export function ensureCurrency(code: string): void {
  const c = code.toUpperCase()
  if (getCurrency(c)) return
  const symbol = currencySymbol(c)
  saveCurrency({ code: c, name: currencyName(c, 'en'), symbol, decimals: currencyDecimals(c), position: symbol !== c ? 'before' : 'after', isActive: true })
}
