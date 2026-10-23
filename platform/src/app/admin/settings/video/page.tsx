import { BunnySettingsCard, BunnyUploadCard } from '@/components/live/bunny-settings-card'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { getBunnyCredentialsView } from '@/server/lib/bunny'

export const dynamic = 'force-dynamic'

/** إعدادات الفيديو المحمي: اعتمادات Bunny Stream ورفع تجريبي */
export default async function AdminVideoSettingsPage() {
  await requirePageActor('SUPER_ADMIN')
  const saved = await getBunnyCredentialsView(await getDb())
  return (
    <div className="space-y-6">
      <PageHeader title="إعدادات الفيديو (Bunny Stream)" description="بث محمي عبر CDN برابط تضمين موقّع يصلح ساعتين لكل مشاهد بعد التحقق من اشتراكه، مع علامة مائية باسم التلميذ وسجل مشاهدة." />
      <div className="grid gap-6 lg:grid-cols-2">
        <BunnySettingsCard saved={saved} />
        <BunnyUploadCard enabled={!!saved?.usable} />
      </div>
    </div>
  )
}
