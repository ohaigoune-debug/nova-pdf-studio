/**
 * النسخة الرقمية للدورة (قرار المالك 2 نوفمبر 2026): بطاقة مستقلة تفتح الدورة نفسها دون كتاب، بالبطاقة فقط،
 * فور تأكّد الخادم من الدفع؛ ومن اشتراها ثم أراد الكتاب يدفع الفرق فقط. البوابة محاكاة، والقاعدة PGlite.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, onlinePayments, orderItems, orders, products } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { clearGuiddiniConfig, saveGuiddiniConfig } from '@/server/lib/guiddini'
import { listCourseCatalog } from '@/server/services/academy-catalog.service'
import {
  courseDigitalStateById,
  courseQuote,
  placeCourseOrder,
  placeDigitalCourseOrder,
  setCourseBook,
  setCourseDigitalPrice
} from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { verifyPayment } from '@/server/services/online-payment.service'
import { listConfirmationQueue } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string
let gateway: { status: string; amount: string; deposit?: string | null } = { status: 'no_payment_attempted', amount: '0' }
let refN = 0

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.includes('/api/payment-requests/check')) {
    const paid = gateway.status === 'paid'
    return json({ data: { id: new URL(url).searchParams.get('order_number'), attributes: { status: gateway.status, amount: gateway.amount, deposit_amount: gateway.deposit ?? null, confirmation_status: paid ? 'confirmed' : 'requires_verification' }, links: { href: paid ? 'https://epay.efawtara.com/r/x' : null } } })
  }
  if (url.includes('/api/payment-requests')) {
    const id = `DIGI${String(++refN).padStart(6, '0')}`
    return json({ data: { id, type: 'payment_request', attributes: { order_number: id, status: 'no_payment_attempted', form_url: `https://test.satim.dz/payment_ar.html?mdOrder=${id}` } } }, 201)
  }
  return json({ errors: [{ status: '404', code: 'NOT_FOUND' }] }, 404)
})
const lastCreateBody = () => {
  const call = fetchMock.mock.calls.filter(([u, init]) => String(u).endsWith('/api/payment-requests') && init?.method === 'POST').at(-1)!
  return JSON.parse(String(call[1]!.body)) as { amount: number }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

let n = 0
/** دورة منشورة: بكتاب (اختياري) وبنسخة رقمية (اختيارية) */
async function course(opts: { book?: number | null; digital?: number | null; stock?: number | null } = {}) {
  const c = await createCourse(h.db, admin, { title: `دورة رقمية ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  if (opts.book) await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: opts.book, stock: opts.stock ?? 5, active: true })
  if (opts.digital) await setCourseDigitalPrice(h.db, admin, c.id, opts.digital)
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}
const buyDigital = (s: Actor, courseId: string, acceptNoBook = true) => placeDigitalCourseOrder(h.db, s, { courseId, acceptNoBook })
const buyBook = (s: Actor, courseId: string) => placeCourseOrder(h.db, s, { courseId, phone: `06${String(10000000 + ++n).slice(-8)}`, wilayaId, address: 'حي النصر', deliveryType: 'HOME', payNow: true })
const enrollments = (studentId: string) => h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))
const paymentOf = async (orderId: string) => (await h.db.select().from(onlinePayments).where(eq(onlinePayments.orderId, orderId)))[0]!
const orderRow = async (id: string) => (await h.db.select().from(orders).where(eq(orders.id, id)))[0]!

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ النسخة الرقمية'))
  wilayaId = (await refIds(h.db)).wilayaId!
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await h.close()
})

describe('النسخة الرقمية للدورة', () => {
  it('سعرها 50 دج على الأقل وأقل من سعر الدورة مع الكتاب؛ والكتاب لا ينزل تحتها', async () => {
    const c = await course({ book: 3000 })
    await expectCode(() => setCourseDigitalPrice(h.db, admin, c.id, 40), 'DIGITAL_PRICE_INVALID')
    await expectCode(() => setCourseDigitalPrice(h.db, admin, c.id, 3000), 'DIGITAL_PRICE_INVALID')
    await setCourseDigitalPrice(h.db, admin, c.id, 2000)
    await expectCode(() => setCourseBook(h.db, admin, c.id, { title: 'كتاب', priceDzd: 1800, stock: 5, active: true }), 'BOOK_PRICE_BELOW_DIGITAL')
    // الإيقاف بـ null
    expect((await setCourseDigitalPrice(h.db, admin, c.id, null)).issue).toBe('NO_DIGITAL')
  })

  it('لا تظهر ولا تُشترى قبل تفعيل الدفع الإلكتروني (لا دفع عند الاستلام لشيء لا يُسلَّم)', async () => {
    const c = await course({ digital: 1500 })
    expect((await courseDigitalStateById(h.db, c.id)).issue).toBe('PAYMENT_OFF')
    const s = await makeStudent(h.db, 'قبل التفعيل')
    await expectCode(() => buyDigital(s, c.id), 'PAYMENT_NOT_CONFIGURED')
    await saveGuiddiniConfig(h.db, { baseUrl: '', appKey: 'APP-test-123456', appSecret: 'SEC-test-abcdef', enabled: true })
    expect((await courseDigitalStateById(h.db, c.id)).purchasable).toBe(true)
  })

  it('الكتالوج يعرض العرضين منفصلين: كتاب منشور وسعر رقمي', async () => {
    const both = await course({ book: 3200, digital: 2200 })
    const onlyDigital = await course({ digital: 1700 })
    const s = await makeStudent(h.db, 'يتصفّح')
    const cat = await listCourseCatalog(h.db, s)
    expect(cat.find((x) => x.id === both.id)).toMatchObject({ bookOffer: true, digitalPriceDzd: 2200, priceDzd: 3200 })
    expect(cat.find((x) => x.id === onlyDigital.id)).toMatchObject({ bookOffer: false, digitalPriceDzd: 1700 })
  })

  it('بلا تأكيد «دون كتاب» يُرفض؛ ومعه: طلب رقمي بلا شحن ولا عنوان، بالبطاقة، ولا يدخل طابور التأكيد', async () => {
    const c = await course({ book: 3000, digital: 1900, stock: 3 })
    const s = await makeStudent(h.db, 'يشتري الرقمية')
    await expectCode(() => buyDigital(s, c.id, false), 'DIGITAL_ACK_REQUIRED')
    const o = await buyDigital(s, c.id)
    expect(o.payUrl).toMatch(/^https:\/\/test\.satim\.dz/)
    expect(lastCreateBody().amount).toBe(1900)
    const row = await orderRow(o.id)
    expect(row).toMatchObject({ paymentMethod: 'ONLINE', needsShipping: false, shippingDzd: 0, totalDzd: 1900, status: 'PENDING', address: null })
    const items = await h.db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    expect(items.map((i) => [i.type, i.productId, i.courseId, i.lineTotalDzd])).toEqual([['COURSE', null, c.id, 1900]])
    expect((await listConfirmationQueue(h.db, admin)).some((q) => q.id === o.id)).toBe(false)
    expect(await enrollments(s.studentId!)).toHaveLength(0)
    // ضغطة ثانية والدفع معلّق: الرابط نفسه، لا طلب ثانٍ
    gateway = { status: 'no_payment_attempted', amount: '1900.00' }
    const again = await buyDigital(s, c.id)
    expect(again.id).toBe(o.id)
    expect(again.payUrl).toBe(o.payUrl)
  })

  it('«paid» ⇒ الدورة تُفتح فورًا مرة واحدة، والطلب يكتمل (سُلِّم) دون مخزون الكتاب', async () => {
    const c = await course({ book: 3000, digital: 1900, stock: 3 })
    const book = (await h.db.select({ id: products.id, stock: products.stock }).from(products).where(eq(products.title, `كتاب ${n}`)))[0]!
    const s = await makeStudent(h.db, 'دفع الرقمية')
    const o = await buyDigital(s, c.id)
    gateway = { status: 'paid', amount: '1900.00', deposit: '1900.00' }
    const pid = (await paymentOf(o.id)).id
    const out = await verifyPayment(h.db, pid)
    expect(out.status).toBe('PAID')
    expect(out.courseIds).toEqual([c.id])
    expect((await enrollments(s.studentId!)).map((e) => [e.courseId, e.source, e.status])).toEqual([[c.id, 'ONLINE_PAYMENT', 'ACTIVE']])
    expect((await orderRow(o.id)).status).toBe('DELIVERED')
    expect((await verifyPayment(h.db, pid)).courseIds).toEqual([])
    expect(await enrollments(s.studentId!)).toHaveLength(1)
    expect((await h.db.select({ stock: products.stock }).from(products).where(eq(products.id, book.id)))[0]!.stock).toBe(book.stock)
    // مشترك الآن: لا شراء رقمي ثانٍ
    await expectCode(() => buyDigital(s, c.id), 'ALREADY_ENROLLED')
  })

  it('فشل الدفع ⇒ يُلغى الطلب الرقمي ولا تُفتح الدورة', async () => {
    const c = await course({ digital: 1600 })
    const s = await makeStudent(h.db, 'فشل الرقمية')
    const o = await buyDigital(s, c.id)
    gateway = { status: 'insufficient_funds', amount: '1600.00', deposit: '0.00' }
    expect((await verifyPayment(h.db, (await paymentOf(o.id)).id)).status).toBe('FAILED')
    expect((await orderRow(o.id)).status).toBe('CANCELLED')
    expect(await enrollments(s.studentId!)).toHaveLength(0)
  })

  it('من اشترى الرقمية ثم أراد الكتاب: يدفع الفرق فقط + التوصيل، مرة واحدة، والدورة لا تتأثر', async () => {
    const c = await course({ book: 3000, digital: 1900, stock: 4 })
    const s = await makeStudent(h.db, 'يضيف الكتاب')
    const d = await buyDigital(s, c.id)
    gateway = { status: 'paid', amount: '1900.00', deposit: '1900.00' }
    await verifyPayment(h.db, (await paymentOf(d.id)).id)

    const q = (await courseQuote(h.db, c.id, wilayaId, 'HOME', s))!
    expect(q).toMatchObject({ priceDzd: 1100, upgrade: true })
    expect((await courseQuote(h.db, c.id, wilayaId, 'HOME'))!.priceDzd).toBe(3000)

    const b = await buyBook(s, c.id)
    expect(b.priceDzd).toBe(1100)
    expect(b.totalDzd).toBe(1100 + b.shippingDzd)
    expect(lastCreateBody().amount).toBe(b.totalDzd)
    const bookRow = await orderRow(b.id)
    expect(bookRow.needsShipping).toBe(true)
    // طلب كتاب قائم ⇒ لا ثانٍ
    await expectCode(() => buyBook(s, c.id), 'ALREADY_ENROLLED')
    // دفع الكتاب يُكمل الطلب ولا يمسّ الاشتراك
    gateway = { status: 'paid', amount: `${b.totalDzd}.00`, deposit: `${b.totalDzd}.00` }
    expect((await verifyPayment(h.db, (await paymentOf(b.id)).id)).status).toBe('PAID')
    expect((await orderRow(b.id)).status).toBe('CONFIRMED')
    const e = await enrollments(s.studentId!)
    expect(e).toHaveLength(1)
    expect(e[0]!.orderId).toBe(d.id)
  })

  it('مشترك عن طريق الكتاب لا «يضيف الكتاب» مرة أخرى', async () => {
    const c = await course({ book: 2800, digital: 1800 })
    const s = await makeStudent(h.db, 'اشترى بالكتاب')
    const b = await buyBook(s, c.id)
    gateway = { status: 'paid', amount: `${b.totalDzd}.00`, deposit: `${b.totalDzd}.00` }
    await verifyPayment(h.db, (await paymentOf(b.id)).id)
    expect((await courseQuote(h.db, c.id, wilayaId, 'HOME', s))!.upgrade).toBe(false)
    await expectCode(() => buyBook(s, c.id), 'ALREADY_ENROLLED')
    await expectCode(() => buyDigital(s, c.id), 'ALREADY_ENROLLED')
    const [en] = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.studentId, s.studentId!), eq(courseEnrollments.courseId, c.id)))
    expect(en!.status).toBe('ACTIVE')
    await clearGuiddiniConfig(h.db)
  })
})
