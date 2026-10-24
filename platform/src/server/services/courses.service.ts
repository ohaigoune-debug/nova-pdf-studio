/**
 * الأكاديمية المدفوعة (M8 — الدورات): الدورة = فوج يملكه أستاذ المنصة، والاشتراك = عضوية
 * في الفوج بمدة. كل ما يعمل على الأفواج (الدروس الموجّهة، الفيديو المحمي، القسم الافتراضي)
 * يعمل تلقائياً على الدورة؛ هنا فقط الإدارة، التفعيل، الانتهاء، والشروط.
 */
import { and, asc, desc, eq, gt, inArray, isNull, isNotNull, lt, ne, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  academicYears,
  content,
  contentTargets,
  courseEnrollments,
  courseProducts,
  courses,
  files,
  groupStudents,
  groups,
  jobs,
  levels,
  liveSessions,
  products,
  profiles,
  streams,
  studentStatusHistory,
  students,
  subjects,
  teacherWorkspaces,
  teachers,
  users,
  type CourseEnrollmentRow,
  type CourseRow
} from '@/server/db/schema'
import { COURSE_STATUSES, ENROLLMENT_SOURCES, type CourseStatus, type EnrollmentSource } from '@/server/db/schema/enums'
import { qcol } from '@/server/db/sql-helpers'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { CONTENT_MEMBERSHIP_STATUSES, getCourseAccessMode, setCourseAccessMode, type CourseAccessMode } from '@/server/lib/course-access'
import { signFileUrl } from '@/server/lib/storage'
import { PLAY_SUBJECTS } from '@/server/play/constants'
import { notify } from './notifications.service'
import { addTimeline } from './timeline.service'

export const COURSE_STATUS_AR: Record<CourseStatus, string> = { DRAFT: 'مسودة', PUBLISHED: 'منشورة', ARCHIVED: 'مؤرشفة' }
export const COURSE_PLAN_AR: Record<string, string> = { ANNUAL: 'اشتراك سنوي', TERM: 'اشتراك فصلي' }
export const ENROLLMENT_SOURCE_AR: Record<EnrollmentSource, string> = { BOOK_ORDER: 'شراء الكتاب', MANUAL: 'تفعيل يدوي', GIFT: 'هدية', CLAIM: 'رمز مطالبة', CODE: 'كود الكتاب' }
export const ENROLLMENT_STATUS_AR: Record<string, string> = { ACTIVE: 'نشط', EXPIRED: 'منتهٍ', REVOKED: 'ملغى' }

/** رمز مادة المنصة (subjects.code) → رمز مادة PLAY */
const PLAY_SUBJECT_BY_CODE: Record<string, string> = {
  ARABIC: 'AR',
  MATH: 'MATH',
  PHYSICS: 'PHYS',
  SCIENCES: 'SVT',
  FRENCH: 'FR',
  ENGLISH: 'EN',
  HISTGEO: 'HIST',
  PHILO: 'PHILO',
  ISLAMIC: 'ISL',
  CIVIC: 'CIV',
  ECONOMICS: 'ECO',
  ACCOUNTING: 'ACC',
  LAW: 'LAW',
  TECHNOLOGY: 'TECH',
  COMPUTING: 'INFO'
}

export function playHrefForSubjectCode(code: string | null | undefined): string {
  const play = code ? PLAY_SUBJECT_BY_CODE[code] : undefined
  return play && PLAY_SUBJECTS.some((s) => s.code === play) ? `/student/play/subject/${play}` : '/student/play'
}

export interface CourseInput {
  title: string
  slug?: string | null
  description?: string | null
  workspaceId: string
  levelId?: string | null
  streamIds?: string[]
  subjectId?: string | null
  season: string
  plan?: 'ANNUAL' | 'TERM'
  startsOn?: string | null
  endsOn?: string | null
  accessEndsOn?: string | null
  priceDzd?: number
  coverFileId?: string | null
  termsText?: string | null
  status?: CourseStatus
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function courseSlugify(title: string): string {
  const s = normalizeArabic(title).replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 80)
  return s || `course-${Date.now().toString(36)}`
}

async function uniqueSlug(db: Db, base: string, excludeId?: string): Promise<string> {
  let slug = base
  for (let i = 2; i < 50; i++) {
    const [hit] = await db.select({ id: courses.id }).from(courses).where(eq(courses.slug, slug)).limit(1)
    if (!hit || hit.id === excludeId) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

function validate(input: CourseInput) {
  if (!input.title?.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (!input.season?.trim()) throw new AppError('VALIDATION', { field: 'season' })
  if (input.plan && input.plan !== 'ANNUAL' && input.plan !== 'TERM') throw new AppError('VALIDATION', { field: 'plan' })
  if (input.priceDzd != null && !(Number.isInteger(input.priceDzd) && input.priceDzd >= 0 && input.priceDzd <= 1_000_000)) throw new AppError('VALIDATION', { field: 'priceDzd' })
  for (const k of ['startsOn', 'endsOn', 'accessEndsOn'] as const) {
    const v = input[k]
    if (v && !DATE_RE.test(v)) throw new AppError('VALIDATION', { field: k })
  }
  if (input.status && !COURSE_STATUSES.includes(input.status)) throw new AppError('VALIDATION', { field: 'status' })
}

/** آخر لحظة من اليوم بتوقيت الجزائر (UTC+1) */
export function endOfDayDz(date: string): Date {
  return new Date(`${date}T23:59:59.999+01:00`)
}

async function loadCourse(db: Db, id: string): Promise<CourseRow> {
  assertUuid(id, 'COURSE_NOT_FOUND')
  const [c] = await db.select().from(courses).where(and(eq(courses.id, id), isNull(courses.deletedAt))).limit(1)
  if (!c) throw new AppError('COURSE_NOT_FOUND')
  return c
}

/* --------------------------------- الإدارة --------------------------------- */

export async function createCourse(db: Db, actor: Actor, input: CourseInput): Promise<CourseRow> {
  assertRole(actor, 'SUPER_ADMIN')
  validate(input)
  assertUuid(input.workspaceId, 'VALIDATION')
  const [ws] = await db.select({ id: teacherWorkspaces.id }).from(teacherWorkspaces).where(eq(teacherWorkspaces.id, input.workspaceId)).limit(1)
  if (!ws) throw new AppError('VALIDATION', { field: 'workspaceId' })
  const [teacher] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, ws.id)).orderBy(asc(teachers.createdAt)).limit(1)
  if (!teacher) throw new AppError('VALIDATION', { field: 'workspaceId' })
  const [year] = await db.select({ id: academicYears.id }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1)
  const title = input.title.trim()
  const slug = await uniqueSlug(db, courseSlugify(input.slug?.trim() || title))
  // دورة جديدة مدفوعة: لا تُنشأ منشورةً قبل إرفاق كتابها (تُنشأ مسودة ثم يُضاف الكتاب من صفحتها فتُنشر)
  if ((input.status ?? 'DRAFT') === 'PUBLISHED' && (input.priceDzd ?? 0) > 0) throw new AppError('COURSE_BOOK_REQUIRED', { issue: 'NO_BOOK' })

  const created = await db.transaction(async (tx) => {
    const [g] = await tx
      .insert(groups)
      .values({
        workspaceId: ws.id,
        teacherId: teacher.id,
        name: title,
        levelId: input.levelId ?? null,
        streamId: null,
        academicYearId: year?.id ?? null,
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        status: 'ACTIVE',
        notes: 'فوج دورة مدفوعة (يُدار من صفحة الدورات)'
      })
      .returning({ id: groups.id })
    if (!g) throw new AppError('INTERNAL')
    const [row] = await tx
      .insert(courses)
      .values({
        slug,
        title,
        description: input.description?.trim() || null,
        workspaceId: ws.id,
        groupId: g.id,
        levelId: input.levelId ?? null,
        streamIds: input.streamIds ?? [],
        subjectId: input.subjectId ?? null,
        season: input.season.trim(),
        plan: input.plan ?? 'ANNUAL',
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        accessEndsOn: input.accessEndsOn ?? null,
        priceDzd: input.priceDzd ?? 0,
        coverFileId: input.coverFileId ?? null,
        termsText: input.termsText?.trim() || null,
        status: input.status ?? 'DRAFT',
        createdByUserId: actor.userId
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: ws.id, action: 'course.create', entityType: 'course', entityId: row.id, newValue: { title, groupId: g.id, season: row.season, plan: row.plan } })
    return row
  })
  if (created.status === 'PUBLISHED') await import('./full-access.service').then((m) => m.enrollFullAccessInCourse(db, created.id))
  return created
}

export async function updateCourse(db: Db, actor: Actor, id: string, input: Partial<CourseInput>): Promise<CourseRow> {
  assertRole(actor, 'SUPER_ADMIN')
  const current = await loadCourse(db, id)
  const merged: CourseInput = {
    ...current,
    ...input,
    title: input.title ?? current.title,
    workspaceId: current.workspaceId,
    season: input.season ?? current.season,
    plan: (input.plan ?? current.plan) as 'ANNUAL' | 'TERM',
    streamIds: input.streamIds ?? current.streamIds,
    status: (input.status ?? current.status) as CourseStatus
  }
  validate(merged)
  const slug = input.slug !== undefined || input.title !== undefined ? await uniqueSlug(db, courseSlugify(input.slug?.trim() || merged.title), id) : current.slug
  const newTerms = merged.termsText?.trim() || null
  const termsChanged = input.termsText !== undefined && newTerms !== current.termsText
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(courses)
      .set({
        slug,
        title: merged.title.trim(),
        description: merged.description?.trim() || null,
        levelId: merged.levelId ?? null,
        streamIds: merged.streamIds ?? [],
        subjectId: merged.subjectId ?? null,
        season: merged.season.trim(),
        plan: merged.plan ?? 'ANNUAL',
        startsOn: merged.startsOn ?? null,
        endsOn: merged.endsOn ?? null,
        accessEndsOn: merged.accessEndsOn ?? null,
        priceDzd: merged.priceDzd ?? 0,
        coverFileId: merged.coverFileId ?? null,
        termsText: newTerms,
        termsVersion: termsChanged ? current.termsVersion + 1 : current.termsVersion,
        status: merged.status ?? current.status,
        updatedAt: new Date()
      })
      .where(eq(courses.id, id))
      .returning()
    if (!row) throw new AppError('INTERNAL')
    // الفوج الخلفي يتبع عنوان الدورة ومستواها
    await tx.update(groups).set({ name: row.title, levelId: row.levelId, startsOn: row.startsOn, endsOn: row.endsOn, updatedAt: new Date() }).where(eq(groups.id, row.groupId))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: row.workspaceId, action: 'course.update', entityType: 'course', entityId: id, newValue: { ...input, termsVersion: row.termsVersion } })
    return row
  })
}

export async function setCourseStatus(db: Db, actor: Actor, id: string, status: CourseStatus): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!COURSE_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  const c = await loadCourse(db, id)
  if (c.status === status) return
  // دورة مدفوعة لا تُنشر بلا كتاب ورقي صالح (الدورات المنشورة سابقاً لا تُمسّ)
  if (status === 'PUBLISHED') await import('./course-purchase.service').then((m) => m.assertCoursePublishable(db, c))
  await db.update(courses).set({ status, updatedAt: new Date() }).where(eq(courses.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.status', entityType: 'course', entityId: id, oldValue: { status: c.status }, newValue: { status } })
  // التلاميذ ذوو الوصول الشامل يُشتركون في كل دورة تُنشر (استيراد متأخر: full-access يعتمد على هذا الملف)
  if (status === 'PUBLISHED') await import('./full-access.service').then((m) => m.enrollFullAccessInCourse(db, id))
}

export interface CourseListItem {
  id: string
  slug: string
  title: string
  season: string
  plan: string
  status: string
  priceDzd: number
  accessEndsOn: string | null
  groupId: string
  workspaceName: string
  teacherName: string
  levelName: string | null
  subjectName: string | null
  activeEnrollments: number
  productsCount: number
  upcomingSessions: number
  createdAt: Date
}

function courseCountColumns() {
  return {
    activeEnrollments: sql<number>`(select count(*)::int from ${courseEnrollments} ce where ce.course_id = ${qcol(courses.id)} and ce.status = 'ACTIVE')`,
    productsCount: sql<number>`(select count(*)::int from ${courseProducts} cp where cp.course_id = ${qcol(courses.id)})`,
    upcomingSessions: sql<number>`(select count(*)::int from ${liveSessions} ls where ls.course_id = ${qcol(courses.id)} and ls.status = 'SCHEDULED' and ls.starts_at > now())`
  }
}

export async function listCoursesAdmin(db: Db, actor: Actor): Promise<CourseListItem[]> {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      season: courses.season,
      plan: courses.plan,
      status: courses.status,
      priceDzd: courses.priceDzd,
      accessEndsOn: courses.accessEndsOn,
      groupId: courses.groupId,
      workspaceName: teacherWorkspaces.name,
      teacherName: teachers.displayName,
      levelName: levels.nameAr,
      subjectName: subjects.nameAr,
      createdAt: courses.createdAt,
      ...courseCountColumns()
    })
    .from(courses)
    .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, courses.workspaceId))
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(levels, eq(levels.id, courses.levelId))
    .leftJoin(subjects, eq(subjects.id, courses.subjectId))
    .where(isNull(courses.deletedAt))
    .orderBy(desc(courses.createdAt))
}

export interface CourseEnrollmentItem {
  id: string
  studentId: string
  fullName: string
  email: string
  phone: string | null
  source: string
  status: string
  activatedAt: Date
  expiresAt: Date | null
  acceptedTermsAt: Date | null
  revokedReason: string | null
}

export async function getCourseAdmin(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'SUPER_ADMIN')
  const course = await loadCourse(db, id)
  const [[meta], linked, enrollments, sessions, streamRows, [counts]] = await Promise.all([
    db
      .select({ workspaceName: teacherWorkspaces.name, teacherName: teachers.displayName, levelName: levels.nameAr, subjectName: subjects.nameAr, subjectCode: subjects.code, coverName: files.originalName })
      .from(courses)
      .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, courses.workspaceId))
      .innerJoin(groups, eq(groups.id, courses.groupId))
      .innerJoin(teachers, eq(teachers.id, groups.teacherId))
      .leftJoin(levels, eq(levels.id, courses.levelId))
      .leftJoin(subjects, eq(subjects.id, courses.subjectId))
      .leftJoin(files, eq(files.id, courses.coverFileId))
      .where(eq(courses.id, id))
      .limit(1),
    db
      .select({ id: courseProducts.id, productId: products.id, title: products.title, type: products.type, priceDzd: products.priceDzd, status: products.status })
      .from(courseProducts)
      .innerJoin(products, eq(products.id, courseProducts.productId))
      .where(eq(courseProducts.courseId, id))
      .orderBy(asc(courseProducts.createdAt)),
    db
      .select({
        id: courseEnrollments.id,
        studentId: courseEnrollments.studentId,
        fullName: profiles.fullName,
        email: users.email,
        phone: profiles.phone,
        source: courseEnrollments.source,
        status: courseEnrollments.status,
        activatedAt: courseEnrollments.activatedAt,
        expiresAt: courseEnrollments.expiresAt,
        acceptedTermsAt: courseEnrollments.acceptedTermsAt,
        revokedReason: courseEnrollments.revokedReason
      })
      .from(courseEnrollments)
      .innerJoin(students, eq(students.id, courseEnrollments.studentId))
      .innerJoin(users, eq(users.id, students.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(eq(courseEnrollments.courseId, id))
      .orderBy(desc(courseEnrollments.activatedAt)),
    db
      .select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt, durationMinutes: liveSessions.durationMinutes, provider: liveSessions.provider, status: liveSessions.status })
      .from(liveSessions)
      .where(and(eq(liveSessions.courseId, id), eq(liveSessions.status, 'SCHEDULED'), gt(liveSessions.startsAt, new Date())))
      .orderBy(asc(liveSessions.startsAt))
      .limit(20),
    course.streamIds.length ? db.select({ id: streams.id, name: streams.nameAr }).from(streams).where(inArray(streams.id, course.streamIds)) : Promise.resolve([] as { id: string; name: string }[]),
    db.select(courseCountColumns()).from(courses).where(eq(courses.id, id))
  ])
  return {
    course,
    workspaceName: meta?.workspaceName ?? '',
    teacherName: meta?.teacherName ?? '',
    levelName: meta?.levelName ?? null,
    subjectName: meta?.subjectName ?? null,
    subjectCode: meta?.subjectCode ?? null,
    coverName: meta?.coverName ?? null,
    streamNames: streamRows.map((s) => s.name),
    products: linked,
    enrollments: enrollments.map((e) => ({ ...e, fullName: e.fullName ?? '' })) as CourseEnrollmentItem[],
    upcomingSessions: sessions,
    counts: { activeEnrollments: counts?.activeEnrollments ?? 0, productsCount: counts?.productsCount ?? 0, upcomingSessions: counts?.upcomingSessions ?? 0 }
  }
}

export async function linkProduct(db: Db, actor: Actor, courseId: string, productId: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  await loadCourse(db, courseId)
  assertUuid(productId, 'PRODUCT_NOT_FOUND')
  const [p] = await db.select({ id: products.id, priceDzd: products.priceDzd }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).limit(1)
  if (!p) throw new AppError('PRODUCT_NOT_FOUND')
  await db.insert(courseProducts).values({ courseId, productId }).onConflictDoNothing()
  // سعر الدورة = سعر الكتاب المرتبط (قرار المالك): يُحدَّث عند الربط، والكتالوج يقرأ أرخص كتاب مرتبط منشور مباشرة
  await db.update(courses).set({ priceDzd: p.priceDzd, updatedAt: new Date() }).where(eq(courses.id, courseId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'course.link_product', entityType: 'course', entityId: courseId, newValue: { productId, priceDzd: p.priceDzd } })
}

export async function unlinkProduct(db: Db, actor: Actor, courseId: string, productId: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  assertUuid(productId, 'PRODUCT_NOT_FOUND')
  await db.delete(courseProducts).where(and(eq(courseProducts.courseId, courseId), eq(courseProducts.productId, productId)))
}

/** المنتجات المنشورة التي يمكن ربطها بدورة (لقائمة الاختيار) */
export async function listLinkableProducts(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ id: products.id, title: products.title, type: products.type, priceDzd: products.priceDzd })
    .from(products)
    .where(and(isNull(products.deletedAt), ne(products.status, 'ARCHIVED')))
    .orderBy(asc(products.sortOrder), asc(products.title))
}

/** مساحات الأساتذة التي لها أستاذ (لاختيار صاحب الدورة) */
export async function listCourseWorkspaces(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ id: teacherWorkspaces.id, name: teacherWorkspaces.name, teacherName: teachers.displayName })
    .from(teacherWorkspaces)
    .innerJoin(teachers, eq(teachers.workspaceId, teacherWorkspaces.id))
    .where(eq(teacherWorkspaces.status, 'ACTIVE'))
    .orderBy(asc(teacherWorkspaces.name))
}

/** بحث عن تلميذ بالبريد أو الهاتف أو الاسم (للتفعيل اليدوي) */
export async function searchStudents(db: Db, actor: Actor, query: string, limit = 20) {
  assertRole(actor, 'SUPER_ADMIN')
  const q = query.trim()
  if (q.length < 2) return []
  const like = `%${q}%`
  return db
    .select({ studentId: students.id, fullName: profiles.fullName, email: users.email, phone: profiles.phone })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(or(sql`${users.email} ilike ${like}`, sql`${profiles.fullName} ilike ${like}`, sql`${profiles.phone} ilike ${like}`))
    .orderBy(asc(profiles.fullName))
    .limit(limit)
}

/* -------------------------------- الاشتراكات -------------------------------- */

export interface EnrollInput {
  courseId: string
  studentId: string
  source: EnrollmentSource
  orderId?: string | null
  expiresAt?: Date | null
  activatedByUserId?: string | null
  /** بلا إشعار ولا خط زمني (الوصول الشامل الجماعي: لا نغرق التلميذ بإشعار لكل دورة) */
  silent?: boolean
}

/**
 * تفعيل اشتراك (idempotent على الزوج دورة/تلميذ): نشط → لا شيء؛ منتهٍ/ملغى → إعادة تفعيل.
 * يضمن عضوية الفوج الخلفي. `actor` = null للنظام (webhook التوصيل، المهام).
 */
export async function enrollStudent(db: Db, actor: Actor | null, input: EnrollInput): Promise<CourseEnrollmentRow> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  if (!ENROLLMENT_SOURCES.includes(input.source)) throw new AppError('VALIDATION', { field: 'source' })
  assertUuid(input.studentId, 'NOT_FOUND')
  const course = await loadCourse(db, input.courseId)
  const [st] = await db.select({ id: students.id, userId: students.userId }).from(students).where(eq(students.id, input.studentId)).limit(1)
  if (!st) throw new AppError('NOT_FOUND')
  const expiresAt = input.expiresAt !== undefined ? input.expiresAt : course.accessEndsOn ? endOfDayDz(course.accessEndsOn) : null
  const byUser = input.activatedByUserId ?? actor?.userId ?? null

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(courseEnrollments)
      .where(and(eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.studentId, st.id)))
      .for('update')
      .limit(1)
    let row: CourseEnrollmentRow
    let reactivated = false
    if (existing && existing.status === 'ACTIVE') {
      row = existing
    } else if (existing) {
      const [r] = await tx
        .update(courseEnrollments)
        .set({ status: 'ACTIVE', source: input.source, orderId: input.orderId ?? existing.orderId, activatedAt: new Date(), expiresAt, revokedReason: null, activatedByUserId: byUser, updatedAt: new Date() })
        .where(eq(courseEnrollments.id, existing.id))
        .returning()
      if (!r) throw new AppError('INTERNAL')
      row = r
      reactivated = true
    } else {
      const [r] = await tx
        .insert(courseEnrollments)
        .values({ courseId: course.id, studentId: st.id, source: input.source, orderId: input.orderId ?? null, expiresAt, status: 'ACTIVE', activatedByUserId: byUser })
        .returning()
      if (!r) throw new AppError('INTERNAL')
      row = r
    }

    // عضوية الفوج الخلفي
    const [gs] = await tx
      .select({ id: groupStudents.id, status: groupStudents.status })
      .from(groupStudents)
      .where(and(eq(groupStudents.groupId, course.groupId), eq(groupStudents.studentId, st.id)))
      .limit(1)
    if (!gs) {
      const [created] = await tx
        .insert(groupStudents)
        .values({ workspaceId: course.workspaceId, groupId: course.groupId, studentId: st.id, status: 'ACTIVE' })
        .returning({ id: groupStudents.id })
      if (created) await tx.insert(studentStatusHistory).values({ groupStudentId: created.id, fromStatus: null, toStatus: 'ACTIVE', reason: `course enrolled (${input.source})`, changedByUserId: byUser })
    } else if (gs.status !== 'ACTIVE') {
      await tx.update(groupStudents).set({ status: 'ACTIVE', leftAt: null, suspendedAt: null, suspensionReason: null, updatedAt: new Date() }).where(eq(groupStudents.id, gs.id))
      await tx.insert(studentStatusHistory).values({ groupStudentId: gs.id, fromStatus: gs.status, toStatus: 'ACTIVE', reason: `course re-enrolled (${input.source})`, changedByUserId: byUser })
    }

    if (existing && !reactivated) return row

    await tx.update(students).set({ studentType: 'COURSE' }).where(and(eq(students.id, st.id), eq(students.studentType, 'FREE')))
    if (!input.silent) await addTimeline(tx, { studentId: st.id, workspaceId: course.workspaceId, type: 'ENROLLED', title: `اشترك في دورة ${course.title}`, meta: { courseId: course.id, source: input.source } })
    if (!input.silent) await notify(tx, {
      userId: st.userId,
      workspaceId: course.workspaceId,
      type: 'ENROLLED',
      title: `تم تفعيل اشتراكك في دورة ${course.title}`,
      body: expiresAt ? `الاشتراك ساري حتى ${expiresAt.toISOString().slice(0, 10)}.` : null,
      link: `/student/courses/${course.slug}`
    })
    await writeAudit(tx, {
      actorUserId: byUser,
      workspaceId: course.workspaceId,
      action: 'course.enroll',
      entityType: 'course_enrollment',
      entityId: row.id,
      newValue: { courseId: course.id, studentId: st.id, source: input.source, orderId: input.orderId ?? null, expiresAt: expiresAt?.toISOString() ?? null, reactivated }
    })
    return row
  })
}

export async function revokeEnrollment(db: Db, actor: Actor, id: string, reason?: string | null): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'ENROLLMENT_NOT_FOUND')
  await db.transaction(async (tx) => {
    const [e] = await tx.select().from(courseEnrollments).where(eq(courseEnrollments.id, id)).for('update').limit(1)
    if (!e) throw new AppError('ENROLLMENT_NOT_FOUND')
    const course = await loadCourse(tx, e.courseId)
    await tx.update(courseEnrollments).set({ status: 'REVOKED', revokedReason: reason?.trim() || null, updatedAt: new Date() }).where(eq(courseEnrollments.id, id))
    await deactivateGroupMembership(tx, course.groupId, e.studentId, 'course revoked', actor.userId)
    const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, e.studentId)).limit(1)
    if (st) await notify(tx, { userId: st.userId, workspaceId: course.workspaceId, type: 'SYSTEM', title: `أُلغي اشتراكك في دورة ${course.title}`, body: reason?.trim() || null, link: '/student/courses' })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.revoke', entityType: 'course_enrollment', entityId: id, oldValue: { status: e.status }, newValue: { status: 'REVOKED', reason: reason ?? null } })
  })
}

async function deactivateGroupMembership(tx: Db, groupId: string, studentId: string, reason: string, byUser: string | null) {
  const [gs] = await tx
    .select({ id: groupStudents.id, status: groupStudents.status })
    .from(groupStudents)
    .where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.studentId, studentId)))
    .limit(1)
  if (!gs || gs.status === 'INACTIVE') return
  await tx.update(groupStudents).set({ status: 'INACTIVE', leftAt: new Date(), updatedAt: new Date() }).where(eq(groupStudents.id, gs.id))
  await tx.insert(studentStatusHistory).values({ groupStudentId: gs.id, fromStatus: gs.status, toStatus: 'INACTIVE', reason, changedByUserId: byUser })
}

/** ينهي الاشتراكات النشطة التي تجاوزت تاريخ انتهائها؛ يعيد عددها. يُستدعى من مهمة COURSE_EXPIRY اليومية. */
/* ----------------------- إجراء الانتقال إلى الوصول الصارم ----------------------- */

export interface CourseAccessMigrationReport {
  mode: CourseAccessMode
  /** عضويات على أفواج الدورات (ACTIVE/SUSPENDED/SUSPENDED_DUE_TO_ABSENCE) بلا أي سجل اشتراك */
  candidates: { courseId: string; courseTitle: string; studentId: string; membershipStatus: string }[]
  /** ما أُدرج فعلًا (0 في المحاكاة) */
  created: number
  /** ما بقي بلا اشتراك بعد الإدراج (يجب أن يكون 0 قبل التفعيل) */
  remaining: number
  strictEnabled: boolean
}

/** العضويات على أفواج الدورات التي لا سجل اشتراك لها، بحالات الوصول إلى المحتوى (لا تُمسّ حالة العضوية ولا سبب الإيقاف) */
async function enrollmentGaps(db: Db) {
  return db
    .select({ courseId: courses.id, courseTitle: courses.title, studentId: groupStudents.studentId, membershipStatus: groupStudents.status })
    .from(groupStudents)
    .innerJoin(courses, and(eq(courses.groupId, groupStudents.groupId), isNull(courses.deletedAt)))
    .where(and(inArray(groupStudents.status, [...CONTENT_MEMBERSHIP_STATUSES]), sql`not exists (select 1 from ${courseEnrollments} ce where ce.course_id = ${courses.id} and ce.student_id = ${groupStudents.studentId})`))
    .orderBy(asc(courses.title))
}

/**
 * إجراء الصيانة الصريح للانتقال من النمط legacy إلى strict دون فقد وصول:
 *   1. يحصر العضويات القديمة على أفواج الدورات بلا اشتراك (ACTIVE والموقوفة بنوعيها).
 *   2. يدرج لها اشتراكات MANUAL بعبارة INSERT … SELECT … ON CONFLICT DO NOTHING واحدة وذرّية:
 *      تُعاد فيها الأهلية (الحالة، الدورة غير محذوفة، لا اشتراك) لحظة التنفيذ، ولا يُعدَّل أي اشتراك موجود —
 *      فاشتراك أُلغي أثناء التنفيذ لا يُعاد تفعيله. لا تُغيَّر حالة العضوية ولا سبب الإيقاف.
 *   3. يتحقق أن ما بقي بلا اشتراك = 0، وعندها فقط (وبطلب `enableStrict`) يفعّل النمط الصارم.
 * `dryRun`: قراءة فقط داخل معاملة READ ONLY؛ لا يكتب شيئًا ولا يغيّر النمط.
 */
export async function runCourseAccessMigration(db: Db, actor: Actor | null, opts: { dryRun?: boolean; enableStrict?: boolean } = {}): Promise<CourseAccessMigrationReport> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  const mode = await getCourseAccessMode(db)
  if (opts.dryRun) {
    return db.transaction(async (tx) => {
      await tx.execute(sql`set transaction read only`)
      const candidates = await enrollmentGaps(tx)
      return { mode, candidates, created: 0, remaining: candidates.length, strictEnabled: false }
    })
  }
  return db.transaction(async (tx) => {
    const candidates = await enrollmentGaps(tx)
    const byUser = actor?.userId ?? null
    const inserted = await tx.execute(sql`
      insert into course_enrollments (course_id, student_id, source, status, activated_at, expires_at, activated_by_user_id)
      select c.id, gs.student_id, 'MANUAL', 'ACTIVE', now(),
             -- نفس endOfDayDz: آخر لحظة من اليوم بتوقيت الجزائر (UTC+1)
             case when c.access_ends_on is null then null else ((c.access_ends_on::timestamp + interval '23:59:59.999') - interval '1 hour') at time zone 'UTC' end,
             ${byUser}::uuid
      from group_students gs
      join courses c on c.group_id = gs.group_id and c.deleted_at is null
      where gs.status in ('ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE')
        and not exists (select 1 from course_enrollments ce where ce.course_id = c.id and ce.student_id = gs.student_id)
      on conflict (course_id, student_id) do nothing
    `)
    const created = Number((inserted as unknown as { rowCount?: number; affectedRows?: number }).rowCount ?? (inserted as unknown as { affectedRows?: number }).affectedRows ?? 0)
    const remaining = (await enrollmentGaps(tx)).length
    let strictEnabled = false
    if (opts.enableStrict && remaining === 0) {
      await setCourseAccessMode(tx, 'strict')
      strictEnabled = true
    }
    if (actor && (created || strictEnabled)) await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'course.access_migration', entityType: 'course', entityId: null, newValue: { created, remaining, strictEnabled } })
    return { mode: strictEnabled ? 'strict' : mode, candidates, created, remaining, strictEnabled }
  })
}

export async function expireDueEnrollments(db: Db, now: Date = new Date()): Promise<number> {
  const due = await db
    .select({ id: courseEnrollments.id, studentId: courseEnrollments.studentId, courseId: courseEnrollments.courseId })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.status, 'ACTIVE'), isNotNull(courseEnrollments.expiresAt), lt(courseEnrollments.expiresAt, now)))
  let n = 0
  for (const e of due) {
    await db.transaction(async (tx) => {
      const [course] = await tx.select().from(courses).where(eq(courses.id, e.courseId)).limit(1)
      if (!course) return
      const updated = await tx
        .update(courseEnrollments)
        .set({ status: 'EXPIRED', updatedAt: now })
        .where(and(eq(courseEnrollments.id, e.id), eq(courseEnrollments.status, 'ACTIVE')))
        .returning({ id: courseEnrollments.id })
      if (updated.length === 0) return
      n++
      await deactivateGroupMembership(tx, course.groupId, e.studentId, 'course expired', null)
      const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, e.studentId)).limit(1)
      if (st) await notify(tx, { userId: st.userId, workspaceId: course.workspaceId, type: 'SYSTEM', title: `انتهى اشتراكك في ${course.title}`, body: 'انتهت مدة الوصول إلى محتوى الدورة. لتجديد الاشتراك تواصل مع الإدارة.', link: '/student/courses' })
      await writeAudit(tx, { actorUserId: null, workspaceId: course.workspaceId, action: 'course.expire', entityType: 'course_enrollment', entityId: e.id, newValue: { courseId: course.id, studentId: e.studentId } })
    })
  }
  return n
}

export const COURSE_EXPIRY_INTERVAL_MS = 24 * 3600_000

/** يُدرج مهمة COURSE_EXPIRY إن لم تُنفَّذ خلال آخر 24 ساعة ولم تكن في الطابور (مرآة ensureMaintenanceJobs) */
export async function ensureCourseExpiryScheduled(db: Db, now: Date = new Date()): Promise<boolean> {
  const [recent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'COURSE_EXPIRY'), or(sql`${jobs.status} in ('QUEUED','PROCESSING')`, sql`${jobs.createdAt} > ${new Date(now.getTime() - COURSE_EXPIRY_INTERVAL_MS)}`)))
    .limit(1)
  if (recent) return false
  await enqueueJob(db, { type: 'COURSE_EXPIRY', payload: {}, maxAttempts: 1, runAfter: now })
  return true
}

export async function runCourseExpiryJob(db: Db): Promise<Record<string, unknown>> {
  const expired = await expireDueEnrollments(db)
  return { expired }
}

/* ---------------------------------- الطالب ---------------------------------- */

async function activeEnrollmentFor(db: Db, studentId: string, courseId: string, now = new Date()) {
  const [e] = await db
    .select()
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId)))
    .limit(1)
  if (!e) return null
  const active = e.status === 'ACTIVE' && (!e.expiresAt || e.expiresAt.getTime() > now.getTime())
  return { enrollment: e, active }
}

export async function acceptTerms(db: Db, actor: Actor, courseId: string): Promise<void> {
  const studentId = studentIdOf(actor)
  const course = await loadCourse(db, courseId)
  const found = await activeEnrollmentFor(db, studentId, course.id)
  if (!found) throw new AppError('COURSE_NOT_FOUND')
  if (!found.active) throw new AppError('COURSE_NOT_ENROLLED')
  await db
    .update(courseEnrollments)
    .set({ acceptedTermsAt: new Date(), acceptedTermsVersion: course.termsVersion, updatedAt: new Date() })
    .where(eq(courseEnrollments.id, found.enrollment.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.terms_accept', entityType: 'course_enrollment', entityId: found.enrollment.id, newValue: { courseId: course.id, termsVersion: course.termsVersion } })
}

export interface MyCourseItem {
  id: string
  slug: string
  title: string
  season: string
  coverUrl: string | null
  teacherName: string
  accessEndsOn: string | null
  expiresAt: Date | null
  status: 'ACTIVE' | 'EXPIRED'
  termsAccepted: boolean
  nextLive: { id: string; title: string; startsAt: Date } | null
  videos: number
  lessons: number
  href: string
}

export async function myCourses(db: Db, actor: Actor): Promise<MyCourseItem[]> {
  const studentId = studentIdOf(actor)
  const now = new Date()
  const rows = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      season: courses.season,
      groupId: courses.groupId,
      coverFileId: courses.coverFileId,
      termsVersion: courses.termsVersion,
      termsText: courses.termsText,
      accessEndsOn: courses.accessEndsOn,
      teacherName: teachers.displayName,
      status: courseEnrollments.status,
      expiresAt: courseEnrollments.expiresAt,
      acceptedTermsVersion: courseEnrollments.acceptedTermsVersion,
      videos: sql<number>`(select count(*)::int from ${contentTargets} ct join ${content} c on c.id = ct.content_id where ct.group_id = ${qcol(courses.groupId)} and c.type = 'VIDEO' and c.published_at is not null and c.deleted_at is null)`,
      lessons: sql<number>`(select count(*)::int from ${contentTargets} ct join ${content} c on c.id = ct.content_id where ct.group_id = ${qcol(courses.groupId)} and c.type <> 'VIDEO' and c.published_at is not null and c.deleted_at is null)`
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courses.id, courseEnrollments.courseId))
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(and(eq(courseEnrollments.studentId, studentId), inArray(courseEnrollments.status, ['ACTIVE', 'EXPIRED']), isNull(courses.deletedAt)))
    .orderBy(desc(courseEnrollments.activatedAt))
  const ids = rows.map((r) => r.id)
  const upcoming = ids.length
    ? await db
        .select({ id: liveSessions.id, courseId: liveSessions.courseId, title: liveSessions.title, startsAt: liveSessions.startsAt })
        .from(liveSessions)
        .where(and(inArray(liveSessions.courseId, ids), eq(liveSessions.status, 'SCHEDULED'), gt(liveSessions.startsAt, now)))
        .orderBy(asc(liveSessions.startsAt))
    : []
  const nextByCourse = new Map<string, { id: string; title: string; startsAt: Date }>()
  for (const s of upcoming) if (!nextByCourse.has(s.courseId)) nextByCourse.set(s.courseId, { id: s.id, title: s.title, startsAt: s.startsAt })
  return rows.map((r) => {
    const active = r.status === 'ACTIVE' && (!r.expiresAt || r.expiresAt.getTime() > now.getTime())
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      season: r.season,
      coverUrl: r.coverFileId ? signFileUrl(r.coverFileId, 3600) : null,
      teacherName: r.teacherName,
      accessEndsOn: r.accessEndsOn,
      expiresAt: r.expiresAt,
      status: active ? 'ACTIVE' : 'EXPIRED',
      termsAccepted: !r.termsText || r.acceptedTermsVersion === r.termsVersion,
      nextLive: nextByCourse.get(r.id) ?? null,
      videos: r.videos,
      lessons: r.lessons,
      href: `/student/courses/${r.slug}`
    }
  })
}

export interface CourseContentItem {
  id: string
  slug: string
  title: string
  type: string
  summary: string | null
  publishedAt: Date | null
  videoProvider: string | null
  href: string
}

export type CourseHome =
  | { needsTerms: true; course: { id: string; slug: string; title: string; termsText: string; termsVersion: number } }
  | {
      needsTerms: false
      course: { id: string; slug: string; title: string; description: string | null; season: string; coverUrl: string | null; teacherName: string; accessEndsOn: string | null; groupId: string }
      expiresAt: Date | null
      nextLive: { id: string; title: string; startsAt: Date; durationMinutes: number; provider: string } | null
      upcoming: { id: string; title: string; startsAt: Date; durationMinutes: number; provider: string }[]
      videos: CourseContentItem[]
      lessons: CourseContentItem[]
      playHref: string
      classroomHref: string
    }

export async function courseHome(db: Db, actor: Actor, slug: string): Promise<CourseHome> {
  const studentId = studentIdOf(actor)
  const now = new Date()
  const [row] = await db
    .select({ course: courses, teacherName: teachers.displayName, subjectCode: subjects.code })
    .from(courses)
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(subjects, eq(subjects.id, courses.subjectId))
    .where(and(eq(courses.slug, slug), isNull(courses.deletedAt)))
    .limit(1)
  if (!row) throw new AppError('COURSE_NOT_FOUND')
  const course = row.course
  const found = await activeEnrollmentFor(db, studentId, course.id, now)
  if (!found) throw new AppError('COURSE_NOT_FOUND')
  if (!found.active) throw new AppError('COURSE_NOT_ENROLLED')
  const termsText = course.termsText?.trim() || ''
  if (termsText && found.enrollment.acceptedTermsVersion !== course.termsVersion) {
    return { needsTerms: true, course: { id: course.id, slug: course.slug, title: course.title, termsText, termsVersion: course.termsVersion } }
  }

  const [upcoming, items] = await Promise.all([
    db
      .select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt, durationMinutes: liveSessions.durationMinutes, provider: liveSessions.provider })
      .from(liveSessions)
      .where(and(eq(liveSessions.courseId, course.id), eq(liveSessions.status, 'SCHEDULED'), gt(liveSessions.startsAt, now)))
      .orderBy(asc(liveSessions.startsAt))
      .limit(10),
    db
      .select({ id: content.id, slug: content.slug, title: content.title, type: content.type, summary: content.summary, publishedAt: content.publishedAt, videoProvider: content.videoProvider })
      .from(contentTargets)
      .innerJoin(content, eq(content.id, contentTargets.contentId))
      .where(and(eq(contentTargets.groupId, course.groupId), isNull(content.deletedAt), isNotNull(content.publishedAt)))
      .orderBy(desc(content.publishedAt))
  ])
  const toItem = (c: (typeof items)[number]): CourseContentItem => ({ ...c, href: `/student/lessons/${c.slug}` })
  return {
    needsTerms: false,
    course: {
      id: course.id,
      slug: course.slug,
      title: course.title,
      description: course.description,
      season: course.season,
      coverUrl: course.coverFileId ? signFileUrl(course.coverFileId, 3600) : null,
      teacherName: row.teacherName,
      accessEndsOn: course.accessEndsOn,
      groupId: course.groupId
    },
    expiresAt: found.enrollment.expiresAt,
    nextLive: upcoming[0] ?? null,
    upcoming,
    videos: items.filter((c) => c.type === 'VIDEO').map(toItem),
    lessons: items.filter((c) => c.type !== 'VIDEO').map(toItem),
    playHref: playHrefForSubjectCode(row.subjectCode),
    classroomHref: `/student/classroom?group=${course.groupId}`
  }
}
