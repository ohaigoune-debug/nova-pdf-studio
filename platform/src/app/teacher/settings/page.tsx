import { DevicesList } from '@/components/domain/devices-list'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, PageHeader } from '@/components/ui/misc'
import { t, tEnum } from '@/i18n'
import { listUserSessions } from '@/server/auth/session'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'

export default async function TeacherSettingsPage() {
  const actor = await requirePageActor('TEACHER')
  const devices = await listUserSessions(await getDb(), actor.userId)
  return (
    <>
      <PageHeader title={t('nav.settings')} />
      <Card className="mb-6">
        <CardContent className="flex items-center gap-4 p-6">
          <Avatar name={actor.fullName} size="lg" />
          <div>
            <p className="text-xl font-extrabold">{actor.fullName}</p>
            <p className="text-sm text-muted-foreground" dir="ltr">
              {actor.email}
            </p>
            <p className="text-xs text-muted-foreground">{tEnum('roles', actor.role)}</p>
          </div>
        </CardContent>
      </Card>
      <h2 className="mb-3 text-lg font-extrabold">{t('teacherPages.devicesTitle')}</h2>
      <DevicesList devices={devices} />
    </>
  )
}
