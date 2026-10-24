import { PublishHome } from '@/components/domain/publish-pages'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'نشر درس أو فرض أو اختبار' }

export default async function TeacherPublishPage({ searchParams }: { searchParams: Promise<{ done?: string; type?: string }> }) {
  const actor = await requirePageActor('TEACHER')
  const { done, type } = await searchParams
  return <PublishHome actor={actor} basePath="/teacher/publish" done={done} initialType={type} />
}
