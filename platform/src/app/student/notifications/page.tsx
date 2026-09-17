import { NotificationsPanel } from '@/components/domain/notifications-panel'
import { requirePageActor } from '@/server/auth/current-user'

export default async function StudentNotificationsPage() {
  const actor = await requirePageActor('STUDENT')
  return <NotificationsPanel actor={actor} />
}
