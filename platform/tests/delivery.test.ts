import { createHmac } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseClaims, courseEnrollments, deliveryEvents, groupStudents, notifications, orderItems, orders, profiles, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { claimCourse, claimsForOrder } from '@/server/services/claims.service'
import { createCourse, linkProduct } from '@/server/services/courses.service'
import { listDeliveryEvents, normalizeDeliveryStatus, parseDeliveryPayload, recordDeliveryEvent, saveDeliveryWebhookSecret, setOrderShipping, verifyDeliveryWebhook } from '@/server/services/delivery.service'
import { createProduct } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let guardian: Actor
let courseId: string
let groupId: string
let bookId: string
const sms: SmsMessage[] = []

async function makeOrder(opts: { userId: string; phone: string; status?: string; trackingId?: string | null; provider?: string | null; beneficiaryStudentId?: string | null }) {
  const [o] = await h.db
    .insert(orders)
    .values({ number: `MD-TEST-${uniq('o').toUpperCase().slice(-8)}`, userId: opts.userId, status: opts.status ?? 'SHIPPED', paymentMethod: 'COD', needsShipping: true, subtotalDzd: 1200, shippingDzd: 400, totalDzd: 1600, customerName: 'زبون', phone: opts.phone, deliveryProvider: opts.provider ?? (opts.trackingId ? 'yalidine' : null), deliveryTrackingId: opts.trackingId ?? null, beneficiaryStudentId: opts.beneficiaryStudentId ?? null, confirmedAt: new Date(), shippedAt: new Date() })
    .returning()
  await h.db.insert(orderItems).values({ orderId: o!.id, productId: bookId, title: 'كتاب', type: 'BOOK', unitPriceDzd: 1200, qty: 1, lineTotalDzd: 1200 })
  return o!
}

beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'test-session-secret-for-delivery'
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sms.push(m) })
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ التوصيل')
  student = await makeStudent(h.db, 'تلميذ التوصيل')
  const [g] = await h.db.insert(users).values({ email: uniq('parent') + '@test.dz', passwordHash: 'x', role: 'PARENT' }).returning()
  await h.db.insert(profiles).values({ userId: g!.id, fullName: 'وليّ أمر' })
  guardian = await actorOf(h.db, g!.id)
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const course = await createCourse(h.db, admin, { title: 'دورة الأدب العربي', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
  courseId = course.id
  groupId = course.groupId
  bookId = (await createProduct(h.db, admin, { title: 'كتاب وسام التفوق', type: 'BOOK', priceDzd: 1200, status: 'PUBLISHED' })).id
  await linkProduct(h.db, admin, courseId, bookId)
  await saveDeliveryWebhookSecret(h.db, admin, 'super-secret-webhook-key-123')
})

afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('webhook التوصيل — المصادقة والتحليل', () => {
  it('سرّ خاطئ مرفوض، والصحيح مقبول بالترويسة أو بتوقيع HMAC', async () => {
    const body = JSON.stringify({ id: 'e1', tracking: 'T1', status: 'delivered' })
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: 'wrong', signature: null, rawBody: body })).toBe(false)
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: null, signature: 'deadbeef', rawBody: body })).toBe(false)
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: 'super-secret-webhook-key-123', signature: null, rawBody: body })).toBe(true)
    const sig = createHmac('sha256', 'super-secret-webhook-key-123').update(body).digest('hex')
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: null, signature: `sha256=${sig}`, rawBody: body })).toBe(true)
    // بعد حذف السرّ وبلا بيئة ⇒ مرفوض دائماً
    const envBackup = process.env.DELIVERY_WEBHOOK_SECRET
    delete process.env.DELIVERY_WEBHOOK_SECRET
    await saveDeliveryWebhookSecret(h.db, admin, null)
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: 'super-secret-webhook-key-123', signature: null, rawBody: body })).toBe(false)
    process.env.DELIVERY_WEBHOOK_SECRET = 'env-secret-webhook-key-456'
    expect(await verifyDeliveryWebhook(h.db, { headerSecret: 'env-secret-webhook-key-456', signature: null, rawBody: body })).toBe(true)
    if (envBackup === undefined) delete process.env.DELIVERY_WEBHOOK_SECRET
    else process.env.DELIVERY_WEBHOOK_SECRET = envBackup
    await expect(saveDeliveryWebhookSecret(h.db, teacher, 'x'.repeat(20))).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('تطبيع الحالات وخرائط المزوّدين', () => {
    expect(normalizeDeliveryStatus('Livré')).toBe('DELIVERED')
    expect(normalizeDeliveryStatus('en cours de livraison')).toBe('IN_TRANSIT')
    expect(normalizeDeliveryStatus('Retour')).toBe('RETURNED')
    expect(normalizeDeliveryStatus('whatever')).toBe('UNKNOWN')
    expect(parseDeliveryPayload('yalidine', { event_id: 'y1', tracking: 'YAL-1', last_status: 'Livré', order_id: 'MD-1' })).toMatchObject({ externalId: 'y1', trackingId: 'YAL-1', status: 'DELIVERED', orderNumber: 'MD-1' })
    expect(parseDeliveryPayload('generic', { data: { tracking: 'G-1', status: 'shipped' } })).toMatchObject({ externalId: 'G-1:IN_TRANSIT', trackingId: 'G-1', status: 'IN_TRANSIT' })
    expect(() => parseDeliveryPayload('generic', { status: 'delivered' })).toThrow()
  })
})

describe('webhook التوصيل — المعالجة', () => {
  it('طلب مجهول يُخزَّن بخطأ، والحدث المكرَّر يُتجاهل', async () => {
    const r = await recordDeliveryEvent(h.db, 'generic', { id: 'unknown-1', tracking: 'NOPE', status: 'delivered' })
    expect(r).toMatchObject({ duplicate: false, orderId: null, error: 'order not found' })
    const dup = await recordDeliveryEvent(h.db, 'generic', { id: 'unknown-1', tracking: 'NOPE', status: 'delivered' })
    expect(dup.duplicate).toBe(true)
    const [ev] = await h.db.select().from(deliveryEvents).where(and(eq(deliveryEvents.provider, 'generic'), eq(deliveryEvents.externalId, 'unknown-1')))
    expect(ev).toMatchObject({ orderId: null, error: 'order not found', status: 'DELIVERED' })
    expect((await h.db.select().from(deliveryEvents).where(eq(deliveryEvents.externalId, 'unknown-1'))).length).toBe(1)
  })

  it('المشرف يسجّل التتبّع: المؤكَّد يصبح في الطريق', async () => {
    const o = await makeOrder({ userId: student.userId, phone: '0550000001', status: 'CONFIRMED' })
    await expect(setOrderShipping(h.db, student, o.id, { provider: 'yalidine', trackingId: 'X' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setOrderShipping(h.db, admin, o.id, { provider: 'yalidine', trackingId: 'YAL-STUDENT-1' })
    const [after] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(after).toMatchObject({ status: 'SHIPPED', deliveryProvider: 'yalidine', deliveryTrackingId: 'YAL-STUDENT-1' })

    // DELIVERED على طلب صاحبه تلميذ ⇒ اشتراك نشط + عضوية الفوج
    const r = await recordDeliveryEvent(h.db, 'yalidine', { event_id: 'y-del-1', tracking: 'YAL-STUDENT-1', last_status: 'Livré' })
    expect(r.duplicate).toBe(false)
    expect(r.error).toBeNull()
    expect(r.activation?.enrolled).toHaveLength(1)
    const [o2] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(o2!.status).toBe('DELIVERED')
    expect(o2!.deliveredAt).not.toBeNull()
    const [en] = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, student.studentId!)))
    expect(en).toMatchObject({ status: 'ACTIVE', source: 'BOOK_ORDER', orderId: o.id })
    const [gs] = await h.db.select().from(groupStudents).where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.studentId, student.studentId!)))
    expect(gs?.status).toBe('ACTIVE')
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(notes.some((n) => n.type === 'ENROLLED')).toBe(true)
    // إعادة إرسال نفس الحدث لا تعيد المعالجة
    expect((await recordDeliveryEvent(h.db, 'yalidine', { event_id: 'y-del-1', tracking: 'YAL-STUDENT-1', last_status: 'Livré' })).duplicate).toBe(true)
  })

  it('المطابقة برقم الطلب حين لا تتبّع مسجَّل', async () => {
    const other = await makeStudent(h.db, 'تلميذ آخر')
    const o = await makeOrder({ userId: other.userId, phone: '0550000002', status: 'SHIPPED' })
    const r = await recordDeliveryEvent(h.db, 'generic', { id: 'g-num-1', order: o.number, status: 'DELIVERED' })
    expect(r.orderId).toBe(o.id)
    expect(r.activation?.enrolled).toHaveLength(1)
  })

  it('طلب وليّ الأمر ⇒ مطالبة + SMS بالرمز، ثم التلميذ يفعّل بالرمز', async () => {
    sms.length = 0
    const o = await makeOrder({ userId: guardian.userId, phone: '0661 23 45 67', trackingId: 'YAL-GUARD-1' })
    const r = await recordDeliveryEvent(h.db, 'yalidine', { event_id: 'y-guard-1', tracking: 'YAL-GUARD-1', status: 'delivered' })
    expect(r.activation?.claims).toHaveLength(1)
    expect(r.activation?.enrolled).toHaveLength(0)
    expect(sms).toHaveLength(1)
    expect(sms[0]!.to).toBe('0661234567')
    expect(sms[0]!.text).toContain(o.number)
    expect(sms[0]!.text).toContain('madrasadz.com/claim')
    const code = /الرمز (\d{6})/.exec(sms[0]!.text)![1]!
    const [claim] = await claimsForOrder(h.db, o.id)
    expect(claim).toMatchObject({ courseId, phone: '0661234567', claimedAt: null })
    // لا تفعيل على حساب الولي
    expect(await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.orderId, o.id))).toHaveLength(0)
    await expect(claimCourse(h.db, guardian, { phone: '0661234567', code })).rejects.toMatchObject({ code: 'FORBIDDEN' })

    const kid = await makeStudent(h.db, 'ابن الولي')
    await expect(claimCourse(h.db, kid, { phone: '0661234567', code: code === '000000' ? '000001' : '000000' })).rejects.toMatchObject({ code: 'CLAIM_INVALID' })
    const ok = await claimCourse(h.db, kid, { phone: '+213 661 234 567', code })
    expect(ok.courseId).toBe(courseId)
    const [en] = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, kid.studentId!)))
    expect(en).toMatchObject({ status: 'ACTIVE', source: 'CLAIM', orderId: o.id })
    const [c2] = await h.db.select().from(courseClaims).where(eq(courseClaims.id, claim!.id))
    expect(c2!.claimedByStudentId).toBe(kid.studentId)
    expect(c2!.claimedAt).not.toBeNull()
    // الرمز لا يُستعمل مرتين
    await expect(claimCourse(h.db, kid, { phone: '0661234567', code })).rejects.toMatchObject({ code: 'CLAIM_INVALID' })
  })

  it('رمز خاطئ ×5 يقفل المطالبة', async () => {
    sms.length = 0
    await makeOrder({ userId: guardian.userId, phone: '0770000009', trackingId: 'YAL-GUARD-2' })
    await recordDeliveryEvent(h.db, 'yalidine', { event_id: 'y-guard-2', tracking: 'YAL-GUARD-2', status: 'delivered' })
    const code = /الرمز (\d{6})/.exec(sms[0]!.text)![1]!
    const kid = await makeStudent(h.db, 'تلميذ مجتهد')
    const wrong = code === '111111' ? '222222' : '111111'
    for (let i = 0; i < 4; i++) await expect(claimCourse(h.db, kid, { phone: '0770000009', code: wrong })).rejects.toMatchObject({ code: 'CLAIM_INVALID' })
    await expect(claimCourse(h.db, kid, { phone: '0770000009', code: wrong })).rejects.toMatchObject({ code: 'CLAIM_BLOCKED' })
    // حتى الرمز الصحيح مرفوض بعد القفل
    await expect(claimCourse(h.db, kid, { phone: '0770000009', code })).rejects.toMatchObject({ code: 'CLAIM_BLOCKED' })
  })

  it('سجلّ الأحداث للمشرف فقط', async () => {
    await expect(listDeliveryEvents(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const rows = await listDeliveryEvents(h.db, admin)
    expect(rows.length).toBeGreaterThanOrEqual(4)
    expect(rows.find((r) => r.externalId === 'unknown-1')).toMatchObject({ orderNumber: null, error: 'order not found' })
    expect(rows.find((r) => r.externalId === 'y-del-1')?.orderNumber).toBeTruthy()
  })
})
