/**
 * Permanent learning-only iOS portal. This is an additional presentation of
 * existing server permissions, never an entitlement derived from a device flag.
 * Commerce, activation codes and user-generated discussions are not exposed here.
 */
import type { Db } from '@/server/db/connect'
import { assertRole, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { getPublicContentBySlug, listPublicContent } from '@/server/queries/content.queries'
import { getContentForStudent } from './content.service'
import { courseHome, myCourses } from './courses.service'
import { phoneGateFor } from './phone-gate.service'

export async function requireIosLearningStudent(db: Db, actor: Actor | null): Promise<Actor> {
  if (!actor) throw new AppError('AUTH_REQUIRED')
  assertRole(actor, 'STUDENT')
  const gate = await phoneGateFor(db, actor.userId)
  if (gate.required) throw new AppError('FORBIDDEN', { reason: 'PHONE_VERIFICATION_REQUIRED' })
  return actor
}

export async function iosLearningHome(db: Db, actor: Actor | null) {
  if (actor) await requireIosLearningStudent(db, actor)
  const [publicLessons, courses] = await Promise.all([
    listPublicContent(db, { types: ['LESSON', 'PDF', 'VIDEO', 'ARTICLE', 'AUDIO', 'EXERCISE', 'IMAGE'], limit: 40 }),
    actor ? myCourses(db, actor) : Promise.resolve([])
  ])
  return {
    publicLessons: publicLessons.map((item) => ({ ...item, href: `/ios/lesson/${encodeURIComponent(item.slug)}` })),
    courses: courses.map((course) => ({ ...course, href: `/ios/course/${encodeURIComponent(course.slug)}` }))
  }
}

export async function iosCourseHome(db: Db, actor: Actor | null, slug: string) {
  const student = await requireIosLearningStudent(db, actor)
  const home = await courseHome(db, student, slug)
  if (home.needsTerms) return home
  return {
    ...home,
    videos: home.videos.map((item) => ({ ...item, href: `/ios/lesson/${encodeURIComponent(item.slug)}` })),
    lessons: home.lessons.map((item) => ({ ...item, href: `/ios/lesson/${encodeURIComponent(item.slug)}` }))
  }
}

export async function iosLesson(db: Db, actor: Actor | null, slug: string) {
  if (actor) {
    const student = await requireIosLearningStudent(db, actor)
    return getContentForStudent(db, student, slug)
  }
  const item = await getPublicContentBySlug(db, slug)
  if (!item) throw new AppError('CONTENT_NOT_FOUND')
  return item
}
