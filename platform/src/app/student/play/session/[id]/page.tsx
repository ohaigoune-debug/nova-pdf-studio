import { PlayGame } from '@/components/play/play-game'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { subjectName } from '@/server/play/constants'
import { getPlayProfile, getSessionView } from '@/server/services/play.service'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function PlaySessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
  return (
    <PlayGame
      session={{ ...view.session, expiresAt: view.session.expiresAt ? view.session.expiresAt.toISOString() : null }}
      questions={view.questions}
      prefs={profile.prefs}
      subjectName={name}
      backHref={backHref}
    />
  )
}
