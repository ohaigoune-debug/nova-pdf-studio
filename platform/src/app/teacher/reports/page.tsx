import { BarChart3, Download } from 'lucide-react'
import { ReportExports } from '@/components/domain/report-exports'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { attendanceOverview } from '@/server/queries/teacher-extras.queries'
import { listReports } from '@/server/services/reports.service'

export default async function TeacherReportsPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const [overview, reports] = await Promise.all([attendanceOverview(db, actor), listReports(db, actor)])
  const csv = '﻿' + ['group,active,sessions,present,late,absent,unexcused,rate', ...overview.map((g) => `"${g.name}",${g.active},${g.sessions},${g.present},${g.late},${g.absent},${g.unexcused},${g.rate ?? ''}`)].join('\n')
  const href = `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`
  return (
    <>
      <PageHeader
        title={t('teacherPages.reportsTitle')}
        actions={
          <Button asChild variant="outline">
            <a href={href} download="attendance-report.csv">
              <Download className="size-4" /> {t('common.exportCsv')}
            </a>
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="size-4" /> تقرير الحضور حسب الفوج
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.group')}</TableHead>
                  <TableHead>{t('groups.active')}</TableHead>
                  <TableHead>{t('common.sessions')}</TableHead>
                  <TableHead>{t('sessions.present')}</TableHead>
                  <TableHead>{t('sessions.late')}</TableHead>
                  <TableHead>{t('sessions.absent')}</TableHead>
                  <TableHead>{t('groups.attendanceRate')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.map((g) => (
                  <TableRow key={g.groupId}>
                    <TableCell className="font-semibold">{g.name}</TableCell>
                    <TableCell className="tabular">{g.active}</TableCell>
                    <TableCell className="tabular">{g.sessions}</TableCell>
                    <TableCell className="tabular">{g.present}</TableCell>
                    <TableCell className="tabular">{g.late}</TableCell>
                    <TableCell className="tabular">{g.absent}</TableCell>
                    <TableCell className="tabular">{percent(g.rate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.exportsTitle')}</CardTitle>
            <p className="text-xs text-muted-foreground">{t('reports.exportsHint')}</p>
          </CardHeader>
          <CardContent>
            <ReportExports groups={overview.map((g) => ({ id: g.groupId, name: g.name }))} reports={reports} />
          </CardContent>
        </Card>
      </div>
    </>
  )
}
