import { ClipboardList, Plus } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/misc'
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
      <PageHeader
        title={t('assignments.title')}
        actions={
          <Button asChild>
            <Link href="/teacher/assignments/new">
              <Plus className="size-4" /> {t('assignments.new')}
            </Link>
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={t('assignments.noAssignments')}
          action={
            <Button asChild>
              <Link href="/teacher/assignments/new">{t('assignments.new')}</Link>
            </Button>
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('assignments.titleField')}</TableHead>
              <TableHead>{t('assignments.topic')}</TableHead>
              <TableHead>{t('assignments.dueAt')}</TableHead>
              <TableHead>{t('assignments.submissions')}</TableHead>
              <TableHead>{t('assignments.pendingReview')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link href={`/teacher/assignments/${a.id}`} className="font-semibold hover:underline">
                    {a.title}
                  </Link>
                </TableCell>
                <TableCell>{a.topic ?? '—'}</TableCell>
                <TableCell className="tabular">
                  {formatDateTime(a.dueAt)} {a.dueAt && a.dueAt < new Date() ? <Badge variant="muted">{t('assignments.overdue')}</Badge> : null}
                </TableCell>
                <TableCell className="tabular">{a.submissions}</TableCell>
                <TableCell>{a.pending > 0 ? <Badge variant="warning">{a.pending}</Badge> : <span className="tabular">0</span>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
