import { Activity, AlertTriangle, CalendarCheck, Cpu, GraduationCap, HardDrive, ScrollText, Users, UsersRound } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader, StatCard } from '@/components/ui/misc'
import { t } from '@/i18n'
import { formatDateTime, percent } from '@/lib/utils'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAuditLogs, platformStats } from '@/server/services/admin.service'
import { storageStats } from '@/server/queries/admin-extras.queries'

export default async function AdminHomePage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const db = await getDb()
  const [s, storage, logs] = await Promise.all([platformStats(db, actor), storageStats(db, actor), listAuditLogs(db, actor, 10)])
  return (
    <div className="space-y-6">
      <PageHeader
        title={t('dashboard.adminTitle')}
        description={t('dashboard.welcome', { name: actor.fullName })}
        actions={
          <Button asChild>
            <Link href="/admin/teachers/new">{t('admin.newTeacher')}</Link>
          </Button>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t('dashboard.usersCount')} value={s.users} icon={Users} />
        <StatCard label={t('dashboard.studentsCount')} value={s.students} icon={GraduationCap} />
        <StatCard label={t('dashboard.teachersCount')} value={s.teachers} icon={UsersRound} />
        <StatCard label={t('dashboard.activeGroups')} value={s.activeGroups} icon={UsersRound} />
        <StatCard label={t('dashboard.sessionsToday')} value={s.sessionsToday} icon={CalendarCheck} />
        <StatCard label={t('dashboard.attendanceRate')} value={percent(s.attendanceRate)} icon={CalendarCheck} tone="success" />
        <StatCard label={t('dashboard.activeUsersToday')} value={s.activeUsersToday} icon={Activity} />
        <StatCard label={t('dashboard.aiOpsToday')} value={s.aiJobsToday} icon={Cpu} />
        <StatCard label={t('dashboard.storageUsage')} value={`${(storage.bytes / 1024 / 1024).toFixed(1)} MB`} hint={`${storage.files} ملف · ${storage.content} محتوى`} icon={HardDrive} />
        <StatCard label={t('dashboard.errors')} value={s.failedJobs} icon={AlertTriangle} tone={s.failedJobs > 0 ? 'destructive' : 'default'} />
        <StatCard label={t('dashboard.securityAlerts')} value={0} hint="المرحلة 8" icon={AlertTriangle} />
        <StatCard label={t('admin.logsTitle')} value={s.auditToday} hint={t('common.today')} icon={ScrollText} />
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{t('dashboard.recentActivity')}</CardTitle>
          <Button asChild variant="link" size="sm">
            <Link href="/admin/logs">{t('common.viewAll')}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <b>{l.actorName ?? l.actorEmail ?? 'النظام'}</b> · <code className="text-xs">{l.action}</code> {l.workspaceName ? <span className="text-muted-foreground">— {l.workspaceName}</span> : null}
                </span>
                <span className="text-[11px] text-muted-foreground tabular">{formatDateTime(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
