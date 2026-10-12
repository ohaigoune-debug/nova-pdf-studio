import { PublishHome } from '@/components/domain/publish-pages'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'نشر درس أو فرض أو اختبار' }

export default async function AdminPublishPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { done } = await searchParams
  return <PublishHome actor={actor} basePath="/admin/publish" done={done} />
}
