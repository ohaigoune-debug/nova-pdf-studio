import { ClipboardList } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentAssignments } from '@/server/queries/student-extras.queries'

export default async function StudentAssignmentsPage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentAssignments(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('nav.assignments')} />
      <PhaseNote phase={4} />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد واجبات مسندة إليك حالياً." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>المحور</TableHead>
              <TableHead>آخر أجل</TableHead>
              <TableHead>{t('common.status')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold">{a.title}</TableCell>
                <TableCell>{a.topic ?? '—'}</TableCell>
                <TableCell className="tabular">{formatDateTime(a.dueAt)}</TableCell>
                <TableCell>{a.submissionStatus ? <Badge variant="success">{a.submissionStatus}</Badge> : <Badge variant="warning">لم يُرسَل</Badge>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
