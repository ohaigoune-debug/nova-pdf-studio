import { HubTabs } from '@/components/student/hub-tabs'
import { redirect } from 'next/navigation'
import { PlayDashboard } from '@/components/play/dashboard'
import { PlayAccessBanner } from '@/components/play/exams/access-banner'
import { PlaySectionsNav } from '@/components/play/exams/sections-nav'
import { PlayHome } from '@/components/play/play-home'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isIosStudyOnly } from '@/server/lib/ios-study'
import { subjectName } from '@/server/play/constants'
import { getPlayAccess } from '@/server/services/play-access.service'
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
  // الوصول (عرض فقط؛ الخادم يفرضه عند البدء والإجابة): مشترك الدورة الملائمة، أو تجربة 72 ساعة
  const [access, ios] = await Promise.all([getPlayAccess(db, actor, { gradeCode: data.profile.gradeCode, streamCode: data.profile.streamCode, subjectCode }), isIosStudyOnly()])
  return (
    <>
      <HubTabs hub="train" />
      <div className="space-y-8">
        <PlayAccessBanner access={access} subjectName={subjectCode ? subjectName(subjectCode) : null} iosStudyOnly={ios} />
        <PlayHome key={subjectCode ?? 'none'} data={data} subjectCode={subjectCode} units={units} />
        <PlaySectionsNav active="lessons" subjectCode={subjectCode} />
        <PlayDashboard data={data} studentName={actor.fullName} />
      </div>
    </>
  )
}
