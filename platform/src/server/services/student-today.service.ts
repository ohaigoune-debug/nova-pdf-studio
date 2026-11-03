/**
 * «اليوم» — الصفحة الرئيسية للتلميذ (3 نوفمبر 2026): ماذا يفعل الآن، لا قائمة أقسام.
 *  - أين توقّف في كل دورة مفعّلة: الحصة التالية بعد آخر ما شاهده، وتقدّمه فيها.
 *  - الواجبات التي لم يسلّمها، الأقرب موعدًا أولًا.
 *  - PLAY: تحدي اليوم، والأخطاء المستحقة للمراجعة، والسلسلة، والنقاط.
 * كل شيء من الجداول القائمة؛ لا جدول جديد.
 */
import { and, count, eq, gte, inArray, lte, max } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { mediaViews, playQuestionMemory, playSessions } from '@/server/db/schema'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { listAssignmentsForStudent } from './assignments.service'
import { courseHome, myCourses } from './courses.service'
import { getPlayProfile, getPlayRules, levelFor } from './play.service'

const MAX_COURSES = 3

export interface TodayCourse {
  id: string
  title: string
  href: string
  teacherName: string
  total: number
  seen: number
  /** الحصة التالية: بعد آخر ما شاهده، أو الأولى إن لم يبدأ */
  next: { title: string; href: string; started: boolean } | null
  needsTerms: boolean
  nextLive: { title: string; startsAt: Date } | null
}

export interface StudentToday {
  courses: TodayCourse[]
  hasCourses: boolean
  assignments: { id: string; title: string; dueAt: Date | null; teacherName: string | null }[]
  play: { ready: boolean; xpTotal: number; levelTitle: string; streakDays: number; dailyDone: boolean; mistakesDue: number }
}

async function courseProgress(db: Db, actor: Actor, slug: string): Promise<Pick<TodayCourse, 'total' | 'seen' | 'next' | 'needsTerms'>> {
  const home = await courseHome(db, actor, slug).catch(() => null)
  if (!home) return { total: 0, seen: 0, next: null, needsTerms: false }
  if (home.needsTerms) return { total: 0, seen: 0, next: null, needsTerms: true }
  // ترتيب الدورة كما يراه التلميذ: الحصص ثم الفيديوهات ثم الفروض ثم الاختبارات ثم الملفات
  const items = [...new Map(home.sections.flatMap((s) => s.items).map((i) => [i.id, i])).values()]
  if (items.length === 0) return { total: 0, seen: 0, next: null, needsTerms: false }
  const views = await db
    .select({ contentId: mediaViews.contentId, last: max(mediaViews.lastSeenAt) })
    .from(mediaViews)
    .where(and(eq(mediaViews.userId, actor.userId), inArray(mediaViews.contentId, items.map((i) => i.id))))
    .groupBy(mediaViews.contentId)
  const seenIds = new Set(views.map((v) => v.contentId))
  // آخر ما فتحه، ثم ما بعده في ترتيب الدورة (درس نصّي لا يُسجَّل له فتح، فلا يعلق عنده التلميذ)
  const latest = views.reduce<{ id: string; at: number } | null>((acc, v) => {
    const at = v.last ? new Date(v.last).getTime() : 0
    return !acc || at > acc.at ? { id: v.contentId, at } : acc
  }, null)
  const index = latest ? items.findIndex((i) => i.id === latest.id) : -1
  const nextItem = latest ? items.slice(index + 1).find((i) => !seenIds.has(i.id)) ?? items.find((i) => !seenIds.has(i.id)) : items[0]
  return {
    total: items.length,
    seen: seenIds.size,
    next: nextItem ? { title: nextItem.displayTitle || nextItem.title, href: nextItem.href, started: Boolean(latest) } : null,
    needsTerms: false
  }
}

export async function studentToday(db: Db, actor: Actor, now: Date = new Date()): Promise<StudentToday> {
  const studentId = studentIdOf(actor)
  const [all, assignmentRows, profile, rules] = await Promise.all([myCourses(db, actor), listAssignmentsForStudent(db, actor), getPlayProfile(db, actor), getPlayRules(db)])
  const active = all.filter((c) => c.status === 'ACTIVE')
  const shown = [...active].sort((a, b) => Number(Boolean(b.nextLive)) - Number(Boolean(a.nextLive))).slice(0, MAX_COURSES)
  const courses: TodayCourse[] = await Promise.all(
    shown.map(async (c) => ({
      id: c.id,
      title: c.title,
      href: c.href,
      teacherName: c.teacherName,
      nextLive: c.nextLive ? { title: c.nextLive.title, startsAt: c.nextLive.startsAt } : null,
      ...(c.termsAccepted ? await courseProgress(db, actor, c.slug) : { total: 0, seen: 0, next: null, needsTerms: true })
    }))
  )

  const assignments = assignmentRows
    .filter((a) => !a.submittedAt && (!a.dueAt || a.dueAt.getTime() > now.getTime()))
    .sort((a, b) => (a.dueAt?.getTime() ?? Number.POSITIVE_INFINITY) - (b.dueAt?.getTime() ?? Number.POSITIVE_INFINITY))
    .slice(0, 3)
    .map((a) => ({ id: a.id, title: a.title, dueAt: a.dueAt, teacherName: a.teacherName ?? null }))

  const today = now.toISOString().slice(0, 10)
  const [[daily], [due]] = await Promise.all([
    db
      .select({ n: count() })
      .from(playSessions)
      .where(and(eq(playSessions.studentId, studentId), eq(playSessions.challengeType, 'DAILY'), eq(playSessions.status, 'COMPLETED'), gte(playSessions.completedAt, new Date(`${today}T00:00:00.000Z`)))),
    db
      .select({ n: count() })
      .from(playQuestionMemory)
      .where(and(eq(playQuestionMemory.studentId, studentId), lte(playQuestionMemory.box, 1), lte(playQuestionMemory.dueAt, now)))
  ])
  return {
    courses,
    hasCourses: active.length > 0,
    assignments,
    play: {
      ready: Boolean(profile.gradeCode),
      xpTotal: profile.xpTotal,
      levelTitle: levelFor(rules, profile.xpTotal).title,
      streakDays: profile.streakDays,
      dailyDone: (daily?.n ?? 0) > 0,
      mistakesDue: due?.n ?? 0
    }
  }
}
