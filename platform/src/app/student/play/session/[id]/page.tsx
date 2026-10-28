import { PlayCardGame } from '@/components/play/play-card-game'
import { PlayGame } from '@/components/play/play-game'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { subjectName, type PlayChallengeType } from '@/server/play/constants'
import { getPlayProfile, getPlayRules, getSessionView, levelFor } from '@/server/services/play.service'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * جولة MADRASADZ PLAY. الافتراضي واجهة البطاقات؛ ‎?view=classic‎ يعرض الواجهة السابقة كما هي
 * (رجوع فوري دون نشر). الواجهتان تستعملان التصحيح والتسجيل والصلاحيات نفسها.
 */
export default async function PlaySessionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string | string[] }> }) {
  const { id } = await params
  const { view: viewParam } = await searchParams
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  let view
  try {
    view = await getSessionView(db, actor, id)
  } catch (e) {
    if (e instanceof AppError) notFound()
    throw e
  }
  const profile = await getPlayProfile(db, actor)
  const name = view.session.subjectCode ? subjectName(view.session.subjectCode) : 'مواد متعددة'
  const backHref = view.session.subjectCode ? `/student/play/subject/${view.session.subjectCode}` : '/student/play'
  const session = { ...view.session, expiresAt: view.session.expiresAt ? view.session.expiresAt.toISOString() : null }

  if (viewParam === 'classic') {
    return <PlayGame session={session} questions={view.questions} prefs={profile.prefs} subjectName={name} backHref={backHref} />
  }

  const level = levelFor(await getPlayRules(db), profile.xpTotal)
  return (
    <PlayCardGame
      session={session}
      questions={view.questions}
      prefs={profile.prefs}
      subjectName={name}
      backHref={backHref}
      retry={{ challengeType: view.session.challengeType as PlayChallengeType, subjectCode: view.session.subjectCode, unitCode: view.session.unitCode, lessonId: view.session.lessonId }}
      level={{ title: level.title, progressPct: level.progressPct, nextMinXp: level.nextMinXp }}
      xpTotal={profile.xpTotal}
    />
  )
}
