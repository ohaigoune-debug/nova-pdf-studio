import { BatchPage } from '@/components/domain/publish-pages'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function AdminBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  return <BatchPage actor={actor} id={id} basePath="/admin/publish" />
}
