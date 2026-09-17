import { Search } from 'lucide-react'
import { RoleBadge, UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { USER_ROLES } from '@/server/db/schema/enums'
import { listUsers } from '@/server/services/admin.service'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const { rows, total } = await listUsers(await getDb(), actor, { search: sp.q, role: sp.role, limit: 100 })
  return (
    <>
      <PageHeader title={t('admin.usersTitle')} description={`${total}`} />
      <form className="mb-4 flex flex-wrap gap-2">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ''} placeholder={t('common.search')} className="ps-9" />
        </div>
        <Select name="role" defaultValue={sp.role ?? ''} className="w-auto min-w-40">
          <option value="">{t('common.all')}</option>
          {USER_ROLES.map((r) => (
            <option key={r} value={r}>
              {tEnum('roles', r)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {t('common.filter')}
        </Button>
      </form>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('common.name')}</TableHead>
            <TableHead>{t('common.email')}</TableHead>
            <TableHead>الدور</TableHead>
            <TableHead>{t('common.status')}</TableHead>
            <TableHead>آخر دخول</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-semibold">{u.fullName ?? '—'}</TableCell>
              <TableCell dir="ltr" className="text-start text-xs">
                {u.email}
              </TableCell>
              <TableCell>
                <RoleBadge role={u.role} />
              </TableCell>
              <TableCell>
                <UserStatusBadge status={u.status} />
              </TableCell>
              <TableCell className="text-xs tabular">{formatDateTime(u.lastLoginAt)}</TableCell>
              <TableCell className="text-end">{u.role !== 'SUPER_ADMIN' ? <UserStatusButton userId={u.id} status={u.status} /> : null}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  )
}
