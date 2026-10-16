import { PlayProfileForm } from '@/components/play/profile-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PLAY_GRADES } from '@/server/play/constants'
import { getPlayProfile } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

export default async function PlaySetupPage() {
  const actor = await requirePageActor('STUDENT')
  const profile = await getPlayProfile(await getDb(), actor)
  return (
    <>
      <PageHeader title="MADRASADZ PLAY — ملفك الدراسي" description="اختر سنتك الدراسية وشعبتك لنعرض لك المواد والدروس المناسبة فقط." />
      <PlayProfileForm grades={PLAY_GRADES.filter((g) => g.isActive).map((g) => ({ ...g, streams: [...g.streams] }))} current={{ gradeCode: profile.gradeCode, streamCode: profile.streamCode }} />
    </>
  )
}
