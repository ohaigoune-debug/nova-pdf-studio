import { BatchPage } from '@/components/domain/publish-pages'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'

export default async function TeacherBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { id } = await params
  return <BatchPage actor={actor} id={id} basePath="/teacher/publish" />
}
