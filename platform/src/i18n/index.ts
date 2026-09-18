import ar from './ar'
import en from './en'
import fr from './fr'
import type { DeepPartial } from './types'

export type Dictionary = typeof ar
export type Locale = 'ar' | 'fr' | 'en'

export const LOCALES: { code: Locale; label: string; dir: 'rtl' | 'ltr' }[] = [
  { code: 'ar', label: 'العربية', dir: 'rtl' },
  { code: 'fr', label: 'Français', dir: 'ltr' },
  { code: 'en', label: 'English', dir: 'ltr' }
]
export const LOCALE_COOKIE = 'madrasa_locale'
export const DEFAULT_LOCALE: Locale = 'ar'
export const LOCALE_DIR: Record<Locale, 'rtl' | 'ltr'> = { ar: 'rtl', fr: 'ltr', en: 'ltr' }

export function isLocale(v: unknown): v is Locale {
  return v === 'ar' || v === 'fr' || v === 'en'
}

/** دمج عميق: المفاتيح غير المترجمة تبقى بالعربية (المصدر الوحيد للمفاتيح) */
function merge<T extends object>(base: T, patch: DeepPartial<T> | undefined): T {
  if (!patch) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const b = out[k]
    if (v && typeof v === 'object' && !Array.isArray(v) && b && typeof b === 'object' && !Array.isArray(b)) out[k] = merge(b as object, v as DeepPartial<object>)
    else if (v !== undefined) out[k] = v
  }
  return out as T
}

const dictionaries: Record<Locale, Dictionary> = {
  ar,
  fr: merge(ar, fr),
  en: merge(ar, en)
}

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
 * تعمل في الخادم والعميل (العربية افتراضياً). للغة الطلب: `getT()` في الخادم أو `useT()` في العميل.
 */
export function t(key: TKey, params?: Record<string, string | number>, locale: Locale = DEFAULT_LOCALE): string {
  const value = lookup(getDictionary(locale), key)
  let text = typeof value === 'string' ? value : key
  if (params) {
    for (const [k, v] of Object.entries(params)) text = text.replaceAll(`{${k}}`, String(v))
  }
  return text
}

export type Translator = (key: TKey, params?: Record<string, string | number>) => string

/** مترجم مقيّد بلغة معيّنة */
export function translator(locale: Locale): Translator {
  return (key, params) => t(key, params, locale)
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

export function errorMessage(code: string, locale: Locale = DEFAULT_LOCALE): string {
  const dict = getDictionary(locale).errors as Record<string, string>
  return dict[code] ?? dict.INTERNAL ?? code
}
