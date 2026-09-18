import { CalendarCheck, CalendarX, CheckCircle2, Clock } from 'lucide-react'
import { notFound } from 'next/navigation'
import { AttendanceHistoryTable } from '@/components/domain/attendance-history-table'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, Avatar, PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDate, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { getStudentProfile } from '@/server/services/students.service'

/** ملف الطالب من منظور المساعد: الحضور والتسجيلات فقط (لا علامات، لا هاتف، لا تحليلات). */
export default async function AssistantStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
  const { id } = await params
  const db = await getDb()
  let p
  try {
    p = await getStudentProfile(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const a = p.attendance
  return (
    <div className="space-y-6">
      <PageHeader
        title={p.fullName}
        description={
          <span className="flex items-center gap-2">
            <Avatar name={p.fullName} size="sm" /> {[p.levelName, p.streamName].filter(Boolean).join(' · ') || t('teacherPages.studentProfile')}
          </span>
        }
      />
      {p.enrollments.some((e) => e.status === 'SUSPENDED_DUE_TO_ABSENCE') ? (
        <Alert tone="destructive" title={t('enrollmentStatus.SUSPENDED_DUE_TO_ABSENCE')}>
          {p.enrollments.find((e) => e.status === 'SUSPENDED_DUE_TO_ABSENCE')?.suspensionReason}
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('sessions.present')} value={a.present} icon={CheckCircle2} tone="success" />
        <StatCard label={t('sessions.late')} value={a.late} icon={Clock} tone="warning" />
        <StatCard label={t('sessions.excused')} value={a.excused} icon={CalendarCheck} />
        <StatCard label={t('assistant.unexcusedShort')} value={a.unexcused} icon={CalendarX} tone={a.unexcused > 0 ? 'destructive' : 'default'} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{t('teacherPages.enrollments')}</CardTitle>
        </CardHeader>
        <CardContent>
          {p.enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
          ) : (
            <ul className="divide-y">
              {p.enrollments.map((e) => (
                <li key={e.groupStudentId} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-bold">{e.groupName}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(e.enrolledAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm tabular">
                      {t('groups.unexcusedCount')}: <b className={e.unexcused >= e.maxUnexcused - 1 ? 'text-destructive' : ''}>{e.unexcused}</b>/{e.maxUnexcused}
                    </span>
                    <EnrollmentStatusBadge status={e.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {t('teacherPages.attendanceSummary')} · {percent(a.rate)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Progress value={a.rate} tone={a.rate !== null && a.rate < 70 ? 'warning' : 'success'} />
          <AttendanceHistoryTable items={p.recentAttendance} />
        </CardContent>
      </Card>
    </div>
  )
}
