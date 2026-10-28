import { HubTabs } from '@/components/student/hub-tabs'
import { redirect } from 'next/navigation'
import { PlayDashboard } from '@/components/play/dashboard'
import { PlayHome } from '@/components/play/play-home'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getPlayDashboard, listLessonsFor } from '@/server/services/play.service'

export const dynamic = 'force-dynamic'

/**
 * لعبة الأسئلة: الشاشة الأولى كما في حزمة الهوية المعتمدة (السنة، المادة، الدرس، «ابدأ اللعب»)،
 * ثم لوحة اللعبة السابقة كاملة (المستوى، التحدي اليومي، الأخطاء، المواد، الشارات، آخر التحديات).
 */
export default async function PlayHomePage({ searchParams }: { searchParams: Promise<{ subject?: string | string[] }> }) {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const data = await getPlayDashboard(db, actor)
  if (!data.profile.gradeCode) redirect('/student/play/setup')
  const { subject: subjectParam } = await searchParams
  const playable = data.subjects.filter((s) => s.questions > 0)
  const wanted = typeof subjectParam === 'string' ? subjectParam.toUpperCase() : null
  const subjectCode =
    [wanted, data.activeSession?.subjectCode, data.recentSessions.find((s) => s.subjectCode)?.subjectCode].find((c) => c && playable.some((s) => s.code === c)) ?? playable[0]?.code ?? null
  const units = subjectCode ? await listLessonsFor(db, data.profile.gradeCode, data.profile.streamCode, subjectCode, actor.studentId ?? undefined) : []
  return (
    <>
      <HubTabs hub="train" />
      <div className="space-y-8">
        <PlayHome key={subjectCode ?? 'none'} data={data} subjectCode={subjectCode} units={units} />
        <PlayDashboard data={data} studentName={actor.fullName} />
      </div>
    </>
  )
}
