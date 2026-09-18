import 'server-only'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, translator, type Locale, type Translator } from './index'

/** لغة الطلب الحالي من الكوكي (العربية افتراضياً). آمنة خارج سياق الطلب. */
export async function getLocale(): Promise<Locale> {
  try {
    const v = (await cookies()).get(LOCALE_COOKIE)?.value
    return isLocale(v) ? v : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

/** مترجم مقيّد بلغة الطلب للمكوّنات الخادمية */
export async function getT(): Promise<{ t: Translator; locale: Locale }> {
  const locale = await getLocale()
  return { t: translator(locale), locale }
}
