import { Search } from 'lucide-react'
import { UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAllStudents } from '@/server/services/admin.service'

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { q } = await searchParams
  const rows = await listAllStudents(await getDb(), actor, { search: q })
  return (
    <>
      <PageHeader title={t('admin.studentsTitle')} description={`${rows.length}`} />
      <form className="mb-4 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={q ?? ''} placeholder={t('common.search')} className="ps-9" />
        </div>
        <Button type="submit" variant="secondary">
          {t('common.search')}
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('common.email')}</TableHead>
            <TableHead>{t('studentPages.studentType')}</TableHead>
            <TableHead>{t('common.groups')}</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>{t('studentPages.registeredAt')}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.studentId}>
              <TableCell className="font-semibold">{r.fullName}</TableCell>
              <TableCell dir="ltr" className="text-start text-xs">
                {r.email}
              </TableCell>
              <TableCell>
                <Badge variant="muted">{tEnum('studentTypes', r.studentType)}</Badge>
              </TableCell>
              <TableCell className="tabular">{r.activeGroups}</TableCell>
              <TableCell>
                <UserStatusBadge status={r.status} />
              </TableCell>
              <TableCell>{formatDate(r.createdAt)}</TableCell>
              <TableCell className="text-end">
                <UserStatusButton userId={r.userId} status={r.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
