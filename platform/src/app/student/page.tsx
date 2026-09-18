import { CalendarCheck, CalendarX, KeyRound, QrCode, TrendingUp, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { ContentGrid } from '@/components/domain/content-cards'
import { AttendanceStatusBadge, EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, EmptyState, Progress, StatCard } from '@/components/ui/misc'
import { dayName, t } from '@/i18n'
import { formatClock, formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listStudentContent } from '@/server/queries/student-extras.queries'
import { skillMap } from '@/server/services/skills.service'
import { studentHome } from '@/server/services/students.service'

export default async function StudentHomePage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [home, suggested, skills] = await Promise.all([studentHome(db, actor), listStudentContent(db, actor, { limit: 3 }), skillMap(db, actor.studentId!)])
  const avgSkill = skills.length ? skills.reduce((s, k) => s + k.score, 0) / skills.length : null
  const open = home.groups.find((g) => g.hasOpenSession && g.status === 'ACTIVE')
  const suspended = home.groups.filter((g) => g.status === 'SUSPENDED_DUE_TO_ABSENCE')

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">{t('dashboard.welcome', { name: actor.fullName })}</h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.studentTitle')}</p>
        </div>
        <Button asChild size="lg" className="shadow-md">
          <Link href="/student/attendance/card">
            <QrCode className="size-5" /> {t('nav.attendanceCard')}
          </Link>
        </Button>
      </div>

      {open ? (
        <Alert tone="success" title={t('dashboard.openSessionNow')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{open.name}</span>
            <Button asChild size="sm">
              <Link href={`/student/attendance/card?group=${open.groupId}`}>{t('nav.attendanceCard')}</Link>
            </Button>
          </div>
        </Alert>
      ) : null}
      {suspended.map((g) => (
        <Alert key={g.groupId} tone="destructive" title={`تسجيلك في فوج ${g.name} معلّق`}>
          {t('groups.suspendedBanner', { n: g.unexcused })} تواصل مع أستاذك لإعادة التفعيل.
        </Alert>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.attendanceRate')} value={percent(home.attendance.rate)} icon={CalendarCheck} tone={home.attendance.rate !== null && home.attendance.rate < 70 ? 'warning' : 'success'} />
        <StatCard label={t('attendanceStatus.UNEXCUSED')} value={home.unexcusedTotal} icon={CalendarX} tone={home.unexcusedTotal >= 3 ? 'destructive' : 'default'} />
        <StatCard label={t('nav.myGroups')} value={home.groups.length} icon={UsersRound} />
        <StatCard label={t('dashboard.skillsLevel')} value={percent(avgSkill)} hint={avgSkill === null ? t('studentPages.skillsEmpty') : `${skills.length} مهارة مقيَّمة`} icon={TrendingUp} tone={avgSkill !== null && avgSkill < 60 ? 'warning' : 'default'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t('nav.myGroups')}</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/student/groups">{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {home.groups.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title={t('studentPages.noGroups')}
                action={
                  <Button asChild>
                    <Link href="/activate-code">{t('nav.activateCode')}</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y">
                {home.groups.map((g) => (
                  <li key={g.groupId} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold">{g.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dayName(g.dayOfWeek)} {formatClock(g.startTime)} {g.room ? `· ${g.room}` : ''} {g.levelName ? `· ${g.levelName}` : ''}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={(g.unexcused / g.maxUnexcused) * 100} tone={g.unexcused >= g.maxUnexcused - 1 ? 'destructive' : 'warning'} className="h-1.5 w-32" />
                        <span className="text-[11px] text-muted-foreground">{t('studentPages.unexcusedOf', { n: g.unexcused, max: g.maxUnexcused })}</span>
                      </div>
                    </div>
                    <EnrollmentStatusBadge status={g.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>{t('studentPages.attendanceRecord')}</CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href="/student/attendance">{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {home.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
            ) : (
              <ul className="space-y-3">
                {home.recent.map((r) => (
                  <li key={r.recordId} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{r.sessionTitle ?? r.groupName}</p>
                      <p className="text-[11px] text-muted-foreground">{formatDateTime(r.scheduledAt)}</p>
                    </div>
                    <AttendanceStatusBadge status={r.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t('dashboard.suggested')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/student/lessons">{t('common.viewAll')}</Link>
          </Button>
        </div>
        <ContentGrid items={suggested} basePath="/student/lessons" />
      </section>
    </div>
  )
}
