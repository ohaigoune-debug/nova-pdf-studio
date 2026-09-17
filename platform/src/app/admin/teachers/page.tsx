import { GraduationCap, Plus } from 'lucide-react'
import Link from 'next/link'
import { UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Button } from '@/components/ui/button'
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listTeachers } from '@/server/services/admin.service'

export default async function AdminTeachersPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const teachers = await listTeachers(await getDb(), actor)
  return (
    <>
      <PageHeader
        title={t('admin.teachersTitle')}
        actions={
          <Button asChild>
            <Link href="/admin/teachers/new">
              <Plus className="size-4" /> {t('admin.newTeacher')}
            </Link>
          </Button>
        }
      />
      {teachers.length === 0 ? (
        <EmptyState icon={GraduationCap} title={t('common.empty')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.teacher')}</TableHead>
              <TableHead>{t('admin.workspaceName')}</TableHead>
              <TableHead>{t('common.groups')}</TableHead>
              <TableHead>{t('common.students')}</TableHead>
              <TableHead>{t('common.status')}</TableHead>
              <TableHead>آخر دخول</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachers.map((tr) => (
              <TableRow key={tr.teacherId}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar name={tr.fullName ?? tr.email} size="sm" />
                    <span>
                      <span className="block font-semibold">{tr.fullName}</span>
                      <span className="block text-[11px] text-muted-foreground" dir="ltr">
                        {tr.email}
                      </span>
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{tr.workspaceName}</TableCell>
                <TableCell className="tabular">{tr.groupsCount}</TableCell>
                <TableCell className="tabular">{tr.studentsCount}</TableCell>
                <TableCell>
                  <UserStatusBadge status={tr.status} />
                </TableCell>
                <TableCell className="text-xs tabular">{formatDateTime(tr.lastLoginAt)}</TableCell>
                <TableCell className="text-end">
                  <UserStatusButton userId={tr.userId} status={tr.status} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
