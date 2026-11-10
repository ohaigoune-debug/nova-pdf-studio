/**
 * رافع المحتوى (CONTENT_UPLOADER) — طلب المالك 1 نوفمبر 2026.
 *  - حساب بلا مساحة أستاذ ولا ملف تلميذ؛ الدور لا يؤخذ من المتصفح أبدًا.
 *  - لا يرى ولا يعدّل إلا الدورات المسندة إليه في course_staff (التحقق في الخادم عند كل طلب).
 *  - لا مال ولا أسعار ولا تلاميذ ولا إعدادات ولا حذف دورات ولا إدارة أدوار.
 */
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseStaff, courses, profiles, teacherWorkspaces, teachers, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { normalizePhone } from './otp.service'

type CourseRow = typeof courses.$inferSelect

export interface CreateUploaderInput {
  email: string
  password: string
  fullName: string
  phone: string
  courseIds: string[]
}

async function assertCoursesExist(db: Db, ids: string[]): Promise<string[]> {
  const unique = [...new Set(ids)]
  for (const id of unique) assertUuid(id, 'COURSE_NOT_FOUND')
  if (unique.length === 0) return []
  const rows = await db.select({ id: courses.id }).from(courses).where(and(inArray(courses.id, unique), isNull(courses.deletedAt)))
  if (rows.length !== unique.length) throw new AppError('COURSE_NOT_FOUND')
  return unique
}

export async function createContentUploader(db: Db, actor: Actor, input: CreateUploaderInput): Promise<{ userId: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  const email = input.email.trim().toLowerCase()
  const fullName = input.fullName.trim()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError('VALIDATION', { field: 'email' })
  if (fullName.length < 3 || fullName.length > 120) throw new AppError('VALIDATION', { field: 'fullName' })
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
  const phone = normalizePhone(input.phone)
  const courseIds = await assertCoursesExist(db, input.courseIds)
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw new AppError('EMAIL_TAKEN')
  return db.transaction(async (tx) => {
    const [user] = await tx.insert(users).values({ email, passwordHash: await hashPassword(input.password), role: 'CONTENT_UPLOADER' }).returning({ id: users.id })
    if (!user) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: user.id, fullName, phone })
    if (courseIds.length) await tx.insert(courseStaff).values(courseIds.map((courseId) => ({ courseId, userId: user.id, createdByUserId: actor.userId })))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'uploader.create', entityType: 'user', entityId: user.id, newValue: { role: 'CONTENT_UPLOADER', courseIds } })
    return { userId: user.id }
  })
}

/** يستبدل قائمة الدورات المسندة لرافع المحتوى (الإضافة والسحب معًا) */
export async function setUploaderCourses(db: Db, actor: Actor, userId: string, courseIdsInput: string[]): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(userId, 'NOT_FOUND')
  const [u] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u || u.role !== 'CONTENT_UPLOADER') throw new AppError('NOT_FOUND')
  const courseIds = await assertCoursesExist(db, courseIdsInput)
  const before = (await db.select({ courseId: courseStaff.courseId }).from(courseStaff).where(eq(courseStaff.userId, userId))).map((r) => r.courseId)
  await db.transaction(async (tx) => {
    await tx.delete(courseStaff).where(eq(courseStaff.userId, userId))
    if (courseIds.length) await tx.insert(courseStaff).values(courseIds.map((courseId) => ({ courseId, userId, createdByUserId: actor.userId })))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'uploader.courses', entityType: 'user', entityId: userId, oldValue: { courseIds: before }, newValue: { courseIds } })
  })
}

export interface UploaderRow {
  id: string
  email: string
  status: string
  fullName: string | null
  phone: string | null
  createdAt: Date
  courses: { id: string; title: string }[]
}

export async function listContentUploaders(db: Db, actor: Actor): Promise<UploaderRow[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: users.id, email: users.email, status: users.status, fullName: profiles.fullName, phone: profiles.phone, createdAt: users.createdAt })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(users.role, 'CONTENT_UPLOADER'))
    .orderBy(desc(users.createdAt))
  if (rows.length === 0) return []
  const links = await db
    .select({ userId: courseStaff.userId, id: courses.id, title: courses.title })
    .from(courseStaff)
    .innerJoin(courses, eq(courses.id, courseStaff.courseId))
    .where(and(inArray(courseStaff.userId, rows.map((r) => r.id)), isNull(courses.deletedAt)))
    .orderBy(asc(courses.title))
  return rows.map((r) => ({ ...r, courses: links.filter((l) => l.userId === r.id).map((l) => ({ id: l.id, title: l.title })) }))
}

/** رافعو المحتوى المسندون لدورة (لبطاقة الدورة في الإدارة) */
export async function courseUploaders(db: Db, actor: Actor, courseId: string): Promise<{ id: string; fullName: string | null; email: string }[]> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  return db
    .select({ id: users.id, fullName: profiles.fullName, email: users.email })
    .from(courseStaff)
    .innerJoin(users, eq(users.id, courseStaff.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(courseStaff.courseId, courseId))
    .orderBy(asc(profiles.fullName))
}

/**
 * من يحق له تعديل دروس هذه الدورة؟ المشرف: كل الدورات. رافع المحتوى: المسندة إليه فقط.
 * الدورة غير المسندة تُعامل كأنها غير موجودة (لا يُكشف وجودها). يُستدعى في كل خدمة وإجراء، لا في الواجهة فقط.
 */
export async function assertCourseEditor(db: Db, actor: Actor, courseId: string): Promise<CourseRow> {
  assertRole(actor, 'SUPER_ADMIN', 'CONTENT_UPLOADER')
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  const [c] = await db.select().from(courses).where(and(eq(courses.id, courseId), isNull(courses.deletedAt))).limit(1)
  if (!c) throw new AppError('COURSE_NOT_FOUND')
  if (actor.role === 'CONTENT_UPLOADER') {
    const [link] = await db
      .select({ id: courseStaff.id })
      .from(courseStaff)
      .innerJoin(users, eq(users.id, courseStaff.userId))
      .where(and(eq(courseStaff.courseId, c.id), eq(courseStaff.userId, actor.userId), eq(users.status, 'ACTIVE')))
      .limit(1)
    if (!link) throw new AppError('COURSE_NOT_FOUND')
  }
  return c
}

export interface EditableCourse {
  id: string
  title: string
  status: string
  season: string
  teacherName: string | null
}

/** الدورات التي يعمل عليها الفاعل: كلها للمشرف، والمسندة فقط لرافع المحتوى */
export async function listEditableCourses(db: Db, actor: Actor): Promise<EditableCourse[]> {
  assertRole(actor, 'SUPER_ADMIN', 'CONTENT_UPLOADER')
  const base = db
    .select({ id: courses.id, title: courses.title, status: courses.status, season: courses.season, teacherName: profiles.fullName })
    .from(courses)
    .leftJoin(teacherWorkspaces, eq(teacherWorkspaces.id, courses.workspaceId))
    .leftJoin(teachers, eq(teachers.workspaceId, courses.workspaceId))
    .leftJoin(profiles, eq(profiles.userId, teachers.userId))
  const rows =
    actor.role === 'SUPER_ADMIN'
      ? await base.where(isNull(courses.deletedAt)).orderBy(asc(courses.title))
      : await base
          .innerJoin(courseStaff, and(eq(courseStaff.courseId, courses.id), eq(courseStaff.userId, actor.userId)))
          .where(isNull(courses.deletedAt))
          .orderBy(asc(courses.title))
  // مساحة فيها أكثر من أستاذ تكرّر الصف: نُبقي الأول
  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
}
