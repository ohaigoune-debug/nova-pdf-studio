/**
 * واجهة بيانات iOS v1 (المرحلة 1 من خطة التطبيق المتكامل): JSON للشاشات الأصلية.
 * كل دالة تعيد استعمال خدمات بوابة iOS الحالية حرفيًا (iosLearningHome / iosCourseHome / iosLesson)،
 * فالدور وبوابة الهاتف والتسجيل والشروط والانتهاء والظهور هي نفسها. لا روابط ملفات موقّعة،
 * ولا بيانات حسابات أخرى، ولا بريد ولا هاتف. العقد موثّق في platform/ios/docs/IOS-API-V1.md.
 */
import { groupLessons } from '@/server/lib/group-lessons'
import type { Db } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { iosCourseHome, iosLearningHome, iosLesson } from './ios-learning.service'

export const IOS_API_VERSION = 1

export function iosCapabilities() {
  return { apiVersion: IOS_API_VERSION, features: ['home', 'course', 'lesson'] as const, minAppBuild: 1 }
}

/** حسابات الطاقم لا تستعمل البوابة: 403 مع سبب صريح يعرض له التطبيق بطاقة «للتلاميذ» */
function assertStudentOrGuest(actor: Actor | null): void {
  if (actor && actor.role !== 'STUDENT') throw new AppError('FORBIDDEN', { reason: 'ROLE' })
}

const iso = (d: Date | string | null | undefined) => (d instanceof Date ? d.toISOString() : d ?? null)

export async function iosApiHome(db: Db, actor: Actor | null) {
  assertStudentOrGuest(actor)
  const home = await iosLearningHome(db, actor)
  return {
    account: actor ? { id: actor.userId } : null,
    courses: home.courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      teacherName: c.teacherName,
      season: c.season,
      status: c.status === 'ACTIVE' ? ('ACTIVE' as const) : ('ENDED' as const),
      accessEndsOn: c.accessEndsOn ?? null,
      termsAccepted: c.termsAccepted
    })),
    freeLessons: groupLessons(home.publicLessons).map((entry) =>
      entry.kind === 'group'
        ? { kind: 'group' as const, heading: entry.heading, detail: entry.detail, items: entry.items.map(({ lesson, label }) => ({ slug: lesson.slug, label, type: lesson.type })) }
        : { kind: 'single' as const, slug: entry.lesson.slug, label: entry.label, summary: entry.lesson.summary, type: entry.lesson.type }),
    tools: actor
      ? [
          { id: 'play', webPath: '/student/play' },
          { id: 'practice', webPath: '/student/practice' },
          { id: 'quizzes', webPath: '/student/quizzes' },
          { id: 'exams', webPath: '/student/exams' }
        ]
      : []
  }
}

export async function iosApiCourse(db: Db, actor: Actor | null, slug: string) {
  assertStudentOrGuest(actor)
  const home = await iosCourseHome(db, actor, slug)
  const webPath = `/ios/course/${encodeURIComponent(home.course.slug)}`
  if (home.needsTerms) return { needsTerms: true as const, course: { slug: home.course.slug, title: home.course.title }, webPath }
  return {
    needsTerms: false as const,
    course: {
      slug: home.course.slug,
      title: home.course.title,
      teacherName: home.course.teacherName,
      season: home.course.season,
      description: home.course.description,
      accessEndsOn: home.course.accessEndsOn ?? null
    },
    sections: home.sections.map((section) => ({
      id: section.id,
      items: section.items.map((item) => ({
        slug: item.slug,
        title: item.title,
        displayTitle: item.displayTitle,
        session: item.session,
        type: item.type,
        videoProvider: item.videoProvider,
        publishedAt: iso(item.publishedAt)
      }))
    })),
    upcoming: home.upcoming.map((s) => ({ title: s.title, startsAt: iso(s.startsAt), durationMinutes: s.durationMinutes })),
    webPath
  }
}

type MediaKind = 'none' | 'youtube' | 'pdf' | 'video' | 'external'

export async function iosApiLesson(db: Db, actor: Actor | null, slug: string) {
  assertStudentOrGuest(actor)
  const item = await iosLesson(db, actor, slug)
  const kind: MediaKind =
    item.type === 'VIDEO' ? (item.videoProvider === 'YOUTUBE' && item.youtubeId ? 'youtube' : 'video')
      : item.type === 'PDF' && item.fileId ? 'pdf'
        : item.externalUrl ? 'external'
          : 'none'
  return {
    lesson: {
      slug: item.slug,
      title: item.title,
      summary: item.summary ?? null,
      type: item.type,
      bodyMarkdown: item.body ?? null,
      media: {
        kind,
        // معرّف المحتوى للفيديو: نبضات المشاهدة وحدّ الجهاز الواحد في المشغّل الأصلي (لا رابط ملف)
        ...(kind === 'youtube' ? { youtubeId: item.youtubeId, contentId: item.id } : {}),
        ...(kind === 'video' ? { contentId: item.id } : {}),
        // PDF: معرّف المحتوى ليستعمله مسار التصدير الحالي المحمي، لا رابط ملف
        ...(kind === 'pdf' ? { contentId: item.id, allowDownload: Boolean(item.allowDownload) } : {})
      },
      webPath: `/ios/lesson/${encodeURIComponent(item.slug)}`
    },
    // العلامة المائية في المشغّل الأصلي: اسم التلميذ نفسه ورمز حسابه (أول 8 خانات، مثل الموقع) — لا بريد ولا هاتف
    viewer: actor ? { name: actor.fullName || null, code: actor.userId.slice(0, 8) } : null
  }
}
