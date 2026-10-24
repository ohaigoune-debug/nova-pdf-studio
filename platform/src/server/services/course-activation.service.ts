/**
 * تفعيل الدورات بعد تسليم الطلب (M8): لكل منتج مرتبط بدورة ⇒ تفعيل على التلميذ المستفيد/حساب التلميذ،
 * وإلا مطالبة بالـSMS حين يكون المشتري وليّ أمر بلا حساب تلميذ. يُستدعى من محرّك حالات الطلب،
 * وwebhook التوصيل، ومزامنة EcoTrack، والتفعيل اليدوي.
 */
import { eq, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseProducts, courses, orderItems, orders, students } from '@/server/db/schema'
import type { EnrollmentSource } from '@/server/db/schema/enums'
import { writeAudit } from '@/server/lib/audit'
import { sendSms } from '@/server/lib/sms'
import { createClaim } from './claims.service'
import { enrollStudent } from './courses.service'
import { notify } from './notifications.service'

export interface ActivateInput {
  courseId: string
  studentId: string
  source: EnrollmentSource
  orderId: string | null
  activatedByUserId: string | null
}

/** تفعيل اشتراك تلميذ في دورة بلا فاعل (النظام): يفوّض إلى enrollStudent في courses.service */
export async function activateEnrollment(db: Db, input: ActivateInput): Promise<{ enrollmentId: string }> {
  const row = await enrollStudent(db, null, { courseId: input.courseId, studentId: input.studentId, source: input.source, orderId: input.orderId, activatedByUserId: input.activatedByUserId })
  return { enrollmentId: row.id }
}

export interface ActivationSummary {
  enrolled: { courseId: string; studentId: string }[]
  claims: { courseId: string; claimId: string; phone: string }[]
}

/** بعد تسليم الطلب: لكل منتج مرتبط بدورة ⇒ تفعيل على التلميذ المستفيد/حساب التلميذ، وإلا مطالبة بالـSMS */
export async function activateCoursesForOrder(db: Db, orderId: string): Promise<ActivationSummary> {
  const summary: ActivationSummary = { enrolled: [], claims: [] }
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) return summary
  const items = await db.select({ productId: orderItems.productId }).from(orderItems).where(eq(orderItems.orderId, orderId))
  if (items.length === 0) return summary
  const links = await db
    .select({ courseId: courseProducts.courseId, title: courses.title, workspaceId: courses.workspaceId })
    .from(courseProducts)
    .innerJoin(courses, eq(courses.id, courseProducts.courseId))
    .where(inArray(courseProducts.productId, [...new Set(items.map((i) => i.productId))]))
  if (links.length === 0) return summary
  const courseIds = [...new Set(links.map((l) => l.courseId))]

  let studentId: string | null = order.beneficiaryStudentId ?? null
  if (!studentId) {
    const [s] = await db.select({ id: students.id }).from(students).where(eq(students.userId, order.userId)).limit(1)
    studentId = s?.id ?? null
  }
  for (const courseId of courseIds) {
    const link = links.find((l) => l.courseId === courseId)!
    if (studentId) {
      await activateEnrollment(db, { courseId, studentId, source: 'BOOK_ORDER', orderId: order.id, activatedByUserId: null })
      summary.enrolled.push({ courseId, studentId })
      await writeAudit(db, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, studentId, mode: 'enroll' } })
    } else {
      const claim = await createClaim(db, { orderId: order.id, courseId, phone: order.phone })
      summary.claims.push({ courseId, claimId: claim.id, phone: claim.phone })
      try {
        await sendSms(db, { to: claim.phone, text: `مدرسة: تم تسليم طلبك ${order.number}. لتفعيل دورة ${link.title} على حساب التلميذ أدخل الرمز ${claim.code} في madrasadz.com/claim`, variables: { name: 'مدرسة', code: claim.code } })
      } catch (err) {
        if (process.env.NODE_ENV !== 'test') console.error('[delivery] sms failed', err)
      }
      await notify(db, { userId: order.userId, workspaceId: link.workspaceId, type: 'SYSTEM', title: `رمز تفعيل دورة «${link.title}»`, body: `سُلّم طلبك ${order.number}. أُرسل رمز التفعيل إلى الهاتف ${claim.phone}؛ يُدخله التلميذ من حسابه في صفحة /claim.`, link: '/claim' })
      await writeAudit(db, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, claimId: claim.id, mode: 'claim' } })
    }
  }
  return summary
}

