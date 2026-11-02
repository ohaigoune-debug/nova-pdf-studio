import { asc } from 'drizzle-orm'
import { ArrowRight, Clock, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AffiliateEditForm, AffiliatePayoutForm, AffiliateResetButton, AffiliateStatusButton, VoidRewardButton } from '@/components/partners/partners-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { wilayas } from '@/server/db/schema'
import { isAppError } from '@/server/lib/errors'
import { getAffiliate } from '@/server/services/affiliates.service'

export const dynamic = 'force-dynamic'

export default async function AffiliateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN', 'MANAGER')
  const { id } = await params
  const db = await getDb()
  let data: Awaited<ReturnType<typeof getAffiliate>>
  try {
    data = await getAffiliate(db, actor, id)
  } catch (e) {
    if (isAppError(e) && (e.code === 'NOT_FOUND' || e.code === 'VALIDATION')) notFound()
    throw e
  }
  const ws = await db.select({ id: wilayas.id, code: wilayas.code, name: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code))
  const { affiliate: a, money } = data
  const isAdmin = actor.role === 'SUPER_ADMIN'
  const now = new Date()
  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin/affiliates">
          <ArrowRight className="size-4 rtl:rotate-0 ltr:rotate-180" /> كل المسوّقين
        </Link>
      </Button>
      <PageHeader
        title={data.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {data.phone ? <span dir="ltr">{data.phone}</span> : null}
            <span dir="ltr" className="font-mono font-bold">{data.code}</span>
            {a.status === 'ACTIVE' ? <Badge variant="success">مفعّل</Badge> : <Badge variant="muted">موقوف</Badge>}
            <span>· {a.commissionDzd} دج عن كل تلميذ</span>
            {data.lastLoginAt ? <span className="text-xs">· آخر دخول {formatDateTime(data.lastLoginAt)}</span> : <span className="text-xs">· لم يدخل بعد</span>}
          </span>
        }
        actions={
          <span className="flex flex-wrap gap-2">
            <AffiliateResetButton id={a.id} />
            <AffiliateStatusButton id={a.id} status={a.status} />
          </span>
        }
      />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard label="سجّلوا / اشتروا" value={`${data.customers.length} / ${data.customers.filter((c) => c.status === 'BOUGHT').length}`} icon={Users} />
        <StatCard label="العمولات المستحقّة" value={`${money.earnedDzd} دج`} icon={Wallet} />
        <StatCard label="قيد المهلة" value={`${money.holdingDzd} دج`} icon={Clock} />
        <StatCard label="المستحق الآن" value={`${money.dueDzd} دج`} icon={Wallet} tone={money.dueDzd > 0 ? 'warning' : 'default'} hint={`دُفع ${money.paidDzd} دج`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>دفع العمولة</CardTitle>
          <CardDescription>لا يتجاوز المستحق الآن (ما تجاوز مهلة الإرجاع). القيد لا يُحذف.</CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliatePayoutForm id={a.id} dueDzd={Math.max(0, money.dueDzd)} />
          {data.payouts.length ? (
            <ul className="mt-4 divide-y text-sm">
              {data.payouts.map((p) => (
                <li key={p.id} className="flex flex-wrap justify-between gap-2 py-2">
                  <span>
                    {formatDateTime(p.createdAt)} {p.note ? `· ${p.note}` : ''} {p.by ? <span className="text-xs text-muted-foreground">· {p.by}</span> : null}
                  </span>
                  <span className="font-semibold tabular-nums">{p.amountDzd} دج</span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الزبائن</CardTitle>
          <CardDescription>كاملة للإدارة (المسوّق يراها مقنّعة). «لا يُحتسب» = رُفض آليًّا لتطابق الهاتف.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.customers.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا أحد بعد.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التلميذ</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>سجّل</TableHead>
                    <TableHead>الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.customers.map((c) => (
                    <TableRow key={c.referralId}>
                      <TableCell>{c.fullName || c.name}</TableCell>
                      <TableCell dir="ltr">{c.phone ?? '—'}</TableCell>
                      <TableCell className="text-sm">{formatDate(c.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === 'BOUGHT' ? 'success' : c.status === 'VOID' || c.status === 'RETURNED' ? 'destructive' : 'muted'}>{c.statusAr}</Badge>
                        {c.note ? <span className="block text-xs text-muted-foreground">{c.note}</span> : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>العمولات</CardTitle>
          <CardDescription>تُلغى آليًّا إن أُرجع الطلب. ألغِ يدويًّا مع السبب إن ثبت تحايل.</CardDescription>
        </CardHeader>
        <CardContent>
          {data.rewards.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا عمولات بعد.</p>
          ) : (
            <ul className="divide-y text-sm">
              {data.rewards.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    {r.buyer ?? '—'} · {formatDate(r.createdAt)}
                    <span className="block text-xs text-muted-foreground">
                      {r.status === 'REVERSED' ? `أُلغيت: ${r.reverseReason ?? ''}` : r.availableAt > now ? `قابلة للدفع من ${formatDate(r.availableAt)}` : 'قابلة للدفع'}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`font-semibold tabular-nums ${r.status === 'REVERSED' ? 'line-through text-muted-foreground' : ''}`}>{r.amountDzd} دج</span>
                    {r.status === 'EARNED' ? <VoidRewardButton rewardId={r.id} affiliateId={a.id} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>بياناته</CardTitle>
          <CardDescription>
            {data.wilaya ?? 'بلا ولاية'} · الرابط: <span dir="ltr">{data.link}</span>
            {a.socialUrl ? (
              <>
                {' '}
                · صفحته:{' '}
                <a href={/^https?:\/\//.test(a.socialUrl) ? a.socialUrl : `https://${a.socialUrl}`} target="_blank" rel="noopener noreferrer nofollow" dir="ltr" className="text-primary hover:underline">
                  {a.socialUrl}
                </a>
              </>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AffiliateEditForm id={a.id} values={{ socialUrl: a.socialUrl, followers: a.followers, wilayaId: a.wilayaId, note: a.note, code: data.code, commissionDzd: a.commissionDzd }} wilayas={ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.name}` }))} isAdmin={isAdmin} />
        </CardContent>
      </Card>
    </div>
  )
}
