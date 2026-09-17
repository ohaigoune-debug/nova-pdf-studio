import Link from 'next/link'
import { SessionStatusBadge } from '@/components/domain/status-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState, PageHeader, Progress } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { attendanceOverview } from '@/server/queries/teacher-extras.queries'
import { listSessions } from '@/server/services/class-sessions.service'

export default async function TeacherAttendancePage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [overview, recent] = await Promise.all([attendanceOverview(db, actor), listSessions(db, actor, { status: ['CLOSED', 'OPEN'], limit: 15 })])
  return (
    <div className="space-y-6">
      <PageHeader title={t('teacherPages.attendanceOverview')} />
      {overview.length === 0 ? (
        <EmptyState title={t('groups.noGroups')} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.map((g) => (
            <Card key={g.groupId}>
              <CardHeader>
                <CardTitle>
                  <Link href={`/teacher/groups/${g.groupId}`} className="hover:underline">
                    {g.name}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{t('groups.attendanceRate')}</span>
                    <span className="font-bold tabular">{percent(g.rate)}</span>
                  </div>
                  <Progress value={g.rate} tone={g.rate !== null && g.rate < 70 ? 'warning' : 'success'} />
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="rounded-md bg-success/10 p-2">
                    <p className="font-bold tabular text-success">{g.present}</p>
                    <p className="text-muted-foreground">{t('sessions.present')}</p>
                  </div>
                  <div className="rounded-md bg-warning/20 p-2">
                    <p className="font-bold tabular">{g.late}</p>
                    <p className="text-muted-foreground">{t('sessions.late')}</p>
                  </div>
                  <div className="rounded-md bg-destructive/10 p-2">
                    <p className="font-bold tabular text-destructive">{g.unexcused}</p>
                    <p className="text-muted-foreground">غير مبرر</p>
                  </div>
                  <div className="rounded-md bg-muted p-2">
                    <p className="font-bold tabular">{g.sessions}</p>
                    <p className="text-muted-foreground">{t('common.sessions')}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {g.active} {t('groups.active')} {g.suspended ? `· ${g.suspended} ${t('groups.suspended')}` : ''}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t('groups.recentSessions')}</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sessions.noSessions')}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('common.group')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead>{t('sessions.present')}</TableHead>
                  <TableHead>{t('sessions.late')}</TableHead>
                  <TableHead>{t('sessions.absent')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recent.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="tabular">
                      <Link href={`/teacher/sessions/${s.id}`} className="hover:underline">
                        {formatDateTime(s.scheduledAt)}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {s.groupName} {s.title ? `— ${s.title}` : ''}
                    </TableCell>
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
