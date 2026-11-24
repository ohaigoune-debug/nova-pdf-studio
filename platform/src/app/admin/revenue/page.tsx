import { Banknote, Receipt, Truck, Wallet } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MonthLinks } from '@/components/domain/assistant-statement'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from '@/components/ui/link'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { formatDa, monthOf, monthRange, recentMonths } from '@/lib/assistant-pay'
import { PAYMENT_METHOD_AR } from '@/lib/invoice-labels'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { platformRevenue } from '@/server/services/platform-revenue.service'
import { codMoneySummary, listCodPending } from '@/server/services/cod-money.service'
import { codReceivedAction } from '@/server/actions/cod-money.actions'
import { COD_MONEY_LABELS } from '@/lib/cod-money'

export const dynamic = 'force-dynamic'

/** «مداخيل المنصة» (قرار المالك 24 نوفمبر 2026): المداخيل من الفواتير الصادرة، وما يخرج منها، والصّافي، وتطوّر ستّة أشهر */
export default async function AdminRevenuePage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { m } = await searchParams
  const now = new Date()
  const months = recentMonths(now, 6)
  const month = m && monthRange(m) && months.includes(m) ? m : monthOf(now)
  const db = await getDb()
  const [r, cod, pending] = await Promise.all([platformRevenue(db, actor, month), codMoneySummary(db, actor, month), listCodPending(db, actor, 50)])
  const max = Math.max(1, ...r.trend.map((x) => x.totalDzd))
  return (
    <div className="space-y-6">
      <PageHeader title="مداخيل المنصة" description="من الفواتير الصّادرة (تصدر عند تسليم الطّلب أو يدويًّا). الصّافي = المداخيل − رسوم التّوصيل − أجر الأستاذ المساعد." />
      <MonthLinks current={month} months={months} href={(x) => `/admin/revenue?m=${x}`} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="المداخيل" value={formatDa(r.grossDzd)} hint={`${r.invoices} فاتورة`} icon={Wallet} tone="success" />
        <StatCard label="رسوم التّوصيل" value={formatDa(r.shippingDzd)} hint="مضمّنة في الفواتير" icon={Truck} />
        <StatCard
          label="أجر الأستاذ المساعد"
          value={formatDa(r.assistantPaidDzd + r.assistantDueDzd)}
          hint={r.assistantDueDzd ? `منها ${formatDa(r.assistantDueDzd)} غير مدفوعة بعد` : 'مدفوع'}
          icon={Banknote}
        />
        <StatCard label="الصّافي" value={formatDa(r.netDzd)} hint="تقريبيّ: بلا مصاريف أخرى" icon={Receipt} tone={r.netDzd < 0 ? 'destructive' : 'success'} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">أين مال الدفع عند الاستلام؟</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
            <div className="rounded-lg bg-success/10 p-2">
              <div className="text-xs text-muted-foreground">وصلني هذا الشّهر</div>
              <div className="font-bold text-success">{formatDa(cod.receivedInMonth.netDzd)}</div>
              <div className="text-xs text-muted-foreground">{cod.receivedInMonth.orders} طرد</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-xs text-muted-foreground">جاهز للدفع</div>
              <div className="font-bold">{formatDa(cod.pending.READY.netDzd)}</div>
              <div className="text-xs text-muted-foreground">{cod.pending.READY.orders} طرد</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-xs text-muted-foreground">عند شركة التّوصيل</div>
              <div className="font-bold">{formatDa(cod.pending.AT_CARRIER.netDzd + cod.pending.UNTRACKED.netDzd)}</div>
              <div className="text-xs text-muted-foreground">{cod.pending.AT_CARRIER.orders + cod.pending.UNTRACKED.orders} طرد</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-xs text-muted-foreground">عند السّائق</div>
              <div className="font-bold">{formatDa(cod.pending.WITH_DRIVER.netDzd)}</div>
              <div className="text-xs text-muted-foreground">{cod.pending.WITH_DRIVER.orders} طرد</div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            لم يصلك بعد: <b>{formatDa(cod.pendingNetDzd)}</b> (بعد رسم الشّركة). يُحدَّث من EcoTrack تلقائيًّا، وتستطيع تعليم أيّ طرد «استلمتُ» بنفسك.
            {cod.pending.UNTRACKED.orders ? ` منها ${cod.pending.UNTRACKED.orders} طرد غير متابَع بعد (يُحسب عند الشّركة حتى تعلّمه).` : ''}
          </p>
          {pending.length === 0 ? (
            <EmptyState title="وصلك مال كلّ الطّرود المسلَّمة" />
          ) : (
            <ul className="divide-y text-sm">
              {pending.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="font-bold">
                      {o.number} · {o.customerName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      سُلّم {o.deliveredAt ? o.deliveredAt.toLocaleDateString('fr-DZ') : '—'}
                      {o.tracking ? ` · ${o.tracking}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={o.status === 'READY' ? 'success' : 'muted'}>{o.status ? COD_MONEY_LABELS[o.status] : 'غير متابَع'}</Badge>
                    <span className="tabular-nums">{formatDa(o.netDzd)}</span>
                    <form action={codReceivedAction}>
                      <input type="hidden" name="orderId" value={o.id} />
                      <input type="hidden" name="on" value="1" />
                      <Button type="submit" size="sm" variant="outline">
                        استلمتُ
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {r.pos.codes > 0 ? (
        <p className="text-sm text-muted-foreground">
          وأكواد نقاط البيع هذا الشّهر: {r.pos.codes} كودًا بسعر بيع {formatDa(r.pos.totalDzd)} (بلا فاتورة، وغير محسوبة في الصّافي).
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">آخر ستّة أشهر</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[...r.trend].reverse().map((x) => (
              <li key={x.month} className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-2">
                <Link href={`/admin/revenue?m=${x.month}`} className={x.month === month ? 'font-bold text-primary' : ''}>
                  {x.month}
                </Link>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success" style={{ width: `${Math.round((100 * x.totalDzd) / max)}%` }} />
                </div>
                <span className="tabular-nums">{formatDa(x.totalDzd)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">حسب طريقة الدّفع</CardTitle>
          </CardHeader>
          <CardContent>
            {r.byMethod.length === 0 ? (
              <EmptyState title="لا فواتير هذا الشّهر" />
            ) : (
              <ul className="divide-y text-sm">
                {r.byMethod.map((x) => (
                  <li key={x.method} className="flex justify-between gap-2 py-2">
                    <span>
                      {PAYMENT_METHOD_AR[x.method] ?? x.method} <span className="text-xs text-muted-foreground">· {x.invoices} فاتورة</span>
                    </span>
                    <span className="tabular-nums">{formatDa(x.totalDzd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">الأكثر مبيعًا</CardTitle>
          </CardHeader>
          <CardContent>
            {r.byItem.length === 0 ? (
              <EmptyState title="لا مبيعات هذا الشّهر" />
            ) : (
              <ul className="divide-y text-sm">
                {r.byItem.map((x) => (
                  <li key={x.title} className="flex justify-between gap-2 py-2">
                    <span className="min-w-0">
                      {x.title} <span className="text-xs text-muted-foreground">× {x.qty}</span>
                    </span>
                    <span className="shrink-0 tabular-nums">{formatDa(x.totalDzd)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        التّفاصيل فاتورةً فاتورة في{' '}
        <Link href={`/admin/invoices?month=${month}`} className="font-bold text-primary">
          الطّلبات ← الفواتير
        </Link>
        ، وأجر المساعد في{' '}
        <Link href={`/admin/assistants-pay?m=${month}`} className="font-bold text-primary">
          الإعدادات ← أجور الأستاذ المساعد
        </Link>
        .
      </p>
    </div>
  )
}
