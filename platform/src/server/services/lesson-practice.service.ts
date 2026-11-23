/**
 * تمارين تحت درس الدورة من بنك مدرسة PLAY (قرار المالك 22 نوفمبر 2026):
 *  - المشرف/رافع المحتوى يضيف تحت الدرس لعبة درس من المنهاج (أسئلة PLAY) أو بكالوريا/فرضًا محوَّلًا.
 *  - مشترك الدورة يلعبها مجانًا من تحت الدرس، بالبطاقات نفسها، ولو كان قسم PLAY مخفيًا في الموقع.
 *  - الجولة/المحاولة تحمل practiceLinkId، فيُفحص اشتراك الدورة عند كل إجابة (practice-access.ts).
 */
import { and, asc, desc, eq, ilike, inArray, isNull, max, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentPlayLinks, contentTargets, courseEnrollments, courses, playExamAttempts, playExamSets, playLessons, playQuestions, playSessions, type LessonPracticeKind } from '@/server/db/schema'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { gradeByCode, subjectName } from '@/server/play/constants'
import { getCourseLesson } from './course-lessons.service'
import { startExamAttempt } from './play-exams.service'
import { getPlayRules, servableFilter, startPlaySession } from './play.service'
import { practiceLinkForStudent } from './practice-access'

export const PRACTICE_MAX_PER_LESSON = 12

const EXAM_KIND_AR: Record<string, string> = { BAC: 'بكالوريا', DEVOIR: 'فرض', TEST: 'اختبار', PROPOSAL: 'موضوع مقترح' }

export interface PracticeBankItem {
  kind: LessonPracticeKind
  /** معرّف درس PLAY أو مجموعة الامتحان */
  refId: string
  title: string
  subtitle: string
}

export interface LessonPracticeAdminItem extends PracticeBankItem {
  linkId: string
}

function gradeLabel(code: string): string {
  return gradeByCode(code)?.shortAr ?? code
}

/* ───────────────────────── البنك (للمشرف) ───────────────────────── */

/** بحث في بنك مدرسة: دروس PLAY (بعدد أسئلتها الصالحة) أو بكالوريات/فروض منشورة */
export async function searchPracticeBank(
  db: Db,
  actor: Actor,
  input: { kind: LessonPracticeKind; q?: string | null; gradeCode?: string | null; subjectCode?: string | null; examKind?: string | null; limit?: number }
): Promise<PracticeBankItem[]> {
  assertRole(actor, 'SUPER_ADMIN', 'CONTENT_UPLOADER', 'TEACHER')
  const q = (input.q ?? '').trim().slice(0, 80)
  const limit = Math.max(1, Math.min(60, input.limit ?? 30))
  if (input.kind === 'LESSON') {
    const rules = await getPlayRules(db)
    const counts = db
      .select({ lessonId: playQuestions.lessonId, n: sql<number>`count(*)::int`.as('n') })
      .from(playQuestions)
      .where(servableFilter(rules))
      .groupBy(playQuestions.lessonId)
      .as('counts')
    const rows = await db
      .select({ id: playLessons.id, lessonName: playLessons.lessonName, unitName: playLessons.unitName, gradeCode: playLessons.gradeCode, subjectCode: playLessons.subjectCode, n: counts.n })
      .from(playLessons)
      .innerJoin(counts, eq(counts.lessonId, playLessons.id))
      .where(
        and(
          eq(playLessons.isActive, true),
          input.gradeCode ? eq(playLessons.gradeCode, input.gradeCode) : undefined,
          input.subjectCode ? eq(playLessons.subjectCode, input.subjectCode) : undefined,
          q ? or(ilike(playLessons.lessonName, `%${q}%`), ilike(playLessons.unitName, `%${q}%`)) : undefined
        )
      )
      .orderBy(asc(playLessons.gradeCode), asc(playLessons.subjectCode), asc(playLessons.unitOrder), asc(playLessons.lessonOrder))
      .limit(limit)
    return rows.map((r) => ({ kind: 'LESSON', refId: r.id, title: `لعبة: ${r.lessonName}`, subtitle: `${subjectName(r.subjectCode)} · ${gradeLabel(r.gradeCode)} · ${r.unitName} · ${r.n} سؤالًا` }))
  }
  const rows = await db
    .select({ id: playExamSets.id, title: playExamSets.title, kind: playExamSets.kind, gradeCode: playExamSets.gradeCode, subjectCode: playExamSets.subjectCode, year: playExamSets.year, scoreTotal: playExamSets.scoreTotal })
    .from(playExamSets)
    .where(
      and(
        eq(playExamSets.publishable, true),
        input.gradeCode ? eq(playExamSets.gradeCode, input.gradeCode) : undefined,
        input.subjectCode ? eq(playExamSets.subjectCode, input.subjectCode) : undefined,
        input.examKind ? eq(playExamSets.kind, input.examKind) : undefined,
        q ? ilike(playExamSets.title, `%${q}%`) : undefined
      )
    )
    .orderBy(sql`${playExamSets.year} desc nulls last`, asc(playExamSets.term), asc(playExamSets.paper), asc(playExamSets.title))
    .limit(limit)
  return rows.map((r) => ({ kind: 'EXAM_SET', refId: r.id, title: r.title, subtitle: `${EXAM_KIND_AR[r.kind] ?? r.kind} · ${subjectName(r.subjectCode)} · ${gradeLabel(r.gradeCode)} · على ${r.scoreTotal}` }))
}

async function linkRows(db: Db, contentId: string, opts: { publishableOnly: boolean }) {
  const rows = await db
    .select({
      linkId: contentPlayLinks.id,
      kind: contentPlayLinks.kind,
      playLessonId: contentPlayLinks.playLessonId,
      examSetId: contentPlayLinks.examSetId,
      lessonName: playLessons.lessonName,
      lessonActive: playLessons.isActive,
      unitName: playLessons.unitName,
      lessonGrade: playLessons.gradeCode,
      lessonSubject: playLessons.subjectCode,
      setTitle: playExamSets.title,
      setKind: playExamSets.kind,
      setGrade: playExamSets.gradeCode,
      setSubject: playExamSets.subjectCode,
      setScore: playExamSets.scoreTotal,
      setPublishable: playExamSets.publishable
    })
    .from(contentPlayLinks)
    .leftJoin(playLessons, eq(playLessons.id, contentPlayLinks.playLessonId))
    .leftJoin(playExamSets, eq(playExamSets.id, contentPlayLinks.examSetId))
    .where(eq(contentPlayLinks.contentId, contentId))
    .orderBy(asc(contentPlayLinks.sortOrder), asc(contentPlayLinks.createdAt))
  return rows
    .filter((r) => !opts.publishableOnly || (r.kind === 'LESSON' ? r.lessonActive === true : r.setPublishable === true))
    .map((r) =>
      r.kind === 'LESSON'
        ? { linkId: r.linkId, kind: 'LESSON' as const, refId: r.playLessonId!, title: `لعبة: ${r.lessonName ?? ''}`, subtitle: `${r.unitName ?? ''} · ${gradeLabel(r.lessonGrade ?? '')}` }
        : { linkId: r.linkId, kind: 'EXAM_SET' as const, refId: r.examSetId!, title: r.setTitle ?? '', subtitle: `${EXAM_KIND_AR[r.setKind ?? ''] ?? ''} · على ${r.setScore ?? 20}` }
    )
}

/** تمارين الدرس كما يراها محرّر الدورة */
export async function listLessonPractice(db: Db, actor: Actor, courseId: string, lessonId: string): Promise<LessonPracticeAdminItem[]> {
  await getCourseLesson(db, actor, courseId, lessonId)
  return linkRows(db, lessonId, { publishableOnly: false })
}

export async function addLessonPractice(db: Db, actor: Actor, courseId: string, lessonId: string, input: { kind: LessonPracticeKind; refId: string }): Promise<{ linkId: string }> {
  const { course } = await getCourseLesson(db, actor, courseId, lessonId)
  assertUuid(input.refId, 'VALIDATION')
  if (input.kind === 'LESSON') {
    const [l] = await db.select({ id: playLessons.id }).from(playLessons).where(and(eq(playLessons.id, input.refId), eq(playLessons.isActive, true))).limit(1)
    if (!l) throw new AppError('PLAY_LESSON_NOT_FOUND')
    // درس بلا أسئلة صالحة للعب لا يُضاف (لعبة فارغة تحت الدرس)
    const [q] = await db.select({ id: playQuestions.id }).from(playQuestions).where(and(eq(playQuestions.lessonId, l.id), servableFilter(await getPlayRules(db)))).limit(1)
    if (!q) throw new AppError('PLAY_NO_QUESTIONS')
  } else if (input.kind === 'EXAM_SET') {
    const [s] = await db.select({ id: playExamSets.id }).from(playExamSets).where(and(eq(playExamSets.id, input.refId), eq(playExamSets.publishable, true))).limit(1)
    if (!s) throw new AppError('PLAY_EXAM_NOT_FOUND')
  } else throw new AppError('VALIDATION', { field: 'kind' })
  return db.transaction(async (tx) => {
    const ref = input.kind === 'LESSON' ? eq(contentPlayLinks.playLessonId, input.refId) : eq(contentPlayLinks.examSetId, input.refId)
    const [dup] = await tx.select({ id: contentPlayLinks.id }).from(contentPlayLinks).where(and(eq(contentPlayLinks.contentId, lessonId), ref)).limit(1)
    if (dup) return { linkId: dup.id }
    const [agg] = await tx.select({ n: sql<number>`count(*)::int`, top: max(contentPlayLinks.sortOrder) }).from(contentPlayLinks).where(eq(contentPlayLinks.contentId, lessonId))
    if ((agg?.n ?? 0) >= PRACTICE_MAX_PER_LESSON) throw new AppError('VALIDATION', { field: 'max', max: PRACTICE_MAX_PER_LESSON })
    const [row] = await tx
      .insert(contentPlayLinks)
      .values({
        contentId: lessonId,
        kind: input.kind,
        playLessonId: input.kind === 'LESSON' ? input.refId : null,
        examSetId: input.kind === 'EXAM_SET' ? input.refId : null,
        sortOrder: (agg?.top ?? -1) + 1,
        createdByUserId: actor.userId
      })
      .returning({ id: contentPlayLinks.id })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'lesson.practice_add', entityType: 'content', entityId: lessonId, newValue: { kind: input.kind, refId: input.refId } })
    return { linkId: row!.id }
  })
}

async function ownLink(db: Db, lessonId: string, linkId: string) {
  assertUuid(linkId, 'LESSON_PRACTICE_NOT_FOUND')
  const [l] = await db.select().from(contentPlayLinks).where(and(eq(contentPlayLinks.id, linkId), eq(contentPlayLinks.contentId, lessonId))).limit(1)
  if (!l) throw new AppError('LESSON_PRACTICE_NOT_FOUND')
  return l
}

export async function removeLessonPractice(db: Db, actor: Actor, courseId: string, lessonId: string, linkId: string): Promise<void> {
  const { course } = await getCourseLesson(db, actor, courseId, lessonId)
  const l = await ownLink(db, lessonId, linkId)
  await db.delete(contentPlayLinks).where(eq(contentPlayLinks.id, l.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'lesson.practice_remove', entityType: 'content', entityId: lessonId, oldValue: { kind: l.kind, refId: l.playLessonId ?? l.examSetId } })
}

export async function moveLessonPractice(db: Db, actor: Actor, courseId: string, lessonId: string, linkId: string, direction: 'up' | 'down'): Promise<void> {
  await getCourseLesson(db, actor, courseId, lessonId)
  await ownLink(db, lessonId, linkId)
  await db.transaction(async (tx) => {
    const rows = await tx.select({ id: contentPlayLinks.id }).from(contentPlayLinks).where(eq(contentPlayLinks.contentId, lessonId)).orderBy(asc(contentPlayLinks.sortOrder), asc(contentPlayLinks.createdAt)).for('update')
    const i = rows.findIndex((r) => r.id === linkId)
    const j = direction === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= rows.length) return
    const order = rows.map((r) => r.id)
    ;[order[i], order[j]] = [order[j]!, order[i]!]
    for (let k = 0; k < order.length; k++) await tx.update(contentPlayLinks).set({ sortOrder: k }).where(eq(contentPlayLinks.id, order[k]!))
  })
}

/* ───────────────────────── التلميذ ───────────────────────── */

export interface StudentPracticeItem {
  linkId: string
  kind: LessonPracticeKind
  /** معرّف درس PLAY أو الموضوع: يفتح به تطبيق آيفون شاشته الأصلية (Build 18) */
  refId: string
  title: string
  subtitle: string
  /** أفضل نتيجة سابقة للتلميذ في هذا التمرين (أي جولة/محاولة مكتملة فيه) */
  best: { label: string; pct: number } | null
}

/** تمارين الدرس لمشترك نشط في دورة يُستهدف بها الدرس؛ null لغيره (لا شيء يظهر) */
export async function lessonPracticeForStudent(db: Db, actor: Actor, contentId: string): Promise<StudentPracticeItem[] | null> {
  if (actor.role !== 'STUDENT' || !actor.studentId) return null
  const studentId = actor.studentId
  const [enrolled] = await db
    .select({ id: courseEnrollments.id })
    .from(contentTargets)
    .innerJoin(courses, and(eq(courses.groupId, contentTargets.groupId), isNull(courses.deletedAt)))
    .innerJoin(
      courseEnrollments,
      and(eq(courseEnrollments.courseId, courses.id), eq(courseEnrollments.studentId, studentId), eq(courseEnrollments.status, 'ACTIVE'), sql`(${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now())`)
    )
    .where(eq(contentTargets.contentId, contentId))
    .limit(1)
  if (!enrolled) return null
  const links = await linkRows(db, contentId, { publishableOnly: true })
  if (!links.length) return []
  const lessonIds = links.filter((l) => l.kind === 'LESSON').map((l) => l.refId)
  const setIds = links.filter((l) => l.kind === 'EXAM_SET').map((l) => l.refId)
  const [sessions, attempts] = await Promise.all([
    lessonIds.length
      ? db
          .select({ lessonId: playSessions.lessonId, correct: playSessions.correctCount, size: sql<number>`cardinality(${playSessions.questionIds})` })
          .from(playSessions)
          .where(and(eq(playSessions.studentId, studentId), eq(playSessions.status, 'COMPLETED'), inArray(playSessions.lessonId, lessonIds)))
          .orderBy(desc(playSessions.completedAt))
          .limit(200)
      : Promise.resolve([]),
    setIds.length
      ? db
          .select({ setId: playExamAttempts.setId, score: playExamAttempts.score, maxScore: playExamAttempts.maxScore })
          .from(playExamAttempts)
          .where(and(eq(playExamAttempts.studentId, studentId), eq(playExamAttempts.status, 'COMPLETED'), inArray(playExamAttempts.setId, setIds)))
          .limit(200)
      : Promise.resolve([])
  ])
  return links.map((l) => {
    let best: StudentPracticeItem['best'] = null
    if (l.kind === 'LESSON') {
      for (const s of sessions.filter((x) => x.lessonId === l.refId)) {
        const pct = s.size ? Math.round((100 * s.correct) / s.size) : 0
        if (!best || pct > best.pct) best = { pct, label: `أفضل نتيجة لك ${s.correct}/${s.size}` }
      }
    } else {
      for (const a of attempts.filter((x) => x.setId === l.refId)) {
        const pct = a.maxScore ? Math.round((100 * a.score) / a.maxScore) : 0
        if (!best || pct > best.pct) best = { pct, label: `أفضل علامة لك ${Number(a.score.toFixed(2))}/${a.maxScore}` }
      }
    }
    return { linkId: l.linkId, kind: l.kind, refId: l.refId, title: l.title, subtitle: l.subtitle, best }
  })
}

/** يبدأ التمرين (جولة PLAY للدرس، أو محاولة للموضوع) ويعيد مسار اللعب */
export async function startLessonPractice(db: Db, actor: Actor, linkId: string, now: Date = new Date()): Promise<{ href: string }> {
  const studentId = studentIdOf(actor)
  const link = await practiceLinkForStudent(db, studentId, linkId)
  if (link.kind === 'LESSON' && link.playLessonId) {
    const [lesson] = await db.select({ gradeCode: playLessons.gradeCode, subjectCode: playLessons.subjectCode, isActive: playLessons.isActive }).from(playLessons).where(eq(playLessons.id, link.playLessonId)).limit(1)
    if (!lesson?.isActive) throw new AppError('LESSON_PRACTICE_NOT_FOUND')
    const session = await startPlaySession(db, actor, { challengeType: 'LESSON_MASTERY', subjectCode: lesson.subjectCode, lessonId: link.playLessonId }, now, { practice: { linkId: link.id, gradeCode: lesson.gradeCode } })
    return { href: `/student/play/session/${session.id}` }
  }
  if (link.kind === 'EXAM_SET' && link.examSetId) {
    const r = await startExamAttempt(db, actor, link.examSetId, 'PRACTICE', now, { practiceLinkId: link.id })
    return { href: `/student/play/exam/${r.attemptId}` }
  }
  throw new AppError('LESSON_PRACTICE_NOT_FOUND')
}

/** صفحة الدرس التي يعود إليها التلميذ بعد تمرين من تحته */
export async function practiceBackHref(db: Db, linkId: string): Promise<string> {
  const [row] = await db.select({ slug: content.slug }).from(contentPlayLinks).innerJoin(content, eq(content.id, contentPlayLinks.contentId)).where(eq(contentPlayLinks.id, linkId)).limit(1)
  return row ? `/student/lessons/${encodeURIComponent(row.slug)}` : '/student/courses'
}

/**
 * قسم PLAY مخفي في الموقع، لكن جولة/محاولة بدأت من تحت درس الدورة تبقى مفتوحة لصاحبها:
 * ‎/student/play/session/<id>‎ و ‎/student/play/exam/<id>[/result]‎.
 */
export async function isOwnPracticeRunPath(db: Db, actor: Actor, path: string): Promise<boolean> {
  if (actor.role !== 'STUDENT' || !actor.studentId) return false
  const m = /^\/student\/play\/(session|exam)\/([0-9a-f-]{36})(?:\/result)?\/?$/i.exec(path)
  if (!m) return false
  const id = m[2]!
  if (m[1] === 'session') {
    const [s] = await db.select({ p: playSessions.practiceLinkId }).from(playSessions).where(and(eq(playSessions.id, id), eq(playSessions.studentId, actor.studentId))).limit(1)
    return Boolean(s?.p)
  }
  const [a] = await db.select({ p: playExamAttempts.practiceLinkId }).from(playExamAttempts).where(and(eq(playExamAttempts.id, id), eq(playExamAttempts.studentId, actor.studentId))).limit(1)
  return Boolean(a?.p)
}

/** عدد تمارين البنك تحت دروس قائمة (لبلاطة «تمارين QCM» في صفحة الدورة) */
export async function practiceCountsFor(db: Db, contentIds: string[]): Promise<Map<string, number>> {
  if (!contentIds.length) return new Map()
  const rows = await db
    .select({ contentId: contentPlayLinks.contentId, n: sql<number>`count(*)::int` })
    .from(contentPlayLinks)
    .where(inArray(contentPlayLinks.contentId, contentIds))
    .groupBy(contentPlayLinks.contentId)
  return new Map(rows.map((r) => [r.contentId, r.n]))
}
