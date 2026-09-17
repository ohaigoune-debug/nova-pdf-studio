import { GraduationCap } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentGrades } from '@/server/queries/student-extras.queries'

export default async function StudentGradesPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentGrades(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('nav.grades')} description="تظهر العلامات بعد اعتمادها من الأستاذ فقط." />
      <PhaseNote phase={5} />
      {items.length === 0 ? (
        <EmptyState icon={GraduationCap} title="لا توجد علامات معتمدة بعد." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((g) => (
            <Card key={g.id}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold">{g.assignmentTitle ?? 'تقييم'}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(g.approvedAt ?? g.createdAt)}</p>
                  </div>
                  <p className="text-2xl font-extrabold tabular">
                    {g.score}
                    <span className="text-sm text-muted-foreground">/{g.maxScore}</span>
                  </p>
                </div>
                {g.feedbackStrengths.length ? (
                  <div>
                    <p className="text-xs font-bold text-success">{t('studentPages.strengths')}</p>
                    <ul className="list-disc ps-5 text-sm">
                      {g.feedbackStrengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {g.feedbackImprovements.length ? (
                  <div>
                    <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('studentPages.improvements')}</p>
                    <ul className="list-disc ps-5 text-sm">
                      {g.feedbackImprovements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {g.teacherNotes ? <p className="rounded-md bg-muted p-2 text-sm">{g.teacherNotes}</p> : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
