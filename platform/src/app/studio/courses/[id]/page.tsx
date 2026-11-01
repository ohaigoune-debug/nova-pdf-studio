import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CourseLessonsSection } from '@/components/courses/lesson-screens'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { requirePageActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { assertCourseEditor } from '@/server/services/course-staff.service'

export const dynamic = 'force-dynamic'

export default async function StudioCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePageActor('CONTENT_UPLOADER')
  const { id } = await params
  let title: string
  try {
    title = (await assertCourseEditor(await getDb(), actor, id)).title
  } catch (e) {
    if (isAppError(e)) notFound()
    throw e
  }
  return (
    <div className="space-y-6">
      <PageHeader title={title} actions={<Button asChild variant="outline" size="sm"><Link href="/studio">دوراتي</Link></Button>} />
      <CourseLessonsSection actor={actor} courseId={id} basePath={`/studio/courses/${id}`} />
    </div>
  )
}
