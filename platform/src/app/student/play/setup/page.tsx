import { PlayProfileForm } from '@/components/play/profile-form'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { PLAY_GRADES } from '@/server/play/constants'
import { getPlayProfile, suggestedPlayGrade } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

export default async function PlaySetupPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const profile = await getPlayProfile(db, actor)
  // السنة من الحساب حين لا تُعرف الشعبة: التلميذ يختار الشعبة فقط
  const gradeCode = profile.gradeCode ?? (await suggestedPlayGrade(db, actor))
  return (
    <>
      <PageHeader title="MADRASADZ PLAY — ملفك الدراسي" description="اختر سنتك الدراسية وشعبتك لنعرض لك المواد والدروس المناسبة فقط." />
      <PlayProfileForm grades={PLAY_GRADES.filter((g) => g.isActive).map((g) => ({ ...g, streams: [...g.streams] }))} current={{ gradeCode, streamCode: profile.streamCode }} />
    </>
  )
}
