/**
 * شركة التوصيل (M8): webhook يستقبل أحداث الشحنة، يزيل التكرار، يطابق الطلب،
 * وعند «سُلِّم» يفعّل الدورة المرتبطة بالكتاب تلقائياً على حساب التلميذ — أو يرسل رمز مطالبة
 * بالـSMS حين يكون المشتري وليّ أمر بلا حساب تلميذ. لا يُحذف أي حدث.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, deliveryEvents, orders } from '@/server/db/schema'
import type { DeliveryEventStatus } from '@/server/db/schema/enums'
import { DELIVERY_EVENT_STATUSES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { notifyAdmins, transitionOrder } from './order-status.service'

/* ───────────────────────── المزوّدون وخرائط الحقول ───────────────────────── */

export const DELIVERY_PROVIDERS = ['generic', 'yalidine', 'ecotrack'] as const
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number]
export const DELIVERY_PROVIDER_AR: Record<DeliveryProvider, string> = { generic: 'شركة توصيل (عام)', yalidine: 'Yalidine', ecotrack: 'EcoTrack' }

interface FieldMap {
  /** مسارات مرشّحة لكل حقل، بالترتيب (الأول الموجود يُعتمد) */
  externalId: string[]
  trackingId: string[]
  status: string[]
  orderNumber: string[]
}

const PROVIDER_FIELDS: Record<DeliveryProvider, FieldMap> = {
  generic: { externalId: ['id', 'event_id', 'eventId'], trackingId: ['tracking', 'tracking_id', 'trackingId'], status: ['status', 'event'], orderNumber: ['order', 'order_number', 'orderNumber', 'reference'] },
  yalidine: { externalId: ['event_id', 'id', 'tracking+status'], trackingId: ['tracking', 'tracking_id'], status: ['status', 'last_status', 'event'], orderNumber: ['order_id', 'reference', 'customer_reference'] },
  ecotrack: { externalId: ['id', 'event_id', 'tracking+status'], trackingId: ['tracking', 'tracking_id'], status: ['status', 'event'], orderNumber: ['reference', 'order', 'order_number'] }
}

/** تطبيع حالات المزوّدين (عربية/فرنسية/إنجليزية) إلى الحالات الست */
const STATUS_ALIASES: [DeliveryEventStatus, string[]][] = [
  ['DELIVERED', ['delivered', 'livre', 'livré', 'livrée', 'delivre', 'received', 'completed', 'done', 'سُلّم', 'سلم', 'تم التسليم', 'تم التوصيل']],
  ['RETURNED', ['returned', 'return', 'retour', 'retourne', 'retourné', 'مرتجع', 'إرجاع', 'ارجاع']],
  ['FAILED_ATTEMPT', ['failed_attempt', 'failed attempt', 'tentative', 'echou', 'échou', 'echec', 'échec', 'failed', 'absent', 'injoignable', 'reporte', 'reporté', 'محاولة فاشلة', 'لا يرد']],
  ['CANCELLED', ['cancelled', 'canceled', 'annule', 'annulé', 'annulée', 'ملغى', 'ملغي', 'ألغي']],
  ['IN_TRANSIT', ['in_transit', 'in transit', 'transit', 'shipped', 'expedie', 'expédié', 'expédiée', 'en cours', 'en_cours', 'en livraison', 'out for delivery', 'sorti en livraison', 'centre', 'hub', 'dispatched', 'في الطريق', 'قيد التوصيل']],
  ['CREATED', ['created', 'pending', 'new', 'cree', 'créé', 'créée', 'en préparation', 'prepared', 'ready', 'جديد', 'أُنشئ']]
]

/**
 * نفي التسليم («non livré»، «not delivered»، «pas livré»، «لم يُسلَّم»…): ليس تسليماً أبداً.
 * يُفحص قبل الأسماء المستعارة لأن «non livré» يحتوي «livré».
 */
export const NOT_DELIVERED_RE = /(non|pas|jamais)[\s_-]*livr|not[\s_-]*deliver|undeliver|no[\s_-]*entreg|لم[\s_]*ي?[ُ]?سل|غير[\s_]*مسل|لم[\s_]*يتم[\s_]*التسليم/i

export function normalizeDeliveryStatus(raw: unknown): DeliveryEventStatus {
  if (typeof raw !== 'string') return 'UNKNOWN'
  const s = raw.trim().toLowerCase()
  if (NOT_DELIVERED_RE.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return 'FAILED_ATTEMPT'
  if ((DELIVERY_EVENT_STATUSES as readonly string[]).includes(s.toUpperCase())) return s.toUpperCase() as DeliveryEventStatus
  for (const [status, aliases] of STATUS_ALIASES) if (aliases.some((a) => s === a || s.includes(a))) return status
  return 'UNKNOWN'
}

function pick(payload: Record<string, unknown>, paths: string[]): string | null {
  for (const p of paths) {
    if (p === 'tracking+status') continue
    const parts = p.split('.')
    let cur: unknown = payload
    for (const part of parts) cur = cur && typeof cur === 'object' ? (cur as Record<string, unknown>)[part] : undefined
    if (cur === undefined || cur === null) {
      // بعض المزوّدين يلفّون الحدث داخل data/shipment/parcel
      for (const wrap of ['data', 'shipment', 'parcel', 'event']) {
        const inner = payload[wrap]
        if (inner && typeof inner === 'object') {
          const v = (inner as Record<string, unknown>)[p]
          if (typeof v === 'string' || typeof v === 'number') return String(v)
        }
      }
      continue
    }
    if (typeof cur === 'string' || typeof cur === 'number') return String(cur)
  }
  return null
}

export interface ParsedDeliveryEvent {
  externalId: string
  trackingId: string | null
  status: DeliveryEventStatus
  rawStatus: string | null
  orderNumber: string | null
}

export function parseDeliveryPayload(provider: DeliveryProvider, payload: Record<string, unknown>): ParsedDeliveryEvent {
  const map = PROVIDER_FIELDS[provider]
  const trackingId = pick(payload, map.trackingId)
  const rawStatus = pick(payload, map.status)
  const status = normalizeDeliveryStatus(rawStatus)
  const orderNumber = pick(payload, map.orderNumber)
  // لا معرّف خارجي ⇒ نشتقّه من (التتبّع + الحالة) حتى لا يُعالَج نفس الحدث مرتين
  const externalId = pick(payload, map.externalId) ?? (trackingId ? `${trackingId}:${status}` : null)
  if (!externalId) throw new AppError('VALIDATION', { field: 'externalId' })
  return { externalId: externalId.slice(0, 200), trackingId: trackingId?.trim().slice(0, 120) ?? null, status, rawStatus, orderNumber: orderNumber?.trim().slice(0, 60) ?? null }
}

export function isDeliveryProvider(p: string | null | undefined): p is DeliveryProvider {
  return !!p && (DELIVERY_PROVIDERS as readonly string[]).includes(p)
}

/* ───────────────────────── سرّ الـwebhook ───────────────────────── */

export const DELIVERY_SECRET_KEY = 'delivery.webhookSecret'
const SEAL_PURPOSE = 'delivery-webhook'

export async function saveDeliveryWebhookSecret(db: Db, actor: Actor, secret: string | null): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const s = secret?.trim() ?? ''
  if (!s) {
    await db.delete(appSettings).where(eq(appSettings.key, DELIVERY_SECRET_KEY))
  } else {
    if (s.length < 16 || s.length > 200) throw new AppError('VALIDATION', { field: 'secret' })
    const value = { sealed: seal(s, SEAL_PURPOSE), hint: s.slice(-4), updatedAt: new Date().toISOString() }
    await db.insert(appSettings).values({ key: DELIVERY_SECRET_KEY, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'delivery.secret_set', entityType: 'settings', entityId: null, newValue: { cleared: !s } })
}

export async function deliverySecretStatus(db: Db): Promise<{ source: 'admin' | 'env' | 'none'; hint: string | null }> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, DELIVERY_SECRET_KEY)).limit(1)
  const v = row?.value as { sealed?: string; hint?: string } | undefined
  if (v?.sealed && unseal(v.sealed, SEAL_PURPOSE)) return { source: 'admin', hint: v.hint ?? null }
  if (process.env.DELIVERY_WEBHOOK_SECRET) return { source: 'env', hint: null }
  return { source: 'none', hint: null }
}

async function resolveSecret(db: Db): Promise<string | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, DELIVERY_SECRET_KEY)).limit(1)
  const v = row?.value as { sealed?: string } | undefined
  const admin = v?.sealed ? unseal(v.sealed, SEAL_PURPOSE) : null
  return admin ?? process.env.DELIVERY_WEBHOOK_SECRET ?? null
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/**
 * يقبل: الترويسة x-webhook-secret مساوية للسرّ، أو x-signature = HMAC-SHA256(السرّ, الجسم الخام) hex.
 * بلا سرّ مضبوط ⇒ مرفوض دائماً.
 */
export async function verifyDeliveryWebhook(db: Db, input: { headerSecret: string | null; signature: string | null; rawBody: string }): Promise<boolean> {
  const secret = await resolveSecret(db)
  if (!secret) return false
  if (input.headerSecret && safeEqual(input.headerSecret, secret)) return true
  if (input.signature) {
    const expected = createHmac('sha256', secret).update(input.rawBody).digest('hex')
    const given = input.signature.replace(/^sha256=/i, '').trim().toLowerCase()
    if (safeEqual(given, expected)) return true
  }
  return false
}

/* التفعيل انتقل إلى course-activation.service (يُعاد تصديره هنا للمستدعين القدامى) */
import type { ActivationSummary } from './course-activation.service'
export { activateEnrollment, activateCoursesForOrder, type ActivateInput, type ActivationSummary } from './course-activation.service'

/* ───────────────────────── تطبيق حالة شحنة على طلب ───────────────────────── */

export interface ApplyDeliveryResult {
  activation: ActivationSummary | null
  error: string | null
  changed: boolean
}

/**
 * يترجم حالة الشحنة (من webhook أو من مزامنة EcoTrack) إلى انتقال في محرّك الطلبات:
 * DELIVERED ⇒ سُلِّم + تفعيل الدورة؛ IN_TRANSIT ⇒ في الطريق؛ RETURNED ⇒ مرتجع؛ CANCELLED ⇒ ملاحظة (لا نلغي طلباً من تلقاء الشركة)؛
 * FAILED_ATTEMPT ⇒ ملاحظة + إشعار المشرف ليتصل بالزبون.
 */
export async function applyDeliveryStatus(db: Db, order: typeof orders.$inferSelect, status: DeliveryEventStatus, ctx: { provider: DeliveryProvider; trackingId: string | null; rawStatus: string | null; source: 'delivery' | 'ecotrack' }): Promise<ApplyDeliveryResult> {
  const common = { actorUserId: null, source: ctx.source, deliveryProvider: order.deliveryProvider ?? ctx.provider, deliveryTrackingId: order.deliveryTrackingId ?? ctx.trackingId } as const
  if (status === 'DELIVERED') {
    if (order.status === 'CANCELLED') return { activation: null, error: 'order cancelled', changed: false }
    if (order.status === 'RETURNED') return { activation: null, error: 'order returned', changed: false }
    const r = await transitionOrder(db, order.id, 'DELIVERED', { ...common, force: true })
    return { activation: r.activation, error: null, changed: r.changed }
  }
  if (status === 'IN_TRANSIT') {
    if (order.status !== 'CONFIRMED') return { activation: null, error: null, changed: false }
    const r = await transitionOrder(db, order.id, 'SHIPPED', common)
    return { activation: null, error: null, changed: r.changed }
  }
  if (status === 'RETURNED') {
    if (order.status !== 'SHIPPED' && order.status !== 'CONFIRMED' && order.status !== 'DELIVERED') return { activation: null, error: null, changed: false }
    const r = await transitionOrder(db, order.id, 'RETURNED', { ...common, force: true, reason: ctx.rawStatus })
    return { activation: null, error: null, changed: r.changed }
  }
  if (status === 'FAILED_ATTEMPT' || status === 'CANCELLED') {
    const label = status === 'FAILED_ATTEMPT' ? 'محاولة تسليم فاشلة' : 'ألغته شركة التوصيل'
    await db.update(orders).set({ adminNote: sql`concat_ws(' | ', ${orders.adminNote}, ${`التوصيل: ${label} (${ctx.rawStatus ?? status})`}::text)`, updatedAt: new Date() }).where(eq(orders.id, order.id))
    await notifyAdmins(db, { title: `${status === 'FAILED_ATTEMPT' ? '📵' : '✖️'} الطلب ${order.number}: ${label}`, body: `${order.customerName} · ${order.phone}${ctx.rawStatus ? ` · ${ctx.rawStatus}` : ''} — اتصل بالزبون.`, link: `/admin/store?status=SHIPPED` })
    return { activation: null, error: null, changed: false }
  }
  return { activation: null, error: null, changed: false }
}

/* ───────────────────────── تسجيل الحدث ───────────────────────── */

export interface RecordResult {
  duplicate: boolean
  eventId: string | null
  status: DeliveryEventStatus
  orderId: string | null
  error: string | null
  activation: ActivationSummary | null
}

/** يسجّل حدث التوصيل (idempotent) ويعالجه: مطابقة الطلب، وعند DELIVERED تسليم الطلب + التفعيل */
export async function recordDeliveryEvent(db: Db, provider: DeliveryProvider, payload: Record<string, unknown>, meta: { ip?: string | null } = {}): Promise<RecordResult> {
  const parsed = parseDeliveryPayload(provider, payload)
  // مطابقة الطلب: رقم التتبّع أولاً ثم رقم الطلب
  let order: typeof orders.$inferSelect | undefined
  if (parsed.trackingId) {
    ;[order] = await db.select().from(orders).where(and(eq(orders.deliveryProvider, provider), eq(orders.deliveryTrackingId, parsed.trackingId))).limit(1)
    if (!order) [order] = await db.select().from(orders).where(eq(orders.deliveryTrackingId, parsed.trackingId)).limit(1)
  }
  if (!order && parsed.orderNumber) [order] = await db.select().from(orders).where(eq(orders.number, parsed.orderNumber)).limit(1)

  const inserted = await db
    .insert(deliveryEvents)
    .values({ provider, externalId: parsed.externalId, trackingId: parsed.trackingId, orderId: order?.id ?? null, status: parsed.status, payload: { ...payload, _meta: { ip: meta.ip ?? null, rawStatus: parsed.rawStatus } }, error: order ? null : 'order not found' })
    .onConflictDoNothing({ target: [deliveryEvents.provider, deliveryEvents.externalId] })
    .returning({ id: deliveryEvents.id })
  const ev = inserted[0]
  if (!ev) return { duplicate: true, eventId: null, status: parsed.status, orderId: order?.id ?? null, error: null, activation: null }
  if (!order) return { duplicate: false, eventId: ev.id, status: parsed.status, orderId: null, error: 'order not found', activation: null }

  let activation: ActivationSummary | null = null
  let error: string | null = null
  try {
    const r = await applyDeliveryStatus(db, order, parsed.status, { provider, trackingId: parsed.trackingId, rawStatus: parsed.rawStatus, source: 'delivery' })
    activation = r.activation
    error = r.error
  } catch (err) {
    error = err instanceof Error ? err.message.slice(0, 300) : 'processing failed'
    if (process.env.NODE_ENV !== 'test') console.error('[delivery] processing failed', err)
  }
  await db.update(deliveryEvents).set({ processedAt: new Date(), error }).where(eq(deliveryEvents.id, ev.id))
  return { duplicate: false, eventId: ev.id, status: parsed.status, orderId: order.id, error, activation }
}

/* ───────────────────────── الإدارة ───────────────────────── */

export async function listDeliveryEvents(db: Db, actor: Actor, limit = 200) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ id: deliveryEvents.id, provider: deliveryEvents.provider, externalId: deliveryEvents.externalId, trackingId: deliveryEvents.trackingId, status: deliveryEvents.status, orderId: deliveryEvents.orderId, orderNumber: orders.number, orderStatus: orders.status, receivedAt: deliveryEvents.receivedAt, processedAt: deliveryEvents.processedAt, error: deliveryEvents.error })
    .from(deliveryEvents)
    .leftJoin(orders, eq(orders.id, deliveryEvents.orderId))
    .orderBy(desc(deliveryEvents.receivedAt))
    .limit(Math.max(1, Math.min(500, limit)))
}

/** المشرف يضبط شركة التوصيل ورقم التتبّع عند الشحن (ويُحوَّل الطلب المؤكَّد إلى SHIPPED) */
export async function setOrderShipping(db: Db, actor: Actor, orderId: string, input: { provider: DeliveryProvider; trackingId: string }): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  if (!isDeliveryProvider(input.provider)) throw new AppError('VALIDATION', { field: 'provider' })
  const trackingId = input.trackingId.trim()
  if (trackingId.length < 3 || trackingId.length > 120) throw new AppError('VALIDATION', { field: 'trackingId' })
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o) throw new AppError('ORDER_NOT_FOUND')
  if (o.status !== 'CONFIRMED' && o.status !== 'SHIPPED' && o.status !== 'DELIVERED') throw new AppError('ORDER_INVALID_TRANSITION')
  if (o.status === 'CONFIRMED') {
    await transitionOrder(db, orderId, 'SHIPPED', { actorUserId: actor.userId, source: 'admin', deliveryProvider: input.provider, deliveryTrackingId: trackingId })
  } else {
    await db.update(orders).set({ deliveryProvider: input.provider, deliveryTrackingId: trackingId, updatedAt: new Date() }).where(eq(orders.id, orderId))
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'delivery.shipping_set', entityType: 'order', entityId: orderId, oldValue: { status: o.status, trackingId: o.deliveryTrackingId }, newValue: { provider: input.provider, trackingId } })
}

/** معلومات الشحن لعدّة طلبات (لصفحة المتجر في الإدارة) */
export async function shippingInfoFor(db: Db, actor: Actor, orderIds: string[]): Promise<Record<string, { provider: string | null; trackingId: string | null }>> {
  assertRole(actor, 'SUPER_ADMIN')
  if (orderIds.length === 0) return {}
  const rows = await db.select({ id: orders.id, provider: orders.deliveryProvider, trackingId: orders.deliveryTrackingId }).from(orders).where(inArray(orders.id, orderIds))
  return Object.fromEntries(rows.map((r) => [r.id, { provider: r.provider, trackingId: r.trackingId }]))
}

export async function deliveryStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      delivered: sql<number>`count(*) filter (where ${deliveryEvents.status} = 'DELIVERED')::int`,
      unmatched: sql<number>`count(*) filter (where ${deliveryEvents.orderId} is null)::int`,
      failed: sql<number>`count(*) filter (where ${deliveryEvents.error} is not null and ${deliveryEvents.orderId} is not null)::int`
    })
    .from(deliveryEvents)
  return { total: r?.total ?? 0, delivered: r?.delivered ?? 0, unmatched: r?.unmatched ?? 0, failed: r?.failed ?? 0 }
}
