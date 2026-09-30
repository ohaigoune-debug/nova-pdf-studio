import { EducatorsAdmin } from '@/components/domain/educators-admin'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listEducators } from '@/server/services/educators.service'

export const dynamic = 'force-dynamic'

export default async function EducatorsAdminPage() {
  const actor = await requirePageActor('SUPER_ADMIN')
  const data = await listEducators(await getDb(), actor)
  return (
    <>
      <PageHeader title="دليل الأساتذة (يوتيوب)" description="ترشيحات دليل القنوات: يبحث النظام عن قناة كل أستاذ، وتختار أنت الصحيحة وتعتمدها، فتُجلب فيديوهاتها إلى المكتبة مصنّفةً بالمادة والصف." />
      <EducatorsAdmin educators={data.educators} hasApiKey={data.hasApiKey} pendingResolve={data.pendingResolve} />
    </>
  )
}
