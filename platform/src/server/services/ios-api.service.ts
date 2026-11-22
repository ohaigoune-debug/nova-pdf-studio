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
import { lessonPracticeForStudent, practiceCountsFor } from './lesson-practice.service'
import { joinWindow, upcomingForStudent } from './live.service'

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
  // نص الشروط ونسختها ليقبلها التلميذ داخل التطبيق الأصيل (POST /api/v1/ios/courses/:slug/terms)
  if (home.needsTerms) return { needsTerms: true as const, course: { slug: home.course.slug, title: home.course.title }, terms: { text: home.course.termsText, version: home.course.termsVersion }, webPath }
  const [practice, live] = await Promise.all([
    practiceCountsFor(
      db,
      home.sections.flatMap((section) => section.items.map((item) => item.id))
    ),
    actor ? upcomingForStudent(db, actor).then((ls) => ls.filter((l) => l.courseId === home.course.id).slice(0, 10)) : Promise.resolve([])
  ])
  return {
    needsTerms: false as const,
    course: {
      slug: home.course.slug,
      title: home.course.title,
      teacherName: home.course.teacherName,
      season: home.course.season,
      description: home.course.description,
      accessEndsOn: home.course.accessEndsOn ?? null,
      // فوج الدورة: يفتح «القسم الافتراضي» في التطبيق (Build 16)
      groupId: home.course.groupId
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
        publishedAt: iso(item.publishedAt),
        // تمارين QCM من بنك مدرسة تحت هذا الدرس (Build 18): تُعدّ في باب «تمارين QCM» كما في الموقع
        practiceCount: practice.get(item.id) ?? 0
      }))
    })),
    // id ونافذة الانضمام: زر «انضم» في التطبيق (Build 18)؛ الرابط نفسه لا يُرسل إلا عند الانضمام.
    // مصدرها مصدر باب «الحصص المباشرة» في الموقع: المجدولة والجارية ما دامت نافذة الانضمام مفتوحة
    upcoming: live.map((s) => {
      const w = joinWindow(s.startsAt, s.durationMinutes)
      return { id: s.id, title: s.title, startsAt: iso(s.startsAt), durationMinutes: s.durationMinutes, provider: s.provider, status: s.status, joinOpensAt: iso(w.opensAt), joinClosesAt: iso(w.closesAt) }
    }),
    webPath
  }
}

type MediaKind = 'none' | 'youtube' | 'pdf' | 'video' | 'external'

type LessonPart =
  | { kind: 'youtube'; youtubeId: string; contentId: string }
  | { kind: 'video'; contentId: string; provider: string | null }
  | { kind: 'pdf'; contentId: string; allowDownload: boolean }
  | { kind: 'external'; url: string | null }

/**
 * أجزاء الدرس بالقاعدة نفسها لصفحة الدرس في الموقع (LessonMedia)، لا بنوع المحتوى وحده:
 * درس الدورة (1 نوفمبر 2026) نوعه LESSON ويحمل فيديو (يوتيوب أو Bunny) وملف PDF معًا.
 * الفيديو أولًا ثم الملف. ملف غير جاهز أو غير PDF مع فيديو لا يُعرض، كما في الموقع.
 */
export function lessonParts(item: { id: string; type: string; videoProvider: string | null; youtubeId: string | null; fileId: string | null; fileMime?: string | null; fileStatus?: string | null; allowDownload: boolean | null; externalUrl: string | null }): LessonPart[] {
  const parts: LessonPart[] = []
  const hasVideo = item.videoProvider === 'YOUTUBE' || item.videoProvider === 'BUNNY'
  if (item.videoProvider === 'YOUTUBE' && item.youtubeId) parts.push({ kind: 'youtube', youtubeId: item.youtubeId, contentId: item.id })
  else if (item.videoProvider === 'BUNNY') parts.push({ kind: 'video', contentId: item.id, provider: 'BUNNY' })
  const fileReady = Boolean(item.fileId) && (!item.fileStatus || item.fileStatus === 'READY')
  const mime = item.fileMime ?? (item.type === 'PDF' ? 'application/pdf' : null)
  if (fileReady && mime === 'application/pdf') parts.push({ kind: 'pdf', contentId: item.id, allowDownload: Boolean(item.allowDownload) })
  else if (fileReady && !hasVideo && mime?.startsWith('video/')) parts.push({ kind: 'video', contentId: item.id, provider: item.videoProvider ?? 'UPLOAD' })
  if (item.externalUrl && item.videoProvider !== 'YOUTUBE') parts.push({ kind: 'external', url: /^https:\/\//i.test(item.externalUrl) ? item.externalUrl : null })
  return parts
}

export async function iosApiLesson(db: Db, actor: Actor | null, slug: string) {
  assertStudentOrGuest(actor)
  const item = await iosLesson(db, actor, slug)
  const parts = lessonParts(item)
  // media: الجزء الأول، للنسخ السابقة من التطبيق التي تعرض جزءًا واحدًا (Build 10 وما قبلها)
  const first = parts[0]
  const media: { kind: MediaKind } & Record<string, unknown> = first ? { ...first } : { kind: 'none' }
  return {
    lesson: {
      slug: item.slug,
      title: item.title,
      summary: item.summary ?? null,
      type: item.type,
      bodyMarkdown: item.body ?? null,
      media,
      // كل أجزاء الدرس بالترتيب (فيديو ثم PDF ثم رابط) — Build 11 وما بعدها
      parts,
      webPath: `/ios/lesson/${encodeURIComponent(item.slug)}`
    },
    // العلامة المائية في المشغّل الأصلي: اسم التلميذ نفسه ورمز حسابه (أول 8 خانات، مثل الموقع) — لا بريد ولا هاتف
    viewer: actor ? { name: actor.fullName || null, code: actor.userId.slice(0, 8) } : null,
    // «تدرّب على هذا الدرس» (Build 18): تمارين بنك مدرسة تحت درس الدورة للمشترك؛ [] لغيره.
    // التطبيق يفتح بها لعبة البطاقات أو الموضوع الأصليّين، مع ?practice=<linkId> (باشتراك الدورة لا بتجربة PLAY)
    practice: actor
      ? ((await lessonPracticeForStudent(db, actor, item.id)) ?? []).map((p) => ({ linkId: p.linkId, kind: p.kind, refId: p.refId, title: p.title, subtitle: p.subtitle, bestPct: p.best?.pct ?? null, bestLabel: p.best?.label ?? null }))
      : []
  }
}
