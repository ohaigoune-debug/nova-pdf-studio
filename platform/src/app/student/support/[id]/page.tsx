import { notFound } from 'next/navigation'
import { TicketThread } from '@/components/support/ticket-thread'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getTicket } from '@/server/services/support.service'

export const dynamic = 'force-dynamic'

export default async function StudentTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { id } = await params
  let view
  try {
    view = await getTicket(await getDb(), actor, id)
  } catch (err) {
    if (isAppError(err)) notFound()
    throw err
  }
  return (
    <>
      <PageHeader title={`التذكرة #${view.ticket.number}`} />
      <TicketThread view={view} currentUserId={actor.userId} backHref="/student/support" />
    </>
  )
}
