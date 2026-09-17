import { BarChart3, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, PhaseNote } from '@/components/ui/misc'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { t } from '@/i18n'
import { percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { attendanceOverview } from '@/server/queries/teacher-extras.queries'

export default async function TeacherReportsPage() {
  const actor = await requirePageActor('TEACHER')
  const overview = await attendanceOverview(await getDb(), actor)
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
      <PhaseNote phase={7} />
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
    </>
  )
}
