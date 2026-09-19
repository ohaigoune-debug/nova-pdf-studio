import { Paperclip } from 'lucide-react'
import { notFound } from 'next/navigation'
import { AnswerEditor } from '@/components/domain/answer-editor'
import { Markdown } from '@/components/domain/markdown'
import { SubmissionThread } from '@/components/domain/submission-thread'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { getAssignmentForStudent } from '@/server/services/assignments.service'

export default async function StudentAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('STUDENT')
  const { id } = await params
  let d
  try {
    d = await getAssignmentForStudent(await getDb(), actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const a = d.assignment
  const s = d.submission
  const submitted = !!s && s.status !== 'DRAFT'
  const overdue = a.dueAt ? a.dueAt < new Date() : false
  return (
    <div className="space-y-6">
      <PageHeader
        title={a.title}
        description={[a.subject, a.topic, a.teacherName, a.dueAt ? `${t('assignments.dueAt')}: ${formatDateTime(a.dueAt)}` : null].filter(Boolean).join(' · ')}
        actions={
          d.grade ? (
            <Badge variant="success" className="px-3 py-1 text-base">
              {t('assignments.grade')}: {Number(d.grade.score)}/{Number(d.grade.maxScore)}
            </Badge>
          ) : submitted ? (
            <Badge variant="secondary">{t('assignments.submitted')}</Badge>
          ) : overdue ? (
            <Badge variant="destructive">{t('assignments.overdue')}</Badge>
          ) : null
        }
      />
      {a.description || a.attachmentName ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('assignments.description')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {a.description ? <Markdown body={a.description} className="space-y-2" /> : null}
            {a.attachmentFileId && a.attachmentName ? (
              <a href={signFileUrl(a.attachmentFileId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                <Paperclip className="size-4" /> {a.attachmentName}
              </a>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {d.grade ? (
        <Alert tone="success" title={`${t('assignments.grade')}: ${Number(d.grade.score)}/${Number(d.grade.maxScore)}`}>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.grade.strengths.length ? (
              <div>
                <p className="text-xs font-bold text-success">{t('studentPages.strengths')}</p>
                <ul className="list-disc ps-5 text-sm">
                  {d.grade.strengths.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {d.grade.improvements.length ? (
              <div>
                <p className="text-xs font-bold text-amber-700 dark:text-amber-300">{t('studentPages.improvements')}</p>
                <ul className="list-disc ps-5 text-sm">
                  {d.grade.improvements.map((x, i) => (
                    <li key={i}>{x}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </Alert>
      ) : null}

      {!submitted ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('assignments.yourAnswer')}</CardTitle>
          </CardHeader>
          <CardContent>
            {overdue ? <Alert tone="warning" className="mb-3">{t('assignments.overdue')} — ستُعلَّم إجابتك كمتأخرة.</Alert> : null}
            <AnswerEditor assignmentId={a.id} title={a.title} initialText={s?.answerText ?? ''} serverSavedAt={s?.updatedAt ? new Date(s.updatedAt).getTime() : 0} />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{t('assignments.thread')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionThread submissionId={s.id} messages={d.messages} canReply placeholder={t('assignments.replyPlaceholder')} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
