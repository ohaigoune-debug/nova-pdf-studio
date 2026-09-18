import { Pencil } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DeleteQuizButton } from '@/components/domain/quiz-actions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getQuizForTeacher } from '@/server/services/quizzes.service'

export default async function TeacherQuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  let q
  try {
    q = await getQuizForTeacher(await getDb(), actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const done = q.attempts.filter((a) => a.status === 'REVIEWED')
  const avg = done.length ? Math.round((done.reduce((s, a) => s + Number(a.finalScore ?? 0), 0) / done.length) * 10) / 10 : null
  const pending = q.attempts.filter((a) => a.status === 'SUBMITTED').length
  const typeLabel = (type: string) => t(`quizzes.type${type}` as never) as string
  return (
    <div className="space-y-6">
      <PageHeader
        title={q.title}
        description={[q.topic, q.timeLimitMinutes ? `${q.timeLimitMinutes} د` : null, `${q.maxAttempts} محاولة`, q.dueAt ? `${t('quizzes.dueAt')}: ${formatDateTime(q.dueAt)}` : null, q.isPublic ? 'عام' : q.groupNames.map((g) => g.name).join('، ')].filter(Boolean).join(' · ')}
        actions={
          <>
            {q.publishedAt ? <Badge variant="success">{t('contentMgmt.published')}</Badge> : <Badge variant="warning">{t('contentMgmt.unpublished')}</Badge>}
            <Button asChild variant="outline">
              <Link href={`/teacher/quizzes/${q.id}/edit`}>
                <Pencil className="size-4" /> {t('common.edit')}
              </Link>
            </Button>
            <DeleteQuizButton id={q.id} />
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('quizzes.questions')} value={q.questions.length} hint={`/${Number(q.maxScore)}`} />
        <StatCard label={t('assignments.student')} value={q.isPublic ? 'عام' : q.eligible} />
        <StatCard label={t('quizzes.attempts')} value={q.attempts.filter((a) => a.status !== 'IN_PROGRESS').length} tone="success" />
        <StatCard label={t('quizzes.pendingReview')} value={pending} tone={pending ? 'warning' : 'default'} hint={avg !== null ? `${t('quizzes.average')}: ${avg}/${Number(q.maxScore)}` : undefined} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('quizzes.attempts')}</CardTitle>
        </CardHeader>
        <CardContent>
          {q.attempts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.student')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('quizzes.autoScore')}</TableHead>
                  <TableHead>{t('quizzes.result')}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {q.attempts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      <Link href={`/teacher/students/${a.studentId}`} className="flex items-center gap-2 hover:underline">
                        <Avatar name={a.fullName} size="sm" /> <span className="font-semibold">{a.fullName}</span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={a.status === 'REVIEWED' ? 'success' : a.status === 'SUBMITTED' ? 'warning' : 'muted'}>{t(`quizzes.status${a.status}` as never) as string}</Badge>
                    </TableCell>
                    <TableCell className="text-xs tabular">{formatDateTime(a.submittedAt ?? a.startedAt)}</TableCell>
                    <TableCell className="tabular">{a.autoScore != null ? Number(a.autoScore) : '—'}</TableCell>
                    <TableCell className="font-bold tabular">{a.finalScore != null ? `${Number(a.finalScore)}/${Number(q.maxScore)}` : '—'}</TableCell>
                    <TableCell className="text-end">
                      {a.status !== 'IN_PROGRESS' ? (
                        <Button asChild size="sm" variant={a.status === 'SUBMITTED' ? 'default' : 'ghost'}>
                          <Link href={`/teacher/quizzes/${q.id}/attempts/${a.id}`}>{a.status === 'SUBMITTED' ? t('quizzes.review') : t('assignments.open')}</Link>
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('quizzes.questions')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2 text-sm">
            {q.questions.map((qq, i) => (
              <li key={qq.id} className="flex items-start gap-2">
                <span className="text-muted-foreground tabular">{i + 1}.</span>
                <span className="flex-1">{qq.prompt}</span>
                <Badge variant="muted">{typeLabel(qq.type)}</Badge>
                <span className="text-xs text-muted-foreground tabular">{qq.points}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
