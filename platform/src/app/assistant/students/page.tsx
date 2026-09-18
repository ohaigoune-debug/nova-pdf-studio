import { Search, Users } from 'lucide-react'
import Link from 'next/link'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Avatar, EmptyState, PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { ENROLLMENT_STATUSES } from '@/server/db/schema/enums'
import { listGroups } from '@/server/services/groups.service'
import { listTeacherStudents } from '@/server/services/students.service'

/** طلاب الأستاذ من منظور المساعد: الاسم، الفوج، الحالة، وعدد الغيابات غير المبررة. لا هاتف ولا علامات. */
export default async function AssistantStudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; groupId?: string; status?: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
  const sp = await searchParams
  const db = await getDb()
  const [students, groups] = await Promise.all([listTeacherStudents(db, actor, { search: sp.q, groupId: sp.groupId, status: sp.status }), listGroups(db, actor, { includeArchived: true })])
  return (
    <>
      <PageHeader title={t('assistant.studentsTitle')} description={`${students.length} ${t('common.students')}`} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative">
          <Search className="absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q ?? ''} placeholder={t('teacherPages.searchStudents')} className="ps-9" />
        </div>
        <Select name="groupId" defaultValue={sp.groupId ?? ''}>
          <option value="">{t('common.all')} — {t('common.groups')}</option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ''}>
          <option value="">{t('common.all')} — {t('common.status')}</option>
          {ENROLLMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {tEnum('enrollmentStatus', s)}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="secondary">
          {t('common.filter')}
        </Button>
      </form>
      {students.length === 0 ? (
        <EmptyState icon={Users} title={t('teacherPages.noStudents')} />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('common.student')}</TableHead>
              <TableHead>{t('common.groups')}</TableHead>
              <TableHead>{t('assistant.unexcusedShort')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((s) => (
              <TableRow key={s.studentId}>
                <TableCell>
                  <Link href={`/assistant/students/${s.studentId}`} className="flex items-center gap-2 hover:underline">
                    <Avatar name={s.fullName} size="sm" />
                    <span className="font-semibold">{s.fullName}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {s.groups.map((g) => (
                      <span key={g.groupStudentId} className="inline-flex items-center gap-1 text-xs">
                        {g.groupName}
                        <EnrollmentStatusBadge status={g.status} />
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="tabular">
                  {s.groups.map((g) => (
                    <span key={g.groupStudentId} className={g.unexcused > 0 ? 'me-2 font-bold text-destructive' : 'me-2'}>
                      {g.unexcused}
                    </span>
                  ))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
