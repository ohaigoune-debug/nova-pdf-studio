import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { isAppleMobile, parseAppStoreLink, type IosAppLink } from '@/lib/ios-app'

const KEY = 'web.ios_app_store_url'

/** القيمة المحفوظة الآن، بلا ذاكرة: لصفحة الإعداد حتى يرى المشرف ما حفظه فورًا */
export async function loadIosAppLink(db: Db): Promise<IosAppLink | null> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
  return typeof row?.value === 'string' ? parseAppStoreLink(row.value) : null
}

/**
 * رابط تطبيق الآيفون في App Store كما حفظه المشرف (فارغ = لا زرّ ولا شريط).
 * يُقرأ في الصفحة الرئيسية وصفحة التلميذ: 60 ثانية في الذاكرة، فيظهر التعديل للتلاميذ خلال دقيقة على الأكثر.
 */
export async function iosAppLink(db: Db): Promise<IosAppLink | null> {
  return ttlMemo(KEY, 60_000, () => loadIosAppLink(db))
}

/** المشرف: يلصق رابط App Store (أو رقم التطبيق)، أو يتركه فارغًا لإخفاء الزر */
export async function setIosAppLink(db: Db, actor: Actor, raw: string): Promise<IosAppLink | null> {
  assertRole(actor, 'SUPER_ADMIN')
  const value = raw.trim()
  const next = value ? parseAppStoreLink(value) : null
  if (value && !next) throw new AppError('VALIDATION')
  const before = await loadIosAppLink(db)
  const stored = next?.url ?? ''
  await db.insert(appSettings).values({ key: KEY, value: stored }).onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.ios_app_link', entityType: 'settings', entityId: null, oldValue: { url: before?.url ?? '' }, newValue: { url: stored } })
  return next
}

/**
 * هل يُعرض زرّ «حمّل تطبيق الآيفون»؟ الرابط محفوظ، والزائر ليس داخل أحد تطبيقَي مدرسة.
 * onlyAppleMobile: في لوحة التلميذ لا معنى للزرّ على أندرويد أو حاسوب.
 */
export async function iosAppDownload(db: Db, opts: { onlyAppleMobile?: boolean } = {}): Promise<IosAppLink | null> {
  const [link, h, insideIos] = await Promise.all([iosAppLink(db), headers(), isIosStudyOnly()])
  if (!link || insideIos || h.get('x-madrasa-app') === '1') return null
  if (opts.onlyAppleMobile && !isAppleMobile(h.get('user-agent'))) return null
  return link
}
