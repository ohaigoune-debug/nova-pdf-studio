/**
 * مطالبة الدورة (M8): حين يُسلَّم كتاب اشتراه وليّ الأمر بحسابه (أو بحساب بلا تلميذ)،
 * يُرسَل رمز بالـSMS إلى هاتف الطلب؛ التلميذ يُدخل الهاتف والرمز في /claim فتُفعَّل الدورة على حسابه هو.
 * لا تفعيل على حساب غير تلميذ أبداً. الرمز لا يُخزَّن إلا hash، 5 محاولات ثم يُقفل.
 */
import { createHash, randomInt } from 'node:crypto'
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseClaims, courses, orders } from '@/server/db/schema'
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
  if (open.length === 0) throw new AppError('CLAIM_INVALID')
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
  const [order] = await db.select({ id: orders.id, number: orders.number }).from(orders).where(eq(orders.id, match.orderId)).limit(1)
  await enrollStudent(db, null, { courseId: course.id, studentId: actor.studentId, source: 'CLAIM', orderId: order?.id ?? null, activatedByUserId: null })
  await db.update(courseClaims).set({ claimedAt: now, claimedByStudentId: actor.studentId }).where(eq(courseClaims.id, match.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: course.workspaceId, action: 'course.claim', entityType: 'course', entityId: course.id, newValue: { claimId: match.id, orderNumber: order?.number ?? null, studentId: actor.studentId } })
  return { courseId: course.id, courseTitle: course.title }
}

/** للإدارة/الاختبارات: مطالبات طلب معيّن (بلا الرمز) */
export async function claimsForOrder(db: Db, orderId: string) {
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  return db.select({ id: courseClaims.id, courseId: courseClaims.courseId, phone: courseClaims.phone, attempts: courseClaims.attempts, expiresAt: courseClaims.expiresAt, claimedAt: courseClaims.claimedAt, claimedByStudentId: courseClaims.claimedByStudentId }).from(courseClaims).where(eq(courseClaims.orderId, orderId)).orderBy(desc(courseClaims.createdAt))
}
