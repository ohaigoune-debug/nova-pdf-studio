/**
 * رابط تطبيق مدرسة في App Store (طلب المالك 16 نوفمبر 2026: إظهار تنزيل تطبيق الآيفون في المنصة).
 * يقبل الرابط كما ينسخه من App Store (https://apps.apple.com/dz/app/…/id1234567890) أو الرقم وحده،
 * ويعيد رابطًا نظيفًا ورقم التطبيق (لشريط Safari الذكي apple-itunes-app).
 */
export interface IosAppLink {
  url: string
  id: string
}

const ID = /^\d{6,12}$/

export function parseAppStoreLink(raw: string): IosAppLink | null {
  const value = raw.trim()
  if (!value) return null
  if (ID.test(value)) return { url: `https://apps.apple.com/app/id${value}`, id: value }
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return null
  }
  if (u.protocol !== 'https:' || u.hostname !== 'apps.apple.com') return null
  const id = /\/id(\d{6,12})(?:\/|$)/.exec(u.pathname)?.[1]
  if (!id) return null
  return { url: `https://apps.apple.com${u.pathname.replace(/\/+$/, '')}`, id }
}

/** هاتف آيفون أو آيباد (آيباد الحديث يتنكّر في Safari كحاسوب ماك، فلا يُكشف — يرى الزر في الصفحة الرئيسية) */
export function isAppleMobile(userAgent: string | null | undefined): boolean {
  return /iPhone|iPad|iPod/i.test(userAgent ?? '')
}
