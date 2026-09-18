import { ListChecks } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listQuizzesForStudent } from '@/server/services/quizzes.service'

export default async function StudentQuizzesPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listQuizzesForStudent(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('nav.quizzes')} />
      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title="لا توجد اختبارات متاحة بعد." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((q) => {
            const closed = q.dueAt ? q.dueAt < new Date() : false
            return (
              <Link key={q.id} href={`/student/quizzes/${q.id}`} className="group">
                <Card className="h-full transition-shadow group-hover:shadow-md">
                  <CardContent className="space-y-2 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold group-hover:text-primary">{q.title}</h3>
                      {q.pending ? <Badge variant="warning">{t('quizzes.pendingReview')}</Badge> : q.bestScore != null ? <Badge variant="success">{Number(q.bestScore)}/{Number(q.maxScore)}</Badge> : q.inProgress ? <Badge>{t('quizzes.statusIN_PROGRESS')}</Badge> : closed ? <Badge variant="muted">{t('assignments.overdue')}</Badge> : null}
                    </div>
                    <p className="text-xs text-muted-foreground">{[q.topic, q.teacherName, q.isPublic ? 'عام' : null].filter(Boolean).join(' · ')}</p>
                    <p className="text-xs text-muted-foreground tabular">
                      {q.questionsCount} سؤال · /{Number(q.maxScore)} {q.timeLimitMinutes ? `· ${q.timeLimitMinutes} د` : ''} · {t('quizzes.attemptsUsed')}: {q.attemptsUsed}/{q.maxAttempts}
                    </p>
                    {q.dueAt ? (
                      <p className="text-xs text-muted-foreground">
                        {t('quizzes.dueAt')}: {formatDateTime(q.dueAt)}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}
