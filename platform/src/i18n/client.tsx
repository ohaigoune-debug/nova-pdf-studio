'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { DEFAULT_LOCALE, translator, type Locale, type Translator } from './index'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

/** مترجم بلغة الطلب داخل مكوّنات العميل */
export function useT(): Translator {
  const locale = useLocale()
  return useMemo(() => translator(locale), [locale])
}
