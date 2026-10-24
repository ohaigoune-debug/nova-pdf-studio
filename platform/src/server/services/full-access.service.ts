/**
 * الوصول الشامل (قرار المالك 2026-10-24): التلاميذ المسجّلون عنده بكود قبل التحوّل إلى الدورات المدفوعة
 * يُنقلون إلى الجانب المدفوع ويصلون إلى كل المحتوى واللعبة «وكأنهم مشتركون في الدورة».
 *
 * التنفيذ لا يضيف مسار وصول موازياً: يُعلَّم التلميذ بـ students.full_access_until، ثم يُشترَك اشتراكاً حقيقياً
 * (GIFT، ينتهي في التاريخ نفسه) في كل دورة منشورة — وفي كل دورة تُنشر لاحقاً تلقائياً. فيمرّ كل شيء
 * (الدروس، الفيديو، الحصص المباشرة، «دوراتي») من آلية الاشتراك نفسها. عضويات أفواجهم القديمة تبقى كما هي.
 * idempotent: إعادة التشغيل لا تكرّر شيئاً، ولا تمسّ اشتراكاً نشطاً قائماً.
 */
import { and, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseEnrollments, courses, groupStudents, groups, students } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { enrollStudent } from './courses.service'

/** نهاية موسم البكالوريا 2027 (بتوقيت الجزائر) — الافتراضي */
export const DEFAULT_FULL_ACCESS_UNTIL = new Date('2027-07-31T22:59:59Z')

/** المرشّحون: من انضمّ إلى فوج عادي (ليس فوج دورة) برمز تسجيل، أو صُنّف حضورياً */
export async function codeRegisteredStudentIds(db: Db): Promise<string[]> {
  const rows = await db
    .selectDistinct({ id: students.id })
    .from(students)
    .leftJoin(groupStudents, eq(groupStudents.studentId, students.id))
    .leftJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(
      or(
        and(isNotNull(groupStudents.enrolledViaCodeId), sql`not exists (select 1 from courses c where c.group_id = ${groups.id} and c.deleted_at is null)`),
        eq(students.studentType, 'IN_PERSON')
      )
    )
  return rows.map((r) => r.id)
}

async function publishedCourseIds(db: Db): Promise<string[]> {
  const rows = await db.select({ id: courses.id }).from(courses).where(and(eq(courses.status, 'PUBLISHED'), isNull(courses.deletedAt)))
  return rows.map((r) => r.id)
}

/** هل له اشتراك نشط غير منتهٍ في الدورة؟ (لا نلمسه حينها) */
async function activeEnrolledIds(db: Db, courseId: string, studentIds: string[]): Promise<Set<string>> {
  if (!studentIds.length) return new Set()
  const rows = await db
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, courseId), inArray(courseEnrollments.studentId, studentIds), eq(courseEnrollments.status, 'ACTIVE'), or(isNull(courseEnrollments.expiresAt), gt(courseEnrollments.expiresAt, new Date()))))
  return new Set(rows.map((r) => r.studentId))
}

export interface FullAccessReport {
  dryRun: boolean
  until: string
  candidates: number
  newlyFlagged: number
  courses: number
  enrollmentsCreated: number
}

/**
 * يمنح الوصول الشامل للمسجّلين بكود. dryRun: يحسب فقط ولا يكتب شيئاً.
 * actor = null للأداة من سطر الأوامر (بموافقة المالك وبعد نسخة احتياطية).
 */
export async function grantFullAccessToCodeStudents(db: Db, actor: Actor | null, opts: { dryRun?: boolean; until?: Date } = {}): Promise<FullAccessReport> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  const until = opts.until ?? DEFAULT_FULL_ACCESS_UNTIL
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) throw new AppError('VALIDATION', { field: 'until' })
  const ids = await codeRegisteredStudentIds(db)
  const courseIds = await publishedCourseIds(db)
  const already = ids.length
    ? (await db.select({ id: students.id }).from(students).where(and(inArray(students.id, ids), isNotNull(students.fullAccessUntil), gt(students.fullAccessUntil, new Date())))).map((r) => r.id)
    : []
  let enrollmentsCreated = 0
  if (opts.dryRun) {
    for (const c of courseIds) enrollmentsCreated += ids.length - (await activeEnrolledIds(db, c, ids)).size
    return { dryRun: true, until: until.toISOString(), candidates: ids.length, newlyFlagged: ids.length - already.length, courses: courseIds.length, enrollmentsCreated }
  }
  if (ids.length) await db.update(students).set({ fullAccessUntil: until, updatedAt: new Date() }).where(inArray(students.id, ids))
  for (const c of courseIds) enrollmentsCreated += await enrollStudentsInCourse(db, c, ids, until)
  await writeAudit(db, { actorUserId: actor?.userId ?? null, workspaceId: null, action: 'students.full_access_granted', entityType: 'students', entityId: null, newValue: { candidates: ids.length, courses: courseIds.length, enrollmentsCreated, until: until.toISOString() } })
  return { dryRun: false, until: until.toISOString(), candidates: ids.length, newlyFlagged: ids.length - already.length, courses: courseIds.length, enrollmentsCreated }
}

async function enrollStudentsInCourse(db: Db, courseId: string, studentIds: string[], until: Date): Promise<number> {
  const skip = await activeEnrolledIds(db, courseId, studentIds)
  let n = 0
  for (const sid of studentIds) {
    if (skip.has(sid)) continue
    await enrollStudent(db, null, { courseId, studentId: sid, source: 'GIFT', expiresAt: until, silent: true })
    n++
  }
  return n
}

/** عند نشر دورة: كل من له وصول شامل ساري يُشترَك فيها حتى تاريخ وصوله */
export async function enrollFullAccessInCourse(db: Db, courseId: string): Promise<number> {
  const rows = await db.select({ id: students.id, until: students.fullAccessUntil }).from(students).where(and(isNotNull(students.fullAccessUntil), gt(students.fullAccessUntil, new Date())))
  let n = 0
  for (const r of rows) n += await enrollStudentsInCourse(db, courseId, [r.id], r.until!)
  return n
}

/** هل للتلميذ وصول شامل ساري؟ (للعرض في الواجهة) */
export async function fullAccessUntil(db: Db, studentId: string): Promise<Date | null> {
  const [r] = await db.select({ until: students.fullAccessUntil }).from(students).where(eq(students.id, studentId)).limit(1)
  return r?.until && r.until.getTime() > Date.now() ? r.until : null
}
