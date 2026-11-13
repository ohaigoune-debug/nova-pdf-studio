/**
 * PLAY وبنك البكالوريات لتطبيق آيفون وحده (قرار المالك 13 نوفمبر 2026).
 * يختفيان من الموقع، ومن تطبيق أندرويد لأنه يعرض الموقع نفسه، ويبقيان في تطبيق آيفون:
 * شاشاته الأصلية (‎/api/v1/ios/*) لا تمرّ من هنا أصلًا، وصفحاته داخل التطبيق تحمل عرض «دراسة فقط».
 * يُعاد إظهارهما للجميع من الإدارة ← أقسام حساب التلميذ، دون برمجة. دوال نقية تُختبر وحدها.
 */
import type { UserRole } from '@/server/db/schema/enums'

/** مسارات حساب التلميذ (وكل ما تحتها) */
export const IOS_ONLY_STUDENT_PATHS = ['/student/play', '/bac', '/student/past-bac'] as const

/** الصفحات العامة، ومعها المسارات القديمة التي تحوّل إليها */
export const IOS_ONLY_PUBLIC_PATHS = ['/play', '/bac', '/past-bac', '/archive'] as const

/** فريق المنصة يبقى يراهما في الموقع ليراجع المحتوى قبل نشره في التطبيق */
export const IOS_ONLY_PREVIEW_ROLES: readonly UserRole[] = ['SUPER_ADMIN', 'CONTENT_UPLOADER']

/** هل يُخفى PLAY والبنك عن هذا الزائر؟ */
export function iosOnlyHiddenFor(input: { enabled: boolean; ios: boolean; role?: UserRole | null }): boolean {
  if (!input.enabled || input.ios) return false
  return !(input.role && IOS_ONLY_PREVIEW_ROLES.includes(input.role))
}

/** يضيف مسارات PLAY والبنك إلى ما أخفاه المشرف من حساب التلميذ */
export function withIosOnly(hidden: readonly string[], hide: boolean): string[] {
  return hide ? [...new Set([...hidden, ...IOS_ONLY_STUDENT_PATHS])] : [...hidden]
}

export function isIosOnlyPublicPath(path: string): boolean {
  const p = path.replace(/\/+$/, '').toLowerCase() || '/'
  return IOS_ONLY_PUBLIC_PATHS.some((h) => p === h || p.startsWith(h + '/'))
}
