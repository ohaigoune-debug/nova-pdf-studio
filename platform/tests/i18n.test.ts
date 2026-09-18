import { describe, expect, it } from 'vitest'
import { LOCALES, errorMessage, getDictionary, isLocale, t, tEnum, translator } from '@/i18n'
import ar from '@/i18n/ar'

describe('i18n: القاموس العربي مصدر المفاتيح، والفرنسية/الإنجليزية تتراجع إليه', () => {
  it('كل لغة تملك نفس بنية المفاتيح (لا مفتاح مفقود بعد الدمج)', () => {
    const keys = (o: unknown, p = ''): string[] =>
      o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, p ? `${p}.${k}` : k)) : [p]
    const arKeys = keys(ar).sort()
    for (const l of LOCALES) expect(keys(getDictionary(l.code)).sort()).toEqual(arKeys)
  })

  it('الترجمة بلغة معيّنة مع التراجع إلى العربية للمفاتيح غير المترجمة', () => {
    expect(t('auth.loginTitle')).toBe('تسجيل الدخول')
    expect(t('auth.loginTitle', undefined, 'fr')).toBe('Connexion')
    expect(t('auth.loginTitle', undefined, 'en')).toBe('Log in')
    // مفتاح لوحة الأستاذ غير مترجم ⇒ عربي
    expect(t('teacherPages.studentsTitle', undefined, 'fr')).toBe(t('teacherPages.studentsTitle'))
    expect(t('activate.success', { group: 'A' }, 'en')).toBe('You have been enrolled in group A')
    const tf = translator('fr')
    expect(tf('nav.lessons')).toBe('Cours')
    expect(tEnum('contentTypes', 'LESSON', 'en')).toBe('Lesson')
    expect(errorMessage('INVALID_CREDENTIALS', 'fr')).toContain('incorrect')
    expect(errorMessage('QUIZ_CLOSED', 'fr')).toBe(errorMessage('QUIZ_CLOSED'))
  })

  it('isLocale يرفض القيم الغريبة', () => {
    expect(isLocale('fr')).toBe(true)
    expect(isLocale('de')).toBe(false)
    expect(isLocale(null)).toBe(false)
  })
})
