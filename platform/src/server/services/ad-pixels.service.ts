import { and, desc, eq, gt, isNotNull, ne } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, onlinePayments, orders } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import { cleanMetaPixel, cleanTiktokPixel, type AdEvent, type AdPixelIds } from '@/lib/ad-pixels'

const KEY = 'web.ad_pixels'

/** المعرّفات المحفوظة الآن (بلا ذاكرة) — لصفحة الإعداد */
export async function loadAdPixels(db: Db): Promise<AdPixelIds> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
  const v = (row?.value ?? {}) as Partial<AdPixelIds>
  return { meta: cleanMetaPixel(v.meta) ?? '', tiktok: cleanTiktokPixel(v.tiktok) ?? '' }
}

/** للصفحات العامة: 60 ثانية في الذاكرة */
export function adPixels(db: Db): Promise<AdPixelIds> {
  return ttlMemo(KEY, 60_000, () => loadAdPixels(db))
}

/** المشرف: يلصق معرّف Meta Pixel و/أو TikTok Pixel؛ الفارغ = معطّل */
export async function setAdPixels(db: Db, actor: Actor, raw: { meta: string; tiktok: string }): Promise<AdPixelIds> {
  assertRole(actor, 'SUPER_ADMIN')
  const meta = raw.meta.trim() ? cleanMetaPixel(raw.meta) : ''
  const tiktok = raw.tiktok.trim() ? cleanTiktokPixel(raw.tiktok) : ''
  if (meta === null) throw new AppError('VALIDATION', { field: 'meta' })
  if (tiktok === null) throw new AppError('VALIDATION', { field: 'tiktok' })
  const before = await loadAdPixels(db)
  const next = { meta, tiktok }
  await db.insert(appSettings).values({ key: KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  ttlDelete(KEY)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.ad_pixels', entityType: 'settings', entityId: null, oldValue: { ...before }, newValue: { ...next } })
  return next
}

/**
 * «طلب» يُبلَّغ للإعلانات: طلبات التلميذ الآتية من صفحة هبوط في آخر ساعتين، غير الملغاة.
 * الدفع بالبطاقة يُحسب بعد الدفع فقط. رقم الطلب معرّف الحدث، فلا يتكرر الحدث عند تحديث الصفحة.
 */
export async function recentLandingConversions(db: Db, userId: string, now = new Date()): Promise<AdEvent[]> {
  const since = new Date(now.getTime() - 2 * 60 * 60 * 1000)
  const rows = await db
    .select({ id: orders.id, number: orders.number, total: orders.totalDzd, method: orders.paymentMethod })
    .from(orders)
    .where(and(eq(orders.userId, userId), isNotNull(orders.landingId), gt(orders.createdAt, since), ne(orders.status, 'CANCELLED')))
    .orderBy(desc(orders.createdAt))
    .limit(5)
  const out: AdEvent[] = []
  for (const r of rows) {
    if (r.method === 'ONLINE') {
      const [paid] = await db.select({ id: onlinePayments.id }).from(onlinePayments).where(and(eq(onlinePayments.orderId, r.id), eq(onlinePayments.status, 'PAID'))).limit(1)
      if (!paid) continue
    }
    out.push({ name: 'Purchase', valueDzd: r.total, orderNumber: r.number })
  }
  return out
}
