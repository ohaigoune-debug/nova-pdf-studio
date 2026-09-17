import { ScanLine } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CancelSessionButton, CloseSessionButton } from '@/components/domain/close-session-button'
import { SessionStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { listSessionAttendance } from '@/server/services/attendance.service'
import { getSessionDetail } from '@/server/services/class-sessions.service'
import { SessionAttendanceTable } from './session-attendance'

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let s
  try {
    s = await getSessionDetail(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const rows = await listSessionAttendance(db, actor, s.id)
  const present = rows.filter((r) => r.status === 'PRESENT').length
  const late = rows.filter((r) => r.status === 'LATE').length
  const absent = rows.filter((r) => r.status === 'UNEXCUSED' || r.status === 'ABSENT').length
  const excused = rows.filter((r) => r.status === 'EXCUSED').length
  const unrecorded = rows.filter((r) => !r.status && r.enrollmentStatus === 'ACTIVE').length
  return (
    <div className="space-y-6">
      <PageHeader
        title={s.title ?? s.groupName}
        description={`${s.groupName} · ${formatDateTime(s.scheduledAt)} ${s.endedAt ? `— ${t('sessions.ended')} ${formatDateTime(s.endedAt)}` : ''} · ${t('groups.lateAfter')}: ${s.lateAfterMinutes}`}
        actions={
          <>
            <SessionStatusBadge status={s.status} />
            <Button asChild variant="ghost">
              <Link href={`/teacher/groups/${s.groupId}`}>{t('common.group')}</Link>
            </Button>
            {s.status === 'OPEN' ? (
              <>
                <Button asChild>
                  <Link href={`/teacher/scanner?session=${s.id}`}>
                    <ScanLine className="size-4" /> {t('sessions.openScanner')}
                  </Link>
                </Button>
                <CloseSessionButton sessionId={s.id} />
                <CancelSessionButton sessionId={s.id} />
              </>
            ) : null}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t('sessions.present')} value={present} tone="success" />
        <StatCard label={t('sessions.late')} value={late} tone="warning" />
        <StatCard label={t('sessions.absent')} value={absent} tone={absent > 0 ? 'destructive' : 'default'} />
        <StatCard label={t('sessions.excused')} value={excused} />
        <StatCard label={t('sessions.unrecorded')} value={unrecorded} />
      </div>
      <SessionAttendanceTable sessionId={s.id} sessionStatus={s.status} rows={rows} />
    </div>
  )
}
