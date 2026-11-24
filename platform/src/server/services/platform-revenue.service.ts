import { and, count, desc, eq, gte, lt, sql, sum } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { invoices } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { monthRange } from '@/lib/assistant-pay'
import { assistantMonth, listPaidAssistants } from '@/server/services/assistant-pay.service'

/**
 * «مداخيل المنصة» (قرار المالك 24 نوفمبر 2026): من الفواتير الصادرة (تصدر عند تسليم الطلب أو يدويًا)،
 * ثمّ ما يخرج منها: رسوم التوصيل المضمّنة في الفاتورة، وأجر الأستاذ المساعد للشّهر.
 */
export interface PlatformRevenue {
  month: string
  invoices: number
  grossDzd: number
  shippingDzd: number
  discountDzd: number
  /** أجر الأستاذ المساعد: المدفوع، والمستحقّ غير المدفوع بعد */
  assistantPaidDzd: number
  assistantDueDzd: number
  /** الإجمالي − التوصيل − أجر المساعد */
  netDzd: number
  /** أكواد نقاط البيع المنشأة في الشّهر بسعر بيعها (بلا فاتورة، وخارج الصّافي) */
  pos: { codes: number; totalDzd: number }
  byMethod: { method: string; invoices: number; totalDzd: number }[]
  byItem: { title: string; qty: number; totalDzd: number }[]
  trend: { month: string; invoices: number; totalDzd: number }[]
}

const rowsOf = <T>(raw: unknown): T[] => (Array.isArray(raw) ? (raw as T[]) : ((raw as { rows?: T[] }).rows ?? []))

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number]
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function platformRevenue(db: Db, actor: Actor, month: string): Promise<PlatformRevenue> {
  assertRole(actor, 'SUPER_ADMIN')
  const range = monthRange(month)
  if (!range) throw new AppError('VALIDATION', { field: 'month' })
  const issued = and(eq(invoices.status, 'ISSUED'), gte(invoices.issuedAt, range.start), lt(invoices.issuedAt, range.end))
  const trendStart = monthRange(shiftMonth(month, -5))!.start
  // الشّهر بتوقيت الجزائر (UTC+1 بلا توقيت صيفيّ)
  const monthKey = sql<string>`to_char(${invoices.issuedAt} + interval '1 hour', 'YYYY-MM')`
  const [[tot], methods, items, trendRows, assistants, posRaw] = await Promise.all([
    db.select({ n: count(), total: sum(invoices.totalDzd), shipping: sum(invoices.shippingDzd), discount: sum(invoices.discountDzd) }).from(invoices).where(issued),
    db
      .select({ method: invoices.paymentMethod, n: count(), total: sum(invoices.totalDzd) })
      .from(invoices)
      .where(issued)
      .groupBy(invoices.paymentMethod)
      .orderBy(desc(sum(invoices.totalDzd))),
    db.execute(sql`
      select l->>'title' as title, sum(coalesce((l->>'qty')::int, 1)) as qty, sum(coalesce((l->>'totalDzd')::int, 0)) as total
      from ${invoices}, jsonb_array_elements(${invoices.lines}) as l
      where ${issued}
      group by 1 order by 3 desc limit 10`),
    db
      .select({ month: monthKey, n: count(), total: sum(invoices.totalDzd) })
      .from(invoices)
      .where(and(eq(invoices.status, 'ISSUED'), gte(invoices.issuedAt, trendStart), lt(invoices.issuedAt, range.end)))
      .groupBy(monthKey),
    listPaidAssistants(db, actor),
    db.execute(sql`select count(*)::int as n, coalesce(sum(c.sale_price_dzd), 0)::int as total from course_codes c
      where c.pos_id is not null and c.status <> 'DISABLED' and c.cancelled_at is null
      and c.created_at >= ${range.start.toISOString()}::timestamptz and c.created_at < ${range.end.toISOString()}::timestamptz`)
  ])
  let assistantPaidDzd = 0
  let assistantDueDzd = 0
  for (const a of assistants) {
    const m = await assistantMonth(db, actor, { assistantUserId: a.userId, month })
    if (m.payout) assistantPaidDzd += m.payout.amount
    else assistantDueDzd += m.statement.total
  }
  const grossDzd = Number(tot?.total ?? 0)
  const shippingDzd = Number(tot?.shipping ?? 0)
  const byTrend = new Map(trendRows.map((r) => [r.month, r]))
  const rows = rowsOf<{ title: string | null; qty: string; total: string }>(items)
  const [pos] = rowsOf<{ n: number; total: number }>(posRaw)
  return {
    month,
    invoices: Number(tot?.n ?? 0),
    grossDzd,
    shippingDzd,
    discountDzd: Number(tot?.discount ?? 0),
    assistantPaidDzd,
    assistantDueDzd,
    netDzd: grossDzd - shippingDzd - assistantPaidDzd - assistantDueDzd,
    byMethod: methods.map((r) => ({ method: r.method, invoices: Number(r.n), totalDzd: Number(r.total ?? 0) })),
    pos: { codes: Number(pos?.n ?? 0), totalDzd: Number(pos?.total ?? 0) },
    byItem: rows.map((r) => ({ title: r.title ?? '—', qty: Number(r.qty), totalDzd: Number(r.total) })),
    trend: Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((mm) => ({ month: mm, invoices: Number(byTrend.get(mm)?.n ?? 0), totalDzd: Number(byTrend.get(mm)?.total ?? 0) }))
  }
}
