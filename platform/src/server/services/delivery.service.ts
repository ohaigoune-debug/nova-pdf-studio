/**
 * شركة التوصيل (M8): webhook يستقبل أحداث الشحنة، يزيل التكرار، يطابق الطلب،
 * وعند «سُلِّم» يفعّل الدورة المرتبطة بالكتاب تلقائياً على حساب التلميذ — أو يرسل رمز مطالبة
 * بالـSMS حين يكون المشتري وليّ أمر بلا حساب تلميذ. لا يُحذف أي حدث.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, courseProducts, courses, deliveryEvents, orderItems, orders, students } from '@/server/db/schema'
import type { DeliveryEventStatus, EnrollmentSource } from '@/server/db/schema/enums'
import { DELIVERY_EVENT_STATUSES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { sendSms } from '@/server/lib/sms'
import { createClaim } from './claims.service'
import { enrollStudent } from './courses.service'
import { grantPurchasesForOrder } from './marketplace.service'
import { notify } from './notifications.service'

/* ───────────────────────── المزوّدون وخرائط الحقول ───────────────────────── */

export const DELIVERY_PROVIDERS = ['generic', 'yalidine'] as const
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number]
export const DELIVERY_PROVIDER_AR: Record<DeliveryProvider, string> = { generic: 'شركة توصيل (عام)', yalidine: 'Yalidine' }

interface FieldMap {
  /** مسارات مرشّحة لكل حقل، بالترتيب (الأول الموجود يُعتمد) */
  externalId: string[]
  trackingId: string[]
  status: string[]
  orderNumber: string[]
}

const PROVIDER_FIELDS: Record<DeliveryProvider, FieldMap> = {
  generic: { externalId: ['id', 'event_id', 'eventId'], trackingId: ['tracking', 'tracking_id', 'trackingId'], status: ['status', 'event'], orderNumber: ['order', 'order_number', 'orderNumber', 'reference'] },
  yalidine: { externalId: ['event_id', 'id', 'tracking+status'], trackingId: ['tracking', 'tracking_id'], status: ['status', 'last_status', 'event'], orderNumber: ['order_id', 'reference', 'customer_reference'] }
}

/** تطبيع حالات المزوّدين (عربية/فرنسية/إنجليزية) إلى الحالات الست */
const STATUS_ALIASES: [DeliveryEventStatus, string[]][] = [
  ['DELIVERED', ['delivered', 'livre', 'livré', 'livrée', 'delivre', 'received', 'completed', 'done', 'سُلّم', 'سلم', 'تم التسليم', 'تم التوصيل']],
  ['RETURNED', ['returned', 'return', 'retour', 'retourne', 'retourné', 'echec', 'échec', 'failed', 'مرتجع', 'إرجاع', 'ارجاع']],
  ['CANCELLED', ['cancelled', 'canceled', 'annule', 'annulé', 'annulée', 'ملغى', 'ملغي', 'ألغي']],
  ['IN_TRANSIT', ['in_transit', 'in transit', 'transit', 'shipped', 'expedie', 'expédié', 'expédiée', 'en cours', 'en_cours', 'en livraison', 'out for delivery', 'sorti en livraison', 'centre', 'hub', 'dispatched', 'في الطريق', 'قيد التوصيل']],
  ['CREATED', ['created', 'pending', 'new', 'cree', 'créé', 'créée', 'en préparation', 'prepared', 'ready', 'جديد', 'أُنشئ']]
]

export function normalizeDeliveryStatus(raw: unknown): DeliveryEventStatus {
  if (typeof raw !== 'string') return 'UNKNOWN'
  const s = raw.trim().toLowerCase()
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

/* ───────────────────────── التفعيل ───────────────────────── */

export interface ActivateInput {
  courseId: string
  studentId: string
  source: EnrollmentSource
  orderId: string | null
  activatedByUserId: string | null
}

/** تفعيل اشتراك تلميذ في دورة بلا فاعل (النظام): يفوّض إلى enrollStudent في courses.service */
export async function activateEnrollment(db: Db, input: ActivateInput): Promise<{ enrollmentId: string }> {
  const row = await enrollStudent(db, null, { courseId: input.courseId, studentId: input.studentId, source: input.source, orderId: input.orderId, activatedByUserId: input.activatedByUserId })
  return { enrollmentId: row.id }
}

export interface ActivationSummary {
  enrolled: { courseId: string; studentId: string }[]
  claims: { courseId: string; claimId: string; phone: string }[]
}

/** بعد تسليم الطلب: لكل منتج مرتبط بدورة ⇒ تفعيل على التلميذ المستفيد/حساب التلميذ، وإلا مطالبة بالـSMS */
export async function activateCoursesForOrder(db: Db, orderId: string): Promise<ActivationSummary> {
  const summary: ActivationSummary = { enrolled: [], claims: [] }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return summary
  const items = await db.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, orderId))
  if (items.length === 0) return summary
  const links = await db
    .select({ courseId: courseProducts.courseId, title: courses.title, workspaceId: courses.workspaceId })
    .from(courseProducts)
    .innerJoin(courses, eq(courses.id, courseProducts.courseId))
    .where(inArray(courseProducts.productId, [...new Set(items.map((i) => i.productId))]))
  if (links.length === 0) return summary
  const courseIds = [...new Set(links.map((l) => l.courseId))]

  let studentId: string | null = order.beneficiaryStudentId ?? null
  if (!studentId) {
    const [s] = await db.select({ id: students.id }).from(students).where(eq(students.userId, order.userId)).limit(1)
    studentId = s?.id ?? null
  }
  for (const courseId of courseIds) {
    const link = links.find((l) => l.courseId === courseId)!
    if (studentId) {
      await activateEnrollment(db, { courseId, studentId, source: 'BOOK_ORDER', orderId: order.id, activatedByUserId: null })
      summary.enrolled.push({ courseId, studentId })
      await writeAudit(db, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, studentId, mode: 'enroll' } })
    } else {
      const claim = await createClaim(db, { orderId: order.id, courseId, phone: order.phone })
      summary.claims.push({ courseId, claimId: claim.id, phone: claim.phone })
      try {
        await sendSms(db, { to: claim.phone, text: `مدرسة: تم تسليم طلبك ${order.number}. لتفعيل دورة ${link.title} على حساب التلميذ أدخل الرمز ${claim.code} في madrasadz.com/claim` })
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.error('[delivery] sms failed', err)
      }
      await notify(db, { userId: order.userId, workspaceId: link.workspaceId, type: 'SYSTEM', title: `رمز تفعيل دورة «${link.title}»`, body: `سُلّم طلبك ${order.number}. أُرسل رمز التفعيل إلى الهاتف ${claim.phone}؛ يُدخله التلميذ من حسابه في صفحة /claim.`, link: '/claim' })
      await writeAudit(db, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, claimId: claim.id, mode: 'claim' } })
    }
  }
  return summary
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
    if (parsed.status === 'DELIVERED') {
      if (order.status === 'CANCELLED') error = 'order cancelled'
      else {
        if (order.status !== 'DELIVERED') {
          const now = new Date()
          await db.update(orders).set({ status: 'DELIVERED', deliveredAt: now, confirmedAt: order.confirmedAt ?? now, shippedAt: order.shippedAt ?? now, deliveryProvider: order.deliveryProvider ?? provider, deliveryTrackingId: order.deliveryTrackingId ?? parsed.trackingId, updatedAt: now }).where(eq(orders.id, order.id))
          await grantPurchasesForOrder(db, order.id)
          await notify(db, { userId: order.userId, workspaceId: null, type: 'SYSTEM', title: `طلب ${order.number}: سُلِّم`, body: 'سُلّم طلبك. شكراً لك.', link: `/store/orders/${order.id}` })
        }
        activation = await activateCoursesForOrder(db, order.id)
      }
    } else if (parsed.status === 'IN_TRANSIT' && order.status === 'CONFIRMED') {
      await db.update(orders).set({ status: 'SHIPPED', shippedAt: new Date(), deliveryProvider: order.deliveryProvider ?? provider, deliveryTrackingId: order.deliveryTrackingId ?? parsed.trackingId, updatedAt: new Date() }).where(eq(orders.id, order.id))
    } else if (parsed.status === 'RETURNED' || parsed.status === 'CANCELLED') {
      await db.update(orders).set({ adminNote: sql`concat_ws(' | ', ${orders.adminNote}, ${`التوصيل: ${parsed.status === 'RETURNED' ? 'مرتجع' : 'ألغته شركة التوصيل'} (${parsed.rawStatus ?? parsed.status})`})`, updatedAt: new Date() }).where(eq(orders.id, order.id))
    }
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
  if (o.status === 'CANCELLED' || o.status === 'PENDING') throw new AppError('ORDER_INVALID_TRANSITION')
  const now = new Date()
  const toShipped = o.status === 'CONFIRMED'
  await db.update(orders).set({ deliveryProvider: input.provider, deliveryTrackingId: trackingId, status: toShipped ? 'SHIPPED' : o.status, shippedAt: toShipped ? now : o.shippedAt, updatedAt: now }).where(eq(orders.id, orderId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'delivery.shipping_set', entityType: 'order', entityId: orderId, oldValue: { status: o.status, trackingId: o.deliveryTrackingId }, newValue: { provider: input.provider, trackingId, status: toShipped ? 'SHIPPED' : o.status } })
  if (toShipped) await notify(db, { userId: o.userId, workspaceId: null, type: 'SYSTEM', title: `طلب ${o.number}: في الطريق`, body: `طلبك في الطريق إليك عبر ${DELIVERY_PROVIDER_AR[input.provider]} — رقم التتبّع ${trackingId}.`, link: `/store/orders/${o.id}` })
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
