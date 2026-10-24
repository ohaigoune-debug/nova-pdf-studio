/**
 * ربط EcoTrack بالمتجر (نسق NOVA COMMERCE): حساب واحد (رابط المنصّة + رمز API مختوم في الإعدادات)،
 * إرسال الطلب المؤكَّد طرداً، مزامنة دورية للطرود المفتوحة تُترجم حالة الشركة إلى حالة الطلب
 * (ومنها «سُلِّم» ⇒ تفعيل الدورة)، ورسوم التوصيل لكل ولاية من جدول الشركة.
 */
import { and, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, deliveryEvents, jobs, orderItems, orders, wilayas } from '@/server/db/schema'
import type { DeliveryEventStatus } from '@/server/db/schema/enums'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { EcotrackClient, EcotrackError, ecotrackBaseUrl, type EcotrackFee, type EcotrackShipmentStatus } from '@/server/lib/ecotrack'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { applyDeliveryStatus } from './delivery.service'
import { notifyAdmins, transitionOrder } from './order-status.service'

export const ECOTRACK_SETTINGS_KEY = 'delivery.ecotrack'
export const ECOTRACK_FEES_KEY = 'delivery.ecotrack.fees'
const SEAL_PURPOSE = 'ecotrack'
/** المزامنة كل 20 دقيقة؛ EcoTrack بلا webhooks والميزانية اليومية محدودة */
export const ECOTRACK_SYNC_INTERVAL_MS = 20 * 60 * 1000
/** طرود كثيرة ⇒ دفعات، كي لا تستهلك مزامنة واحدة الميزانية */
export const ECOTRACK_SYNC_BATCH = 60

interface Stored {
  baseUrl: string
  tokenSealed: string
  hint: string
  enabled: boolean
  /** إرسال الطرد تلقائياً عند تأكيد الطلب */
  autoSend: boolean
  updatedAt: string
  lastCheck?: { ok: boolean; message: string; at: string } | null
}

export interface EcotrackStatus {
  configured: boolean
  enabled: boolean
  autoSend: boolean
  baseUrl: string | null
  hint: string | null
  updatedAt: string | null
  lastCheck: { ok: boolean; message: string; at: string } | null
  /** المفتاح المحفوظ لا يُفتح (تغيّر SESSION_SECRET) */
  unusable: boolean
  feesSyncedAt: string | null
  feesCount: number
}

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, ECOTRACK_SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<Stored> | undefined
  if (!v?.tokenSealed || !v.baseUrl) return null
  return { baseUrl: v.baseUrl, tokenSealed: v.tokenSealed, hint: v.hint ?? '', enabled: v.enabled !== false, autoSend: v.autoSend === true, updatedAt: v.updatedAt ?? '', lastCheck: v.lastCheck ?? null }
}

export async function ecotrackStatus(db: Db): Promise<EcotrackStatus> {
  const s = await readStored(db)
  const fees = await readFees(db)
  const unusable = Boolean(s && unseal(s.tokenSealed, SEAL_PURPOSE) === null)
  return { configured: Boolean(s) && !unusable, enabled: Boolean(s?.enabled) && !unusable, autoSend: Boolean(s?.autoSend), baseUrl: s?.baseUrl ?? null, hint: s?.hint ?? null, updatedAt: s?.updatedAt || null, lastCheck: s?.lastCheck ?? null, unusable, feesSyncedAt: fees?.syncedAt ?? null, feesCount: fees?.rows.length ?? 0 }
}

/** العميل الجاهز أو null حين لا إعداد (أو معطَّل) */
export async function ecotrackClient(db: Db, opts: { fetchImpl?: typeof fetch; ignoreEnabled?: boolean } = {}): Promise<EcotrackClient | null> {
  const s = await readStored(db)
  if (!s || (!s.enabled && !opts.ignoreEnabled)) return null
  const token = unseal(s.tokenSealed, SEAL_PURPOSE)
  if (!token) return null
  return new EcotrackClient({ baseUrl: s.baseUrl, apiToken: token }, opts.fetchImpl)
}

export interface SaveEcotrackInput {
  baseUrl: string
  /** undefined = إبقاء المحفوظ؛ '' = حذف الإعداد كله */
  apiToken?: string
  enabled: boolean
  autoSend: boolean
}

/** يحفظ الحساب بعد التحقق من الرمز (GET wilayas)؛ الرمز يُختم ولا يُعاد أبداً */
export async function saveEcotrackSettings(db: Db, actor: Actor, input: SaveEcotrackInput, fetchImpl?: typeof fetch): Promise<EcotrackStatus> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await readStored(db)
  if (input.apiToken === '') {
    await db.delete(appSettings).where(eq(appSettings.key, ECOTRACK_SETTINGS_KEY))
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'ecotrack.settings_cleared', entityType: 'settings', entityId: null })
    return ecotrackStatus(db)
  }
  let baseUrl: string
  try {
    baseUrl = ecotrackBaseUrl(input.baseUrl)
    new URL(baseUrl)
  } catch {
    throw new AppError('VALIDATION', { field: 'baseUrl' })
  }
  const token = input.apiToken !== undefined ? input.apiToken.replace(/\s+/g, '') : cur ? unseal(cur.tokenSealed, SEAL_PURPOSE) : null
  if (!token || token.length < 8 || token.length > 600) throw new AppError('VALIDATION', { field: 'apiToken' })
  const check = await new EcotrackClient({ baseUrl, apiToken: token }, fetchImpl).validate()
  if (!check.ok) throw new AppError('ECOTRACK_REJECTED', { message: check.message })
  const stored: Stored = { baseUrl, tokenSealed: seal(token, SEAL_PURPOSE), hint: token.slice(-4), enabled: input.enabled, autoSend: input.autoSend, updatedAt: new Date().toISOString(), lastCheck: { ok: true, message: `${check.wilayas} ولاية`, at: new Date().toISOString() } }
  await db
    .insert(appSettings)
    .values({ key: ECOTRACK_SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'ecotrack.settings_saved', entityType: 'settings', entityId: null, newValue: { baseUrl, hint: stored.hint, enabled: input.enabled, autoSend: input.autoSend } })
  return ecotrackStatus(db)
}

/* ───────────────────────── الرسوم لكل ولاية ───────────────────────── */

interface StoredFees {
  syncedAt: string
  rows: EcotrackFee[]
}

async function readFees(db: Db): Promise<StoredFees | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, ECOTRACK_FEES_KEY)).limit(1)
  const v = row?.value as Partial<StoredFees> | undefined
  return v?.rows && Array.isArray(v.rows) ? { syncedAt: v.syncedAt ?? '', rows: v.rows } : null
}

/** يجلب جدول رسوم الشركة ويحفظه (يُستعمل في السلة بدل الرسم الثابت) */
export async function syncEcotrackFees(db: Db, actor: Actor | null, fetchImpl?: typeof fetch): Promise<{ count: number }> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  const client = await ecotrackClient(db, { fetchImpl, ignoreEnabled: true })
  if (!client) throw new AppError('ECOTRACK_NOT_CONFIGURED')
  const rows = await client.fees()
  const value: StoredFees = { syncedAt: new Date().toISOString(), rows }
  await db
    .insert(appSettings)
    .values({ key: ECOTRACK_FEES_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
  return { count: rows.length }
}

/** رسم التوصيل لولاية (بالرمز 01..58) ونوع التسليم، أو null حين لا جدول محفوظ */
export async function ecotrackFeeFor(db: Db, wilayaCode: string | null | undefined, deliveryType: 'HOME' | 'DESK'): Promise<number | null> {
  if (!wilayaCode) return null
  const fees = await readFees(db)
  const row = fees?.rows.find((f) => f.wilayaCode === wilayaCode.padStart(2, '0'))
  if (!row) return null
  return deliveryType === 'DESK' ? row.deskDzd : row.homeDzd
}

export async function listEcotrackFees(db: Db): Promise<(EcotrackFee & { wilayaName: string | null })[]> {
  const fees = await readFees(db)
  if (!fees) return []
  const ws = await db.select({ code: wilayas.code, nameAr: wilayas.nameAr }).from(wilayas)
  const byCode = new Map(ws.map((w) => [w.code.padStart(2, '0'), w.nameAr]))
  return fees.rows.map((f) => ({ ...f, wilayaName: byCode.get(f.wilayaCode) ?? null })).sort((a, b) => a.wilayaCode.localeCompare(b.wilayaCode))
}

/* ───────────────────────── إرسال الطرد ───────────────────────── */

/** ينشئ الطرد عند EcoTrack لطلب مؤكَّد يحتاج شحناً، ويحفظ رقم التتبّع وينقله إلى «في الطريق» */
export async function sendOrderToEcotrack(db: Db, actor: Actor | null, orderId: string, fetchImpl?: typeof fetch): Promise<{ tracking: string }> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  const client = await ecotrackClient(db, { fetchImpl })
  if (!client) throw new AppError('ECOTRACK_NOT_CONFIGURED')
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o) throw new AppError('ORDER_NOT_FOUND')
  if (!o.needsShipping) throw new AppError('VALIDATION', { field: 'needsShipping' })
  // أُرسل من قبل: لا طرد ثانٍ أبداً (ضغطة مكرّرة، أو مهمة أُعيدت)
  if (o.deliveryProvider === 'ecotrack' && o.deliveryTrackingId) return { tracking: o.deliveryTrackingId }
  if (o.status !== 'CONFIRMED') throw new AppError('ORDER_INVALID_TRANSITION')
  const [w] = o.wilayaId ? await db.select({ code: wilayas.code, nameAr: wilayas.nameAr, nameFr: wilayas.nameFr }).from(wilayas).where(eq(wilayas.id, o.wilayaId)).limit(1) : []
  if (!w) throw new AppError('VALIDATION', { field: 'wilayaId' })
  const items = await db.select({ title: orderItems.title, qty: orderItems.qty }).from(orderItems).where(eq(orderItems.orderId, orderId))
  const summary = items.map((i) => (i.qty > 1 ? `${i.title} ×${i.qty}` : i.title)).join(' + ')
  const cod = o.paymentMethod === 'COD' ? o.totalDzd : 0
  const { tracking, raw } = await client.createOrder({
    orderNumber: o.number,
    fullName: o.customerName,
    phone: o.phone,
    address: o.address ?? '',
    wilayaCode: w.code,
    communeName: o.commune ?? w.nameFr,
    codAmountDzd: cod,
    productsSummary: summary,
    notes: o.note,
    deliveryType: (o.deliveryType as 'HOME' | 'DESK') ?? 'HOME',
    allowOpen: false
  })
  // حدث «أُنشئت» في سجلّ التوصيل، ثم الطلب ⇒ في الطريق برقم التتبّع
  await db
    .insert(deliveryEvents)
    .values({ provider: 'ecotrack', externalId: `${tracking}:CREATED`, trackingId: tracking, orderId: o.id, status: 'CREATED', payload: { request: 'create/order', response: raw }, processedAt: new Date() })
    .onConflictDoNothing({ target: [deliveryEvents.provider, deliveryEvents.externalId] })
  await transitionOrder(db, o.id, 'SHIPPED', { actorUserId: actor?.userId ?? null, source: actor ? 'admin' : 'ecotrack', deliveryProvider: 'ecotrack', deliveryTrackingId: tracking })
  await writeAudit(db, { actorUserId: actor?.userId ?? null, workspaceId: null, action: 'ecotrack.order_sent', entityType: 'order', entityId: o.id, newValue: { tracking, cod, wilaya: w.code } })
  return { tracking }
}

/** عند تأكيد الطلب: إن كان الإرسال التلقائي مفعّلاً يُرسَل الطرد في الخلفية (مهمة) ولا يُعطَّل التأكيد بفشل الشبكة */
export async function maybeAutoSend(db: Db, orderId: string): Promise<boolean> {
  const s = await readStored(db)
  if (!s?.enabled || !s.autoSend) return false
  await enqueueJob(db, { type: 'ECOTRACK_SEND', payload: { orderId }, maxAttempts: 3 })
  return true
}

export async function runEcotrackSendJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const orderId = String(payload.orderId ?? '')
  try {
    const r = await sendOrderToEcotrack(db, null, orderId)
    return { ok: true, tracking: r.tracking }
  } catch (e) {
    if (e instanceof AppError && e.code === 'ORDER_INVALID_TRANSITION') return { ok: false, skipped: 'status' }
    const [o] = await db.select({ number: orders.number }).from(orders).where(eq(orders.id, orderId)).limit(1)
    await notifyAdmins(db, { title: `⚠️ تعذّر إرسال الطلب ${o?.number ?? ''} إلى EcoTrack`, body: e instanceof Error ? e.message.slice(0, 200) : 'خطأ', link: '/admin/delivery' })
    throw e
  }
}

/** يحذف الطرد عند الشركة (ما دام لم يُستلم) — عند إلغاء طلب مرسَل */
export async function cancelEcotrackParcel(db: Db, actor: Actor, orderId: string, fetchImpl?: typeof fetch): Promise<boolean> {
  assertRole(actor, 'SUPER_ADMIN')
  const client = await ecotrackClient(db, { fetchImpl })
  if (!client) throw new AppError('ECOTRACK_NOT_CONFIGURED')
  const [o] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o || o.deliveryProvider !== 'ecotrack' || !o.deliveryTrackingId) throw new AppError('ORDER_NOT_FOUND')
  const ok = await client.deleteOrder(o.deliveryTrackingId)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'ecotrack.parcel_deleted', entityType: 'order', entityId: o.id, newValue: { tracking: o.deliveryTrackingId, ok } })
  return ok
}

/* ───────────────────────── المزامنة الدورية ───────────────────────── */

const MAP_TO_EVENT: Record<EcotrackShipmentStatus, DeliveryEventStatus> = {
  created: 'CREATED',
  picked_up: 'IN_TRANSIT',
  in_transit: 'IN_TRANSIT',
  at_agency: 'IN_TRANSIT',
  out_for_delivery: 'IN_TRANSIT',
  delivered: 'DELIVERED',
  failed_attempt: 'FAILED_ATTEMPT',
  returned: 'RETURNED',
  canceled: 'CANCELLED'
}

export interface EcotrackSyncSummary {
  polled: number
  changed: number
  delivered: number
  failed: number
  skipped: string | null
}

/** آخر حالة EcoTrack معروفة للطرد (من آخر حدث مسجَّل) لتوفير نداء السجلّ حين لم يتحرّك شيء */
async function knownStatuses(db: Db, trackings: string[]): Promise<Map<string, string>> {
  if (!trackings.length) return new Map()
  const rows = await db
    .select({ trackingId: deliveryEvents.trackingId, payload: deliveryEvents.payload, receivedAt: deliveryEvents.receivedAt })
    .from(deliveryEvents)
    .where(and(eq(deliveryEvents.provider, 'ecotrack'), inArray(deliveryEvents.trackingId, trackings)))
    .orderBy(desc(deliveryEvents.receivedAt))
  const out = new Map<string, string>()
  for (const r of rows) {
    if (!r.trackingId || out.has(r.trackingId)) continue
    const st = (r.payload as { ecotrackStatus?: string } | null)?.ecotrackStatus
    if (st) out.set(r.trackingId, st)
  }
  return out
}

/**
 * يستطلع الطرود المفتوحة (طلبات ecotrack في «في الطريق»، وما زال «مؤكَّداً» برقم تتبّع) ويطبّق الحالات الجديدة.
 * كل تغيّر يُسجَّل حدثاً فريداً (tracking:status) فلا يُعالَج مرتين؛ الميزانية تُحترم.
 */
export async function syncEcotrackShipments(db: Db, opts: { fetchImpl?: typeof fetch; limit?: number } = {}): Promise<EcotrackSyncSummary> {
  const summary: EcotrackSyncSummary = { polled: 0, changed: 0, delivered: 0, failed: 0, skipped: null }
  const client = await ecotrackClient(db, { fetchImpl: opts.fetchImpl })
  if (!client) {
    summary.skipped = 'not configured'
    return summary
  }
  if (!client.pollingAllowed()) {
    summary.skipped = 'rate budget reserved'
    return summary
  }
  const open = await db
    .select()
    .from(orders)
    .where(and(eq(orders.deliveryProvider, 'ecotrack'), isNotNull(orders.deliveryTrackingId), inArray(orders.status, ['CONFIRMED', 'SHIPPED'])))
    .orderBy(sql`${orders.updatedAt} asc`)
    .limit(opts.limit ?? ECOTRACK_SYNC_BATCH)
  const known = await knownStatuses(
    db,
    open.map((o) => o.deliveryTrackingId!)
  )
  for (const o of open) {
    const tracking = o.deliveryTrackingId!
    summary.polled++
    try {
      const t = await client.tracking(tracking, known.get(tracking) ?? null)
      const eventStatus = MAP_TO_EVENT[t.status]
      const inserted = await db
        .insert(deliveryEvents)
        .values({ provider: 'ecotrack', externalId: `${tracking}:${eventStatus}:${t.status}`, trackingId: tracking, orderId: o.id, status: eventStatus, payload: { ecotrackStatus: t.status, label: t.carrierStatusLabel, driverName: t.driverName, driverPhone: t.driverPhone, feeDzd: t.feeDzd, events: t.events.map((e) => ({ ...e, occurredAt: e.occurredAt.toISOString() })) } })
        .onConflictDoNothing({ target: [deliveryEvents.provider, deliveryEvents.externalId] })
        .returning({ id: deliveryEvents.id })
      const ev = inserted[0]
      if (!ev) continue
      const r = await applyDeliveryStatus(db, o, eventStatus, { provider: 'ecotrack', trackingId: tracking, rawStatus: t.carrierStatusLabel ?? t.status, source: 'ecotrack' })
      await db.update(deliveryEvents).set({ processedAt: new Date(), error: r.error }).where(eq(deliveryEvents.id, ev.id))
      if (r.changed) summary.changed++
      if (eventStatus === 'DELIVERED' && r.changed) summary.delivered++
    } catch (e) {
      summary.failed++
      if (process.env.NODE_ENV !== 'test') console.error('[ecotrack sync]', tracking, e instanceof Error ? e.message : e)
      if (e instanceof EcotrackError && (e.status === 401 || e.status === 403 || e.status === 429)) {
        summary.skipped = e.message
        break
      }
    }
    if (!client.pollingAllowed()) {
      summary.skipped = 'rate budget reserved'
      break
    }
  }
  return summary
}

/** يجدول مزامنة إن لم تكن واحدة مجدولة/حديثة (يُستدعى من العامل ومن مسار Cron) */
export async function ensureEcotrackSyncScheduled(db: Db, now: Date = new Date()): Promise<boolean> {
  const s = await readStored(db)
  if (!s?.enabled) return false
  const [recent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'ECOTRACK_SYNC'), sql`(${jobs.status} in ('QUEUED','PROCESSING') or ${jobs.createdAt} > ${new Date(now.getTime() - ECOTRACK_SYNC_INTERVAL_MS)})`))
    .limit(1)
  if (recent) return false
  await enqueueJob(db, { type: 'ECOTRACK_SYNC', payload: {}, maxAttempts: 1, runAfter: now })
  return true
}

export async function runEcotrackSyncJob(db: Db): Promise<Record<string, unknown>> {
  const s = await syncEcotrackShipments(db)
  return { ...s }
}

/** مزامنة فورية من اللوحة (زر «حدّث الآن») */
export async function syncNow(db: Db, actor: Actor): Promise<EcotrackSyncSummary> {
  assertRole(actor, 'SUPER_ADMIN')
  return syncEcotrackShipments(db, { limit: 200 })
}
