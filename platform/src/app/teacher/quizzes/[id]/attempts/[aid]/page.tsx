import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AttemptResult } from '@/components/domain/attempt-result'
import { AttemptReviewForm } from '@/components/domain/attempt-review-form'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getAttemptForTeacher } from '@/server/services/quizzes.service'

export default async function TeacherAttemptPage({ params }: { params: Promise<{ id: string; aid: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { aid } = await params
  let v
  try {
    v = await getAttemptForTeacher(await getDb(), actor, aid)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const essays = v.items.filter((i) => i.type === 'LONG_ANSWER' || (i.type === 'IMAGE' && i.options.length === 0)).filter((i) => i.answerId)
  return (
    <div className="space-y-6">
      <PageHeader
        title={v.quiz.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/teacher/quizzes/${v.quiz.id}`} className="hover:underline">
              {t('quizzes.attempts')}
            </Link>
            <span>·</span>
            {v.student ? (
              <Link href={`/teacher/students/${v.student.id}`} className="flex items-center gap-1 hover:underline">
                <Avatar name={v.student.fullName} size="sm" /> {v.student.fullName}
              </Link>
            ) : null}
            <span>· {formatDateTime(v.attempt.submittedAt ?? v.attempt.startedAt)}</span>
            <Badge variant={v.attempt.status === 'REVIEWED' ? 'success' : 'warning'}>{t(`quizzes.status${v.attempt.status}` as never) as string}</Badge>
            {v.attempt.finalScore != null ? (
              <Badge variant="success" className="text-base">
                {Number(v.attempt.finalScore)}/{Number(v.quiz.maxScore)}
              </Badge>
            ) : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AttemptResult view={v} showKeys />
        </div>
        {v.attempt.status !== 'IN_PROGRESS' ? (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>{essays.length ? t('quizzes.review') : t('quizzes.result')}</CardTitle>
            </CardHeader>
            <CardContent>
              {essays.length ? (
                <AttemptReviewForm attemptId={v.attempt.id} essays={essays.map((e) => ({ answerId: e.answerId!, prompt: e.prompt, answerText: e.answerText, points: e.points, score: e.score }))} autoScore={Number(v.attempt.autoScore ?? 0)} maxScore={Number(v.quiz.maxScore)} />
              ) : (
                <p className="text-sm text-muted-foreground">صُحّحت المحاولة آلياً بالكامل.</p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
