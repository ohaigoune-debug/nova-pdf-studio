import { GroupStatusBadge } from '@/components/domain/status-badges'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAllGroups } from '@/server/services/admin.service'

export default async function AdminGroupsPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const rows = await listAllGroups(await getDb(), actor)
  return (
    <>
      <PageHeader title={t('admin.groupsTitle')} description={`${rows.length}`} />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.group')}</TableHead>
            <TableHead>{t('common.teacher')}</TableHead>
            <TableHead>{t('admin.workspaceName')}</TableHead>
            <TableHead>{t('groups.active')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('common.date')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((g) => (
            <TableRow key={g.id}>
              <TableCell className="font-semibold">{g.name}</TableCell>
              <TableCell>{g.teacherName}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{g.workspaceName}</TableCell>
              <TableCell className="tabular">{g.activeStudents}</TableCell>
              <TableCell>
                <GroupStatusBadge status={g.status} />
              </TableCell>
              <TableCell>{formatDate(g.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
