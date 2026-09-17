import { DevicesList } from '@/components/domain/devices-list'
import { EnrollmentStatusBadge } from '@/components/domain/status-badges'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { formatDate } from '@/lib/utils'
import { listUserSessions } from '@/server/auth/session'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getStudentProfile } from '@/server/services/students.service'

export default async function StudentProfilePage() {
  const actor = await requirePageActor('STUDENT')
  const db = await getDb()
  const [p, devices] = await Promise.all([getStudentProfile(db, actor, actor.studentId!), listUserSessions(db, actor.userId)])
  const rows: [string, string][] = [
    [t('common.email'), p.email],
    [t('common.phone'), p.phone ?? '—'],
    [t('common.wilaya'), p.wilayaName ?? '—'],
    [t('common.school'), p.schoolName ?? '—'],
    [t('common.level'), p.levelName ?? '—'],
    [t('common.stream'), p.streamName ?? '—'],
    [t('studentPages.studentType'), tEnum('studentTypes', p.studentType)],
    [t('studentPages.registeredAt'), formatDate(p.registeredAt)]
  ]
  return (
    <>
      <PageHeader title={t('studentPages.profile')} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
            <div className="mb-6 flex items-center gap-4">
              <Avatar name={p.fullName} size="lg" />
              <div>
                <p className="text-xl font-extrabold">{p.fullName}</p>
                <p className="text-sm text-muted-foreground">{tEnum('roles', actor.role)}</p>
              </div>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
              {rows.map(([k, v]) => (
                <div key={k} className="rounded-md bg-muted/50 p-3">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{t('teacherPages.enrollments')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {p.enrollments.map((e) => (
              <div key={e.groupStudentId} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">{e.groupName}</span>
                <EnrollmentStatusBadge status={e.status} />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-extrabold">{t('teacherPages.devicesTitle')}</h2>
        <DevicesList devices={devices} />
      </section>
    </>
  )
}
