import { Paperclip, Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AssignmentAiBulk } from '@/components/domain/assignment-ai-bulk'
import { DeleteAssignmentButton } from '@/components/domain/delete-assignment-button'
import { Markdown } from '@/components/domain/markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { assignmentAiSummary } from '@/server/services/ai.service'
import { getAssignmentForTeacher } from '@/server/services/assignments.service'

function statusBadge(status: string | null) {
  if (!status || status === 'DRAFT') return <Badge variant="muted">{status === 'DRAFT' ? t('assignments.draft') : t('assignments.notSubmitted')}</Badge>
  if (status === 'SUBMITTED' || status === 'AI_EVALUATED') return <Badge variant="warning">{t('assignments.pendingReview')}</Badge>
  if (status === 'REVIEWED') return <Badge variant="success">{t('assignments.reviewed')}</Badge>
  return <Badge variant="secondary">{status}</Badge>
}

export default async function TeacherAssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  let d
  let aiSummary
  try {
    const db = await getDb()
    d = await getAssignmentForTeacher(db, actor, id)
    aiSummary = await assignmentAiSummary(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const a = d.assignment
  const submitted = d.submissions.filter((s) => s.status && s.status !== 'DRAFT').length
  const reviewed = d.submissions.filter((s) => s.status === 'REVIEWED').length
  const pending = d.submissions.filter((s) => s.status === 'SUBMITTED' || s.status === 'AI_EVALUATED').length
  const completion = d.eligible > 0 ? Math.round((submitted / d.eligible) * 100) : null
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        description={[a.subject, a.topic, a.skillName, a.dueAt ? `${t('assignments.dueAt')}: ${formatDateTime(a.dueAt)}` : null].filter(Boolean).join(' · ')}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/teacher/assignments/${a.id}/edit`}>
                <Pencil className="size-4" /> {t('common.edit')}
              </Link>
            </Button>
            <DeleteAssignmentButton id={a.id} />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('assignments.student')} value={d.eligible} hint={[...d.targets.groups.map((g) => g.name), ...d.targets.students.map((s) => s.fullName)].join('، ')} />
        <StatCard label={t('assignments.submitted')} value={submitted} tone="success" />
        <StatCard label={t('assignments.pendingReview')} value={pending} tone={pending > 0 ? 'warning' : 'default'} />
        <StatCard label={t('assignments.completion')} value={percent(completion)} hint={<Progress value={completion} className="mt-1" />} />
      </div>
      <AssignmentAiBulk assignmentId={a.id} summary={aiSummary} />
      {a.description || a.attachmentName ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('assignments.description')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.description ? <Markdown body={a.description} className="space-y-2 text-[15px]" /> : null}
            {a.attachmentFileId && a.attachmentName ? (
              <a href={signFileUrl(a.attachmentFileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                <Paperclip className="size-4" /> {a.attachmentName}
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>
            {t('assignments.submissions')} ({reviewed}/{d.eligible} {t('assignments.reviewed')})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('common.student')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('assignments.submittedAt')}</TableHead>
                <TableHead>{t('assignments.grade')}</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {d.submissions.map((s) => (
                <TableRow key={s.studentId}>
                  <TableCell>
                    <Link href={`/teacher/students/${s.studentId}`} className="flex items-center gap-2 hover:underline">
                      <Avatar name={s.fullName} size="sm" /> <span className="font-semibold">{s.fullName}</span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    {statusBadge(s.status)}
                    {s.submittedAt && a.dueAt && s.submittedAt > a.dueAt ? <Badge variant="destructive" className="ms-1">{t('assignments.late')}</Badge> : null}
                  </TableCell>
                  <TableCell className="text-xs tabular">{formatDateTime(s.submittedAt)}</TableCell>
                  <TableCell className="font-bold tabular">{s.score ? `${Number(s.score)}/${Number(s.maxScore)}` : '—'}</TableCell>
                  <TableCell className="text-end">
                    {s.submissionId && s.status !== 'DRAFT' ? (
                      <Button asChild size="sm" variant={s.status === 'REVIEWED' ? 'ghost' : 'default'}>
                        <Link href={`/teacher/assignments/${a.id}/submissions/${s.submissionId}`}>{s.status === 'REVIEWED' ? t('assignments.open') : t('assignments.review')}</Link>
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
