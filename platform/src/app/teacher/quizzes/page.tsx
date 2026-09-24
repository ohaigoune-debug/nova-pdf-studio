import { ListChecks, Plus, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listQuizzesForTeacher } from '@/server/services/quizzes.service'

export default async function TeacherQuizzesPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listQuizzesForTeacher(await getDb(), actor)
  return (
    <>
      <PageHeader
        title={t('quizzes.title')}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/teacher/rubrics">{t('rubrics.title')}</Link>
            </Button>
            <Button asChild variant="gold">
              <Link href="/teacher/quizzes/generate">
                <Sparkles className="size-4" /> توليد بالذكاء الاصطناعي
              </Link>
            </Button>
            <Button asChild>
              <Link href="/teacher/quizzes/new">
                <Plus className="size-4" /> {t('quizzes.new')}
              </Link>
            </Button>
          </>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={t('quizzes.noQuizzes')}
          action={
            <Button asChild>
              <Link href="/teacher/quizzes/new">{t('quizzes.new')}</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('quizzes.titleField')}</TableHead>
              <TableHead>{t('quizzes.questions')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('quizzes.attempts')}</TableHead>
              <TableHead>{t('quizzes.pendingReview')}</TableHead>
              <TableHead>{t('quizzes.average')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((q) => (
              <TableRow key={q.id}>
                <TableCell>
                  <Link href={`/teacher/quizzes/${q.id}`} className="font-semibold hover:underline">
                    {q.title}
                  </Link>
                  {q.topic ? <span className="block text-xs text-muted-foreground">{q.topic}</span> : null}
                </TableCell>
                <TableCell className="tabular">
                  {q.questionsCount} · /{Number(q.maxScore)}
                </TableCell>
                <TableCell className="space-x-1 space-x-reverse">
                  {q.publishedAt ? <Badge variant="success">{t('contentMgmt.published')}</Badge> : <Badge variant="warning">{t('contentMgmt.unpublished')}</Badge>}
                  {q.isPublic ? <Badge variant="muted">عام</Badge> : null}
                </TableCell>
                <TableCell className="tabular">{q.attempts}</TableCell>
                <TableCell>{q.pending > 0 ? <Badge variant="warning">{q.pending}</Badge> : <span className="tabular">0</span>}</TableCell>
                <TableCell className="tabular">{q.average != null ? `${Math.round(Number(q.average) * 10) / 10}/${Number(q.maxScore)}` : '—'}</TableCell>
                <TableCell className="text-xs">{formatDate(q.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
