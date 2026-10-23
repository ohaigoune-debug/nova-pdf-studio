import { notFound } from 'next/navigation'
import { TicketThread } from '@/components/support/ticket-thread'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getTicket, supportAgents } from '@/server/services/support.service'

export const dynamic = 'force-dynamic'

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  const db = await getDb()
  let view
  try {
    view = await getTicket(db, actor, id)
  } catch (err) {
    if (isAppError(err)) notFound()
    throw err
  }
  const agents = await supportAgents(db, actor)
  return (
    <div className="space-y-6">
      <PageHeader title={`التذكرة #${view.ticket.number}`} description={view.ticket.subject} />
      <TicketThread view={view} currentUserId={actor.userId} agents={agents} backHref="/admin/support" />
    </div>
  )
}
