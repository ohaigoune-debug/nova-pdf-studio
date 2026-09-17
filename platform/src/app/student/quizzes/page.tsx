import { ListChecks } from 'lucide-react'
import { ContentGrid } from '@/components/domain/content-cards'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listPublicQuizzes, listStudentContent } from '@/server/queries/student-extras.queries'

export default async function StudentQuizzesPage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [quizzes, exercises] = await Promise.all([listPublicQuizzes(db), listStudentContent(db, actor, { types: ['QUIZ', 'EXERCISE'] })])
  return (
    <>
      <PageHeader title={t('nav.quizzes')} />
      <PhaseNote phase={5} />
      {quizzes.length > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes.map((q) => (
            <Card key={q.id}>
              <CardContent className="p-5">
                <p className="font-bold">{q.title}</p>
                <p className="text-sm text-muted-foreground">{q.description}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {q.topic ?? ''} {q.timeLimitMinutes ? `· ${q.timeLimitMinutes} د` : ''} · /{q.maxScore}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      {exercises.length === 0 && quizzes.length === 0 ? <EmptyState icon={ListChecks} title="لا توجد اختبارات متاحة بعد." /> : <ContentGrid items={exercises} />}
    </>
  )
}
