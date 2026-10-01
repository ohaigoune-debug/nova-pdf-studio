import { and, desc, eq, isNull } from 'drizzle-orm'
import { Store, TrendingUp, Wallet } from 'lucide-react'
import Link from 'next/link'
import { ListingActions, ListingForm } from '@/components/domain/market-teacher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { bankQuestions } from '@/server/db/schema'
import type { ListingKind, ListingStatus } from '@/server/db/schema/enums'
import { bankFormOptions } from '@/server/queries/bank-options'
import { LISTING_KIND_AR, LISTING_STATUS_AR, listingSources, myListings, teacherEarnings } from '@/server/services/marketplace.service'

export const dynamic = 'force-dynamic'

const VARIANT: Record<string, 'secondary' | 'success' | 'warning' | 'muted' | 'destructive'> = { DRAFT: 'secondary', PENDING_REVIEW: 'warning', PUBLISHED: 'success', REJECTED: 'destructive', ARCHIVED: 'muted' }

/** سوق الأساتذة — صفحة الأستاذ (المرحلة 11): عروضي، أرباحي، عرض جديد */
export default async function TeacherMarketPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const sp = await searchParams
  const db = await getDb()
  const [mine, earnings, sources, opts, questions] = await Promise.all([
    myListings(db, actor),
    teacherEarnings(db, actor),
    listingSources(db, actor),
    bankFormOptions(db, actor),
    db.select({ id: bankQuestions.id, title: bankQuestions.title, body: bankQuestions.body, rights: bankQuestions.rightsStatus }).from(bankQuestions).where(and(eq(bankQuestions.workspaceId, actor.workspaceId ?? ''), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'PUBLISHED'))).orderBy(desc(bankQuestions.updatedAt)).limit(300)
  ])
  return (
    <div className="space-y-6">
      <PageHeader
        title="سوق الأساتذة"
        description={`اعرض امتحاناتك وتمارينك وملخّصاتك للأساتذة والتلاميذ، مجاناً أو بثمن — نصيبك ${earnings.sharePct}% من كل بيع.`}
        actions={
          <Button asChild variant={sp.new ? 'outline' : 'default'}>
            <Link href={sp.new ? '/teacher/market' : '/teacher/market?new=1'}>
              <Store className="size-4" /> {sp.new ? 'عروضي' : 'عرض جديد'}
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="المبيعات" value={earnings.sales} icon={TrendingUp} />
        <StatCard label="أرباحي" value={`${earnings.earnedDzd} دج`} hint={`من إجمالي ${earnings.grossDzd} دج`} icon={Wallet} tone="success" />
        <StatCard label="سُدّد لي" value={`${earnings.paidDzd} دج`} hint={earnings.pendingDzd ? `${earnings.pendingDzd} دج قيد التحويل` : undefined} icon={Wallet} />
        <StatCard label="الرصيد المستحقّ" value={`${earnings.balanceDzd} دج`} icon={Wallet} tone={earnings.balanceDzd > 0 ? 'warning' : 'default'} />
      </div>

      {sp.new ? (
        <ListingForm sources={{ exams: sources.exams, files: sources.files, questions }} options={{ subjects: opts.subjects, levels: opts.levels, streams: opts.streams }} sharePct={earnings.sharePct} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>عروضي</CardTitle>
          </CardHeader>
          <CardContent>
            {mine.length === 0 ? (
              <EmptyState icon={Store} title="لا عروض بعد" description="اعرض امتحاناً جاهزاً، أو مجموعة تمارين من بنكك، أو ملخّصاً PDF." action={<Button asChild><Link href="/teacher/market?new=1">عرض جديد</Link></Button>} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العرض</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>السعر</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>مبيعات</TableHead>
                    <TableHead>أرباح</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mine.map(({ l, subjectName, levelName, productSlug, earnedDzd }) => (
                    <TableRow key={l.id}>
                      <TableCell>
                        {productSlug && l.status === 'PUBLISHED' ? (
                          <Link href={`/store/${productSlug}`} className="font-semibold hover:underline" target="_blank">
                            {l.title}
                          </Link>
                        ) : (
                          <span className="font-semibold">{l.title}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {[subjectName, levelName].filter(Boolean).join(' · ') || '—'} · {formatDate(l.updatedAt)}
                        </span>
                        {l.status === 'REJECTED' && l.reviewNote ? <span className="block text-xs text-destructive">سبب الرفض: {l.reviewNote}</span> : null}
                      </TableCell>
                      <TableCell className="text-xs">{LISTING_KIND_AR[l.kind as ListingKind]}</TableCell>
                      <TableCell className="tabular">{l.priceDzd ? `${l.priceDzd} دج` : 'مجاني'}</TableCell>
                      <TableCell>
                        <Badge variant={VARIANT[l.status] ?? 'secondary'}>{LISTING_STATUS_AR[l.status as ListingStatus]}</Badge>
                      </TableCell>
                      <TableCell className="tabular">{l.salesCount}</TableCell>
                      <TableCell className="tabular">{earnedDzd} دج</TableCell>
                      <TableCell>
                        <ListingActions id={l.id} status={l.status} rightsConfirmed={l.rightsConfirmed} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {earnings.recent.length || earnings.payouts.length ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">آخر المبيعات</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y text-sm">
                {earnings.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="min-w-0 truncate">{r.title}</span>
                    <span className="tabular text-xs text-muted-foreground">
                      {r.priceDzd ? `${r.priceDzd} دج → ${r.teacherShareDzd} دج` : 'مجاني'} · {formatDateTime(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">الدفعات</CardTitle>
            </CardHeader>
            <CardContent>
              {earnings.payouts.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا دفعات بعد. يحوّل المشرف الرصيد المستحقّ دورياً.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {earnings.payouts.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                      <span>
                        <span className="tabular font-semibold">{p.amountDzd} دج</span>
                        {p.note ? <span className="block text-xs text-muted-foreground">{p.note}</span> : null}
                      </span>
                      <span className="text-xs text-muted-foreground">{p.status === 'PAID' ? `حُوّلت ${formatDate(p.paidAt)}` : 'قيد التحويل'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
