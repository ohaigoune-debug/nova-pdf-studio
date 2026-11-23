/**
 * الترجمة: اللغات الأربع عشرة للمشروع الأصلي (نفس ملفات JSON المستعملة في نسخة Windows)
 * + نصوص خاصة بتطبيق iOS تحت المفتاح "ios". أي نص ios غير مترجم بعد يرجع إلى الإنجليزية تلقائيًا.
 */
import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'
import { LANGUAGES, intlLocaleOf, languageDirection, type Language } from '@shared/settings'
import dAr from '@modules/translations/renderer/locales/ar.json'
import dEn from '@modules/translations/renderer/locales/en.json'
import dFr from '@modules/translations/renderer/locales/fr.json'
import dZh from '@modules/translations/renderer/locales/zh.json'
import dTr from '@modules/translations/renderer/locales/tr.json'
import dEs from '@modules/translations/renderer/locales/es.json'
import dDe from '@modules/translations/renderer/locales/de.json'
import dPt from '@modules/translations/renderer/locales/pt.json'
import dRu from '@modules/translations/renderer/locales/ru.json'
import dHi from '@modules/translations/renderer/locales/hi.json'
import dId from '@modules/translations/renderer/locales/id.json'
import dJa from '@modules/translations/renderer/locales/ja.json'
import dIt from '@modules/translations/renderer/locales/it.json'
import dFa from '@modules/translations/renderer/locales/fa.json'

const DESKTOP: Record<Language, Record<string, unknown>> = { ar: dAr, en: dEn, fr: dFr, zh: dZh, tr: dTr, es: dEs, de: dDe, pt: dPt, ru: dRu, hi: dHi, id: dId, ja: dJa, it: dIt, fa: dFa }

// نصوص التطبيق: تُحمَّل كلها (صغيرة) حتى يعمل التبديل الفوري دون إنترنت
const APP = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json', { eager: true })
function appStrings(lang: Language): Record<string, unknown> {
  return APP[`./locales/${lang}.json`]?.default ?? {}
}

export const SUPPORTED: Language[] = LANGUAGES.map((l) => l.code)

export function detectLanguage(preferred?: readonly string[]): Language {
  for (const tag of preferred ?? (typeof navigator !== 'undefined' ? navigator.languages : []) ?? []) {
    const base = tag.toLowerCase().split('-')[0] as Language
    if (SUPPORTED.includes(base)) return base
  }
  return 'ar'
}

export function initI18n(lang: Language): typeof i18next {
  if (!i18next.isInitialized) {
    void i18next.use(initReactI18next).init({
      resources: Object.fromEntries(SUPPORTED.map((code) => [code, { translation: { ...DESKTOP[code], ios: appStrings(code) } }])),
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      returnNull: false
    })
  }
  applyDirection(lang)
  return i18next
}

export function applyDirection(lang: Language): void {
  document.documentElement.setAttribute('dir', languageDirection(lang))
  document.documentElement.setAttribute('lang', lang)
}

export async function setLanguage(lang: Language): Promise<void> {
  await i18next.changeLanguage(lang)
  applyDirection(lang)
}

export const intlLocale = intlLocaleOf
export default i18next
