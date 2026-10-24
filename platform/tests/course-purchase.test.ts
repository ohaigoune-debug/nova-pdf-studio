/**
 * شراء الدورة مع كتابها مباشرة (قرار المالك 2026-10-24) — الاختبارات الإلزامية:
 * الإجمالي من الخادم، لا تفعيل قبل التسليم، التسليم يفعّل الدورة المطلوبة للحساب الصحيح مرة واحدة،
 * الكتاب المشترك وتغيير الربط لا يبدّلان الاستحقاق، تكرار التسليم/المطالبة آمن، والقديم سليم.
 * قاعدة PGlite في الذاكرة وبيانات وهمية.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, courses, orderItems, orders, products } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { mapEcotrackStatus } from '@/server/lib/ecotrack'
import { AppError } from '@/server/lib/errors'
import { claimCourse, createClaim } from '@/server/services/claims.service'
import { activateCoursesForOrder, coursesOfOrder, sendActivationCode } from '@/server/services/course-activation.service'
import { assertCoursePublishable, chooseCourseBook, courseBookStateById, courseQuote, placeCourseOrder, publishedCoursesBlocked, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, enrollStudent, linkProduct, setCourseStatus, unlinkProduct } from '@/server/services/courses.service'
import { normalizeDeliveryStatus, recordDeliveryEvent } from '@/server/services/delivery.service'
import { createProduct, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

let n = 0
/** دورة مدفوعة جديدة بكتابها، منشورة عبر حارس النشر */
async function paidCourse(price = 2500, stock: number | null = 10) {
  const c = await createCourse(h.db, admin, { title: `دورة ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب الدورة ${n}`, priceDzd: price, stock, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

const buy = (actor: Actor, courseId: string, extra: Record<string, unknown> = {}) => placeCourseOrder(h.db, actor, { courseId, phone: `05${String(10000000 + ++n).slice(-8)}`, wilayaId, address: 'حي الأمل', deliveryType: 'HOME', ...extra } as Parameters<typeof placeCourseOrder>[2])

const enrollmentsOf = (studentId: string) => h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))

async function deliver(orderId: string) {
  await setOrderStatus(h.db, admin, orderId, 'CONFIRMED')
  await setOrderStatus(h.db, admin, orderId, 'SHIPPED')
  return setOrderStatus(h.db, admin, orderId, 'DELIVERED')
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin, 'أستاذ الشراء')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  wilayaId = (await refIds(h.db)).wilayaId!
})

afterAll(async () => {
  await h.close()
})

describe('1. الشراء يشمل الكتاب والإجمالي من الخادم', () => {
  it('سعر الدورة = سعر الكتاب؛ الطلب يحفظ الدورة والكتاب والسعر؛ الإجمالي = السعر + التوصيل', async () => {
    const c = await paidCourse(2500)
    const st = await courseBookStateById(h.db, c.id)
    expect(st.purchasable).toBe(true)
    expect((await h.db.select({ p: courses.priceDzd }).from(courses).where(eq(courses.id, c.id)))[0]!.p).toBe(2500)
    const q = await courseQuote(h.db, c.id, wilayaId, 'HOME')
    const s = await makeStudent(h.db, 'مشترٍ أول')
    const o = await buy(s, c.id)
    expect(o.priceDzd).toBe(2500)
    expect(o.totalDzd).toBe(2500 + o.shippingDzd)
    expect(o.totalDzd).toBe(q!.totalDzd)
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(row!.totalDzd).toBe(o.totalDzd)
    expect(row!.beneficiaryStudentId).toBe(s.studentId)
    const items = await h.db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    expect(items).toHaveLength(1)
    expect(items[0]!.courseId).toBe(c.id)
    expect(items[0]!.productId).toBe(st.book!.id)
    expect(items[0]!.unitPriceDzd).toBe(2500)
    // المخزون نقص بواحد
    expect((await h.db.select({ s: products.stock }).from(products).where(eq(products.id, st.book!.id)))[0]!.s).toBe(9)
  })

  it('المتصفح لا يفرض سعراً ولا منتجاً ولا تلميذاً: الحقول الزائدة تُتجاهل', async () => {
    const c = await paidCourse(3000)
    const s = await makeStudent(h.db, 'مشترٍ متلاعب')
    const other = await makeStudent(h.db, 'تلميذ آخر')
    const fake = await createProduct(h.db, admin, { title: 'كتاب رخيص', type: 'BOOK', priceDzd: 1, stock: 5, status: 'PUBLISHED' })
    const o = await buy(s, c.id, { priceDzd: 1, totalDzd: 1, productId: fake.id, studentId: other.studentId })
    expect(o.priceDzd).toBe(3000)
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(row!.beneficiaryStudentId).toBe(s.studentId)
    const items = await h.db.select().from(orderItems).where(eq(orderItems.orderId, o.id))
    expect(items[0]!.productId).not.toBe(fake.id)
  })

  it('لا طلب ثانٍ مفتوح للدورة نفسها؛ ونفاد المخزون يوقف الشراء', async () => {
    const c = await paidCourse(1000, 2)
    const s = await makeStudent(h.db, 'مكرّر')
    await buy(s, c.id)
    await expectCode(() => buy(s, c.id), 'COURSE_ORDER_OPEN')
    await buy(await makeStudent(h.db, 'آخر نسخة'), c.id)
    const s3 = await makeStudent(h.db, 'متأخر')
    await expectCode(() => buy(s3, c.id), 'COURSE_NOT_PURCHASABLE')
  })

  it('حارس النشر: دورة مدفوعة بلا كتاب لا تُنشر؛ الدورة المجانية تُنشر', async () => {
    const c = await createCourse(h.db, admin, { title: 'مدفوعة بلا كتاب', workspaceId, season: '2026/2027', status: 'DRAFT', priceDzd: 2000 })
    await expectCode(() => setCourseStatus(h.db, admin, c.id, 'PUBLISHED'), 'COURSE_BOOK_REQUIRED')
    await expectCode(() => createCourse(h.db, admin, { title: 'منشورة مباشرة', workspaceId, season: '2026/2027', status: 'PUBLISHED', priceDzd: 2000 }), 'COURSE_BOOK_REQUIRED')
    const free = await createCourse(h.db, admin, { title: 'مجانية', workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseStatus(h.db, admin, free.id, 'PUBLISHED')
    await expect(assertCoursePublishable(h.db, { bookProductId: null, priceDzd: 0 })).resolves.toBeUndefined()
  })
})

describe('2. لا تفعيل قبل التسليم، ولا عند الإلغاء أو الإرجاع', () => {
  it('PENDING/CONFIRMED/SHIPPED لا تفعّل؛ الإرجاع لا يفعّل؛ الإلغاء ثم «تسليم» لا يفعّل', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'منتظر')
    const o = await buy(s, c.id)
    expect((await activateCoursesForOrder(h.db, o.id)).enrolled).toHaveLength(0)
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(0)
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    expect((await activateCoursesForOrder(h.db, o.id)).enrolled).toHaveLength(0)
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(0)
    await setOrderStatus(h.db, admin, o.id, 'RETURNED')
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(0)

    const s2 = await makeStudent(h.db, 'ملغٍ')
    const o2 = await buy(s2, c.id)
    await setOrderStatus(h.db, admin, o2.id, 'CANCELLED')
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o2.id))
    await recordDeliveryEvent(h.db, 'generic', { id: `cancel-${o2.id}`, order: row!.number, status: 'delivered' })
    expect((await h.db.select().from(orders).where(eq(orders.id, o2.id)))[0]!.status).toBe('CANCELLED')
    expect(await enrollmentsOf(s2.studentId!)).toHaveLength(0)
  })

  it('«non livré» / «not delivered» / المجهول ليست تسليماً (webhook وEcoTrack)', async () => {
    expect(normalizeDeliveryStatus('Non livré')).toBe('FAILED_ATTEMPT')
    expect(normalizeDeliveryStatus('not delivered')).toBe('FAILED_ATTEMPT')
    expect(normalizeDeliveryStatus('لم يتم التسليم')).toBe('FAILED_ATTEMPT')
    expect(normalizeDeliveryStatus('statut bizarre')).toBe('UNKNOWN')
    expect(mapEcotrackStatus('Non livré')).toBe('failed_attempt')
    expect(mapEcotrackStatus('not delivered')).toBe('failed_attempt')
    expect(mapEcotrackStatus('Livré')).toBe('delivered')

    const c = await paidCourse()
    const s = await makeStudent(h.db, 'لم يُسلَّم')
    const o = await buy(s, c.id)
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    for (const [i, status] of ['Non livré', 'not delivered', 'statut inconnu'].entries()) {
      await recordDeliveryEvent(h.db, 'generic', { id: `nd-${o.id}-${i}`, order: o.number, status })
    }
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.status).not.toBe('DELIVERED')
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(0)
  })

  it('أكواد المطالبة محمية قبل التسليم: لا توليد ولا استعمال', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'مستعجل')
    const o = await buy(s, c.id)
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await expectCode(() => sendActivationCode(h.db, admin.userId, o.id), 'ORDER_NOT_DELIVERED')
    const claim = await createClaim(h.db, { orderId: o.id, courseId: c.id, phone: '0661112233' })
    await expectCode(() => claimCourse(h.db, s, { phone: '0661112233', code: claim.code }), 'ORDER_NOT_DELIVERED')
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(0)
  })
})

describe('3. التسليم يفعّل الدورة المطلوبة للحساب الصحيح مرة واحدة', () => {
  it('تسليم يدوي ثم webhook مكرّر ثم إعادة التفعيل ⇒ اشتراك واحد فقط للمشتري', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'مستلم')
    const bystander = await makeStudent(h.db, 'متفرّج')
    const o = await buy(s, c.id)
    await deliver(o.id)
    let mine = await enrollmentsOf(s.studentId!)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.courseId).toBe(c.id)
    expect(mine[0]!.orderId).toBe(o.id)
    expect(mine[0]!.status).toBe('ACTIVE')
    for (let i = 0; i < 3; i++) await recordDeliveryEvent(h.db, 'generic', { id: `dup-${o.id}-${i}`, order: o.number, status: 'delivered' })
    await activateCoursesForOrder(h.db, o.id)
    await setOrderStatus(h.db, admin, o.id, 'DELIVERED').catch(() => null)
    mine = await enrollmentsOf(s.studentId!)
    expect(mine).toHaveLength(1)
    expect(await enrollmentsOf(bystander.studentId!)).toHaveLength(0)
  })

  it('webhook «Livré» يفعّل كذلك (المسار الموحّد)', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'webhook')
    const o = await buy(s, c.id)
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    await recordDeliveryEvent(h.db, 'generic', { id: `ok-${o.id}`, order: o.number, status: 'Livré' })
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.status).toBe('DELIVERED')
    expect((await enrollmentsOf(s.studentId!)).map((e) => e.courseId)).toEqual([c.id])
  })
})

describe('4. الكتاب المشترك وتغيير الربط لا يبدّلان الاستحقاق', () => {
  it('دورتان بكتاب واحد: شراء الأولى لا يفعّل الثانية', async () => {
    const a = await paidCourse(2000)
    const bookId = (await courseBookStateById(h.db, a.id)).book!.id
    const b = await createCourse(h.db, admin, { title: 'دورة تشارك الكتاب', workspaceId, season: '2026/2027', status: 'DRAFT' })
    await chooseCourseBook(h.db, admin, b.id, bookId)
    await setCourseStatus(h.db, admin, b.id, 'PUBLISHED')
    const s = await makeStudent(h.db, 'مشترك الكتاب')
    const o = await buy(s, a.id)
    expect((await coursesOfOrder(h.db, o.id)).map((x) => x.courseId)).toEqual([a.id])
    await deliver(o.id)
    expect((await enrollmentsOf(s.studentId!)).map((e) => e.courseId)).toEqual([a.id])
  })

  it('تغيير كتاب الدورة أو ربط الكتاب بدورة أخرى بعد الشراء لا يغيّر حقوق الطلب', async () => {
    const a = await paidCourse(2000)
    const oldBook = (await courseBookStateById(h.db, a.id)).book!.id
    const s = await makeStudent(h.db, 'قبل التغيير')
    const o = await buy(s, a.id)
    // الإدارة تغيّر كتاب الدورة، وتنقل الكتاب القديم إلى دورة أخرى
    const other = await createCourse(h.db, admin, { title: 'دورة أخذت الكتاب', workspaceId, season: '2026/2027', status: 'DRAFT' })
    await unlinkProduct(h.db, admin, a.id, oldBook)
    await linkProduct(h.db, admin, other.id, oldBook)
    await chooseCourseBook(h.db, admin, other.id, oldBook)
    const newBook = await createProduct(h.db, admin, { title: 'طبعة جديدة', type: 'BOOK', priceDzd: 2600, stock: 5, status: 'PUBLISHED' })
    await chooseCourseBook(h.db, admin, a.id, newBook.id)
    await deliver(o.id)
    expect((await enrollmentsOf(s.studentId!)).map((e) => e.courseId)).toEqual([a.id])
    // سعر الطلب محفوظ كما كان وقت الشراء
    expect((await h.db.select().from(orderItems).where(eq(orderItems.orderId, o.id)))[0]!.unitPriceDzd).toBe(2000)
  })
})

describe('5. تكرار التسليم/المطالبة لا يمنح اشتراكات إضافية', () => {
  it('كود بعد التسليم: صاحبه يكرّره بلا اشتراك إضافي، وحساب ثانٍ يُرفض (CLAIM_ALREADY_USED)', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'صاحب الكود')
    const thief = await makeStudent(h.db, 'حساب ثانٍ')
    const o = await buy(s, c.id)
    await deliver(o.id)
    const r1 = await sendActivationCode(h.db, admin.userId, o.id, { phone: '0771234567' })
    await expectCode(() => claimCourse(h.db, thief, { phone: '0771234567', code: r1.codes[0]!.code }), 'CLAIM_ALREADY_USED')
    const r2 = await sendActivationCode(h.db, admin.userId, o.id, { phone: '0771234568' })
    await claimCourse(h.db, s, { phone: '0771234568', code: r2.codes[0]!.code })
    await claimCourse(h.db, s, { phone: '0771234568', code: r2.codes[0]!.code })
    expect(await enrollmentsOf(s.studentId!)).toHaveLength(1)
    expect(await enrollmentsOf(thief.studentId!)).toHaveLength(0)
  })

  it('طلب بلا تلميذ (حساب ولي/زائر): رمزان للطلب نفسه ⇒ أوّل حساب يفوز والثاني يُرفض', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة قديمة بمطالبة', workspaceId, season: '2026/2027', status: 'DRAFT' })
    const book = await createProduct(h.db, admin, { title: 'كتاب قديم', type: 'BOOK', priceDzd: 1500, stock: 5, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, c.id, book.id)
    await publishLegacyCourse(h.db, c.id)
    // مشترٍ بحساب إداري (لا ملف تلميذ) ⇒ مطالبة بالـSMS بعد التسليم
    const o = await placeOrder(h.db, admin, { items: [{ productId: book.id, qty: 1 }], customerName: 'ولي', phone: '0551112299', wilayaId, address: 'x' })
    await deliver(o.id)
    const extra = await sendActivationCode(h.db, admin.userId, o.id, { phone: '0551112298' })
    const first = await makeStudent(h.db, 'الأول')
    const second = await makeStudent(h.db, 'الثاني')
    await claimCourse(h.db, first, { phone: '0551112298', code: extra.codes[0]!.code })
    const auto = await createClaim(h.db, { orderId: o.id, courseId: c.id, phone: '0551112297' })
    await expectCode(() => claimCourse(h.db, second, { phone: '0551112297', code: auto.code }), 'CLAIM_ALREADY_USED')
    const all = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, c.id), eq(courseEnrollments.orderId, o.id)))
    expect(all.map((e) => e.studentId)).toEqual([first.studentId])
  })
})

describe('6. الطلبات القديمة والاشتراكات الحالية سليمة', () => {
  it('طلب قديم بلا course_id يفعّل عبر ربط المنتج؛ اشتراك يدوي سابق لا يُمسّ', async () => {
    const c = await createCourse(h.db, admin, { title: 'دورة تاريخية', workspaceId, season: '2026/2027', status: 'DRAFT' })
    const book = await createProduct(h.db, admin, { title: 'كتاب تاريخي', type: 'BOOK', priceDzd: 1200, stock: 5, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, c.id, book.id)
    await publishLegacyCourse(h.db, c.id)
    const veteran = await makeStudent(h.db, 'مشترك قديم')
    await enrollStudent(h.db, admin, { courseId: c.id, studentId: veteran.studentId!, source: 'MANUAL' })
    const s = await makeStudent(h.db, 'طلب قديم')
    const o = await placeOrder(h.db, s, { items: [{ productId: book.id, qty: 1 }], customerName: 'x', phone: '0559998877', wilayaId, address: 'x' })
    expect((await h.db.select().from(orderItems).where(eq(orderItems.orderId, o.id)))[0]!.courseId).toBeNull()
    await deliver(o.id)
    expect((await enrollmentsOf(s.studentId!)).map((e) => e.courseId)).toEqual([c.id])
    const v = await enrollmentsOf(veteran.studentId!)
    expect(v).toHaveLength(1)
    expect(v[0]!.source).toBe('MANUAL')
    expect(v[0]!.status).toBe('ACTIVE')
  })

  it('دورة قديمة منشورة بلا كتاب: تبقى منشورة واشتراكاتها، مع تنبيه للإدارة وإيقاف الشراء الجديد', async () => {
    const c = await createCourse(h.db, admin, { title: 'قديمة بلا كتاب', workspaceId, season: '2026/2027', status: 'DRAFT', priceDzd: 2000 })
    await publishLegacyCourse(h.db, c.id)
    const old = await makeStudent(h.db, 'مشترك محفوظ')
    await enrollStudent(h.db, admin, { courseId: c.id, studentId: old.studentId!, source: 'MANUAL' })
    expect((await publishedCoursesBlocked(h.db)).some((x) => x.id === c.id)).toBe(true)
    const s = await makeStudent(h.db, 'يريد الشراء')
    await expectCode(() => buy(s, c.id), 'COURSE_NOT_PURCHASABLE')
    expect((await h.db.select({ st: courses.status }).from(courses).where(eq(courses.id, c.id)))[0]!.st).toBe('PUBLISHED')
    expect(await enrollmentsOf(old.studentId!)).toHaveLength(1)
  })
})
