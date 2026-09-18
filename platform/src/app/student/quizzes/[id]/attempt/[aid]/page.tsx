import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AttemptResult } from '@/components/domain/attempt-result'
import { QuizPlayer } from '@/components/domain/quiz-player'
import { Badge } from '@/components/ui/badge'
import { Alert, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { getAttemptForStudent, getQuizForStudent } from '@/server/services/quizzes.service'

export default async function StudentAttemptPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { id, aid } = await params
  const db = await getDb()
  let v
  try {
    v = await getAttemptForStudent(db, actor, aid)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  if (v.attempt.status === 'IN_PROGRESS') {
    const q = await getQuizForStudent(db, actor, id)
    return (
      <div className="space-y-4">
        <PageHeader title={q.quiz.title} description={q.quiz.description ?? undefined} />
        <QuizPlayer attemptId={v.attempt.id} expiresAt={v.attempt.expiresAt ? v.attempt.expiresAt.toISOString() : null} questions={q.questions.map((x) => ({ ...x, imageUrl: x.imageFileId ? signFileUrl(x.imageFileId, 3600) : null }))} />
      </div>
    )
  }
  const reviewed = v.attempt.status === 'REVIEWED'
  return (
    <div className="space-y-4">
      <PageHeader
        title={v.quiz.title}
        description={
          <Link href={`/student/quizzes/${id}`} className="hover:underline">
            {t('quizzes.attempts')}
          </Link>
        }
        actions={reviewed ? <Badge variant="success" className="px-3 py-1 text-base">{t('quizzes.yourScore')}: {Number(v.attempt.finalScore)}/{Number(v.quiz.maxScore)}</Badge> : <Badge variant="warning">{t('quizzes.pendingEssay')}</Badge>}
      />
      {!reviewed ? <Alert tone="info">{t('quizzes.pendingEssay')}. {t('quizzes.autoScore')}: {Number(v.attempt.autoScore ?? 0)}</Alert> : null}
      <AttemptResult view={v} showKeys={reviewed} />
    </div>
  )
}
