import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { loadIosAppLink } from '@/server/services/ios-app.service'
import { IosAppLinkForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تطبيق الآيفون' }

export default async function IosAppSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const link = await loadIosAppLink(await getDb())
  return (
    <div className="max-w-2xl space-y-4">
      <PageHeader
        title="تطبيق الآيفون"
        description="حين تحفظ الرابط يظهر زر «حمّل تطبيق الآيفون» في الصفحة الرئيسية، ولكل تلميذ يفتح حسابه من آيفون، ويقترح Safari التطبيق في أعلى الصفحة. لا يظهر الزر داخل التطبيقين نفسيهما."
      />
      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm">
            الحالة:{' '}
            {link ? (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="font-bold text-primary underline underline-offset-4">
                ظاهر للتلاميذ (رقم التطبيق {link.id})
              </a>
            ) : (
              <b className="text-muted-foreground">مخفي — لا رابط بعد</b>
            )}
          </p>
          <IosAppLinkForm url={link?.url ?? ''} />
        </CardContent>
      </Card>
    </div>
  )
}
