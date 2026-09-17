import { ContentGrid } from '@/components/domain/content-cards'
import { PageHeader, PhaseNote } from '@/components/ui/misc'
import { t } from '@/i18n'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listPublicContent } from '@/server/queries/content.queries'

export default async function AdminContentPage() {
  await requirePageActor('SUPER_ADMIN')
  const items = await listPublicContent(await getDb(), { limit: 100 })
  return (
    <>
      <PageHeader title={t('admin.contentTitle')} description={`${items.length} عنصر منشور`} />
      <PhaseNote phase={4} />
      <ContentGrid items={items} />
    </>
  )
}
