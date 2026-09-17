import { AlertTriangle, CalendarCheck, CalendarX, ClipboardList, KeyRound, ScanLine, Users, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { CloseSessionButton } from '@/components/domain/close-session-button'
import { StartSessionDialog } from '@/components/domain/start-session-dialog'
import { EnrollmentStatusBadge, SessionStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, EmptyState, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatClock, formatDateTime, formatTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { teacherDashboard } from '@/server/queries/teacher-dashboard.queries'
import { listGroups } from '@/server/services/groups.service'

const actionLabels: Record<string, string> = {
  'session.start': 'بدأ حصة',
  'session.close': 'أنهى حصة',
  'session.cancel': 'ألغى حصة',
  'group.create': 'أنشأ فوجاً',
  'group.update': 'عدّل فوجاً',
  'group.archive': 'أرشف فوجاً',
  'codes.generate': 'ولّد أكواداً',
  'codes.disable': 'عطّل كوداً',
  'codes.cancel_batch': 'ألغى دفعة أكواد',
  'attendance.excuse': 'برّر غياباً',
  'attendance.manual': 'عدّل حضوراً',
  'enrollment.redeem_code': 'انضم طالب بكود',
  'enrollment.suspend_absence': 'تعليق تلقائي بسبب الغياب',
  'enrollment.reactivate': 'أعاد تفعيل طالب',
  'enrollment.status': 'غيّر حالة تسجيل',
  'teacher.create': 'إنشاء حساب أستاذ'
}

export default async function TeacherHomePage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [d, groups] = await Promise.all([teacherDashboard(db, actor), listGroups(db, actor)])
  const groupOptions = groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name, hasOpenSession: g.hasOpenSession }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('dashboard.welcome', { name: actor.fullName })}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.teacherTitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StartSessionDialog groups={groupOptions} />
          <Button asChild variant="outline">
            <Link href="/teacher/scanner">
              <ScanLine className="size-4" /> {t('dashboard.openScanner')}
            </Link>
          </Button>
        </div>
      </div>

      {d.openSessions.map((s) => (
        <Alert key={s.id} tone="success" title={t('dashboard.openSessionNow')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {s.groupName} {s.title ? `— ${s.title}` : ''} · {t('sessions.started')} {formatTime(s.startedAt)}
            </span>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href={`/teacher/scanner?session=${s.id}`}>{t('dashboard.openScanner')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/teacher/sessions/${s.id}`}>{t('common.details')}</Link>
              </Button>
              <CloseSessionButton sessionId={s.id} />
            </div>
          </div>
        </Alert>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.groupsCount')} value={d.groupsCount} icon={UsersRound} />
        <StatCard label={t('dashboard.studentsCount')} value={d.studentsCount} hint={d.suspendedCount ? `${d.suspendedCount} معلّق` : undefined} icon={Users} />
        <StatCard label={t('dashboard.attendanceToday')} value={d.attendanceToday} hint={`${t('dashboard.attendanceRate')} (7 أيام): ${percent(d.weeklyAttendanceRate)}`} icon={CalendarCheck} tone="success" />
        <StatCard label={t('dashboard.absencesToday')} value={d.absencesToday} icon={CalendarX} tone={d.absencesToday > 0 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('dashboard.todaySessions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.scheduledToday.length === 0 && d.todaySessions.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="لا توجد حصص مجدولة اليوم." />
            ) : (
              <ul className="divide-y">
                {d.scheduledToday.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <p className="font-bold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatClock(g.startTime)} {g.room ? `· ${g.room}` : ''}
                      </p>
                    </div>
                    {g.hasOpenSession && g.openSessionId ? (
                      <Button asChild size="sm">
                        <Link href={`/teacher/scanner?session=${g.openSessionId}`}>{t('dashboard.openScanner')}</Link>
                      </Button>
                    ) : (
                      <StartSessionDialog groups={groupOptions} defaultGroupId={g.id} size="sm" variant="outline" />
                    )}
                  </li>
                ))}
                {d.todaySessions
                  .filter((s) => s.status !== 'OPEN')
                  .map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                      <div>
                        <p className="font-bold">
                          {s.groupName} {s.title ? `— ${s.title}` : ''}
                        </p>
                        <p className="text-xs text-muted-foreground">{formatTime(s.scheduledAt)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <SessionStatusBadge status={s.status} />
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/teacher/sessions/${s.id}`}>{t('common.details')}</Link>
                        </Button>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.quickActions')}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href="/teacher/scanner">
                <ScanLine className="size-5" />
                <span className="text-xs">{t('dashboard.openScanner')}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href="/teacher/codes">
                <KeyRound className="size-5" />
                <span className="text-xs">{t('dashboard.generateCodes')}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href="/teacher/groups/new">
                <UsersRound className="size-5" />
                <span className="text-xs">{t('groups.new')}</span>
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-auto flex-col gap-1 py-3">
              <Link href="/teacher/assignments">
                <ClipboardList className="size-5" />
                <span className="text-xs">{t('dashboard.addAssignment')}</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" /> {t('dashboard.strugglingStudents')}
            </CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/teacher/students">{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {d.atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">لا يوجد طلاب معرّضون للتعليق حالياً.</p>
            ) : (
              <ul className="divide-y">
                {d.atRisk.map((s) => (
                  <li key={`${s.studentId}-${s.groupName}`} className="flex items-center justify-between gap-2 py-2">
                    <Link href={`/teacher/students/${s.studentId}`} className="min-w-0 hover:underline">
                      <p className="truncate font-semibold">{s.fullName}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.groupName} · {s.unexcused}/{s.max} {t('groups.unexcusedCount')}
                      </p>
                    </Link>
                    <EnrollmentStatusBadge status={s.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
            ) : (
              <ul className="space-y-2">
                {d.recentActivity.map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2 text-sm">
                    <span>
                      <span className="font-semibold">{a.actorName ?? '—'}</span> {actionLabels[a.action] ?? a.action}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular">{formatDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
