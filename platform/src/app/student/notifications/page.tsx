import { HubTabs } from '@/components/student/hub-tabs'
import { NotificationsPanel } from '@/components/domain/notifications-panel'
import { requirePageActor } from '@/server/auth/current-user'

export default async function StudentNotificationsPage() {
  const actor = await requirePageActor('STUDENT')
  return (
    <>
      <HubTabs hub="account" />
      <NotificationsPanel actor={actor} />
    </>
  )
}
