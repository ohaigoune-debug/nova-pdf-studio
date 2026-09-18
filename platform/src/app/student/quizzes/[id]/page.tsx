import Link from 'next/link'
import { notFound } from 'next/navigation'
import { StartAttemptButton } from '@/components/domain/quiz-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getQuizForStudent } from '@/server/services/quizzes.service'

export default async function StudentQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { id } = await params
  let v
  try {
    v = await getQuizForStudent(await getDb(), actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const q = v.quiz
  const closed = q.dueAt ? q.dueAt < new Date() : false
  const canStart = !closed && v.used < q.maxAttempts
  const best = v.attempts.filter((a) => a.status === 'REVIEWED').reduce<number | null>((b, a) => (a.finalScore != null && (b === null || Number(a.finalScore) > b) ? Number(a.finalScore) : b), null)
  return (
    <div className="space-y-6">
      <PageHeader
        title={q.title}
        description={[q.topic, q.teacherName, `${v.questions.length} سؤال`, `/${Number(q.maxScore)}`, q.timeLimitMinutes ? `${q.timeLimitMinutes} د` : null, q.dueAt ? `${t('quizzes.dueAt')}: ${formatDateTime(q.dueAt)}` : null].filter(Boolean).join(' · ')}
        actions={best !== null ? <Badge variant="success" className="px-3 py-1 text-base">{t('quizzes.bestScore')}: {best}/{Number(q.maxScore)}</Badge> : null}
      />
      {q.description ? <Card><CardContent className="p-5 text-sm leading-7">{q.description}</CardContent></Card> : null}
      {v.inProgress ? (
        <Alert tone="info" title={t('quizzes.statusIN_PROGRESS')}>
          <Button asChild className="mt-2">
            <Link href={`/student/quizzes/${q.id}/attempt/${v.inProgress.id}`}>{t('quizzes.resume')}</Link>
          </Button>
        </Alert>
      ) : canStart ? (
        <div className="flex items-center gap-3">
          <StartAttemptButton quizId={q.id} />
          <span className="text-sm text-muted-foreground tabular">
            {t('quizzes.attemptsUsed')}: {v.used}/{q.maxAttempts}
          </span>
        </div>
      ) : (
        <Alert tone="warning">{closed ? t('errors.QUIZ_CLOSED') : t('errors.ATTEMPT_LIMIT')}</Alert>
      )}
      {v.attempts.filter((a) => a.status !== 'IN_PROGRESS').length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('quizzes.attempts')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {v.attempts
                .filter((a) => a.status !== 'IN_PROGRESS')
                .map((a) => (
                  <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="tabular">{formatDateTime(a.submittedAt)}</span>
                    <span className="flex items-center gap-2">
                      {a.status === 'REVIEWED' ? <Badge variant="success">{Number(a.finalScore)}/{Number(q.maxScore)}</Badge> : <Badge variant="warning">{t('quizzes.pendingEssay')}</Badge>}
                      <Button asChild size="sm" variant="ghost">
                        <Link href={`/student/quizzes/${q.id}/attempt/${a.id}`}>{t('quizzes.result')}</Link>
                      </Button>
                    </span>
                  </li>
                ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
