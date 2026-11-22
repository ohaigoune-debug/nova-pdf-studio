/**
 * وصول تمارين الدورة (content_play_links): مشترك نشط في دورة يُستهدف درسُها بفوجها، وهي غير محذوفة.
 * يُستعمل عند بدء الجولة/المحاولة وعند كل إجابة فيها، بدل تجربة PLAY (play-access.service).
 * وحدة صغيرة بلا اعتماد على خدمات PLAY حتى لا تنشأ حلقة استيراد.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { contentPlayLinks, contentTargets, courseEnrollments, courses } from '@/server/db/schema'
import { AppError, assertUuid } from '@/server/lib/errors'

export interface PracticeLinkRow {
  id: string
  contentId: string
  kind: string
  playLessonId: string | null
  examSetId: string | null
  courseId: string
  courseSlug: string
}

/** الرابط ودورته إن كان التلميذ مشتركًا فيها اشتراكًا نشطًا؛ وإلا LESSON_PRACTICE_NOT_ALLOWED */
export async function practiceLinkForStudent(db: Db, studentId: string, linkId: string): Promise<PracticeLinkRow> {
  assertUuid(linkId, 'LESSON_PRACTICE_NOT_FOUND')
  const [row] = await db
    .select({
      id: contentPlayLinks.id,
      contentId: contentPlayLinks.contentId,
      kind: contentPlayLinks.kind,
      playLessonId: contentPlayLinks.playLessonId,
      examSetId: contentPlayLinks.examSetId,
      courseId: courses.id,
      courseSlug: courses.slug
    })
    .from(contentPlayLinks)
    .innerJoin(contentTargets, eq(contentTargets.contentId, contentPlayLinks.contentId))
    .innerJoin(courses, and(eq(courses.groupId, contentTargets.groupId), isNull(courses.deletedAt)))
    .innerJoin(
      courseEnrollments,
      and(
        eq(courseEnrollments.courseId, courses.id),
        eq(courseEnrollments.studentId, studentId),
        eq(courseEnrollments.status, 'ACTIVE'),
        sql`(${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now())`
      )
    )
    .where(eq(contentPlayLinks.id, linkId))
    .limit(1)
  if (!row) throw new AppError('LESSON_PRACTICE_NOT_ALLOWED')
  return row
}
