import { ListChecks } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWorkspaceQuizzes } from '@/server/queries/teacher-extras.queries'

export default async function TeacherQuizzesPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceQuizzes(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('teacherPages.quizzesTitle')} />
      <PhaseNote phase={5} />
      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title="لا توجد اختبارات بعد." description="محرك الاختبارات (MCQ، صح/خطأ، إجابة قصيرة/مقالية، ملء فراغ، مطابقة، سؤال بصورة) — المرحلة 5." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>المحور</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>{t('common.date')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-semibold">{q.title}</TableCell>
                <TableCell>{q.topic ?? '—'}</TableCell>
                <TableCell>{q.publishedAt ? <Badge variant="success">منشور</Badge> : <Badge variant="muted">مسودة</Badge>}</TableCell>
                <TableCell>{formatDate(q.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
