import ar from './ar'

export type Dictionary = typeof ar
export type Locale = 'ar' | 'fr' | 'en'

/** اللغات المدعومة؛ fr/en تُضاف بملفات مطابقة للمفاتيح */
const dictionaries: Record<Locale, Dictionary> = {
  ar,
  fr: ar,
  en: ar
}

export const DEFAULT_LOCALE: Locale = 'ar'
export const LOCALE_DIR: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', fr: 'ltr', en: 'ltr' }

type PathsOf<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends readonly string[]
      ? `${P}${K}`
      : PathsOf<T[K], `${P}${K}.`>
}[keyof T & string]

export type TKey = PathsOf<Dictionary>

function lookup(dict: Dictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[part]
    }
    return undefined
  }, dict)
}

export function getDictionary(locale: Locale = DEFAULT_LOCALE): Dictionary {
  return dictionaries[locale] ?? ar
}

/**
 * t('auth.loginTitle') — مع استبدال {name} من params.
 * تعمل في الخادم والعميل (العربية افتراضياً).
 */
export function t(key: TKey, params?: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  const value = lookup(getDictionary(locale), key)
  let text = typeof value === 'string' ? value : key
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}

/** ترجمة قيمة تعداد بأمان: tEnum('attendanceStatus', 'LATE') */
export function tEnum(group: keyof Dictionary, value: string | null | undefined, locale: Locale = DEFAULT_LOCALE): string {
  if (!value) return '—'
  const dict = getDictionary(locale)[group] as unknown as Record<string, string>
  return dict?.[value] ?? value
}

export function dayName(day: number | null | undefined): string {
  if (day === null || day === undefined) return '—'
  return ar.days[day] ?? '—'
}

export function errorMessage(code: string): string {
  const dict = getDictionary().errors as Record<string, string>
  return dict[code] ?? dict.INTERNAL ?? code
}
