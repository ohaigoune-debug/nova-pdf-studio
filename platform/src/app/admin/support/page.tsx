import { Clock, Inbox, LifeBuoy, ShieldAlert, UserRoundCheck } from 'lucide-react'
import Link from 'next/link'
import { KIND_AR, STATUS_AR } from '@/components/support/labels'
import { TicketStatusBadge } from '@/components/support/ticket-thread'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { SUPPORT_KINDS, SUPPORT_STATUSES, type SupportKind, type SupportStatus } from '@/server/db/schema/enums'
import { listTicketsAdmin, supportStats } from '@/server/services/support.service'

export const dynamic = 'force-dynamic'

const chip = (active: boolean) => cn('rounded-full border px-2.5 py-1', active ? 'border-primary bg-primary text-primary-foreground' : '')

/** الشكاوى (المشرف العام): مرشّحات بالحالة والنوع والإسناد */
export default async function AdminSupportPage({ searchParams }: { searchParams: Promise<{ status?: string; kind?: string; mine?: string; q?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const status = SUPPORT_STATUSES.includes(sp.status as SupportStatus) ? (sp.status as SupportStatus) : null
  const kind = SUPPORT_KINDS.includes(sp.kind as SupportKind) ? (sp.kind as SupportKind) : null
  const mine = sp.mine === '1'
  const db = await getDb()
  const [stats, tickets] = await Promise.all([supportStats(db, actor), listTicketsAdmin(db, actor, { status, kind, assignedToUserId: mine ? actor.userId : null, q: sp.q ?? null })])
  const href = (patch: Partial<{ status: string | null; kind: string | null; mine: string | null }>) => {
    const p = new URLSearchParams()
    const merged = { status: status ?? null, kind: kind ?? null, mine: mine ? '1' : null, ...patch }
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v)
    if (sp.q) p.set('q', sp.q)
    const s = p.toString()
    return `/admin/support${s ? `?${s}` : ''}`
  }
  return (
    <div className="space-y-6">
      <PageHeader title="الشكاوى والدعم" description="تذاكر المستخدمين: ردّ، ملاحظة داخلية، إسناد، وتغيير الحالة. الشكاوى عن الأساتذة لا يراها إلا المشرف العام." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="مفتوحة" value={stats.open} icon={Inbox} tone={stats.open ? 'warning' : 'default'} />
        <StatCard label="قيد المعالجة" value={stats.inProgress} icon={UserRoundCheck} />
        <StatCard label="بانتظار المستخدم" value={stats.waiting} icon={Clock} />
        <StatCard label="حساسة نشطة" value={stats.sensitive} icon={ShieldAlert} tone={stats.sensitive ? 'destructive' : 'default'} />
      </div>
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>التذاكر ({tickets.length})</CardTitle>
            <form className="flex gap-1" action="/admin/support">
              {status ? <input type="hidden" name="status" value={status} /> : null}
              {kind ? <input type="hidden" name="kind" value={kind} /> : null}
              <input name="q" defaultValue={sp.q ?? ''} placeholder="بحث بالموضوع أو الرقم" className="h-9 rounded-md border bg-card px-3 text-sm" />
            </form>
          </div>
          <nav className="flex flex-wrap gap-1 text-xs">
            <Link href={href({ status: null })} className={chip(!status)}>
              كل الحالات
            </Link>
            {SUPPORT_STATUSES.map((s) => (
              <Link key={s} href={href({ status: s })} className={chip(status === s)}>
                {STATUS_AR[s]}
              </Link>
            ))}
            <span className="mx-1 border-s" />
            <Link href={href({ kind: null })} className={chip(!kind)}>
              كل الأنواع
            </Link>
            {SUPPORT_KINDS.map((k) => (
              <Link key={k} href={href({ kind: k })} className={chip(kind === k)}>
                {KIND_AR[k]}
              </Link>
            ))}
            <span className="mx-1 border-s" />
            <Link href={href({ mine: mine ? null : '1' })} className={chip(mine)}>
              المُسنَدة إليّ
            </Link>
          </nav>
        </CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <EmptyState icon={LifeBuoy} title="لا تذاكر" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>الموضوع</TableHead>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>النوع</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>المسؤول</TableHead>
                  <TableHead>آخر رسالة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono text-xs" dir="ltr">
                      {t.number}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/support/${t.id}`} className="font-semibold hover:underline">
                        {t.subject}
                      </Link>
                      <span className="block text-[11px] text-muted-foreground">{t.messages} رسالة</span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.ownerName}
                      <span className="block text-muted-foreground" dir="ltr">
                        {t.ownerEmail}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {KIND_AR[t.kind]} {t.isSensitive ? <Badge variant="destructive">حساسة</Badge> : null}
                    </TableCell>
                    <TableCell>
                      <TicketStatusBadge status={t.status} />
                    </TableCell>
                    <TableCell className="text-xs">{t.assigneeName ?? '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDateTime(t.lastMessageAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
