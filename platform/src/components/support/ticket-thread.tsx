import { Lock, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn, formatDateTime } from '@/lib/utils'
import type { SupportKind, SupportStatus } from '@/server/db/schema/enums'
import type { TicketView } from '@/server/services/support.service'
import { KIND_AR, STATUS_AR, STATUS_VARIANT } from './labels'
import { ReplyForm, TicketControls } from './ticket-forms'

export function TicketStatusBadge({ status }: { status: string }) {
  const s = status as SupportStatus
  return <Badge variant={STATUS_VARIANT[s] ?? 'secondary'}>{STATUS_AR[s] ?? status}</Badge>
}

/** عرض التذكرة: الترويسة، الرسائل (الداخلية مميّزة للموظف)، ثم نموذج الردّ */
export function TicketThread({ view, currentUserId, agents, backHref }: { view: TicketView; currentUserId: string; agents?: { id: string; name: string }[]; backHref: string }) {
  const { ticket, messages, staff } = view
  const closed = ticket.status === 'CLOSED'
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card>
        <CardHeader className="gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground" dir="ltr">
                #{ticket.number}
              </span>
              <TicketStatusBadge status={ticket.status} />
              <Badge variant="outline">{KIND_AR[ticket.kind as SupportKind] ?? ticket.kind}</Badge>
              {ticket.isSensitive ? (
                <Badge variant="destructive">
                  <ShieldAlert className="size-3" /> حساسة
                </Badge>
              ) : null}
            </div>
            <TicketControls ticketId={ticket.id} status={ticket.status as SupportStatus} staff={staff} assignedToUserId={ticket.assignedToUserId} agents={staff ? agents : undefined} />
          </div>
          <CardTitle className="text-lg leading-snug">{ticket.subject}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {staff ? (
              <>
                {ticket.ownerName} · <span dir="ltr">{ticket.ownerEmail}</span> ·{' '}
              </>
            ) : null}
            فُتحت {formatDateTime(ticket.createdAt)}
            {ticket.orderNumber ? (
              <>
                {' '}
                · الطلب{' '}
                <Link href={`/store/orders/${ticket.orderId}`} className="font-mono underline" dir="ltr">
                  {ticket.orderNumber}
                </Link>
              </>
            ) : null}
            {ticket.courseTitle ? ` · الدورة: ${ticket.courseTitle}` : null}
            {staff && ticket.assigneeName ? ` · المسؤول: ${ticket.assigneeName}` : null}
          </p>
        </CardHeader>
      </Card>

      <ol className="space-y-3">
        {messages.map((m) => {
          const mine = m.authorUserId === currentUserId
          return (
            <li key={m.id} className={cn('flex', mine ? 'justify-start' : 'justify-end')}>
              <div className={cn('max-w-[90%] rounded-lg border p-3 text-sm shadow-soft sm:max-w-[75%]', m.isInternal ? 'border-warning/40 bg-warning/10' : m.isStaff ? 'border-primary/20 bg-primary/5' : 'bg-card')}>
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="font-semibold text-foreground">{m.isStaff && !staff ? 'فريق الدعم' : m.authorName}</span>
                  {m.isInternal ? (
                    <span className="inline-flex items-center gap-1 text-amber-800 dark:text-amber-300">
                      <Lock className="size-3" /> داخلية
                    </span>
                  ) : null}
                  <span>{formatDateTime(m.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
              </div>
            </li>
          )
        })}
      </ol>

      <Card>
        <CardContent className="pt-5">
          <ReplyForm ticketId={ticket.id} staff={staff} disabled={closed && !staff} />
        </CardContent>
      </Card>
      <p className="text-center text-xs">
        <Link href={backHref} className="text-muted-foreground underline">
          ← العودة إلى القائمة
        </Link>
      </p>
    </div>
  )
}
