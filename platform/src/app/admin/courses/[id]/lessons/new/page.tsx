import { LessonEditorScreen } from '@/components/courses/lesson-screens'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'درس جديد' }

export default async function AdminNewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id } = await params
  return <LessonEditorScreen actor={actor} courseId={id} lessonId={null} basePath={`/admin/courses/${id}`} />
}
