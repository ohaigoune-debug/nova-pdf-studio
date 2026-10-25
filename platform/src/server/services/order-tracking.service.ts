/**
 * تتبّع الطلب وإلغاؤه من الزبون (نسق NOVA COMMERCE: public-tracking + customer-manage).
 *  - التتبّع بالهاتف وحده: آخر 5 طلبات خلال 180 يوماً، بالحالة والخط الزمني ورقم التتبّع وأحداث شركة التوصيل.
 *    لا عنوان ولا اسم كامل (الهاتف وحده لا يكشف بيانات شخصية)؛ محدود المعدّل لكل عنوان IP ولكل هاتف.
 *  - الإلغاء: صاحب الطلب وحده (بحسابه)، وقبل الشحن فقط (لا رقم تتبّع، والحالة قبل «في الطريق»).
 */
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { deliveryEvents, orderItems, orders, wilayas } from '@/server/db/schema'
import type { OrderStatus } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import { ORDER_STATUS_AR, transitionOrder } from './order-status.service'
import { normalizePhone } from './otp.service'

export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'NO_ANSWER', 'CALL_LATER', 'CONFIRMED']
export const CANCEL_REASONS = { changed_mind: 'غيّرت رأيي', ordered_by_mistake: 'طلبت بالخطأ', found_elsewhere: 'وجدته في مكان آخر', price: 'السعر', delay: 'التأخير', other: 'سبب آخر' } as const
export type CancelReason = keyof typeof CANCEL_REASONS

export interface TimelineStep {
  label: string
  at: Date
  tone: 'done' | 'bad' | 'info'
}

export interface TrackedOrder {
  id: string
  number: string
  status: OrderStatus
  statusAr: string
  createdAt: Date
  totalDzd: number
  itemsText: string
  /** الاسم الأول فقط */
  firstName: string
  deliveryProvider: string | null
  trackingId: string | null
  timeline: TimelineStep[]
  canCancel: boolean
  wilayaName: string | null
  commune: string | null
}

const PROVIDER_AR: Record<string, string> = { ecotrack: 'EcoTrack', yalidine: 'Yalidine', generic: 'شركة التوصيل' }

export function canCustomerCancel(o: { status: string; deliveryTrackingId: string | null }): boolean {
  return (CUSTOMER_CANCELLABLE as readonly string[]).includes(o.status) && !o.deliveryTrackingId
}

async function buildTimelines(db: Db, rows: (typeof orders.$inferSelect)[]): Promise<Map<string, TimelineStep[]>> {
  const ids = rows.map((r) => r.id)
  const evs = ids.length ? await db.select().from(deliveryEvents).where(inArray(deliveryEvents.orderId, ids)).orderBy(deliveryEvents.receivedAt) : []
  const out = new Map<string, TimelineStep[]>()
  for (const o of rows) {
    const steps: TimelineStep[] = [{ label: 'استُلم الطلب', at: o.createdAt, tone: 'done' }]
    if (o.lastCallAt && o.confirmAttempts > 0 && !o.confirmedAt) steps.push({ label: `حاولنا الاتصال بك (${o.confirmAttempts})`, at: o.lastCallAt, tone: 'info' })
    if (o.confirmedAt) steps.push({ label: 'أُكّد الطلب', at: o.confirmedAt, tone: 'done' })
    if (o.shippedAt) steps.push({ label: `سُلّم لشركة التوصيل${o.deliveryProvider ? ` (${PROVIDER_AR[o.deliveryProvider] ?? o.deliveryProvider})` : ''}`, at: o.shippedAt, tone: 'done' })
    for (const e of evs.filter((x) => x.orderId === o.id)) {
      const p = (e.payload ?? {}) as { label?: string | null; _meta?: { rawStatus?: string | null } }
      const label = p.label || p._meta?.rawStatus
      if (e.status === 'CREATED' || !label) continue
      steps.push({ label: `التوصيل: ${label}`, at: e.receivedAt, tone: e.status === 'FAILED_ATTEMPT' || e.status === 'RETURNED' ? 'bad' : 'info' })
    }
    if (o.deliveredAt) steps.push({ label: 'سُلِّم — تُفعَّل الدورة المرتبطة بالكتاب', at: o.deliveredAt, tone: 'done' })
    if (o.returnedAt) steps.push({ label: 'أُعيد الطرد', at: o.returnedAt, tone: 'bad' })
    if (o.cancelledAt) steps.push({ label: `أُلغي${o.cancelReason ? `: ${o.cancelReason}` : ''}`, at: o.cancelledAt, tone: 'bad' })
    steps.sort((a, b) => a.at.getTime() - b.at.getTime())
    out.set(o.id, steps)
  }
  return out
}

async function toTracked(db: Db, rows: (typeof orders.$inferSelect)[], includeLocation = false): Promise<TrackedOrder[]> {
  const timelines = await buildTimelines(db, rows)
  const wilayaIds = includeLocation ? [...new Set(rows.map((o) => o.wilayaId).filter((id): id is string => Boolean(id)))] : []
  const locations = wilayaIds.length ? await db.select({ id: wilayas.id, name: wilayas.nameAr }).from(wilayas).where(inArray(wilayas.id, wilayaIds)) : []
  const wilayaById = new Map(locations.map((w) => [w.id, w.name]))
  const ids = rows.map((r) => r.id)
  const items = ids.length ? await db.select({ orderId: orderItems.orderId, title: orderItems.title, qty: orderItems.qty }).from(orderItems).where(inArray(orderItems.orderId, ids)).orderBy(orderItems.createdAt) : []
  const text = (id: string) =>
    items
      .filter((i) => i.orderId === id)
      .map((i) => (i.qty > 1 ? `${i.title} ×${i.qty}` : i.title))
      .join(' + ')
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    statusAr: ORDER_STATUS_AR[o.status as OrderStatus] ?? o.status,
    createdAt: o.createdAt,
    totalDzd: o.totalDzd,
    itemsText: text(o.id),
    firstName: o.customerName.trim().split(/\s+/)[0] ?? '',
    deliveryProvider: o.deliveryProvider,
    trackingId: o.deliveryTrackingId,
    timeline: timelines.get(o.id) ?? [],
    canCancel: canCustomerCancel(o),
    wilayaName: includeLocation && o.wilayaId ? wilayaById.get(o.wilayaId) ?? null : null,
    commune: includeLocation ? o.commune : null
  }))
}

/** التتبّع العام بالهاتف (بلا حساب): آخر 5 طلبات خلال 180 يوماً — بلا إمكانية تعديل */
export async function trackByPhone(db: Db, rawPhone: string): Promise<TrackedOrder[]> {
  const phone = normalizePhone(rawPhone)
  const since = new Date(Date.now() - 180 * 86_400_000)
  const rows = await db.select().from(orders).where(and(eq(orders.phone, phone), gte(orders.createdAt, since))).orderBy(desc(orders.createdAt)).limit(5)
  // التتبّع العام لا يُلغي: الإلغاء من حساب صاحب الطلب فقط
  return (await toTracked(db, rows)).map((o) => ({ ...o, canCancel: false }))
}

/** طلبات التلميذ بحسابه مع الخط الزمني وإمكانية الإلغاء */
export async function myTrackedOrders(db: Db, actor: Actor): Promise<TrackedOrder[]> {
  const rows = await db.select().from(orders).where(eq(orders.userId, actor.userId)).orderBy(desc(orders.createdAt)).limit(30)
  return toTracked(db, rows, true)
}

/** الزبون يلغي طلبه قبل الشحن؛ المخزون يعود والمشرف يُخطر (محرّك الحالات) */
export async function cancelMyOrder(db: Db, actor: Actor, orderId: string, reason: CancelReason, note?: string | null): Promise<void> {
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  const [o] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.userId, actor.userId))).limit(1)
  if (!o) throw new AppError('ORDER_NOT_FOUND')
  if (!canCustomerCancel(o)) throw new AppError('ORDER_NOT_CANCELLABLE')
  const label = CANCEL_REASONS[reason] ?? CANCEL_REASONS.other
  const why = [label, note?.trim().slice(0, 200)].filter(Boolean).join(' — ')
  await transitionOrder(db, o.id, 'CANCELLED', { actorUserId: actor.userId, source: 'customer', reason: why })
}
