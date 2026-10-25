/** Régressions PR #15 : PGlite en mémoire uniquement, aucune API de livraison réelle. */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseClaims, courseEnrollments, groupStudents, notifications, orders, products, users } from '@/server/db/schema'
import type { EnrollmentSource } from '@/server/db/schema/enums'
import type { Actor } from '@/server/lib/actor'
import { mapEcotrackStatus } from '@/server/lib/ecotrack'
import { AppError } from '@/server/lib/errors'
import { claimCourse, createClaim } from '@/server/services/claims.service'
import { activateCoursesForOrder } from '@/server/services/course-activation.service'
import { courseBookStateById, placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, enrollStudent, revokeEnrollment, setCourseStatus } from '@/server/services/courses.service'
import { applyDeliveryStatus, normalizeDeliveryStatus, recordDeliveryEvent } from '@/server/services/delivery.service'
import { transitionOrder } from '@/server/services/order-status.service'
import * as notificationService from '@/server/services/notifications.service'
import { placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let workspaceId: string
let wilayaId: string
let sequence = 0
const phone = () => `05${String(10000000 + ++sequence).slice(-8)}`

beforeAll(async () => {
  vi.stubEnv('STORE_SHIPPING_DZD', '0')
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ اختبارات الحماية')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  wilayaId = (await refIds(h.db)).wilayaId!
})

afterAll(async () => {
  await h?.close()
  vi.unstubAllEnvs()
})

async function courseWithBook(priceDzd = 2500) {
  const c = await createCourse(h.db, admin, { title: `دورة حماية ${++sequence}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب حماية ${sequence}`, priceDzd: Math.max(1, priceDzd), stock: 20, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  const state = await courseBookStateById(h.db, c.id)
  // محرر كتاب الدورة يفرض سعراً موجباً؛ المنتجات القديمة المجانية يقبلها المتجر فعلاً.
  if (priceDzd === 0) await h.db.update(products).set({ priceDzd: 0 }).where(eq(products.id, state.book!.id))
  return { ...c, bookId: state.book!.id }
}

const buy = (actor: Actor, courseId: string) => placeCourseOrder(h.db, actor, { courseId, phone: phone(), wilayaId, address: 'عنوان تجريبي', deliveryType: 'HOME' })
const rawBuy = (actor: Actor, productId: string, beneficiaryStudentId?: string | null) => placeOrder(h.db, actor, { items: [{ productId, qty: 1 }], customerName: actor.fullName, phone: phone(), wilayaId, address: 'عنوان تجريبي', beneficiaryStudentId })
const enrollmentsOf = (studentId: string) => h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))
const membershipsOf = (studentId: string, groupId: string) => h.db.select().from(groupStudents).where(and(eq(groupStudents.studentId, studentId), eq(groupStudents.groupId, groupId)))
const orderOf = async (id: string) => (await h.db.select().from(orders).where(eq(orders.id, id)))[0]!

async function ship(orderId: string) {
  await setOrderStatus(h.db, admin, orderId, 'CONFIRMED')
  await setOrderStatus(h.db, admin, orderId, 'SHIPPED')
}

async function deliver(orderId: string) {
  await ship(orderId)
  await setOrderStatus(h.db, admin, orderId, 'DELIVERED')
}

async function expectCode(work: () => Promise<unknown>, code: string) {
  await expect(work()).rejects.toSatisfy((error: unknown) => error instanceof AppError && error.code === code)
}

describe('تفسير حالات التوصيل: النفي ثم الإرجاع قبل التسليم', () => {
  it.each([
    ['retour livré', 'RETURNED', 'returned'],
    ["retourné à l'expéditeur", 'RETURNED', 'returned'],
    ['retour', 'RETURNED', 'returned'],
    ['return', 'RETURNED', 'returned'],
    ['retourné', 'RETURNED', 'returned'],
    ['مرتجع', 'RETURNED', 'returned'],
    ['إرجاع', 'RETURNED', 'returned'],
    ['Livré', 'DELIVERED', 'delivered'],
    ['delivered', 'DELIVERED', 'delivered'],
    ['out for delivery - tournée 2', 'IN_TRANSIT', 'out_for_delivery'],
    ['non livré', 'FAILED_ATTEMPT', 'failed_attempt'],
    ['not delivered', 'FAILED_ATTEMPT', 'failed_attempt'],
    ['لم يتم التسليم', 'FAILED_ATTEMPT', 'failed_attempt']
  ])('%s: webhook عام وEcoTrack يتفقان', (label, generic, ecotrack) => {
    expect(normalizeDeliveryStatus(label)).toBe(generic)
    expect(mapEcotrackStatus(label)).toBe(ecotrack)
  })

  it('webhook «retour livré» لطلب SHIPPED يجعله RETURNED ولا يفعّل الدورة', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await ship(order.id)
    const event = await recordDeliveryEvent(h.db, 'generic', { id: `return-shipped-${order.id}`, order: order.number, status: 'retour livré' })
    expect(event.error).toBeNull()
    expect(event.status).toBe('RETURNED')
    expect((await orderOf(order.id)).status).toBe('RETURNED')
    expect(await enrollmentsOf(student.studentId!)).toHaveLength(0)
  })
})

describe('سحب حقوق الطلب المرتجع وحدها', () => {
  it.each(['admin', 'delivery', 'ecotrack'] as const)('شراء ثم تسليم ثم إرجاع من %s يسحب BOOK_ORDER ويزيل عضوية الفوج مرة واحدة', async (source) => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await deliver(order.id)
    const [before] = await enrollmentsOf(student.studentId!)
    expect(before).toMatchObject({ status: 'ACTIVE', source: 'BOOK_ORDER', orderId: order.id })
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('ACTIVE')
    const noticesBefore = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    if (source === 'delivery') {
      const result = await recordDeliveryEvent(h.db, 'generic', { id: `return-${order.id}`, order: order.number, status: 'returned' })
      expect(result.error).toBeNull()
    } else if (source === 'ecotrack') {
      const result = await applyDeliveryStatus(h.db, await orderOf(order.id), 'RETURNED', { provider: 'ecotrack', trackingId: null, rawStatus: 'retour livré', source: 'ecotrack' })
      expect(result.error).toBeNull()
    } else {
      await transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: admin.userId, source: 'admin' })
    }
    expect((await enrollmentsOf(student.studentId!))[0]).toMatchObject({ id: before!.id, status: 'REVOKED', source: 'BOOK_ORDER', orderId: order.id })
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('INACTIVE')
    const revokeAudits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.entityId, before!.id), eq(auditLogs.action, 'course.revoke')))
    expect(revokeAudits).toHaveLength(1)
    const noticesAfter = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(noticesAfter.length).toBeGreaterThan(noticesBefore.length)
    expect(noticesAfter.some((n) => !noticesBefore.some((old) => old.id === n.id) && n.workspaceId === workspaceId)).toBe(true)
    const auditsAfter = await h.db.select().from(auditLogs)
    const duplicatePayload = { id: `return-duplicate-${order.id}`, order: order.number, status: 'returned' }
    await recordDeliveryEvent(h.db, 'generic', duplicatePayload)
    const repeated = await recordDeliveryEvent(h.db, 'generic', duplicatePayload)
    expect(repeated.duplicate).toBe(true)
    await transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: null, source: 'delivery' })
    expect(await h.db.select().from(auditLogs)).toHaveLength(auditsAfter.length)
    expect(await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))).toHaveLength(noticesAfter.length)
    await recordDeliveryEvent(h.db, 'generic', { id: `late-delivered-${order.id}`, order: order.number, status: 'delivered' })
    expect((await orderOf(order.id)).status).toBe('RETURNED')
    expect((await enrollmentsOf(student.studentId!))[0]!.status).toBe('REVOKED')
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('INACTIVE')
  })

  it('اشتراك CLAIM لتلميذ غير المشتري يُسحب ويُبلّغ التلميذ عند إرجاع الطلب', async () => {
    const c = await courseWithBook()
    const order = await rawBuy(admin, c.bookId)
    await deliver(order.id)
    const student = await makeStudent(h.db)
    const claim = await createClaim(h.db, { orderId: order.id, courseId: c.id, phone: phone() })
    await claimCourse(h.db, student, { phone: claim.phone, code: claim.code })
    const [enrollment] = await enrollmentsOf(student.studentId!)
    expect(enrollment).toMatchObject({ source: 'CLAIM', orderId: order.id, status: 'ACTIVE' })
    const beforeNotices = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    await setOrderStatus(h.db, admin, order.id, 'RETURNED')
    expect((await enrollmentsOf(student.studentId!))[0]!.status).toBe('REVOKED')
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('INACTIVE')
    const afterNotices = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(afterNotices.length).toBeGreaterThan(beforeNotices.length)
  })

  it('اشتراك MANUAL سابق في الدورة نفسها يبقى ACTIVE بعد إرجاع كتابها', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const original = await enrollStudent(h.db, admin, { courseId: c.id, studentId: student.studentId!, source: 'MANUAL' })
    const order = await rawBuy(student, c.bookId)
    await deliver(order.id)
    await setOrderStatus(h.db, admin, order.id, 'RETURNED')
    expect((await enrollmentsOf(student.studentId!))[0]).toMatchObject({ id: original.id, source: 'MANUAL', orderId: null, status: 'ACTIVE' })
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('ACTIVE')
  })

  it.each(['MANUAL', 'GIFT', 'CODE'] satisfies EnrollmentSource[])('المصدر %s محمي حتى إن أُرفق به معرّف الطلب المرتجع', async (source) => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await rawBuy(student, c.bookId)
    const enrollment = await enrollStudent(h.db, admin, { courseId: c.id, studentId: student.studentId!, source, orderId: order.id })
    await deliver(order.id)
    await setOrderStatus(h.db, admin, order.id, 'RETURNED')
    expect((await enrollmentsOf(student.studentId!))[0]).toMatchObject({ id: enrollment.id, source, status: 'ACTIVE', orderId: order.id })
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('ACTIVE')
  })

  it('اشتراك BOOK_ORDER من طلب آخر للدورة نفسها يبقى ACTIVE', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const paidOrder = await buy(student, c.id)
    await deliver(paidOrder.id)
    const returnedOrder = await rawBuy(student, c.bookId)
    await deliver(returnedOrder.id)
    await setOrderStatus(h.db, admin, returnedOrder.id, 'RETURNED')
    expect((await enrollmentsOf(student.studentId!))[0]).toMatchObject({ source: 'BOOK_ORDER', orderId: paidOrder.id, status: 'ACTIVE' })
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('ACTIVE')
  })

  it('إرجاع الطلب ينهي أكواد المطالبة المفتوحة ويرفض claimCourse', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await rawBuy(admin, c.bookId)
    await deliver(order.id)
    const claim = await createClaim(h.db, { orderId: order.id, courseId: c.id, phone: phone() })
    const returnedAfter = Date.now()
    await setOrderStatus(h.db, admin, order.id, 'RETURNED')
    const [row] = await h.db.select().from(courseClaims).where(eq(courseClaims.id, claim.id))
    expect(row!.claimedAt).toBeNull()
    expect(row!.expiresAt.getTime()).toBeGreaterThanOrEqual(returnedAfter)
    expect(row!.expiresAt.getTime()).toBeLessThanOrEqual(Date.now())
    await expect(claimCourse(h.db, student, { phone: claim.phone, code: claim.code })).rejects.toBeInstanceOf(AppError)
    expect(await enrollmentsOf(student.studentId!)).toHaveLength(0)
  })

  it('الحارس الموجود يتخطّى اشتراكًا REVOKED لنفس الطلب والدورة حتى عند DELIVERED', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await deliver(order.id)
    const [enrollment] = await enrollmentsOf(student.studentId!)
    await revokeEnrollment(h.db, admin, enrollment!.id, 'قرار إداري')
    const first = await activateCoursesForOrder(h.db, order.id)
    const second = await activateCoursesForOrder(h.db, order.id)
    expect(first.enrolled).toHaveLength(0)
    expect(second.enrolled).toHaveLength(0)
    expect((await enrollmentsOf(student.studentId!))[0]!.status).toBe('REVOKED')
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('INACTIVE')
  })

  it('إرجاعان متزامنان يعيدان نسخة مخزون واحدة ويسجلان سحباً واحداً', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await deliver(order.id)
    const [before] = await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId))
    await Promise.all([
      transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: null, source: 'delivery' }),
      transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: null, source: 'ecotrack' })
    ])
    expect((await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId)))[0]!.stock).toBe(before!.stock! + 1)
    const [enrollment] = await enrollmentsOf(student.studentId!)
    expect(enrollment!.status).toBe('REVOKED')
    expect(await h.db.select().from(auditLogs).where(and(eq(auditLogs.entityId, enrollment!.id), eq(auditLogs.action, 'course.revoke')))).toHaveLength(1)
  })

  it('إعادة محاولة تفعيل متزامنة مع الإرجاع لا تترك اشتراكاً أو عضوية نشطة', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await ship(order.id)
    // طلب مسلّم ينتظر إعادة محاولة التفعيل بعد انقطاع سابق؛ لا اشتراك موجود بعد.
    await h.db.update(orders).set({ status: 'DELIVERED', deliveredAt: new Date() }).where(eq(orders.id, order.id))
    expect(await enrollmentsOf(student.studentId!)).toHaveLength(0)
    await Promise.all([
      activateCoursesForOrder(h.db, order.id),
      transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: null, source: 'delivery' })
    ])
    expect((await orderOf(order.id)).status).toBe('RETURNED')
    expect((await enrollmentsOf(student.studentId!)).some((enrollment) => enrollment.status === 'ACTIVE')).toBe(false)
    expect((await membershipsOf(student.studentId!, c.groupId)).some((membership) => membership.status === 'ACTIVE')).toBe(false)
  })

  it('فشل إشعار سحب الدورة يُبقي الطلب والاشتراك والمخزون كما كانت داخل المعاملة', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    const order = await buy(student, c.id)
    await deliver(order.id)
    const [before] = await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId))
    const originalNotify = notificationService.notify
    const spy = vi.spyOn(notificationService, 'notify').mockImplementation(async (db, input) => {
      if (input.userId === student.userId && input.workspaceId === workspaceId) throw new Error('injected revocation notification failure')
      await originalNotify(db, input)
    })
    try {
      await expect(transitionOrder(h.db, order.id, 'RETURNED', { actorUserId: admin.userId, source: 'admin' })).rejects.toThrow('injected revocation notification failure')
    } finally {
      spy.mockRestore()
    }
    expect((await orderOf(order.id)).status).toBe('DELIVERED')
    expect((await enrollmentsOf(student.studentId!))[0]!.status).toBe('ACTIVE')
    expect((await membershipsOf(student.studentId!, c.groupId))[0]!.status).toBe('ACTIVE')
    expect((await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId)))[0]!.stock).toBe(before!.stock)
  })
})

describe('أحقية تعيين beneficiaryStudentId', () => {
  it('التلميذ لا يستطيع توجيه الطلب إلى تلميذ آخر ولا يتغيّر المخزون', async () => {
    const c = await courseWithBook()
    const buyer = await makeStudent(h.db)
    const other = await makeStudent(h.db)
    const [stockBefore] = await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId))
    await expectCode(() => rawBuy(buyer, c.bookId, other.studentId!), 'FORBIDDEN')
    expect(await h.db.select().from(orders).where(eq(orders.userId, buyer.userId))).toHaveLength(0)
    expect((await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, c.bookId)))[0]!.stock).toBe(stockBefore!.stock)
  })

  it('التلميذ يعيّن نفسه والمشرف يعيّن أي تلميذ', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    expect((await rawBuy(student, c.bookId, student.studentId!)).beneficiaryStudentId).toBe(student.studentId)
    expect((await rawBuy(admin, c.bookId, student.studentId!)).beneficiaryStudentId).toBe(student.studentId)
  })

  it('مطابقة studentId داخل Actor وحدها لا تكفي دون ملكية userId في القاعدة', async () => {
    const c = await courseWithBook()
    const buyer = await makeStudent(h.db)
    const other = await makeStudent(h.db)
    const inconsistentActor = { ...buyer, studentId: other.studentId }
    await expectCode(() => rawBuy(inconsistentActor, c.bookId, other.studentId!), 'FORBIDDEN')
  })

  it('PUBLIC لا يعيّن beneficiaryStudentId؛ وعند عدم إرساله يبقى السلوك الحالي', async () => {
    const c = await courseWithBook()
    const publicUser = await makeStudent(h.db)
    await h.db.update(users).set({ role: 'PUBLIC' }).where(eq(users.id, publicUser.userId))
    const actor = await actorOf(h.db, publicUser.userId)
    const beneficiary = await makeStudent(h.db)
    await expectCode(() => rawBuy(actor, c.bookId, beneficiary.studentId!), 'FORBIDDEN')
    expect((await rawBuy(actor, c.bookId)).beneficiaryStudentId).toBeNull()
  })

  it('TEACHER لا يعيّن beneficiaryStudentId', async () => {
    const c = await courseWithBook()
    const student = await makeStudent(h.db)
    await expectCode(() => rawBuy(teacher, c.bookId, student.studentId!), 'FORBIDDEN')
  })
})

describe('التفعيل الفوري للطلب المجاني', () => {
  it('كتاب مجاني مربوط بدورة ينشئ DELIVERED ويُفعّل الدورة مرة واحدة', async () => {
    const c = await courseWithBook(0)
    const student = await makeStudent(h.db)
    const order = await rawBuy(student, c.bookId, student.studentId!)
    expect(order).toMatchObject({ status: 'DELIVERED', paymentMethod: 'FREE', totalDzd: 0 })
    const initial = await enrollmentsOf(student.studentId!)
    expect(initial).toHaveLength(1)
    expect(initial[0]).toMatchObject({ courseId: c.id, source: 'BOOK_ORDER', orderId: order.id, status: 'ACTIVE' })
    await activateCoursesForOrder(h.db, order.id)
    await activateCoursesForOrder(h.db, order.id)
    await recordDeliveryEvent(h.db, 'generic', { id: `free-repeat-${order.id}`, order: order.number, status: 'delivered' })
    expect(await enrollmentsOf(student.studentId!)).toHaveLength(1)
    expect(await membershipsOf(student.studentId!, c.groupId)).toHaveLength(1)
    const enrollAudits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'course.enroll'), eq(auditLogs.entityId, initial[0]!.id)))
    expect(enrollAudits).toHaveLength(1)
  })
})
