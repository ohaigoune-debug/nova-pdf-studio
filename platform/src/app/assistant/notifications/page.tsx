import { NotificationsPanel } from '@/components/domain/notifications-panel'
import { requirePageActor } from '@/server/auth/current-user'

export default async function AssistantNotificationsPage() {
  const actor = await requirePageActor('ASSISTANT')
  return <NotificationsPanel actor={actor} />
}
