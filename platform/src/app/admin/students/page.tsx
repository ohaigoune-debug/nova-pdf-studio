import { KeyRound, Search } from 'lucide-react'
import { notFound } from 'next/navigation'
import { CoursePicker } from '@/components/admin/course-picker'
import { CourseRosterView } from '@/components/admin/course-roster-view'
import { UserStatusBadge } from '@/components/domain/status-badges'
import { UserStatusButton } from '@/components/domain/user-status-button'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { listAllStudents } from '@/server/services/admin.service'
import { courseOptions, courseRoster, parseRosterFilters } from '@/server/services/course-roster.service'
import { tempPasswordStats } from '@/server/services/temp-login.service'

export const dynamic = 'force-dynamic'

type Q = { q?: string; course?: string; status?: string; source?: string; month?: string }

export default async function AdminStudentsPage({ searchParams }: { searchParams: Promise<Q> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const sp = await searchParams
  const db = await getDb()
  const options = await courseOptions(db, actor)
  const courseId = sp.course && options.some((o) => o.id === sp.course) ? sp.course : null
  if (sp.course && !courseId) notFound()

  const picker = (
    <div className="mb-5 rounded-xl border bg-card p-3">
      <label className="mb-1.5 block text-sm font-semibold">اختر دورة لترى تلاميذها وعددهم، وتصدّرهم أو تطبع فواتيرهم</label>
      <CoursePicker options={options.map((o) => ({ id: o.id, title: o.title, active: o.active, archived: o.status === 'ARCHIVED' }))} value={courseId} />
    </div>
  )

  /* تلاميذ دورة معيّنة (21 نوفمبر 2026) */
  if (courseId) {
    const filters = parseRosterFilters(sp)
    let data
    try {
      data = await courseRoster(db, actor, { courseId, ...filters })
    } catch (e) {
      if (isAppError(e)) notFound()
      throw e
    }
    return (
      <>
        <PageHeader title={t('admin.studentsTitle')} />
        {picker}
        <CourseRosterView course={data.course} stats={data.stats} rows={data.rows} matched={data.matched} filters={filters} />
      </>
    )
  }

  const q = sp.q
  const [rows, temp] = await Promise.all([listAllStudents(db, actor, { search: q }), tempPasswordStats(db)])
  return (
    <>
      <PageHeader title={t('admin.studentsTitle')} description={`${rows.length}`} />
      {picker}
      {/* من سجّل دون كلمة سر من صفحات الهبوط (18 نوفمبر 2026) */}
      <StatCard
        className="mb-4"
        icon={KeyRound}
        tone={temp.expired > 0 ? 'warning' : 'default'}
        label="حسابات بلا كلمة سر بعد (رمز دخول مؤقت)"
        value={temp.total}
        hint={`ينتهي رمزها خلال يومين: ${temp.warn} · انتهى رمزها ولم تُنشئ كلمة سر: ${temp.expired} — يصلهم تذكير بالإشعار، دون رسائل SMS.`}
      />
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
