import { AlertTriangle, CalendarCheck, CalendarX, ScanLine, Users } from 'lucide-react'
import Link from 'next/link'
import { CloseSessionButton } from '@/components/domain/close-session-button'
import { StartSessionDialog } from '@/components/domain/start-session-dialog'
import { EnrollmentStatusBadge, SessionStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, EmptyState, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime, formatTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { assistantDashboard } from '@/server/queries/assistant.queries'
import { getAssistantContext } from '@/server/services/assistants.service'
import { listGroups } from '@/server/services/groups.service'

export default async function AssistantHomePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const actor = await requirePageActor('ASSISTANT')
  const { welcome } = await searchParams
  const db = await getDb()
  const [ctx, d, groups] = await Promise.all([getAssistantContext(db, actor), assistantDashboard(db, actor), listGroups(db, actor)])
  const groupOptions = groups.filter((g) => g.status === 'ACTIVE').map((g) => ({ id: g.id, name: g.name, hasOpenSession: g.hasOpenSession }))

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('dashboard.welcome', { name: actor.fullName })}</h1>
          <p className="text-sm text-muted-foreground">{ctx ? t('assistant.assistantOf', { teacher: ctx.teacherName }) : t('assistant.dashboardTitle')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StartSessionDialog groups={groupOptions} />
          <Button asChild variant="outline">
            <Link href="/assistant/scanner">
              <ScanLine className="size-4" /> {t('assistant.quickScan')}
            </Link>
          </Button>
        </div>
      </div>

      {welcome === '1' && ctx ? <Alert tone="success">{t('assistant.joinSuccess', { teacher: ctx.teacherName })}</Alert> : null}

      {d.openSessions.map((s) => (
        <Alert key={s.id} tone="success" title={t('dashboard.openSessionNow')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {s.groupName} {s.title ? `— ${s.title}` : ''} · {t('sessions.started')} {formatTime(s.startedAt ?? s.scheduledAt)}
            </span>
            <div className="flex gap-2">
              <Button asChild size="sm">
                <Link href={`/assistant/scanner?session=${s.id}`}>{t('dashboard.openScanner')}</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href={`/assistant/sessions/${s.id}`}>{t('common.details')}</Link>
              </Button>
              <CloseSessionButton sessionId={s.id} basePath="/assistant" />
            </div>
          </div>
        </Alert>
      ))}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label={t('dashboard.studentsCount')} value={d.studentsCount} hint={d.suspendedCount ? `${d.suspendedCount} ${t('groups.suspended')}` : undefined} icon={Users} />
        <StatCard label={t('dashboard.attendanceToday')} value={d.attendanceToday} hint={`${t('dashboard.attendanceRate')} (7 أيام): ${percent(d.weeklyAttendanceRate)}`} icon={CalendarCheck} tone="success" />
        <StatCard label={t('dashboard.absencesToday')} value={d.absencesToday} icon={CalendarX} tone={d.absencesToday > 0 ? 'warning' : 'default'} />
        <StatCard label={t('assistant.atRisk')} value={d.atRisk.length} icon={AlertTriangle} tone={d.atRisk.length > 0 ? 'destructive' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('groups.recentSessions')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.recentSessions.length === 0 ? (
              <EmptyState icon={CalendarCheck} title={t('sessions.noSessions')} />
            ) : (
              <ul className="divide-y">
                {d.recentSessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/assistant/sessions/${s.id}`} className="font-bold hover:underline">
                        {s.groupName} {s.title ? `— ${s.title}` : ''}
                      </Link>
                      <p className="text-xs text-muted-foreground tabular">{formatDateTime(s.scheduledAt)}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs tabular">
                      <span className="text-success">{s.present}</span>/<span className="text-amber-600">{s.late}</span>/<span className="text-destructive">{s.absent}</span>
                      <SessionStatusBadge status={s.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('assistant.atRisk')}</CardTitle>
          </CardHeader>
          <CardContent>
            {d.atRisk.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
            ) : (
              <ul className="divide-y">
                {d.atRisk.map((r) => (
                  <li key={`${r.studentId}-${r.groupName}`} className="flex items-center justify-between gap-3 py-3">
                    <div>
                      <Link href={`/assistant/students/${r.studentId}`} className="font-bold hover:underline">
                        {r.fullName}
                      </Link>
                      <p className="text-xs text-muted-foreground">{r.groupName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular text-destructive">
                        {r.unexcused}/{r.max}
                      </span>
                      <EnrollmentStatusBadge status={r.status} />
                    </div>
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
