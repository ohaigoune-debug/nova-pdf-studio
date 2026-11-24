import { and, asc, eq, gte, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { orders } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { monthRange } from '@/lib/assistant-pay'
import { codNetDzd, type CodMoneyStatus } from '@/lib/cod-money'

/** ما يصلك من الطرد: الإجمالي ناقص رسم الشركة إن عُرف، وإلّا رسم التوصيل المحسوب */
const netSql = sql<number>`greatest(0, ${orders.totalDzd} - coalesce(${orders.codFeeDzd}, ${orders.shippingDzd}))`
const deliveredCod = and(eq(orders.status, 'DELIVERED'), eq(orders.paymentMethod, 'COD'), sql`${orders.totalDzd} > 0`)

export interface CodMoneySummary {
  /** المال الذي لم يصلك بعد، الآن (كلّ الأشهر) */
  pending: Record<'WITH_DRIVER' | 'AT_CARRIER' | 'READY' | 'UNTRACKED', { orders: number; netDzd: number }>
  pendingNetDzd: number
  /** ما وصلك في الشّهر المختار */
  receivedInMonth: { orders: number; netDzd: number }
}

export async function codMoneySummary(db: Db, actor: Actor, month: string): Promise<CodMoneySummary> {
  assertRole(actor, 'SUPER_ADMIN')
  const range = monthRange(month)
  if (!range) throw new AppError('VALIDATION', { field: 'month' })
  const [byStatus, [rec]] = await Promise.all([
    db
      .select({ status: orders.codMoneyStatus, n: sql<number>`count(*)::int`, net: sql<number>`coalesce(sum(${netSql}), 0)::int` })
      .from(orders)
      .where(and(deliveredCod, or(isNull(orders.codMoneyStatus), ne(orders.codMoneyStatus, 'RECEIVED'))))
      .groupBy(orders.codMoneyStatus),
    db
      .select({ n: sql<number>`count(*)::int`, net: sql<number>`coalesce(sum(${netSql}), 0)::int` })
      .from(orders)
      .where(and(deliveredCod, eq(orders.codMoneyStatus, 'RECEIVED'), gte(orders.codReceivedAt, range.start), lt(orders.codReceivedAt, range.end)))
  ])
  const pending: CodMoneySummary['pending'] = { WITH_DRIVER: { orders: 0, netDzd: 0 }, AT_CARRIER: { orders: 0, netDzd: 0 }, READY: { orders: 0, netDzd: 0 }, UNTRACKED: { orders: 0, netDzd: 0 } }
  for (const r of byStatus) {
    const k = (r.status ?? 'UNTRACKED') as keyof CodMoneySummary['pending']
    if (!pending[k]) continue
    pending[k].orders += Number(r.n)
    pending[k].netDzd += Number(r.net)
  }
  return {
    pending,
    pendingNetDzd: Object.values(pending).reduce((s, x) => s + x.netDzd, 0),
    receivedInMonth: { orders: Number(rec?.n ?? 0), netDzd: Number(rec?.net ?? 0) }
  }
}

export interface CodPendingRow {
  id: string
  number: string
  customerName: string
  deliveredAt: Date | null
  netDzd: number
  status: CodMoneyStatus | null
  tracking: string | null
}

/** الطرود المسلَّمة التي لم يصلك مالها بعد، الأقدم أوّلًا */
export async function listCodPending(db: Db, actor: Actor, limit = 50): Promise<CodPendingRow[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: orders.id, number: orders.number, customerName: orders.customerName, deliveredAt: orders.deliveredAt, totalDzd: orders.totalDzd, shippingDzd: orders.shippingDzd, codFeeDzd: orders.codFeeDzd, status: orders.codMoneyStatus, tracking: orders.deliveryTrackingId })
    .from(orders)
    .where(and(deliveredCod, or(isNull(orders.codMoneyStatus), ne(orders.codMoneyStatus, 'RECEIVED'))))
    .orderBy(asc(orders.deliveredAt))
    .limit(Math.min(Math.max(limit, 1), 200))
  return rows.map((r) => ({ id: r.id, number: r.number, customerName: r.customerName, deliveredAt: r.deliveredAt, netDzd: codNetDzd(r), status: (r.status as CodMoneyStatus | null) ?? null, tracking: r.tracking }))
}

/** المشرف: «استلمتُ مال هذا الطرد» أو التراجع (تعيده المزامنة إلى حالة EcoTrack) */
export async function setCodReceived(db: Db, actor: Actor, orderId: string, received: boolean): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  const [o] = await db.select({ id: orders.id, number: orders.number, status: orders.status, paymentMethod: orders.paymentMethod, money: orders.codMoneyStatus }).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o || o.status !== 'DELIVERED' || o.paymentMethod !== 'COD') throw new AppError('ORDER_NOT_FOUND')
  await db
    .update(orders)
    .set(received ? { codMoneyStatus: 'RECEIVED', codReceivedAt: new Date(), codReceivedByUserId: actor.userId } : { codMoneyStatus: null, codReceivedAt: null, codReceivedByUserId: null, codMoneyCheckedAt: null })
    .where(eq(orders.id, o.id))
  const audit = { actorUserId: actor.userId, workspaceId: null, entityType: 'order', entityId: o.id, oldValue: { money: o.money } }
  if (received) await writeAudit(db, { ...audit, action: 'store.cod_received', newValue: { number: o.number, money: 'RECEIVED' } })
  else await writeAudit(db, { ...audit, action: 'store.cod_unreceived', newValue: { number: o.number, money: null } })
}
