import { NotificationsPanel } from '@/components/domain/notifications-panel'
import { requirePageActor } from '@/server/auth/current-user'

export default async function TeacherNotificationsPage() {
  const actor = await requirePageActor('TEACHER')
  return <NotificationsPanel actor={actor} />
}
