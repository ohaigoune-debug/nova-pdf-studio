/**
 * مطالبة الدورة (M8): حين يُسلَّم كتاب اشتراه وليّ الأمر بحسابه (أو بحساب بلا تلميذ)،
 * يُرسَل رمز بالـSMS إلى هاتف الطلب؛ التلميذ يُدخل الهاتف والرمز في /claim فتُفعَّل الدورة على حسابه هو.
 * لا تفعيل على حساب غير تلميذ أبداً. الرمز لا يُخزَّن إلا hash، 5 محاولات ثم يُقفل.
 */
import { createHash, randomInt } from 'node:crypto'
import { and, desc, eq, gt, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseClaims, courseEnrollments, courses, orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { enrollStudent } from './courses.service'

export const CLAIM_MAX_ATTEMPTS = 5
export const CLAIM_TTL_DAYS = 30

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  // +213 5XX… ⇒ 05XX…
  if (digits.startsWith('213') && digits.length === 12) return `0${digits.slice(3)}`
  return digits
}

export function hashClaimCode(code: string): string {
  return createHash('sha256').update(`course-claim:${code}`).digest('hex')
}

export function generateClaimCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** ينشئ مطالبة جديدة ويعيد الرمز الصريح (للإرسال بالـSMS فقط — لا يُخزَّن) */
export async function createClaim(db: Db, input: { orderId: string; courseId: string; phone: string }): Promise<{ id: string; code: string; phone: string; expiresAt: Date }> {
  const phone = normalizePhone(input.phone)
  const code = generateClaimCode()
  const expiresAt = new Date(Date.now() + CLAIM_TTL_DAYS * 24 * 3600 * 1000)
  const [row] = await db.insert(courseClaims).values({ orderId: input.orderId, courseId: input.courseId, phone, codeHash: hashClaimCode(code), expiresAt }).returning({ id: courseClaims.id })
  if (!row) throw new AppError('INTERNAL')
  return { id: row.id, code, phone, expiresAt }
}

/**
 * التلميذ يطالب بدورة: الهاتف + الرمز. تُفحص كل المطالبات المفتوحة لهذا الهاتف؛
 * الخطأ يزيد عدّاد كل مطالبة مفتوحة للهاتف، وبعد 5 محاولات تُقفل (CLAIM_BLOCKED).
 */
export async function claimCourse(db: Db, actor: Actor, input: { phone: string; code: string }): Promise<{ courseId: string; courseTitle: string }> {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  const phone = normalizePhone(input.phone)
  const code = input.code.replace(/\D/g, '')
  if (!phone || code.length !== 6) throw new AppError('CLAIM_INVALID')
  const now = new Date()
  const open = await db
    .select()
    .from(courseClaims)
    .where(and(eq(courseClaims.phone, phone), isNull(courseClaims.claimedAt), gt(courseClaims.expiresAt, now)))
    .orderBy(desc(courseClaims.createdAt))
  if (open.length === 0) {
    // التلميذ نفسه يعيد إدخال كود فعّله سابقاً (ضغطة مزدوجة/انقطاع): نجاح، لا «كود غير صالح»
    const [mine] = await db
      .select({ courseId: courseClaims.courseId })
      .from(courseClaims)
      .where(and(eq(courseClaims.phone, phone), eq(courseClaims.codeHash, hashClaimCode(code)), eq(courseClaims.claimedByStudentId, actor.studentId)))
      .limit(1)
    if (mine) {
      const [c] = await db.select({ id: courses.id, title: courses.title }).from(courses).where(eq(courses.id, mine.courseId)).limit(1)
      if (c) return { courseId: c.id, courseTitle: c.title }
    }
    throw new AppError('CLAIM_INVALID')
  }
  if (open.every((c) => c.attempts >= CLAIM_MAX_ATTEMPTS)) throw new AppError('CLAIM_BLOCKED')
  const hash = hashClaimCode(code)
  const match = open.find((c) => c.attempts < CLAIM_MAX_ATTEMPTS && c.codeHash === hash)
  if (!match) {
    await db
      .update(courseClaims)
      .set({ attempts: sql`${courseClaims.attempts} + 1` })
      .where(and(eq(courseClaims.phone, phone), isNull(courseClaims.claimedAt), gt(courseClaims.expiresAt, now)))
    const remaining = Math.max(...open.map((c) => CLAIM_MAX_ATTEMPTS - c.attempts - 1))
    if (remaining <= 0) throw new AppError('CLAIM_BLOCKED')
    throw new AppError('CLAIM_INVALID', { remaining })
  }
  const [course] = await db.select({ id: courses.id, title: courses.title, workspaceId: courses.workspaceId }).from(courses).where(eq(courses.id, match.courseId)).limit(1)
  if (!course) throw new AppError('NOT_FOUND')
  const studentId = actor.studentId
  // ذرّي: طلب واحد لدورة واحدة لا يمنحها لحسابين — قفل الطلب، ثم التحقق والاستهلاك والاشتراك في معاملة واحدة
  const order = await db.transaction(async (tx) => {
    const [o] = await tx.select({ id: orders.id, number: orders.number, status: orders.status }).from(orders).where(eq(orders.id, match.orderId)).for('update').limit(1)
    // لا تفعيل قبل التسليم المؤكَّد، ولا بعد الإلغاء أو الإرجاع
    if (!o || o.status !== 'DELIVERED') throw new AppError('ORDER_NOT_DELIVERED')
    const [other] = await tx
      .select({ studentId: courseEnrollments.studentId })
      .from(courseEnrollments)
      .where(and(eq(courseEnrollments.orderId, o.id), eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.status, 'ACTIVE'), ne(courseEnrollments.studentId, studentId)))
      .limit(1)
    if (other) throw new AppError('CLAIM_ALREADY_USED')
    const [taken] = await tx
      .select({ by: courseClaims.claimedByStudentId })
      .from(courseClaims)
      .where(and(eq(courseClaims.orderId, o.id), eq(courseClaims.courseId, course.id), isNotNull(courseClaims.claimedAt), ne(courseClaims.claimedByStudentId, studentId)))
      .limit(1)
    if (taken) throw new AppError('CLAIM_ALREADY_USED')
    const won = await tx
      .update(courseClaims)
      .set({ claimedAt: now, claimedByStudentId: studentId })
      .where(and(eq(courseClaims.id, match.id), isNull(courseClaims.claimedAt)))
      .returning({ id: courseClaims.id })
    if (!won.length) throw new AppError('CLAIM_INVALID')
    // بقية رموز هذا الطلب لهذه الدورة (رمز تلقائي + رمز الإدارة مثلاً) تسقط: لا حساب ثانٍ
    await tx.update(courseClaims).set({ expiresAt: now }).where(and(eq(courseClaims.orderId, o.id), eq(courseClaims.courseId, course.id), isNull(courseClaims.claimedAt)))
    await enrollStudent(tx, null, { courseId: course.id, studentId, source: 'CLAIM', orderId: o.id, activatedByUserId: null })
    return o
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.claim', entityType: 'course', entityId: course.id, newValue: { claimId: match.id, orderNumber: order.number, studentId } })
  return { courseId: course.id, courseTitle: course.title }
}

/** للإدارة/الاختبارات: مطالبات طلب معيّن (بلا الرمز) */
export async function claimsForOrder(db: Db, orderId: string) {
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  return db.select({ id: courseClaims.id, courseId: courseClaims.courseId, phone: courseClaims.phone, attempts: courseClaims.attempts, expiresAt: courseClaims.expiresAt, claimedAt: courseClaims.claimedAt, claimedByStudentId: courseClaims.claimedByStudentId }).from(courseClaims).where(eq(courseClaims.orderId, orderId)).orderBy(desc(courseClaims.createdAt))
}
