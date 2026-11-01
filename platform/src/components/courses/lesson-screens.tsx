import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/misc'
import { getDb } from '@/server/db/client'
import type { Actor } from '@/server/lib/actor'
import { getBunnyCredentials } from '@/server/lib/bunny'
import { isAppError } from '@/server/lib/errors'
import { getCourseLesson, listCourseLessons } from '@/server/services/course-lessons.service'
import { CourseLessonsPanel, type PanelLesson } from './course-lessons-panel'
import { LessonEditor } from './lesson-editor'

const NOT_FOUND = new Set(['COURSE_NOT_FOUND', 'LESSON_NOT_FOUND', 'FORBIDDEN'])

async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    if (isAppError(e) && NOT_FOUND.has(e.code)) notFound()
    throw e
  }
}

/** قائمة دروس الدورة (تُستعمل في صفحة الدورة للمشرف وفي بوابة رافع المحتوى) */
export async function CourseLessonsSection({ actor, courseId, basePath }: { actor: Actor; courseId: string; basePath: string }) {
  const db = await getDb()
  const { lessons } = await guard(() => listCourseLessons(db, actor, courseId))
  const rows: PanelLesson[] = lessons.map((l) => ({ id: l.id, title: l.title, published: Boolean(l.publishedAt), hasPdf: l.fileMime === 'application/pdf', video: l.videoProvider }))
  return <CourseLessonsPanel courseId={courseId} basePath={basePath} lessons={rows} />
}

/** صفحة إضافة/تعديل درس — شاشة واحدة */
export async function LessonEditorScreen({ actor, courseId, lessonId, basePath }: { actor: Actor; courseId: string; lessonId: string | null; basePath: string }) {
  const db = await getDb()
  const data = lessonId ? await guard(() => getCourseLesson(db, actor, courseId, lessonId)) : { ...(await guard(() => listCourseLessons(db, actor, courseId))), lesson: null }
  const bunnyConfigured = Boolean(await getBunnyCredentials(db))
  const l = data.lesson
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={l ? `تعديل الدرس: ${l.title}` : 'درس جديد'}
        description={`الدورة: ${data.course.title}`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={basePath}>رجوع إلى الدروس</Link>
          </Button>
        }
      />
      <LessonEditor
        courseId={courseId}
        basePath={basePath}
        bunnyConfigured={bunnyConfigured}
        isAdmin={actor.role === 'SUPER_ADMIN'}
        lesson={
          l
            ? {
                id: l.id,
                title: l.title,
                summary: l.summary,
                body: l.body,
                pdf: l.fileId && l.fileMime === 'application/pdf' ? { id: l.fileId, name: l.fileName ?? 'ملف PDF' } : null,
                videoProvider: l.videoProvider,
                bunnyVideoId: l.bunnyVideoId,
                youtubeUrl: l.videoProvider === 'YOUTUBE' ? l.externalUrl : null,
                published: Boolean(l.publishedAt),
                allowDownload: l.allowDownload,
                legacyUploadVideo: l.legacyUploadVideo
              }
            : null
        }
      />
    </div>
  )
}
