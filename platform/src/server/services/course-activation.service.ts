/**
 * تفعيل الدورات بعد تسليم الطلب (M8): لكل منتج مرتبط بدورة ⇒ تفعيل على التلميذ المستفيد/حساب التلميذ،
 * وإلا مطالبة بالـSMS حين يكون المشتري وليّ أمر بلا حساب تلميذ. يُستدعى من محرّك حالات الطلب،
 * وwebhook التوصيل، ومزامنة EcoTrack، والتفعيل اليدوي.
 */
import { and, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseClaims, courseEnrollments, courseProducts, courses, orderItems, orders, students } from '@/server/db/schema'
import type { EnrollmentSource } from '@/server/db/schema/enums'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { sendSms } from '@/server/lib/sms'
import { createClaim } from './claims.service'
import { normalizePhone } from './otp.service'
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

/** دورات الطلب: المثبَّتة على أسطره وقت الشراء (course_id)، وإلا — للطلبات القديمة فقط — روابط المنتج كما كانت */
export async function coursesOfOrder(db: Db, orderId: string): Promise<{ courseId: string; title: string; workspaceId: string }[]> {
  const items = await db.select({ productId: orderItems.productId, courseId: orderItems.courseId }).from(orderItems).where(eq(orderItems.orderId, orderId))
  if (items.length === 0) return []
  const explicit = [...new Set(items.map((i) => i.courseId).filter((c): c is string => Boolean(c)))]
  if (explicit.length) {
    // شراء «الدورة مع كتابها»: الحقّ هو الدورة المشتراة وحدها — لا دورات أخرى تشترك في الكتاب، ولا تتغيّر بتغيّر الربط
    return db.select({ courseId: courses.id, title: courses.title, workspaceId: courses.workspaceId }).from(courses).where(inArray(courses.id, explicit))
  }
  const links = await db
    .select({ courseId: courseProducts.courseId, title: courses.title, workspaceId: courses.workspaceId })
    .from(courseProducts)
    .innerJoin(courses, eq(courses.id, courseProducts.courseId))
    .where(inArray(courseProducts.productId, [...new Set(items.map((i) => i.productId))]))
  return [...new Map(links.map((l) => [l.courseId, l])).values()]
}

/**
 * بعد التسليم المؤكَّد فقط (الطلب في حالة DELIVERED): لكل دورة في الطلب ⇒ تفعيل على التلميذ المستفيد/حساب التلميذ،
 * وإلا مطالبة بالـSMS حين يكون المشتري وليّ أمر بلا حساب تلميذ.
 * idempotent لكل (طلب، دورة): إشعار تسليم مكرَّر لا يُنشئ اشتراكاً ثانياً ولا مطالبة ثانية، ولا يُعيد اشتراكاً ألغته الإدارة.
 */
export async function activateCoursesForOrder(db: Db, orderId: string): Promise<ActivationSummary> {
  // نفس قفل الإرجاع: لا يتسابق تفعيل متأخر مع سحب اشتراك الطلب.
  return db.transaction(async (tx) => {
    const summary: ActivationSummary = { enrolled: [], claims: [] }
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update').limit(1)
    // لا تفعيل عند الإنشاء أو التأكيد أو الدفع أو الشحن: التسليم المؤكَّد وحده
    if (!order || order.status !== 'DELIVERED') return summary
    const list = await coursesOfOrder(tx, orderId)
    if (list.length === 0) return summary

    let studentId: string | null = order.beneficiaryStudentId ?? null
    if (!studentId) {
      const [s] = await tx.select({ id: students.id }).from(students).where(eq(students.userId, order.userId)).limit(1)
      studentId = s?.id ?? null
    }
    for (const link of list) {
      const courseId = link.courseId
      // سبق التفعيل/المطالبة لهذا الطلب وهذه الدورة ⇒ لا شيء (تكرار الإشعار آمن)
      const [done] = await tx.select({ id: courseEnrollments.id }).from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.orderId, order.id))).limit(1)
      if (done) continue
      const [claimed] = await tx.select({ id: courseClaims.id }).from(courseClaims).where(and(eq(courseClaims.orderId, order.id), eq(courseClaims.courseId, courseId))).limit(1)
      if (claimed) continue
      if (studentId) {
        await activateEnrollment(tx, { courseId, studentId, source: 'BOOK_ORDER', orderId: order.id, activatedByUserId: null })
        summary.enrolled.push({ courseId, studentId })
        await writeAudit(tx, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, studentId, mode: 'enroll' } })
      } else {
        const claim = await createClaim(tx, { orderId: order.id, courseId, phone: order.phone })
        summary.claims.push({ courseId, claimId: claim.id, phone: claim.phone })
        try {
          await sendSms(tx, { to: claim.phone, text: `مدرسة: تم تسليم طلبك ${order.number}. لتفعيل دورة ${link.title} على حساب التلميذ أدخل الرمز ${claim.code} في madrasadz.com/claim`, variables: { name: 'مدرسة', code: claim.code } })
        } catch (err) {
          if (process.env.NODE_ENV !== 'test') console.error('[delivery] sms failed', err)
        }
        await notify(tx, { userId: order.userId, workspaceId: link.workspaceId, type: 'SYSTEM', title: `رمز تفعيل دورة «${link.title}»`, body: `سُلّم طلبك ${order.number}. أُرسل رمز التفعيل إلى الهاتف ${claim.phone}؛ يُدخله التلميذ من حسابه في صفحة /claim.`, link: '/claim' })
        await writeAudit(tx, { actorUserId: null, workspaceId: link.workspaceId, action: 'delivery.delivered_activation', entityType: 'course', entityId: courseId, newValue: { orderId: order.id, orderNumber: order.number, claimId: claim.id, mode: 'claim' } })
      }
    }
    return summary
  })
}

/* ───────────── كود التفعيل الذي تولّده الإدارة (حين يفشل التفعيل بالتسليم) ───────────── */

export interface ActivationCodeResult {
  phone: string
  /** الرموز الصريحة (تُعرض للمشرف مرة واحدة ليمليها هاتفياً إن لم تصل الرسالة) */
  codes: { courseId: string; courseTitle: string; code: string }[]
  smsSent: boolean
}

/**
 * يولّد كود تفعيل لكل دورة مرتبطة بكتب الطلب ويرسله بالـSMS إلى الهاتف المختار:
 * هاتف الطلب (افتراضياً)، أو هاتف وليّ الأمر، أو أي رقم آخر. التلميذ يُدخل الهاتف + الكود في /claim.
 * الطلب يجب أن يكون مسلَّماً (أو مؤكَّداً/في الطريق لمن دفع مسبقاً)؛ الملغى والمرتجع ممنوعان.
 */
export async function sendActivationCode(db: Db, actorUserId: string, orderId: string, opts: { phone?: string | null } = {}): Promise<ActivationCodeResult> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) throw new AppError('ORDER_NOT_FOUND')
  // أكواد الطلب لا تُولَّد قبل التسليم المؤكَّد (لا تفعيل قبل التسليم، حتى بالكود)
  if (order.status !== 'DELIVERED') throw new AppError('ORDER_NOT_DELIVERED')
  const uniq = await coursesOfOrder(db, orderId)
  if (!uniq.length) throw new AppError('COURSE_NOT_FOUND')
  const phone = normalizePhone(opts.phone?.trim() || order.phone)
  const codes: ActivationCodeResult['codes'] = []
  for (const l of uniq) {
    const c = await createClaim(db, { orderId: order.id, courseId: l.courseId, phone })
    codes.push({ courseId: l.courseId, courseTitle: l.title, code: c.code })
  }
  let smsSent = true
  try {
    for (const c of codes) await sendSms(db, { to: phone, text: `مدرسة: كود تفعيل دورة ${c.courseTitle}: ${c.code}. أدخله مع هذا الرقم في madrasadz.com/claim من حساب التلميذ.`, variables: { name: 'مدرسة', code: c.code } })
  } catch (e) {
    smsSent = false
    if (process.env.NODE_ENV !== 'test') console.error('[activation-code] sms failed', e)
  }
  await writeAudit(db, { actorUserId, workspaceId: null, action: 'course.activation_code_sent', entityType: 'order', entityId: order.id, newValue: { orderNumber: order.number, phoneTail: phone.slice(-4), courses: codes.map((c) => c.courseId), smsSent } })
  return { phone, codes, smsSent }
}
