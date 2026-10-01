import { desc } from 'drizzle-orm'
import { Store, Wallet } from 'lucide-react'
import Link from 'next/link'
import { MarkPaidButton, PayoutForm, ReviewActions } from '@/components/domain/market-admin'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherPayouts, teacherWorkspaces } from '@/server/db/schema'
import { LISTING_STATUSES, type ListingKind, type ListingStatus } from '@/server/db/schema/enums'
import { balancesAdmin, LISTING_KIND_AR, LISTING_STATUS_AR, listListingsAdmin, marketStats } from '@/server/services/marketplace.service'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { DRAFT: 'secondary', PENDING_REVIEW: 'warning', PUBLISHED: 'success', REJECTED: 'destructive', ARCHIVED: 'muted' }

/** إدارة السوق (المرحلة 11): مراجعة العروض، أرصدة الأساتذة، الدفعات */
export default async function AdminMarketPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const status = LISTING_STATUSES.includes(sp.status as ListingStatus) ? (sp.status as ListingStatus) : 'PENDING_REVIEW'
  const db = await getDb()
  const [stats, rows, balances, payouts] = await Promise.all([marketStats(db, actor), listListingsAdmin(db, actor, status), balancesAdmin(db, actor), db.select({ p: teacherPayouts, name: teacherWorkspaces.name }).from(teacherPayouts).innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, teacherPayouts.workspaceId)).orderBy(desc(teacherPayouts.createdAt)).limit(30)])
  return (
    <div className="space-y-6">
      <PageHeader title="سوق الأساتذة" description={`نصيب الأستاذ ${stats.sharePct}% (MARKETPLACE_TEACHER_SHARE_PCT في البيئة). العروض المقبولة تُنشر منتجات في المتجر وتُباع بطلباته.`} />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
        <StatCard label="بانتظار المراجعة" value={stats.pending} icon={Store} tone={stats.pending ? 'warning' : 'default'} />
        <StatCard label="منشورة" value={stats.published} icon={Store} tone="success" />
        <StatCard label="المبيعات" value={stats.sales} hint={`إجمالي ${stats.grossDzd} دج`} icon={Wallet} />
        <StatCard label="نصيب المنصة" value={`${stats.platformDzd} دج`} icon={Wallet} />
        <StatCard label="نصيب الأساتذة" value={`${stats.teachersDzd} دج`} icon={Wallet} />
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>العروض</CardTitle>
          <nav className="flex flex-wrap gap-1 text-xs">
            {LISTING_STATUSES.map((s) => (
              <Link key={s} href={`/admin/market?status=${s}`} className={cn('rounded-full border px-2.5 py-1', status === s ? 'border-primary bg-primary text-primary-foreground' : '')}>
                {LISTING_STATUS_AR[s]}
              </Link>
            ))}
          </nav>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <EmptyState icon={Store} title="لا عروض في هذه الحالة" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>العرض</TableHead>
                  <TableHead>الأستاذ</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>السعر</TableHead>
                  <TableHead>الحقوق</TableHead>
                  <TableHead>التاريخ</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ l, teacherName, workspaceName, subjectName, levelName }) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-semibold">{l.title}</span>
                      <span className="block text-xs text-muted-foreground">{[subjectName, levelName].filter(Boolean).join(' · ') || '—'}</span>
                      {l.description ? <span className="line-clamp-2 block text-xs text-muted-foreground">{l.description}</span> : null}
                      {l.kind === 'EXAM' && l.examId ? (
                        <Link href={`/print/exams/${l.examId}?mode=subject`} target="_blank" className="text-xs text-primary underline">
                          معاينة الورقة
                        </Link>
                      ) : null}
                      {(l.kind === 'EXERCISE_SET' || l.kind === 'QUESTION_BANK') && l.questionIds.length ? <span className="block text-xs text-muted-foreground">{l.questionIds.length} سؤالاً</span> : null}
                    </TableCell>
                    <TableCell className="text-xs">
                      {teacherName ?? '—'}
                      <span className="block text-muted-foreground">{workspaceName}</span>
                    </TableCell>
                    <TableCell className="text-xs">{LISTING_KIND_AR[l.kind as ListingKind]}</TableCell>
                    <TableCell className="tabular">{l.priceDzd ? `${l.priceDzd} دج` : 'مجاني'}</TableCell>
                    <TableCell>{l.rightsConfirmed ? <Badge variant="success">مؤكَّدة</Badge> : <Badge variant="destructive">غير مؤكَّدة</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(l.submittedAt ?? l.updatedAt)}</TableCell>
                    <TableCell>
                      {l.status === 'PENDING_REVIEW' ? <ReviewActions id={l.id} /> : <Badge variant={VARIANT[l.status] ?? 'secondary'}>{LISTING_STATUS_AR[l.status as ListingStatus]}</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">أرصدة الأساتذة</CardTitle>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا مبيعات بعد.</p>
            ) : (
              <ul className="divide-y text-sm">
                {balances.map((b) => (
                  <li key={b.workspaceId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.sales} بيع · مكتسب {b.earned} دج · مدفوع {b.paidDzd} دج{b.pendingDzd ? ` · معلّق ${b.pendingDzd} دج` : ''}
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn('tabular font-bold', b.balanceDzd > 0 ? 'text-warning' : '')}>{b.balanceDzd} دج</span>
                      {b.balanceDzd > 0 ? <PayoutForm workspaceId={b.workspaceId} balanceDzd={b.balanceDzd} /> : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">آخر الدفعات</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا دفعات بعد.</p>
            ) : (
              <ul className="divide-y text-sm">
                {payouts.map(({ p, name }) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className="font-semibold">{name}</span> · <span className="tabular">{p.amountDzd} دج</span>
                      <span className="block text-xs text-muted-foreground">{formatDate(p.createdAt)}{p.note ? ` · ${p.note}` : ''}</span>
                    </span>
                    {p.status === 'PAID' ? <Badge variant="success">حُوّلت</Badge> : <MarkPaidButton id={p.id} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
