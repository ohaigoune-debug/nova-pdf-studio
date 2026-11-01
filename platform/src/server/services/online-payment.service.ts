/**
 * الدفع الإلكتروني للدورة (Guiddini/SATIM) — قرار المالك 1 نوفمبر 2026: «ادفع الآن وتُفعَّل الدورة فورًا».
 *
 *  1) الطلب يُنشأ بطريقة ONLINE وحالة PENDING (الكتاب محجوز إن وُجد)، ثم تُنشأ المعاملة ويُحوَّل الولي إلى SATIM.
 *  2) عند العودة — أو آليًّا كل بضع دقائق لمن لم يعد — يسأل الخادم البوابة نفسها عن الحالة. لا يُصدَّق المتصفح أبدًا.
 *  3) «paid» بالمبلغ نفسه ⇒ الدورة تُفعَّل فورًا (ONLINE_PAYMENT) والطلب «مؤكَّد» فيُشحن الكتاب كالعادة.
 *     مبلغ مختلف ⇒ MISMATCH بلا تفعيل وتنبيه للمشرف. فشل ⇒ يُلغى الطلب ويعود المخزون.
 *  4) كل خطوة آمنة عند التكرار (عودة الولي + الفحص الآلي في اللحظة نفسها لا يفعّلان مرتين).
 */
import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { onlinePayments, orderItems, orders, students, users } from '@/server/db/schema'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { getGuiddiniConfig, guiddiniCheck, guiddiniInitiate } from '@/server/lib/guiddini'
import { notifyMany } from './notifications.service'
import { transitionOrder } from './order-status.service'

type PaymentRow = typeof onlinePayments.$inferSelect

const FAILED_STATUSES = new Set(['failed', 'declined', 'rejected', 'refused', 'canceled', 'cancelled', 'expired', 'error'])
/** بعدها تُعدّ المحاولة منتهية ويُلغى الطلب (صفحة SATIM لا تبقى مفتوحة يومًا كاملًا) */
const EXPIRE_AFTER_MS = 24 * 3600 * 1000

/** ينشئ المعاملة عند البوابة لطلب ONLINE قائم ويعيد رابط صفحة SATIM */
export async function startOrderPayment(db: Db, input: { orderId: string; userId: string; amountDzd: number }, fetchImpl?: typeof fetch): Promise<{ paymentId: string; formUrl: string }> {
  const config = await getGuiddiniConfig(db)
  if (!config?.enabled) throw new AppError('PAYMENT_NOT_CONFIGURED')
  const t = await guiddiniInitiate(config, input.amountDzd, fetchImpl)
  const [row] = await db
    .insert(onlinePayments)
    .values({ orderId: input.orderId, userId: input.userId, amountDzd: input.amountDzd, gatewayRef: t.ref, formUrl: t.formUrl, gatewayStatus: 'initiated', gatewayResponse: t.raw })
    .returning({ id: onlinePayments.id })
  await writeAudit(db, { actorUserId: input.userId, workspaceId: null, action: 'payment.initiate', entityType: 'order', entityId: input.orderId, newValue: { paymentId: row!.id, amountDzd: input.amountDzd, ref: t.ref } })
  return { paymentId: row!.id, formUrl: t.formUrl }
}

/** المبلغ الذي أكدته البوابة يطابق المطلوب؟ (بالدينار، أو بالسنتيم إن أعادته كذلك) */
function amountMatches(gateway: number | null, expected: number): boolean {
  if (gateway === null) return true
  return gateway === expected || gateway === expected * 100
}

async function activateForOrder(db: Db, orderId: string): Promise<string[]> {
  const [o] = await db.select({ userId: orders.userId, beneficiaryStudentId: orders.beneficiaryStudentId }).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!o) return []
  let studentId = o.beneficiaryStudentId
  if (!studentId) studentId = (await db.select({ id: students.id }).from(students).where(eq(students.userId, o.userId)).limit(1))[0]?.id ?? null
  if (!studentId) return []
  const lines = await db.select({ courseId: orderItems.courseId }).from(orderItems).where(eq(orderItems.orderId, orderId))
  const { enrollStudent } = await import('./courses.service')
  const done: string[] = []
  for (const l of lines) {
    if (!l.courseId) continue
    await enrollStudent(db, null, { courseId: l.courseId, studentId, source: 'ONLINE_PAYMENT', orderId })
    done.push(l.courseId)
  }
  return done
}

export interface PaymentOutcome {
  paymentId: string
  orderId: string
  status: PaymentRow['status']
  /** الدورات المفعّلة الآن (عند PAID) */
  courseIds: string[]
}

/** يسأل البوابة عن حالة الدفع ويطبّق النتيجة — آمن عند التكرار */
export async function verifyPayment(db: Db, paymentId: string, fetchImpl?: typeof fetch, now = new Date()): Promise<PaymentOutcome> {
  assertUuid(paymentId, 'PAYMENT_NOT_FOUND')
  const [p] = await db.select().from(onlinePayments).where(eq(onlinePayments.id, paymentId)).limit(1)
  if (!p) throw new AppError('PAYMENT_NOT_FOUND')
  const base = { paymentId: p.id, orderId: p.orderId }
  if (p.status !== 'PENDING' || !p.gatewayRef) return { ...base, status: p.status, courseIds: [] }
  const config = await getGuiddiniConfig(db)
  if (!config) throw new AppError('PAYMENT_NOT_CONFIGURED')
  const r = await guiddiniCheck(config, p.gatewayRef, fetchImpl)

  const settle = async (status: PaymentRow['status']): Promise<boolean> => {
    // الحالة تتغيّر مرة واحدة فقط (من PENDING) حتى مع فحصين متزامنين
    const [row] = await db
      .update(onlinePayments)
      .set({ status, gatewayStatus: r.status, gatewayResponse: r.raw, checkCount: sql`${onlinePayments.checkCount} + 1`, checkedAt: now, paidAt: status === 'PAID' ? now : null, updatedAt: now })
      .where(and(eq(onlinePayments.id, p.id), eq(onlinePayments.status, 'PENDING')))
      .returning({ id: onlinePayments.id })
    return Boolean(row)
  }
  const admins = async (title: string, body: string) => {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
    await notifyMany(db, rows.map((a) => ({ userId: a.id, workspaceId: null, type: 'SYSTEM' as const, title, body, link: '/admin/store' })))
  }
  const [o] = await db.select({ number: orders.number, status: orders.status, total: orders.totalDzd }).from(orders).where(eq(orders.id, p.orderId)).limit(1)

  if (r.status === 'paid') {
    if (!amountMatches(r.amount, p.amountDzd)) {
      if (await settle('MISMATCH')) {
        await writeAudit(db, { actorUserId: null, workspaceId: null, action: 'payment.mismatch', entityType: 'order', entityId: p.orderId, newValue: { paymentId: p.id, expected: p.amountDzd, gateway: r.amount } })
        await admins(`دفع بمبلغ مختلف — الطلب ${o?.number ?? ''}`, `المطلوب ${p.amountDzd} دج، والبوابة أكدت ${r.amount}. لم تُفعَّل الدورة: راجعه يدويًّا.`)
      }
      return { ...base, status: 'MISMATCH', courseIds: [] }
    }
    if (!(await settle('PAID'))) return { ...base, status: 'PAID', courseIds: [] }
    if (o && o.status !== 'CONFIRMED') {
      if (o.status === 'CANCELLED') await transitionOrder(db, p.orderId, 'PENDING', { actorUserId: null, source: 'system', reason: 'دفع إلكتروني مؤكَّد بعد الإلغاء' }).catch(() => null)
      await transitionOrder(db, p.orderId, 'CONFIRMED', { actorUserId: null, source: 'system', reason: 'دفع إلكتروني مؤكَّد' }).catch(() => null)
    }
    const courseIds = await activateForOrder(db, p.orderId)
    await writeAudit(db, { actorUserId: null, workspaceId: null, action: 'payment.paid', entityType: 'order', entityId: p.orderId, newValue: { paymentId: p.id, amountDzd: p.amountDzd, courseIds } })
    await notifyMany(db, [{ userId: p.userId, workspaceId: null, type: 'SYSTEM' as const, title: 'تمّ الدفع وفُعّلت الدورة', body: `الطلب ${o?.number ?? ''} · ${p.amountDzd} دج`, link: '/student/courses' }])
    await admins(`دفع إلكتروني ${o?.number ?? ''}`, `${p.amountDzd} دج · فُعّلت الدورة تلقائيًّا`)
    return { ...base, status: 'PAID', courseIds }
  }

  const expired = now.getTime() - p.createdAt.getTime() > EXPIRE_AFTER_MS
  if (FAILED_STATUSES.has(r.status) || expired) {
    const status = FAILED_STATUSES.has(r.status) ? 'FAILED' : 'EXPIRED'
    if (await settle(status)) {
      if (o && o.status !== 'CANCELLED') await transitionOrder(db, p.orderId, 'CANCELLED', { actorUserId: null, source: 'system', reason: status === 'FAILED' ? 'لم يتمّ الدفع الإلكتروني' : 'انتهت مهلة الدفع الإلكتروني' }).catch(() => null)
      await writeAudit(db, { actorUserId: null, workspaceId: null, action: 'payment.failed', entityType: 'order', entityId: p.orderId, newValue: { paymentId: p.id, gatewayStatus: r.status, status } })
    }
    return { ...base, status, courseIds: [] }
  }

  await db.update(onlinePayments).set({ gatewayStatus: r.status, checkCount: sql`${onlinePayments.checkCount} + 1`, checkedAt: now, updatedAt: now }).where(eq(onlinePayments.id, p.id))
  return { ...base, status: 'PENDING', courseIds: [] }
}

/** دفعة الولي العائد من SATIM: بمعرّف البوابة إن أُرسل، وإلا آخر دفعة معلّقة لهذا الحساب */
export async function paymentForReturn(db: Db, userId: string, ref: string | null): Promise<PaymentRow | null> {
  const where = ref ? and(eq(onlinePayments.userId, userId), eq(onlinePayments.gatewayRef, ref)) : eq(onlinePayments.userId, userId)
  const [p] = await db.select().from(onlinePayments).where(where).orderBy(desc(onlinePayments.createdAt)).limit(1)
  return p ?? null
}

/** دفعة معلّقة لهذا الحساب وهذه الدورة (لإعادة الرابط نفسه بدل طلب ثانٍ) */
export async function pendingPaymentForCourse(db: Db, userId: string, courseId: string): Promise<PaymentRow | null> {
  const [p] = await db
    .select({ p: onlinePayments })
    .from(onlinePayments)
    .innerJoin(orderItems, eq(orderItems.orderId, onlinePayments.orderId))
    .where(and(eq(onlinePayments.userId, userId), eq(onlinePayments.status, 'PENDING'), eq(orderItems.courseId, courseId)))
    .orderBy(desc(onlinePayments.createdAt))
    .limit(1)
  return p?.p ?? null
}

/**
 * الفحص الآلي (العامل ومسار Cron): المعلّقة منذ دقيقتين على الأقل، ولم تُفحص منذ 3 دقائق، 20 في كل دورة.
 * هكذا يُفعَّل من دفع ثم أغلق الصفحة أو انقطع اتصاله قبل العودة.
 */
export async function reconcilePendingPayments(db: Db, fetchImpl?: typeof fetch, now = new Date()): Promise<{ checked: number; paid: number }> {
  const config = await getGuiddiniConfig(db)
  if (!config) return { checked: 0, paid: 0 }
  const rows = await db
    .select({ id: onlinePayments.id })
    .from(onlinePayments)
    .where(and(eq(onlinePayments.status, 'PENDING'), lt(onlinePayments.createdAt, new Date(now.getTime() - 2 * 60_000)), or(sql`${onlinePayments.checkedAt} is null`, lt(onlinePayments.checkedAt, new Date(now.getTime() - 3 * 60_000)))))
    .orderBy(onlinePayments.createdAt)
    .limit(20)
  let paid = 0
  for (const r of rows) {
    const out = await verifyPayment(db, r.id, fetchImpl, now).catch(() => null)
    if (out?.status === 'PAID') paid++
  }
  return { checked: rows.length, paid }
}

/** للإدارة: آخر عمليات الدفع */
export async function listRecentPayments(db: Db, limit = 50) {
  return db
    .select({ id: onlinePayments.id, status: onlinePayments.status, amountDzd: onlinePayments.amountDzd, gatewayStatus: onlinePayments.gatewayStatus, createdAt: onlinePayments.createdAt, paidAt: onlinePayments.paidAt, orderNumber: orders.number, customerName: orders.customerName })
    .from(onlinePayments)
    .innerJoin(orders, eq(orders.id, onlinePayments.orderId))
    .where(inArray(onlinePayments.status, ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'MISMATCH']))
    .orderBy(desc(onlinePayments.createdAt))
    .limit(limit)
}
