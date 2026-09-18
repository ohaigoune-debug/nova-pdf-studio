import { CalendarCheck, KeyRound, Pencil, ScanLine, Users, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CloseSessionButton } from '@/components/domain/close-session-button'
import { MemberActions } from '@/components/domain/member-actions'
import { StartSessionDialog } from '@/components/domain/start-session-dialog'
import { EnrollmentStatusBadge, GroupStatusBadge, SessionStatusBadge } from '@/components/domain/status-badges'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, Avatar, EmptyState, PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { dayName, t } from '@/i18n'
import { formatClock, formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { attendanceMatrix } from '@/server/queries/teacher-extras.queries'
import { getGroupDashboard, getGroupDetail, listGroupMembers } from '@/server/services/groups.service'
import { GenerateExercisesButton } from '@/components/domain/generate-exercises-button'
import { groupWeakSkills } from '@/server/services/skills.service'
import { AttendanceHeatmap } from '@/components/domain/attendance-heatmap'

export default async function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let g
  try {
    g = await getGroupDetail(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [dash, members, matrix, weakSkills] = await Promise.all([getGroupDashboard(db, actor, g.id), listGroupMembers(db, actor, g.id), attendanceMatrix(db, actor, g.id), groupWeakSkills(db, g.id)])
  const activeMembers = members.filter((m) => m.status === 'ACTIVE')
  const otherMembers = members.filter((m) => m.status !== 'ACTIVE')

  return (
    <div className="space-y-6">
      <PageHeader
        title={g.name}
        description={[dayName(g.dayOfWeek) + ' ' + formatClock(g.startTime), g.room, g.levelName, g.streamName, g.schoolName, g.wilayaName, g.yearLabel].filter(Boolean).join(' · ')}
        actions={
          <>
            <GroupStatusBadge status={g.status} />
            <Button asChild variant="outline" size="sm">
              <Link href={`/teacher/groups/${g.id}/report`}>{t('printReport.groupOpen')}</Link>
            </Button>
            {dash.openSession ? (
              <>
                <Button asChild>
                  <Link href={`/teacher/scanner?session=${dash.openSession.id}`}>
                    <ScanLine className="size-4" /> {t('dashboard.openScanner')}
                  </Link>
                </Button>
                <CloseSessionButton sessionId={dash.openSession.id} />
              </>
            ) : (
              <StartSessionDialog groups={[{ id: g.id, name: g.name, lateAfterMinutes: g.lateAfterMinutes }]} />
            )}
            <Button asChild variant="outline">
              <Link href={`/teacher/groups/${g.id}/codes`}>
                <KeyRound className="size-4" /> {t('groups.codes')}
              </Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={`/teacher/groups/${g.id}/edit`}>
                <Pencil className="size-4" /> {t('common.edit')}
              </Link>
            </Button>
          </>
        }
      />

      {dash.openSession ? (
        <Alert tone="success" title={t('dashboard.openSessionNow')}>
          {dash.openSession.title ?? ''} · {t('sessions.started')} {formatDateTime(dash.openSession.startedAt)}
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('groups.enrolled')} value={dash.enrolled} hint={g.capacity ? `${t('common.capacity')}: ${g.capacity}` : undefined} icon={UsersRound} />
        <StatCard label={t('groups.active')} value={dash.active} hint={dash.suspended ? `${dash.suspended} ${t('groups.suspended')}` : undefined} icon={Users} tone={dash.suspended ? 'warning' : 'success'} />
        <StatCard label={t('groups.attendanceRate')} value={percent(dash.attendanceRate)} hint={`${dash.presentTotal} حاضر · ${dash.lateTotal} متأخر · ${dash.absentTotal} غائب`} icon={CalendarCheck} />
        <StatCard label={t('groups.sessions')} value={dash.sessionsClosed} hint={`${t('groups.averageScore')}: ${dash.averageScore ?? '—'} · ${t('groups.assignments')}: ${dash.assignmentsCount}`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>
              {t('groups.members')} ({activeMembers.length})
            </CardTitle>
            <Button asChild variant="link" size="sm">
              <Link href={`/teacher/students?groupId=${g.id}`}>{t('common.viewAll')}</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {members.length === 0 ? (
              <EmptyState
                icon={KeyRound}
                title={t('teacherPages.noStudents')}
                action={
                  <Button asChild>
                    <Link href={`/teacher/groups/${g.id}/codes`}>{t('codes.generate')}</Link>
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.student')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('groups.attendanceRate')}</TableHead>
                    <TableHead>{t('groups.unexcusedCount')}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...activeMembers, ...otherMembers].map((m) => (
                    <TableRow key={m.groupStudentId}>
                      <TableCell>
                        <Link href={`/teacher/students/${m.studentId}`} className="flex items-center gap-2 hover:underline">
                          <Avatar name={m.fullName} size="sm" />
                          <span>
                            <span className="block font-semibold">{m.fullName}</span>
                            <span className="block text-[11px] text-muted-foreground">{m.phone ?? m.email}</span>
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <EnrollmentStatusBadge status={m.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={m.attendanceRate} className="w-20" tone={m.attendanceRate !== null && m.attendanceRate < 70 ? 'warning' : 'success'} />
                          <span className="text-xs tabular">{percent(m.attendanceRate)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={m.unexcusedAbsences >= g.maxUnexcusedAbsences - 1 ? 'font-bold text-destructive tabular' : 'tabular'}>
                          {m.unexcusedAbsences}/{g.maxUnexcusedAbsences}
                        </span>
                      </TableCell>
                      <TableCell className="text-end">
                        <MemberActions groupStudentId={m.groupStudentId} status={m.status} compact />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('groups.atRisk')}</CardTitle>
            </CardHeader>
            <CardContent>
              {dash.atRisk.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد.</p>
              ) : (
                <ul className="space-y-2">
                  {dash.atRisk.map((s) => (
                    <li key={s.studentId} className="flex items-center justify-between text-sm">
                      <Link href={`/teacher/students/${s.studentId}`} className="font-semibold hover:underline">
                        {s.fullName}
                      </Link>
                      <span className="text-xs text-muted-foreground tabular">
                        {s.unexcused} غياب · {percent(s.attendanceRate)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('groups.frequentlyLate')}</CardTitle>
            </CardHeader>
            <CardContent>
              {dash.frequentlyLate.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا يوجد.</p>
              ) : (
                <ul className="space-y-2">
                  {dash.frequentlyLate.map((s) => (
                    <li key={s.studentId} className="flex items-center justify-between text-sm">
                      <span className="font-semibold">{s.fullName}</span>
                      <span className="text-xs text-muted-foreground tabular">{s.lateCount} مرات</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('groups.codes')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p>
                {t('codes.unused')}: <b className="tabular">{dash.activeCodes}</b> · {t('codes.used')}: <b className="tabular">{dash.usedCodes}</b>
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>خريطة الحضور</CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceHeatmap matrix={matrix} />
        </CardContent>
      </Card>

      {weakSkills.length ? (
        <Card>
          <CardHeader>
            <CardTitle>{t('skills.groupWeak')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y text-sm">
              {weakSkills.map((w) => (
                <li key={w.skillId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="font-semibold">{w.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {w.weakCount} من {w.assessed} · متوسط {w.average}% · {w.students.slice(0, 4).join('، ')}{w.students.length > 4 ? '…' : ''}
                  </span>
                  <GenerateExercisesButton skillId={w.skillId} groupId={g.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('groups.recentSessions')}</CardTitle>
          <Button asChild variant="link" size="sm">
            <Link href={`/teacher/sessions?groupId=${g.id}`}>{t('common.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {dash.recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sessions.noSessions')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('sessions.titleField')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('sessions.present')}</TableHead>
                  <TableHead>{t('sessions.late')}</TableHead>
                  <TableHead>{t('sessions.absent')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dash.recentSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular">
                      <Link href={`/teacher/sessions/${s.id}`} className="hover:underline">
                        {formatDateTime(s.scheduledAt)}
                      </Link>
                    </TableCell>
                    <TableCell>{s.title ?? '—'}</TableCell>
                    <TableCell>
                      <SessionStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="tabular text-success">{s.present}</TableCell>
                    <TableCell className="tabular text-amber-600">{s.late}</TableCell>
                    <TableCell className="tabular text-destructive">{s.absent}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
