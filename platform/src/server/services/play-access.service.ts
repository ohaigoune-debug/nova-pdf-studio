/**
 * MADRASA PLAY — سياسة الوصول (11_ACCESS_AND_TRIAL_POLICY):
 *  1. تلميذ له اشتراك فعّال في دورة ملائمة (المستوى + المادة + الشعبة) ⇒ PLAY مجاني طوال صلاحية الاشتراك.
 *  2. وإلا: 72 ساعة كاملة من أول بدء لعب فعلي (وقت الخادم)، مرة واحدة لكل تلميذ، حتى للحسابات القديمة.
 *  3. بعدها: دعوة للاشتراك في الدورة من متجر مدرسة الحالي، لا اشتراك PLAY مستقل.
 * الخادم وحده مصدر الحقيقة: لا localStorage ولا ساعة الهاتف. يُفحص عند كل طلب حساس (بدء جولة، إرسال إجابة).
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseEnrollments, courses, levels, playAccessTrials, streams, subjects } from '@/server/db/schema'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { PLAY_TO_CURRICULUM_SUBJECT, PLAY_TRIAL_MS } from '@/server/play/constants'

export interface PlayScope {
  /** مستوى PLAY (3AS…) */
  gradeCode: string
  streamCode: string | null
  /** مادة الجولة؛ null = جولة متعددة المواد */
  subjectCode: string | null
}

export interface EntitledCourse {
  id: string
  title: string
  slug: string
  /** رموز مواد PLAY التي تغطيها الدورة؛ 'ALL' = كل المواد */
  subjects: 'ALL' | string[]
  expiresAt: string | null
}

export type PlayAccessState =
  | { kind: 'subscriber'; courses: EntitledCourse[]; subjects: 'ALL' | string[] }
  | { kind: 'trial_available' }
  | { kind: 'trial_active'; startedAt: string; endsAt: string; remainingMs: number }
  | { kind: 'trial_expired'; startedAt: string; endsAt: string }

export interface PlayAccess {
  state: PlayAccessState
  /** الدورات الفعالة الملائمة للمستوى (حتى لو لم تغطِّ مادة الجولة) */
  levelCourses: EntitledCourse[]
  /** المواد التي يغطيها الاشتراك دون تجربة */
  entitledSubjects: 'ALL' | string[]
  /** يجوز اللعب الآن في هذا النطاق */
  canPlay: boolean
}

const curriculumToPlay = (() => {
  const m = new Map<string, string[]>()
  for (const [play, codes] of Object.entries(PLAY_TO_CURRICULUM_SUBJECT)) for (const c of codes) m.set(c, [...(m.get(c) ?? []), play])
  return m
})()

/** الدورات الفعالة للتلميذ الملائمة لمستوى PLAY وشعبته، مع موادها برموز PLAY */
export async function activeLevelCourses(db: Db, studentId: string, scope: Pick<PlayScope, 'gradeCode' | 'streamCode'>, now: Date = new Date()): Promise<EntitledCourse[]> {
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      levelCode: levels.code,
      streamIds: courses.streamIds,
      subjectCode: subjects.code,
      accessEndsOn: courses.accessEndsOn,
      expiresAt: courseEnrollments.expiresAt
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
    .leftJoin(levels, eq(levels.id, courses.levelId))
    .leftJoin(subjects, eq(subjects.id, courses.subjectId))
    .where(
      and(
        eq(courseEnrollments.studentId, studentId),
        eq(courseEnrollments.status, 'ACTIVE'),
        isNull(courses.deletedAt),
        sql`(${courseEnrollments.expiresAt} IS NULL OR ${courseEnrollments.expiresAt} > ${now})`,
        sql`(${courses.accessEndsOn} IS NULL OR ${courses.accessEndsOn} >= ${now.toISOString().slice(0, 10)}::date)`
      )
    )
  if (!rows.length) return []
  let streamId: string | null = null
  if (scope.streamCode) {
    const [st] = await db.select({ id: streams.id }).from(streams).where(eq(streams.code, scope.streamCode)).limit(1)
    streamId = st?.id ?? null
  }
  const out: EntitledCourse[] = []
  for (const r of rows) {
    // المستوى: دورة بلا مستوى تغطي كل المستويات؛ وإلا يجب أن يطابق مستوى اللعبة
    if (r.levelCode && r.levelCode !== scope.gradeCode) continue
    // الشعبة: دورة بلا شعب تغطي كل الشعب؛ وإلا يجب أن تشمل شعبة التلميذ (إن كانت له شعبة)
    if (r.streamIds.length && streamId && !r.streamIds.includes(streamId)) continue
    const playSubjects = r.subjectCode ? (curriculumToPlay.get(r.subjectCode) ?? []) : 'ALL'
    if (playSubjects !== 'ALL' && playSubjects.length === 0) continue
    out.push({ id: r.id, title: r.title, slug: r.slug, subjects: playSubjects, expiresAt: r.expiresAt ? r.expiresAt.toISOString() : null })
  }
  return out
}

function unionSubjects(list: EntitledCourse[]): 'ALL' | string[] {
  if (list.some((c) => c.subjects === 'ALL')) return 'ALL'
  return [...new Set(list.flatMap((c) => c.subjects as string[]))].sort()
}

const covers = (entitled: 'ALL' | string[], subject: string | null) => (entitled === 'ALL' ? true : subject ? entitled.includes(subject) : entitled.length > 0)

/** حالة الوصول دون أي كتابة (للعرض) */
export async function getPlayAccess(db: Db, actor: Actor, scope: PlayScope, now: Date = new Date()): Promise<PlayAccess> {
  const studentId = studentIdOf(actor)
  const levelCourses = await activeLevelCourses(db, studentId, scope, now)
  const entitledSubjects = unionSubjects(levelCourses)
  if (levelCourses.length && covers(entitledSubjects, scope.subjectCode)) {
    const relevant = levelCourses.filter((c) => covers(c.subjects, scope.subjectCode))
    return { state: { kind: 'subscriber', courses: relevant, subjects: entitledSubjects }, levelCourses, entitledSubjects, canPlay: true }
  }
  const [trial] = await db.select().from(playAccessTrials).where(eq(playAccessTrials.studentId, studentId)).limit(1)
  if (!trial) return { state: { kind: 'trial_available' }, levelCourses, entitledSubjects, canPlay: true }
  const remainingMs = trial.endsAt.getTime() - now.getTime()
  if (remainingMs > 0) return { state: { kind: 'trial_active', startedAt: trial.startedAt.toISOString(), endsAt: trial.endsAt.toISOString(), remainingMs }, levelCourses, entitledSubjects, canPlay: true }
  return { state: { kind: 'trial_expired', startedAt: trial.startedAt.toISOString(), endsAt: trial.endsAt.toISOString() }, levelCourses, entitledSubjects, canPlay: false }
}

/**
 * قبل بدء جولة: المشترك يمرّ؛ وإلا تبدأ التجربة ذريًّا عند أول بدء فعلي (INSERT … ON CONFLICT DO NOTHING)،
 * ثم يُعاد قراءة الصف نفسه فلا تُمدَّد ولا تتكرر مهما تعدّدت الطلبات أو الأجهزة.
 * يُرجع المواد المسموحة لجولة متعددة المواد (null = بلا قيد).
 */
export async function beginPlayAccess(db: Db, actor: Actor, scope: PlayScope, now: Date = new Date()): Promise<{ access: PlayAccess; allowedSubjects: string[] | null }> {
  const studentId = studentIdOf(actor)
  let access = await getPlayAccess(db, actor, scope, now)
  if (access.state.kind === 'subscriber') {
    // جولة متعددة المواد لمشترك في بعض المواد فقط: لا أسئلة من مواد خارج اشتراكه
    const allowed = scope.subjectCode === null && access.entitledSubjects !== 'ALL' ? access.entitledSubjects : null
    return { access, allowedSubjects: allowed }
  }
  if (access.state.kind === 'trial_available') {
    await db
      .insert(playAccessTrials)
      .values({ studentId, startedAt: now, endsAt: new Date(now.getTime() + PLAY_TRIAL_MS) })
      .onConflictDoNothing()
    access = await getPlayAccess(db, actor, scope, now)
  }
  if (access.state.kind === 'trial_expired') throw new AppError('PLAY_TRIAL_EXPIRED')
  return { access, allowedSubjects: null }
}

/** عند كل إرسال إجابة: مشترك أو تجربة نشطة، وإلا يُرفض (لا تبدأ هنا تجربة جديدة) */
export async function assertPlayAccess(db: Db, actor: Actor, scope: PlayScope, now: Date = new Date()): Promise<PlayAccess> {
  const access = await getPlayAccess(db, actor, scope, now)
  if (access.state.kind === 'subscriber' || access.state.kind === 'trial_active') return access
  if (access.state.kind === 'trial_expired') throw new AppError('PLAY_TRIAL_EXPIRED')
  throw new AppError('PLAY_TRIAL_REQUIRED')
}

/** «متبقي لك يومان و8 ساعات» — نص عربي للمدة المتبقية */
export function remainingLabel(ms: number): string {
  const totalHours = Math.max(0, Math.floor(ms / 3_600_000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  const minutes = Math.max(0, Math.floor((ms % 3_600_000) / 60_000))
  const d = days === 0 ? '' : days === 1 ? 'يوم' : days === 2 ? 'يومان' : `${days} أيام`
  const h = hours === 0 ? '' : hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتان' : hours <= 10 ? `${hours} ساعات` : `${hours} ساعة`
  if (d && h) return `${d} و${h}`
  if (d || h) return d || h
  return minutes <= 1 ? 'أقل من دقيقة' : minutes === 2 ? 'دقيقتان' : minutes <= 10 ? `${minutes} دقائق` : `${minutes} دقيقة`
}
