import { MonthLinks } from '@/components/domain/assistant-statement'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { formatDa, monthOf, monthRange, recentMonths } from '@/lib/assistant-pay'
import { PAYMENT_METHOD_AR } from '@/lib/invoice-labels'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherShareMonth } from '@/server/services/teacher-share.service'

export const dynamic = 'force-dynamic'

/** «مستحقّاتي» — نصيب الأستاذ من مبيعات دوراته شهرًا بشهر */
export default async function TeacherEarningsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { m } = await searchParams
  const now = new Date()
  const months = recentMonths(now, 6)
  const month = m && monthRange(m) && months.includes(m) ? m : monthOf(now)
  const d = await teacherShareMonth(await getDb(), actor, { month })
  const c = d.config
  return (
    <>
      <PageHeader title="مستحقّاتي" description={`بالبطاقة: تُحذف TVA ${c.vatPct}% ثمّ لك ${c.cardPct}%. بغير البطاقة (عند الاستلام…): لك ${c.otherPct}%. على ثمن المنتج وحده، للطّلبات المسلَّمة.`} />
      <div className="mx-auto max-w-3xl space-y-4">
        <MonthLinks current={month} months={months} href={(x) => `/teacher/earnings?m=${x}`} />
        {!d.partner ? (
          <EmptyState title="لا نصيب مفعّل لحسابك بعد" description="يفعّله مالك المنصّة من «مداخيل المنصّة»." />
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
                <CardTitle className="text-base">نصيبك هذا الشّهر</CardTitle>
                {d.payout ? <Badge variant="success">مدفوع · {formatDa(d.payout.amountDzd)}</Badge> : <Badge variant="muted">غير مدفوع بعد</Badge>}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-4xl font-extrabold tabular-nums text-primary">{formatDa(d.totalShareDzd)}</p>
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border p-2.5">
                    <dt className="text-xs text-muted-foreground">بالبطاقة</dt>
                    <dd className="font-bold tabular-nums">{formatDa(d.card.shareDzd)}</dd>
                    <dd className="text-xs text-muted-foreground">من {formatDa(d.card.grossDzd)} (بعد TVA {formatDa(d.card.baseDzd)})</dd>
                  </div>
                  <div className="rounded-lg border p-2.5">
                    <dt className="text-xs text-muted-foreground">بغير البطاقة</dt>
                    <dd className="font-bold tabular-nums">{formatDa(d.other.shareDzd)}</dd>
                    <dd className="text-xs text-muted-foreground">من {formatDa(d.other.grossDzd)}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">المبيعات ({d.lines.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {d.lines.length === 0 ? (
                  <EmptyState title="لا مبيعات مسلَّمة هذا الشّهر" />
                ) : (
                  <ul className="divide-y text-sm">
                    {[...d.lines].reverse().map((l, i) => (
                      <li key={`${l.orderNumber}-${i}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                        <div className="min-w-0">
                          <div className="font-bold">{l.title}</div>
                          <div className="text-xs text-muted-foreground">
                            {l.orderNumber} · {l.deliveredAt ? l.deliveredAt.toLocaleDateString('fr-DZ') : '—'} · {PAYMENT_METHOD_AR[l.method] ?? l.method} · {formatDa(l.amountDzd)}
                          </div>
                        </div>
                        <span className="shrink-0 font-bold tabular-nums">{formatDa(l.shareDzd)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}
