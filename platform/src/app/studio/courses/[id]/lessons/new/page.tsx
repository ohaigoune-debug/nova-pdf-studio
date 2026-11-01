import { LessonEditorScreen } from '@/components/courses/lesson-screens'
import { requirePageActor } from '@/server/auth/current-user'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'درس جديد' }

export default async function StudioNewLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('CONTENT_UPLOADER')
  const { id } = await params
  return <LessonEditorScreen actor={actor} courseId={id} lessonId={null} basePath={`/studio/courses/${id}`} />
}
