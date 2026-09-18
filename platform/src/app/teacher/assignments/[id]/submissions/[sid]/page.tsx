import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AiReviewPanel } from '@/components/domain/ai-review-panel'
import { SubmissionThread } from '@/components/domain/submission-thread'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getLatestAiEvaluation } from '@/server/services/ai.service'
import { getSubmissionForTeacher } from '@/server/services/assignments.service'
import { getRubric } from '@/server/services/rubrics.service'

export default async function TeacherSubmissionPage({ params }: { params: Promise<{ id: string; sid: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { sid } = await params
  const db = await getDb()
  let v
  try {
    v = await getSubmissionForTeacher(db, actor, sid)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [rubric, evaluation] = await Promise.all([
    v.assignment.rubricId ? getRubric(db, actor, v.assignment.rubricId).catch(() => null) : Promise.resolve(null),
    v.submission.status === 'DRAFT' ? Promise.resolve(null) : getLatestAiEvaluation(db, actor, sid)
  ])
  const late = v.submission.submittedAt && v.assignment.dueAt && v.submission.submittedAt > v.assignment.dueAt
  return (
    <div className="space-y-6">
      <PageHeader
        title={v.assignment.title}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/teacher/assignments/${v.assignment.id}`} className="hover:underline">
              {t('assignments.submissions')}
            </Link>
            <span>·</span>
            <Link href={`/teacher/students/${v.student.id}`} className="flex items-center gap-1 hover:underline">
              <Avatar name={v.student.fullName} size="sm" /> {v.student.fullName}
            </Link>
            <span>· {t('assignments.submittedAt')} {formatDateTime(v.submission.submittedAt)}</span>
            {late ? <Badge variant="destructive">{t('assignments.late')}</Badge> : null}
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('assignments.thread')}</CardTitle>
          </CardHeader>
          <CardContent>
            <SubmissionThread submissionId={v.submission.id} messages={v.messages} canReply placeholder={t('assignments.feedbackPlaceholder')} />
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>
              {t('assignments.review')} {v.grade ? <Badge variant="success">{Number(v.grade.score)}/{Number(v.grade.maxScore)}</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AiReviewPanel submissionId={v.submission.id} maxScore={v.assignment.maxScore} current={v.grade} rubricItems={rubric?.items} evaluation={evaluation} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
