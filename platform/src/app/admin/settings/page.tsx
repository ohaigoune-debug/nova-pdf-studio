import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listSettings } from '@/server/queries/admin-extras.queries'

export default async function AdminSettingsPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const settings = await listSettings(await getDb(), actor)
  const env: [string, string][] = [
    ['DATABASE_URL', (process.env.DATABASE_URL ?? 'pglite://./data/pglite').replace(/:\/\/.*@/, '://***@')],
    ['QR_TOKEN_TTL_SECONDS', process.env.QR_TOKEN_TTL_SECONDS ?? '60'],
    ['AI_PROVIDER', process.env.AI_PROVIDER ?? 'mock'],
    ['MAIL_PROVIDER', process.env.MAIL_PROVIDER ?? 'console'],
    ['STORAGE_DRIVER', process.env.STORAGE_DRIVER ?? 'local'],
    ['JOBS_INLINE_WORKER', process.env.JOBS_INLINE_WORKER === '0' ? 'off' : 'on'],
    ['CRON_SECRET', process.env.CRON_SECRET ? 'set' : 'unset'],
    ['VAPID (Web Push)', process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY ? 'configured' : 'unset'],
    ['APP_URL', process.env.APP_URL ?? '—'],
    ['NODE_ENV', process.env.NODE_ENV ?? '—']
  ]
  return (
    <>
      <PageHeader title={t('admin.settingsTitle')} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>البيئة</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {env.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 border-b py-1 last:border-0">
                  <dt className="font-mono text-xs">{k}</dt>
                  <dd className="truncate font-mono text-xs" dir="ltr">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>إعدادات مخزّنة</CardTitle>
          </CardHeader>
          <CardContent>
            {settings.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
            ) : (
              <dl className="space-y-2 text-sm">
                {settings.map((s) => (
                  <div key={s.key} className="flex justify-between gap-4 border-b py-1 last:border-0">
                    <dt className="font-mono text-xs">{s.key}</dt>
                    <dd className="truncate font-mono text-xs" dir="ltr">
                      {JSON.stringify(s.value)}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
