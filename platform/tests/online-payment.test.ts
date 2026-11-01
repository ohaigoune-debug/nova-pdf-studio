/**
 * الدفع الإلكتروني (Guiddini/SATIM) — 1 نوفمبر 2026. البوابة محاكاة (fetch وهمي)، والقاعدة PGlite في الذاكرة.
 * المطلوب: لا تفعيل قبل تأكّد الخادم من الدفع، التفعيل فوري بعده ومرة واحدة، الفشل يلغي الطلب ويعيد المخزون،
 * المبلغ المختلف لا يفعّل، والطلب غير المدفوع لا يظهر في طابور التأكيد.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, onlinePayments, orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { saveGuiddiniConfig, clearGuiddiniConfig } from '@/server/lib/guiddini'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { reconcilePendingPayments, verifyPayment } from '@/server/services/online-payment.service'
import { listConfirmationQueue } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string
let gateway = { status: 'processing', amount: '0' }
let refN = 0

const fetchMock = vi.fn(async (url: string) => {
  if (url.includes('/api/payment/initiate')) return new Response(JSON.stringify({ data: { type: 'transaction', id: `REF${++refN}`, attributes: { amount: '0', status: 'processing', form_url: 'https://test.satim.dz/payment?mdOrder=x' } } }), { status: 200 })
  if (url.includes('/api/payment/check')) return new Response(JSON.stringify({ data: { attributes: { status: gateway.status, amount: gateway.amount } }, meta: { code: 'TRANSACTION_FOUND' } }), { status: 200 })
  return new Response('{}', { status: 404 })
})

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

let n = 0
async function paidCourse(price = 3000, stock: number | null = 5) {
  const c = await createCourse(h.db, admin, { title: `دورة دفع ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: price, stock, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}
const payNow = (s: Actor, courseId: string) => placeCourseOrder(h.db, s, { courseId, phone: `06${String(10000000 + ++n).slice(-8)}`, wilayaId, address: 'حي النصر', deliveryType: 'HOME', payNow: true })
const enrollments = (studentId: string) => h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))
const paymentOf = async (orderId: string) => (await h.db.select().from(onlinePayments).where(eq(onlinePayments.orderId, orderId)))[0]!

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الدفع'))
  wilayaId = (await refIds(h.db)).wilayaId!
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await h.close()
})

describe('الدفع الإلكتروني', () => {
  it('بلا مفاتيح مفعّلة: «ادفع الآن» مرفوض والدفع عند الاستلام باقٍ', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'بلا بوابة')
    await expectCode(() => payNow(s, c.id), 'PAYMENT_NOT_CONFIGURED')
  })

  it('ادفع الآن ⇒ رابط SATIM، لا تفعيل قبل الدفع، ولا يظهر في طابور التأكيد', async () => {
    await saveGuiddiniConfig(h.db, { baseUrl: '', appKey: 'app-key-123456', appSecret: 'secret-abcdef', enabled: true })
    const c = await paidCourse(3000)
    const s = await makeStudent(h.db, 'يدفع الآن')
    const o = await payNow(s, c.id)
    expect(o.payUrl).toMatch(/^https:\/\/test\.satim\.dz/)
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(row!.paymentMethod).toBe('ONLINE')
    expect(row!.status).toBe('PENDING')
    expect(await enrollments(s.studentId!)).toHaveLength(0)
    expect((await listConfirmationQueue(h.db, admin)).some((q) => q.id === o.id)).toBe(false)
    gateway = { status: 'processing', amount: '0' }
    expect((await verifyPayment(h.db, (await paymentOf(o.id)).id)).status).toBe('PENDING')
    expect(await enrollments(s.studentId!)).toHaveLength(0)
  })

  it('«paid» بالمبلغ نفسه ⇒ الدورة تُفعَّل فورًا مرة واحدة، والطلب مؤكَّد للشحن', async () => {
    const c = await paidCourse(2500)
    const s = await makeStudent(h.db, 'دفع ناجح')
    const o = await payNow(s, c.id)
    gateway = { status: 'paid', amount: String(o.totalDzd) }
    const pid = (await paymentOf(o.id)).id
    const out = await verifyPayment(h.db, pid)
    expect(out.status).toBe('PAID')
    expect(out.courseIds).toEqual([c.id])
    const e = await enrollments(s.studentId!)
    expect(e.map((x) => [x.courseId, x.source, x.status])).toEqual([[c.id, 'ONLINE_PAYMENT', 'ACTIVE']])
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.status).toBe('CONFIRMED')
    // تكرار (عودة الولي + الفحص الآلي) لا يكرر شيئًا
    expect((await verifyPayment(h.db, pid)).courseIds).toEqual([])
    expect(await enrollments(s.studentId!)).toHaveLength(1)
  })

  it('المبلغ المختلف لا يفعّل؛ الفشل يلغي الطلب ويعيد الكتاب للمخزون', async () => {
    const c = await paidCourse(2000, 3)
    const s1 = await makeStudent(h.db, 'مبلغ مختلف')
    const o1 = await payNow(s1, c.id)
    gateway = { status: 'paid', amount: '10' }
    expect((await verifyPayment(h.db, (await paymentOf(o1.id)).id)).status).toBe('MISMATCH')
    expect(await enrollments(s1.studentId!)).toHaveLength(0)

    const s2 = await makeStudent(h.db, 'دفع فاشل')
    const o2 = await payNow(s2, c.id)
    gateway = { status: 'failed', amount: '0' }
    expect((await verifyPayment(h.db, (await paymentOf(o2.id)).id)).status).toBe('FAILED')
    expect((await h.db.select().from(orders).where(eq(orders.id, o2.id)))[0]!.status).toBe('CANCELLED')
    expect(await enrollments(s2.studentId!)).toHaveLength(0)
  })

  it('الولي الذي دفع وأغلق الصفحة: الفحص الآلي يفعّل الدورة', async () => {
    const c = await paidCourse(1800)
    const s = await makeStudent(h.db, 'أغلق الصفحة')
    const o = await payNow(s, c.id)
    gateway = { status: 'paid', amount: String(o.totalDzd) }
    const later = new Date(Date.now() + 5 * 60_000)
    const r = await reconcilePendingPayments(h.db, undefined, later)
    expect(r.paid).toBeGreaterThanOrEqual(1)
    expect((await enrollments(s.studentId!)).map((x) => x.source)).toEqual(['ONLINE_PAYMENT'])
    await clearGuiddiniConfig(h.db)
  })
})
