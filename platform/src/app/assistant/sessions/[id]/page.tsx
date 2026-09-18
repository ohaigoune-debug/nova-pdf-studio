import { ScanLine } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CancelSessionButton, CloseSessionButton } from '@/components/domain/close-session-button'
import { SessionAttendanceTable } from '@/components/domain/session-attendance-table'
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

export default async function AssistantSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
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
            {s.status === 'OPEN' ? (
              <>
                <Button asChild>
                  <Link href={`/assistant/scanner?session=${s.id}`}>
                    <ScanLine className="size-4" /> {t('sessions.openScanner')}
                  </Link>
                </Button>
                <CloseSessionButton sessionId={s.id} basePath="/assistant" />
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
      {/* المساعد يسجّل الحضور يدوياً لكنه لا يبرّر الغياب (قرار الأستاذ) */}
      <SessionAttendanceTable sessionId={s.id} sessionStatus={s.status} rows={rows} basePath="/assistant" canExcuse={false} />
    </div>
  )
}
