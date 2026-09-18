import { CalendarCheck, CalendarX, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AttendanceHistoryTable } from '@/components/domain/attendance-history-table'
import { ExcuseDialog } from '@/components/domain/excuse-dialog'
import { MemberActions } from '@/components/domain/member-actions'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { SkillMap } from '@/components/domain/skill-map'
import { Timeline } from '@/components/domain/timeline'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, Avatar, PageHeader, Progress, StatCard } from '@/components/ui/misc'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { t, tEnum } from '@/i18n'
import { formatDate, formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { AiStudentPanel } from '@/components/domain/ai-student-panel'
import { Button } from '@/components/ui/button'
import { latestStudentAnalysis } from '@/server/services/ai.service'
import { skillMap } from '@/server/services/skills.service'
import { getStudentProfile } from '@/server/services/students.service'

export default async function TeacherStudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  const db = await getDb()
  let p
  try {
    p = await getStudentProfile(db, actor, id)
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  const [skills, analysis] = await Promise.all([skillMap(db, p.studentId), latestStudentAnalysis(db, actor, p.studentId)])
  const info: [string, string][] = [
    [t('common.phone'), p.phone ?? '—'],
    [t('common.email'), p.email],
    ['هاتف الولي', p.guardianPhone ?? '—'],
    [t('common.wilaya'), p.wilayaName ?? '—'],
    [t('common.school'), p.schoolName ?? '—'],
    [t('common.level'), [p.levelName, p.streamName].filter(Boolean).join(' · ') || '—'],
    [t('studentPages.registeredAt'), formatDate(p.registeredAt)]
  ]
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('teacherPages.studentProfile')}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/teacher/students/${p.studentId}/report`}>{t('printReport.open')}</Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-6 p-6 md:flex-row">
          <div className="flex items-center gap-4 md:w-72">
            <Avatar name={p.fullName} size="lg" />
            <div>
              <p className="text-xl font-extrabold">{p.fullName}</p>
              <Badge variant="muted">{tEnum('studentTypes', p.studentType)}</Badge>
            </div>
          </div>
          <dl className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {info.map(([k, v]) => (
              <div key={k} className="rounded-md bg-muted/50 p-3">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="font-semibold" dir="auto">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {p.enrollments
        .filter((e) => e.status === 'SUSPENDED_DUE_TO_ABSENCE')
        .map((e) => (
          <Alert key={e.groupStudentId} tone="destructive" title={t('groups.suspendedBanner', { n: e.unexcused })}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{e.groupName}</span>
              <MemberActions groupStudentId={e.groupStudentId} status={e.status} compact />
            </div>
          </Alert>
        ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.attendanceRate')} value={percent(p.attendance.rate)} icon={CalendarCheck} tone="success" />
        <StatCard label={t('attendanceStatus.LATE')} value={p.attendance.late} icon={Clock} tone="warning" />
        <StatCard label={t('attendanceStatus.EXCUSED')} value={p.attendance.excused} icon={CheckCircle2} />
        <StatCard label={t('attendanceStatus.UNEXCUSED')} value={p.attendance.unexcused} icon={CalendarX} tone={p.attendance.unexcused >= 3 ? 'destructive' : 'default'} />
      </div>

      <Tabs defaultValue="enrollments">
        <TabsList>
          <TabsTrigger value="enrollments">{t('teacherPages.enrollments')}</TabsTrigger>
          <TabsTrigger value="attendance">{t('nav.attendance')}</TabsTrigger>
          <TabsTrigger value="timeline">{t('studentPages.timeline')}</TabsTrigger>
          <TabsTrigger value="skills">{t('studentPages.skillsTitle')}</TabsTrigger>
        </TabsList>
        <TabsContent value="enrollments" className="space-y-4">
          {p.enrollments.map((e) => (
            <Card key={e.groupStudentId}>
              <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  <Link href={`/teacher/groups/${e.groupId}`} className="hover:underline">
                    {e.groupName}
                  </Link>
                </CardTitle>
                <div className="flex items-center gap-2">
                  <EnrollmentStatusBadge status={e.status} />
                  <MemberActions groupStudentId={e.groupStudentId} status={e.status} compact />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{t('groups.unexcusedCount')}</span>
                    <span className="tabular">
                      {e.unexcused}/{e.maxUnexcused}
                    </span>
                  </div>
                  <Progress value={(e.unexcused / e.maxUnexcused) * 100} tone={e.unexcused >= e.maxUnexcused - 1 ? 'destructive' : 'warning'} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('studentPages.registeredAt')}: {formatDateTime(e.enrolledAt)}
                </p>
                <div>
                  <p className="mb-1 text-xs font-bold">{t('teacherPages.statusHistory')}</p>
                  <ul className="space-y-1 text-xs">
                    {e.history.map((h) => (
                      <li key={h.id} className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular">{formatDateTime(h.changedAt)}</span>
                        <span>
                          {h.fromStatus ? `${tEnum('enrollmentStatus', h.fromStatus)} ← ` : ''}
                          <b>{tEnum('enrollmentStatus', h.toStatus)}</b>
                        </span>
                        {h.reason ? <span className="text-muted-foreground">({h.reason})</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
        <TabsContent value="attendance">
          <AttendanceHistoryTable items={p.recentAttendance} renderActions={(a) => (a.status === 'UNEXCUSED' || a.status === 'ABSENT' ? <ExcuseDialog recordId={a.recordId} studentName={p.fullName} /> : null)} />
        </TabsContent>
        <TabsContent value="timeline">
          <Card>
            <CardContent className="p-6">
              <Timeline items={p.timeline} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="skills" className="space-y-4">
          <Card>
            <CardContent className="p-6">
              <SkillMap items={skills} />
            </CardContent>
          </Card>
          <AiStudentPanel studentId={p.studentId} analysis={analysis} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
