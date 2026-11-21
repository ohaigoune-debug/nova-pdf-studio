import { ClipboardList } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAssignmentsForStudent } from '@/server/services/assignments.service'

function status(a: { status: string | null; score: string | null; dueAt: Date | null }) {
  if (a.status === 'REVIEWED') return <Badge variant="success">{t('assignments.reviewed')}</Badge>
  if (a.status === 'SUBMITTED' || a.status === 'AI_EVALUATED') return <Badge variant="secondary">{t('assignments.submitted')}</Badge>
  if (a.status === 'DRAFT') return <Badge variant="muted">{t('assignments.draft')}</Badge>
  if (a.dueAt && a.dueAt < new Date()) return <Badge variant="destructive">{t('assignments.overdue')}</Badge>
  return <Badge variant="warning">{t('assignments.notSubmitted')}</Badge>
}

export default async function StudentAssignmentsPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listAssignmentsForStudent(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('nav.assignments')} />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد واجبات مسندة إليك حالياً." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((a) => (
            <Link key={a.id} href={`/student/assignments/${a.id}`} className="group">
              <Card className="h-full transition-shadow group-hover:shadow-md">
                <CardContent className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold group-hover:text-primary">{a.title}</h3>
                    {status(a)}
                  </div>
                  <p className="text-xs text-muted-foreground">{[a.subject, a.topic, a.teacherName].filter(Boolean).join(' · ')}</p>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t('assignments.dueAt')}: <span className="tabular">{formatDateTime(a.dueAt)}</span>
                    </span>
                    {a.score ? (
                      <span className="font-extrabold tabular">
                        {Number(a.score)}/{Number(a.maxScore)}
                      </span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
