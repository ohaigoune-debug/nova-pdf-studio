import { LifeBuoy, Plus } from 'lucide-react'
import Link from 'next/link'
import { NewTicketForm } from '@/components/support/ticket-forms'
import { TicketStatusBadge } from '@/components/support/ticket-thread'
import { KIND_AR } from '@/components/support/labels'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { SUPPORT_KINDS, type SupportKind } from '@/server/db/schema/enums'
import { myOrders } from '@/server/services/store.service'
import { myTickets } from '@/server/services/support.service'

export const dynamic = 'force-dynamic'

/** الدعم والشكاوى (التلميذ): تذاكري + فتح تذكرة جديدة */
export default async function StudentSupportPage({ searchParams }: { searchParams: Promise<{ new?: string; kind?: string; order?: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const sp = await searchParams
  const db = await getDb()
  const [tickets, orders] = await Promise.all([myTickets(db, actor), myOrders(db, actor)])
  const showNew = sp.new === '1' || tickets.length === 0
  const defaultKind = SUPPORT_KINDS.includes(sp.kind as SupportKind) ? (sp.kind as SupportKind) : undefined
  return (
    <>
      <PageHeader
        title="الدعم والشكاوى"
        description="مشكلة في طلب أو توصيل أو دورة؟ افتح تذكرة وسيردّ عليك فريق المنصة."
        actions={
          !showNew ? (
            <Link href="/student/support?new=1" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground">
              <Plus className="size-4" /> تذكرة جديدة
            </Link>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-3xl space-y-5">
        {showNew ? (
          <Card>
            <CardHeader>
              <CardTitle>تذكرة جديدة</CardTitle>
            </CardHeader>
            <CardContent>
              <NewTicketForm basePath="/student/support" defaultKind={defaultKind} orderId={sp.order ?? null} orders={orders.map((o) => ({ id: o.id, number: o.number }))} />
            </CardContent>
          </Card>
        ) : null}
        {tickets.length === 0 ? (
          !showNew ? <EmptyState icon={LifeBuoy} title="لا تذاكر بعد" /> : null
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>تذاكري</CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              {tickets.map((t) => (
                <Link key={t.id} href={`/student/support/${t.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-muted/40">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      <span className="me-2 font-mono text-xs text-muted-foreground" dir="ltr">
                        #{t.number}
                      </span>
                      {t.subject}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {KIND_AR[t.kind]} · {t.messages} رسالة · آخر تحديث {formatDateTime(t.lastMessageAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.isSensitive ? <Badge variant="destructive">حساسة</Badge> : null}
                    <TicketStatusBadge status={t.status} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
