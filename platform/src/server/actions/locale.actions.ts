'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { LOCALE_COOKIE, isLocale } from '@/i18n'

/** يحفظ لغة الواجهة في كوكي (سنة) — لا يحتاج حساباً */
export async function setLocaleAction(locale: string): Promise<{ ok: boolean }> {
  if (!isLocale(locale)) return { ok: false }
  const jar = await cookies()
  jar.set(LOCALE_COOKIE, locale, { path: '/', sameSite: 'lax', maxAge: 365 * 24 * 3600, secure: process.env.NODE_ENV === 'production' })
  revalidatePath('/', 'layout')
  return { ok: true }
}
