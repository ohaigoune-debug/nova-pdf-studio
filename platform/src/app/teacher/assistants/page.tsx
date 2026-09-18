import { headers } from 'next/headers'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listAssistants } from '@/server/services/assistants.service'
import { AssistantsPanel } from './assistants-panel'

export default async function TeacherAssistantsPage() {
  const actor = await requirePageActor('TEACHER')
  const db = await getDb()
  const { assistants, pendingCodes } = await listAssistants(db, actor)
  const h = await headers()
  const proto = h.get('x-forwarded-proto') ?? 'http'
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000'
  const origin = process.env.APP_URL?.replace(/\/$/, '') || `${proto}://${host}`
  return (
    <div className="space-y-6">
      <PageHeader title={t('assistant.title')} description={t('assistant.subtitle')} />
      <Card>
        <CardHeader>
          <CardTitle>{t('assistant.permissionsTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>✔ {t('assistant.canDo')}</p>
          <p className="text-muted-foreground">✖ {t('assistant.cannotDo')}</p>
        </CardContent>
      </Card>
      <AssistantsPanel assistants={assistants} pendingCodes={pendingCodes} origin={origin} />
    </div>
  )
}
