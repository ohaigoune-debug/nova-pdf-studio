import { LessonEditorScreen } from '@/components/courses/lesson-screens'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تعديل درس' }

export default async function AdminEditLessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const actor = await requirePageActor('SUPER_ADMIN')
  const { id, lessonId } = await params
  return <LessonEditorScreen actor={actor} courseId={id} lessonId={lessonId} basePath={`/admin/courses/${id}`} />
}
