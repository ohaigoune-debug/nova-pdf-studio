import { LessonEditorScreen } from '@/components/courses/lesson-screens'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تعديل درس' }

export default async function StudioEditLessonPage({ params }: { params: Promise<{ id: string; lessonId: string }> }) {
  const actor = await requirePageActor('CONTENT_UPLOADER')
  const { id, lessonId } = await params
  return <LessonEditorScreen actor={actor} courseId={id} lessonId={lessonId} basePath={`/studio/courses/${id}`} />
}
