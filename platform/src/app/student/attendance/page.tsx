import { CalendarCheck, CalendarX, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { AttendanceHistoryTable } from '@/components/domain/attendance-history-table'
import { Button } from '@/components/ui/button'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentAttendance, summarizeAttendance } from '@/server/services/attendance.service'

export default async function StudentAttendancePage() {
  const actor = await requirePageActor('STUDENT')
  const items = await listStudentAttendance(await getDb(), actor, actor.studentId!, { limit: 200 })
  const s = summarizeAttendance(items)
  return (
    <>
      <PageHeader
        title={t('studentPages.attendanceRecord')}
        actions={
          <Button asChild>
            <Link href="/student/attendance/card">{t('nav.attendanceCard')}</Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.attendanceRate')} value={percent(s.rate)} icon={CalendarCheck} tone="success" />
        <StatCard label={t('attendanceStatus.LATE')} value={s.late} icon={Clock} tone="warning" />
        <StatCard label={t('attendanceStatus.EXCUSED')} value={s.excused} icon={CheckCircle2} />
        <StatCard label={t('attendanceStatus.UNEXCUSED')} value={s.unexcused} icon={CalendarX} tone={s.unexcused >= 3 ? 'destructive' : 'default'} />
      </div>
      <AttendanceHistoryTable items={items} />
    </>
  )
}
