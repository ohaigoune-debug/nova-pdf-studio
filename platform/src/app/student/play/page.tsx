import { HubTabs } from '@/components/student/hub-tabs'
import { redirect } from 'next/navigation'
import { PlayDashboard } from '@/components/play/dashboard'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPlayDashboard } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

export default async function PlayHomePage() {
  const actor = await requirePageActor('STUDENT')
  const data = await getPlayDashboard(await getDb(), actor)
  if (!data.profile.gradeCode) redirect('/student/play/setup')
  return (
    <>
      <HubTabs hub="train" />
      <PlayDashboard data={data} studentName={actor.fullName} />
    </>
  )
}
