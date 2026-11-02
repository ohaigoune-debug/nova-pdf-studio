/**
 * حجز طابور التأكيد (قرار المالك 2 نوفمبر 2026).
 *
 * موظف التأكيد يحجز دفعة من أقدم الطلبات غير المحجوزة (10 أو 20) فتختفي من طوابير زملائه، فلا يتصل
 * اثنان بالزبون نفسه. القواعد:
 *   1) لا يرى الموظف في طابوره إلا حجوزاته، ولا يحجز أكثر من الحد الأقصى من الطلبات غير المنتهية.
 *   2) الحجز مؤقت: بعد انتهاء مدته يعود الطلب إلى الطابور العام ليأخذه غيره («لا يردّ» و«لاحقًا» تبقى معه
 *      حتى تنتهي المدة).
 *   3) أي إجراء من موظف على طلب في مرحلة التأكيد: إن كان محجوزًا لزميل يُرفض، وإن كان غير محجوز
 *      يُحجز له تلقائيًّا (فلا يتداخل اثنان عبر صفحة «كل الطلبات»).
 *   4) المشرف يرى كل الطلبات ومن حجزها، ويفكّ أي حجز، ويضبط المدة والحد الأقصى. إجراءاته لا تُقيَّد.
 *   5) الحجز يخصّ مرحلة التأكيد فقط؛ الطلب المؤكَّد أو الملغى خارج الطابور ولا يقيّد أحدًا.
 */
import { and, count, eq, gt, inArray, isNotNull, min, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, orders, profiles, users } from '@/server/db/schema'
import { CONFIRMATION_STATUSES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'

/* ───────────── السياسة (يضبطها المشرف) ───────────── */

export interface ReservationPolicy {
  /** مفعّل: كل موظف يرى حجوزاته فقط. معطّل: الطابور مشترك كما كان */
  enabled: boolean
  /** مدة الحجز بالدقائق قبل أن يعود الطلب إلى الطابور العام */
  holdMinutes: number
  /** أقصى عدد من الطلبات غير المنتهية يحجزها موظف في الوقت نفسه */
  maxHeld: number
}

export const DEFAULT_RESERVATION_POLICY: ReservationPolicy = { enabled: true, holdMinutes: 120, maxHeld: 20 }
export const CLAIM_SIZES = [10, 20] as const
const POLICY_KEY = 'confirm.reservations'

const intIn = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback)

export async function reservationPolicy(db: Db): Promise<ReservationPolicy> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, POLICY_KEY)).limit(1)
  const v = (row?.value ?? {}) as Partial<ReservationPolicy>
  const d = DEFAULT_RESERVATION_POLICY
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : d.enabled,
    holdMinutes: intIn(v.holdMinutes, 10, 24 * 60, d.holdMinutes),
    maxHeld: intIn(v.maxHeld, 1, 200, d.maxHeld)
  }
}

export async function setReservationPolicy(db: Db, actor: Actor, patch: Partial<ReservationPolicy>): Promise<ReservationPolicy> {
  assertRole(actor, 'SUPER_ADMIN')
  const cur = await reservationPolicy(db)
  if (patch.holdMinutes != null && intIn(patch.holdMinutes, 10, 24 * 60, -1) < 0) throw new AppError('VALIDATION', { field: 'holdMinutes' })
  if (patch.maxHeld != null && intIn(patch.maxHeld, 1, 200, -1) < 0) throw new AppError('VALIDATION', { field: 'maxHeld' })
  const next: ReservationPolicy = {
    enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
    holdMinutes: patch.holdMinutes ?? cur.holdMinutes,
    maxHeld: patch.maxHeld ?? cur.maxHeld
  }
  await db.insert(appSettings).values({ key: POLICY_KEY, value: next }).onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.queue_policy', entityType: 'settings', entityId: null, oldValue: { ...cur }, newValue: { ...next } })
  return next
}

/* ───────────── شروط SQL ───────────── */

/** الطلب في طابور التأكيد الهاتفي (المدفوع إلكترونيًّا لا ينتظر اتصالًا) */
export const inConfirmQueue = () => and(inArray(orders.status, [...CONFIRMATION_STATUSES]), sql`${orders.paymentMethod} <> 'ONLINE'`)
/** حجز ساري المفعول (المنتهي كأنه غير موجود) */
export const activeHold = (now: Date) => and(isNotNull(orders.reservedByUserId), gt(orders.reservedUntil, now))
/** طلب في الطابور محجوز لموظف آخر الآن (آمن مع NULL: يعطي false لا NULL) */
export const heldByOther = (userId: string, now: Date) =>
  sql<boolean>`coalesce(${orders.status} in ('PENDING', 'NO_ANSWER', 'CALL_LATER') and ${orders.paymentMethod} <> 'ONLINE' and ${orders.reservedByUserId} <> ${userId} and ${orders.reservedUntil} > ${now}, false)`

const isQueueOrder = (o: { status: string; paymentMethod: string }) => (CONFIRMATION_STATUSES as readonly string[]).includes(o.status) && o.paymentMethod !== 'ONLINE'

/* ───────────── الحجز والإعادة ───────────── */

async function heldCount(db: Db, userId: string, now: Date): Promise<number> {
  const [r] = await db.select({ n: count() }).from(orders).where(and(inConfirmQueue(), eq(orders.reservedByUserId, userId), gt(orders.reservedUntil, now)))
  return Number(r?.n ?? 0)
}

/**
 * «احجز 10 / 20»: أقدم الطلبات غير المحجوزة — الجديدة أولًا، ثم «لا يردّ» و«لاحقًا» الأقدم اتصالًا.
 * SKIP LOCKED: موظفان يضغطان في اللحظة نفسها لا يأخذان الطلب نفسه أبدًا.
 */
export async function claimOrders(db: Db, actor: Actor, size: number, now = new Date()): Promise<{ claimed: number; held: number; until: Date }> {
  assertRole(actor, 'CONFIRMER')
  if (!(CLAIM_SIZES as readonly number[]).includes(size)) throw new AppError('VALIDATION', { field: 'size' })
  const policy = await reservationPolicy(db)
  if (!policy.enabled) throw new AppError('FORBIDDEN')
  const until = new Date(now.getTime() + policy.holdMinutes * 60_000)
  return db.transaction(async (tx) => {
    // ضغطتان متتاليتان من الموظف نفسه تُنفَّذان واحدة بعد الأخرى (لا تجاوز للحد الأقصى)
    await tx.select({ id: users.id }).from(users).where(eq(users.id, actor.userId)).for('update')
    const held = await heldCount(tx, actor.userId, now)
    const room = policy.maxHeld - held
    if (room <= 0) throw new AppError('RESERVATION_LIMIT')
    const take = Math.min(size, room)
    const rows = await tx
      .update(orders)
      .set({ reservedByUserId: actor.userId, reservedAt: now, reservedUntil: until })
      .where(
        inArray(
          orders.id,
          sql`(select o.id from ${orders} o
                where o.status in ('PENDING', 'NO_ANSWER', 'CALL_LATER') and o.payment_method <> 'ONLINE'
                  and (o.reserved_by_user_id is null or o.reserved_until is null or o.reserved_until <= ${now})
                order by (o.status = 'PENDING') desc, coalesce(o.last_call_at, o.created_at) asc
                limit ${take} for update skip locked)`
        )
      )
      .returning({ id: orders.id })
    if (rows.length) await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'store.queue_claim', entityType: 'order', entityId: null, newValue: { count: rows.length, orderIds: rows.map((r) => r.id), until: until.toISOString() } })
    return { claimed: rows.length, held: held + rows.length, until }
  })
}

/**
 * إعادة طلبات إلى الطابور العام. الموظف: حجوزاته فقط (طلب واحد أو كلها).
 * المشرف: أي طلب، أو كل حجوزات موظف (forUserId)، أو كل الحجوزات.
 */
export async function releaseOrders(db: Db, actor: Actor, input: { orderIds?: string[] | null; forUserId?: string | null }): Promise<number> {
  assertRole(actor, 'SUPER_ADMIN', 'CONFIRMER')
  const ids = input.orderIds ?? null
  if (ids) for (const id of ids) assertUuid(id, 'ORDER_NOT_FOUND')
  if (input.forUserId) assertUuid(input.forUserId, 'NOT_FOUND')
  const owner = actor.role === 'CONFIRMER' ? actor.userId : (input.forUserId ?? null)
  const rows = await db
    .update(orders)
    .set({ reservedByUserId: null, reservedAt: null, reservedUntil: null })
    .where(and(isNotNull(orders.reservedByUserId), inConfirmQueue(), ids ? inArray(orders.id, ids) : undefined, owner ? eq(orders.reservedByUserId, owner) : undefined))
    .returning({ id: orders.id })
  if (rows.length) await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.queue_release', entityType: 'order', entityId: rows.length === 1 ? rows[0]!.id : null, newValue: { count: rows.length, orderIds: rows.map((r) => r.id), forUserId: owner } })
  return rows.length
}

/**
 * يُستدعى داخل معاملة كل إجراء من الموظف على طلب (بعد قفل صفّه): طلب محجوز لزميل ⇒ مرفوض؛
 * غير محجوز ⇒ يُحجز له. المشرف وما خرج من مرحلة التأكيد لا يُقيَّدان.
 */
export async function takeForAction(tx: Db, actor: Actor, order: { id: string; status: string; paymentMethod: string; reservedByUserId: string | null; reservedUntil: Date | null }, now = new Date()): Promise<void> {
  if (actor.role !== 'CONFIRMER' || !isQueueOrder(order)) return
  const policy = await reservationPolicy(tx)
  if (!policy.enabled) return
  const active = Boolean(order.reservedByUserId && order.reservedUntil && order.reservedUntil > now)
  if (active && order.reservedByUserId !== actor.userId) throw new AppError('ORDER_RESERVED')
  if (!active) await tx.update(orders).set({ reservedByUserId: actor.userId, reservedAt: now, reservedUntil: new Date(now.getTime() + policy.holdMinutes * 60_000) }).where(eq(orders.id, order.id))
}

/** نسخة لمن لم يقفل الصف بعد (حظر الزبون): تقفله ثم تتحقق */
export async function takeOrderForAction(db: Db, actor: Actor, orderId: string, now = new Date()): Promise<void> {
  if (actor.role !== 'CONFIRMER') return
  await db.transaction(async (tx) => {
    const [o] = await tx.select({ id: orders.id, status: orders.status, paymentMethod: orders.paymentMethod, reservedByUserId: orders.reservedByUserId, reservedUntil: orders.reservedUntil }).from(orders).where(eq(orders.id, orderId)).for('update').limit(1)
    if (!o) throw new AppError('ORDER_NOT_FOUND')
    await takeForAction(tx, actor, o, now)
  })
}

/* ───────────── الملخّص للصفحة ───────────── */

export interface QueueSummary {
  policy: ReservationPolicy
  /** طلبات في الطابور غير محجوزة الآن (متاحة للحجز) */
  free: number
  /** للموظف: حجوزاته غير المنتهية، وأقرب انتهاء */
  mine: number
  mineUntil: Date | null
  /** للمشرف: الحجوزات السارية لكل موظف */
  byConfirmer: { userId: string; name: string; held: number; until: Date | null }[]
}

export async function queueSummary(db: Db, actor: Actor, now = new Date()): Promise<QueueSummary> {
  assertRole(actor, 'SUPER_ADMIN', 'CONFIRMER')
  const policy = await reservationPolicy(db)
  const [freeRow] = await db.select({ n: count() }).from(orders).where(and(inConfirmQueue(), sql`not coalesce(${orders.reservedByUserId} is not null and ${orders.reservedUntil} > ${now}, false)`))
  const free = Number(freeRow?.n ?? 0)
  if (actor.role === 'CONFIRMER') {
    const [m] = await db.select({ n: count(), until: min(orders.reservedUntil) }).from(orders).where(and(inConfirmQueue(), eq(orders.reservedByUserId, actor.userId), gt(orders.reservedUntil, now)))
    return { policy, free, mine: Number(m?.n ?? 0), mineUntil: m?.until ?? null, byConfirmer: [] }
  }
  const rows = await db
    .select({ userId: orders.reservedByUserId, name: profiles.fullName, held: count(), until: min(orders.reservedUntil) })
    .from(orders)
    .leftJoin(profiles, eq(profiles.userId, orders.reservedByUserId))
    .where(and(inConfirmQueue(), activeHold(now)))
    .groupBy(orders.reservedByUserId, profiles.fullName)
  return { policy, free, mine: 0, mineUntil: null, byConfirmer: rows.map((r) => ({ userId: r.userId!, name: r.name ?? 'موظف', held: Number(r.held), until: r.until ?? null })) }
}
