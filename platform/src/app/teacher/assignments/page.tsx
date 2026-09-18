import { ClipboardList } from 'lucide-react'
import { EmptyState, PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listWorkspaceAssignments } from '@/server/queries/teacher-extras.queries'

export default async function TeacherAssignmentsPage() {
  const actor = await requirePageActor('TEACHER')
  const items = await listWorkspaceAssignments(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('teacherPages.assignmentsTitle')} />
      <PhaseNote phase={4} />
      {items.length === 0 ? (
        <EmptyState icon={ClipboardList} title="لا توجد واجبات بعد." description="إنشاء الواجبات والإسناد (طالب/مجموعة/فوج/عدة أفواج) وكتابة الطلاب إجاباتهم نصاً كرسائل — المرحلة 4." />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العنوان</TableHead>
              <TableHead>المحور</TableHead>
              <TableHead>آخر أجل</TableHead>
              <TableHead>الإجابات</TableHead>
              <TableHead>{t('dashboard.pendingCorrections')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-semibold">{a.title}</TableCell>
                <TableCell>{a.topic ?? '—'}</TableCell>
                <TableCell className="tabular">{formatDateTime(a.dueAt)}</TableCell>
                <TableCell className="tabular">{a.submissions}</TableCell>
                <TableCell className="tabular">{a.pending}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
