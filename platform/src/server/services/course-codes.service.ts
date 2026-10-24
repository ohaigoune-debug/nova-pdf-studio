/**
 * أكواد تفعيل الدورة (قرار المالك 2026-10-24):
 * «توليد أكواد ← اختر الدورة الموجّهة لها ← كل كود يفتح تلك الدورة وحدها».
 * - التوليد للمشرف وحده؛ الكود الصريح يُعاد مرة واحدة (للطباعة/التصدير) ولا يُخزَّن إلا hash.
 * - الاستعمال من حساب التلميذ (/claim): مرة واحدة، تحت قفل الصف، فيُفعَّل اشتراك CODE في الدورة.
 * منفصلة تماماً عن أكواد أفواج الأساتذة (enrollment_codes) فلا يُفتح بها فوج أستاذ أبداً.
 */
import { randomUUID } from 'node:crypto'
import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseCodes, courses } from '@/server/db/schema'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { codePrefix, generateEnrollmentCode, hashEnrollmentCode, normalizeEnrollmentCode } from '@/server/lib/codes'
import { AppError, assertUuid } from '@/server/lib/errors'
import { enrollStudent } from './courses.service'

/** الكود المطبوع: 11 رقماً (نفس صيغة الأكواد الرقمية: لا حروف تلتبس عند الإملاء) */
export const isCourseCodeShape = (raw: string): boolean => /^\d{11}$/.test(normalizeEnrollmentCode(raw))
/** بادئة في الـhash تفصل فضاء أكواد الدورات عن أكواد الأفواج */
const hashCourseCode = (code: string) => hashEnrollmentCode(`course:${code}`)

export interface GenerateCourseCodesInput {
  courseId: string
  count: number
  label?: string | null
  expiresAt?: Date | null
}

export async function generateCourseCodes(db: Db, actor: Actor, input: GenerateCourseCodesInput): Promise<{ batchId: string; courseTitle: string; codes: string[] }> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(input.courseId, 'COURSE_NOT_FOUND')
  const count = Math.floor(input.count)
  if (!Number.isFinite(count) || count < 1 || count > 1000) throw new AppError('VALIDATION', { field: 'count' })
  const [course] = await db.select({ id: courses.id, title: courses.title, workspaceId: courses.workspaceId, deletedAt: courses.deletedAt }).from(courses).where(eq(courses.id, input.courseId)).limit(1)
  if (!course || course.deletedAt) throw new AppError('COURSE_NOT_FOUND')
  const batchId = randomUUID()
  const label = input.label?.trim().slice(0, 80) || null
  const codes: string[] = []
  const seen = new Set<string>()
  let attempts = 0
  await db.transaction(async (tx) => {
    while (codes.length < count) {
      if (++attempts > count * 20) throw new AppError('INTERNAL')
      const code = generateEnrollmentCode()
      if (seen.has(code)) continue
      seen.add(code)
      const [row] = await tx
        .insert(courseCodes)
        .values({ courseId: course.id, batchId, batchLabel: label, codeHash: hashCourseCode(code), codePrefix: codePrefix(code), expiresAt: input.expiresAt ?? null, createdByUserId: actor.userId })
        .onConflictDoNothing({ target: courseCodes.codeHash })
        .returning({ id: courseCodes.id })
      if (row) codes.push(code)
    }
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.codes_generate', entityType: 'course', entityId: course.id, newValue: { batchId, count, label, expiresAt: input.expiresAt?.toISOString() ?? null } })
  })
  return { batchId, courseTitle: course.title, codes }
}

export interface CourseCodeBatch {
  batchId: string
  courseId: string
  courseTitle: string
  label: string | null
  total: number
  used: number
  disabled: number
  expiresAt: Date | null
  createdAt: Date
}

/** الدفعات (لكل الدورات أو لدورة) مع عدد المستعمل والمعطَّل */
export async function listCourseCodeBatches(db: Db, actor: Actor, courseId?: string | null): Promise<CourseCodeBatch[]> {
  assertRole(actor, 'SUPER_ADMIN')
  if (courseId) assertUuid(courseId, 'COURSE_NOT_FOUND')
  const rows = await db
    .select({
      batchId: courseCodes.batchId,
      courseId: courseCodes.courseId,
      courseTitle: courses.title,
      label: sql<string | null>`max(${courseCodes.batchLabel})`,
      total: sql<number>`count(*)::int`,
      used: sql<number>`count(*) filter (where ${courseCodes.status} = 'USED')::int`,
      disabled: sql<number>`count(*) filter (where ${courseCodes.status} = 'DISABLED')::int`,
      expiresAt: sql<Date | null>`max(${courseCodes.expiresAt})`,
      createdAt: sql<Date>`min(${courseCodes.createdAt})`
    })
    .from(courseCodes)
    .innerJoin(courses, eq(courses.id, courseCodes.courseId))
    .where(courseId ? eq(courseCodes.courseId, courseId) : undefined)
    .groupBy(courseCodes.batchId, courseCodes.courseId, courses.title)
    .orderBy(desc(sql`min(${courseCodes.createdAt})`))
  return rows.map((r) => ({ ...r, expiresAt: r.expiresAt ? new Date(r.expiresAt) : null, createdAt: new Date(r.createdAt) }))
}

/** تعطيل ما لم يُستعمل من دفعة (ضياع ورقة الأكواد مثلاً) */
export async function disableCourseCodeBatch(db: Db, actor: Actor, batchId: string): Promise<number> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(batchId, 'NOT_FOUND')
  const rows = await db.update(courseCodes).set({ status: 'DISABLED' }).where(and(eq(courseCodes.batchId, batchId), eq(courseCodes.status, 'ACTIVE'))).returning({ id: courseCodes.id })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'course.codes_disable', entityType: 'course_code_batch', entityId: batchId, newValue: { disabled: rows.length } })
  return rows.length
}

/** التلميذ يُدخل كود الدورة: يُستهلك تحت قفل الصف ثم يُفعَّل اشتراكه في الدورة الموجّه لها */
export async function redeemCourseCode(db: Db, actor: Actor, raw: string): Promise<{ courseId: string; courseTitle: string; slug: string }> {
  const studentId = studentIdOf(actor)
  const code = normalizeEnrollmentCode(raw)
  if (!/^\d{11}$/.test(code)) throw new AppError('CODE_INVALID')
  const hash = hashCourseCode(code)
  // استهلاك الكود والاشتراك في معاملة واحدة: فشل التفعيل لا يحرق الكود
  const { course, codeId, batchId } = await db.transaction(async (tx) => {
    const [c] = await tx.select().from(courseCodes).where(eq(courseCodes.codeHash, hash)).for('update').limit(1)
    if (!c) throw new AppError('CODE_INVALID')
    if (c.status === 'USED') throw new AppError('CODE_USED')
    if (c.status === 'DISABLED') throw new AppError('CODE_DISABLED')
    if (c.expiresAt && c.expiresAt.getTime() < Date.now()) throw new AppError('CODE_EXPIRED')
    const [crs] = await tx.select({ id: courses.id, title: courses.title, slug: courses.slug, workspaceId: courses.workspaceId, deletedAt: courses.deletedAt }).from(courses).where(eq(courses.id, c.courseId)).limit(1)
    if (!crs || crs.deletedAt) throw new AppError('COURSE_NOT_FOUND')
    await tx.update(courseCodes).set({ status: 'USED', usedAt: new Date(), usedByStudentId: studentId }).where(eq(courseCodes.id, c.id))
    await enrollStudent(tx, null, { courseId: crs.id, studentId, source: 'CODE', activatedByUserId: actor.userId })
    return { course: crs, codeId: c.id, batchId: c.batchId }
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.code_redeem', entityType: 'course', entityId: course.id, newValue: { codeId, batchId } })
  return { courseId: course.id, courseTitle: course.title, slug: course.slug }
}
