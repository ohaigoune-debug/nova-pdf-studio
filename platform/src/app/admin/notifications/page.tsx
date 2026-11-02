import { NotificationsPanel } from '@/components/domain/notifications-panel'
import { requirePageActor } from '@/server/auth/current-user'

export default async function AdminNotificationsPage() {
  const actor = await requirePageActor('SUPER_ADMIN', 'MANAGER')
  return <NotificationsPanel actor={actor} />
}
