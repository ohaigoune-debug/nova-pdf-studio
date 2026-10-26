/**
 * شراء «الدورة مع كتابها» مباشرة (قرار المالك 2026-10-24).
 *  - لكل دورة مدفوعة كتاب ورقي واحد (courses.book_product_id) يُدار من صفحة الدورة؛ سعره = سعر الدورة.
 *  - الشراء يأخذ courseId وحده: الخادم يحدّد الكتاب والسعر والمخزون والصلاحية والتوصيل، ولا يثق بسعر أو منتج
 *    أو تلميذ من المتصفح. السطر يحفظ الدورة والكتاب والسعر وقت الشراء (order_items.course_id).
 *  - التفعيل عند التسليم المؤكَّد فقط (محرّك الحالات ← course-activation.service).
 */
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseEnrollments, courseProducts, courses, orderItems, orders, products, students, users } from '@/server/db/schema'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { streamFamily } from './academy-catalog.service'
import { courseCommunesForWilaya } from './delivery-communes.service'
import { notifyMany } from './notifications.service'
import { transitionOrder } from './order-status.service'
import { isPhoneVerified, normalizePhone, verifyOtp } from './otp.service'
import { orderNumber, shippingFeeFor, storePolicy } from './store.service'

const isPhysical = (type: string) => type === 'BOOK' || type === 'PACK'
/** طلب مفتوح لم يُحسم بعد (لا يُفتح طلب ثانٍ للدورة نفسها) */
const OPEN: string[] = ['PENDING', 'NO_ANSWER', 'CALL_LATER', 'CONFIRMED', 'SHIPPED']

export type CourseBookIssue = 'NO_BOOK' | 'BOOK_DELETED' | 'BOOK_NOT_PUBLISHED' | 'BOOK_NOT_PHYSICAL' | 'OUT_OF_STOCK' | 'COURSE_NOT_PUBLISHED'

export interface CourseBookState {
  book: { id: string; title: string; priceDzd: number; stock: number | null; status: string; type: string } | null
  /** يمكن شراء الدورة الآن */
  purchasable: boolean
  issue: CourseBookIssue | null
}

export const BOOK_ISSUE_AR: Record<CourseBookIssue, string> = {
  NO_BOOK: 'لا كتاب مرفق بالدورة: الشراء الجديد متوقف. أضف الكتاب من صفحة الدورة.',
  BOOK_DELETED: 'الكتاب المرفق محذوف: الشراء الجديد متوقف.',
  BOOK_NOT_PUBLISHED: 'الكتاب المرفق غير منشور: الشراء الجديد متوقف.',
  BOOK_NOT_PHYSICAL: 'المنتج المرفق ليس كتاباً ورقياً: الشراء الجديد متوقف.',
  OUT_OF_STOCK: 'نفد مخزون الكتاب: الشراء الجديد متوقف حتى تزيد المخزون.',
  COURSE_NOT_PUBLISHED: 'الدورة غير منشورة.'
}

type CourseRow = typeof courses.$inferSelect

async function loadCourse(db: Db, courseId: string): Promise<CourseRow> {
  assertUuid(courseId, 'COURSE_NOT_FOUND')
  const [c] = await db.select().from(courses).where(and(eq(courses.id, courseId), isNull(courses.deletedAt))).limit(1)
  if (!c) throw new AppError('COURSE_NOT_FOUND')
  return c
}

/** حالة الكتاب المرفق وقابلية الشراء — مصدر واحد للصفحة والإدارة والشراء */
export async function courseBookState(db: Db, course: Pick<CourseRow, 'bookProductId' | 'status'>): Promise<CourseBookState> {
  if (!course.bookProductId) return { book: null, purchasable: false, issue: 'NO_BOOK' }
  const [p] = await db.select().from(products).where(eq(products.id, course.bookProductId)).limit(1)
  if (!p) return { book: null, purchasable: false, issue: 'NO_BOOK' }
  const book = { id: p.id, title: p.title, priceDzd: p.priceDzd, stock: p.stock, status: p.status, type: p.type }
  const issue: CourseBookIssue | null = p.deletedAt ? 'BOOK_DELETED' : !isPhysical(p.type) ? 'BOOK_NOT_PHYSICAL' : p.status !== 'PUBLISHED' ? 'BOOK_NOT_PUBLISHED' : p.stock !== null && p.stock < 1 ? 'OUT_OF_STOCK' : course.status !== 'PUBLISHED' ? 'COURSE_NOT_PUBLISHED' : null
  return { book, purchasable: issue === null, issue }
}

export async function courseBookStateById(db: Db, courseId: string): Promise<CourseBookState> {
  return courseBookState(db, await loadCourse(db, courseId))
}

/* ───────────── إدارة الكتاب داخل صفحة الدورة ───────────── */

export interface CourseBookInput {
  title: string
  priceDzd: number
  /** null = غير محدود */
  stock: number | null
  /** منشور (قابل للشراء) أو موقوف */
  active: boolean
}

/**
 * ينشئ الكتاب المرفق أو يعدّله من صفحة الدورة (بلا صفحة متجر). سعره يصبح سعر الدورة.
 * الكتاب يُربط بالدورة في course_products أيضاً (للعرض والطلبات القديمة).
 */
export async function setCourseBook(db: Db, actor: Actor, courseId: string, input: CourseBookInput): Promise<CourseBookState> {
  assertRole(actor, 'SUPER_ADMIN')
  const c = await loadCourse(db, courseId)
  const title = input.title.trim()
  if (title.length < 2 || title.length > 200) throw new AppError('VALIDATION', { field: 'title' })
  if (!Number.isInteger(input.priceDzd) || input.priceDzd < 1 || input.priceDzd > 1_000_000) throw new AppError('VALIDATION', { field: 'priceDzd' })
  if (input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) throw new AppError('VALIDATION', { field: 'stock' })
  const status = input.active ? 'PUBLISHED' : 'DRAFT'
  const now = new Date()
  const bookId = await db.transaction(async (tx) => {
    const [existing] = c.bookProductId ? await tx.select().from(products).where(and(eq(products.id, c.bookProductId), isNull(products.deletedAt))).limit(1) : []
    let id: string
    if (existing) {
      await tx.update(products).set({ title, priceDzd: input.priceDzd, stock: input.stock, status, type: isPhysical(existing.type) ? existing.type : 'BOOK', updatedAt: now }).where(eq(products.id, existing.id))
      id = existing.id
    } else {
      const slug = `course-book-${c.slug}-${Date.now().toString(36)}`.slice(0, 120)
      const [p] = await tx.insert(products).values({ title, slug, type: 'BOOK', priceDzd: input.priceDzd, stock: input.stock, status, maxPerOrder: 1, levelId: c.levelId, subjectId: c.subjectId, createdByUserId: actor.userId }).returning({ id: products.id })
      id = p!.id
    }
    await tx.insert(courseProducts).values({ courseId: c.id, productId: id }).onConflictDoNothing()
    await tx.update(courses).set({ bookProductId: id, priceDzd: input.priceDzd, updatedAt: now }).where(eq(courses.id, c.id))
    return id
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.book_set', entityType: 'course', entityId: c.id, newValue: { bookProductId: bookId, priceDzd: input.priceDzd, stock: input.stock, active: input.active } })
  return courseBookStateById(db, c.id)
}

/** اختيار منتج كتاب موجود ككتاب الدورة (للدورات القديمة المربوطة بأكثر من منتج) */
export async function chooseCourseBook(db: Db, actor: Actor, courseId: string, productId: string): Promise<CourseBookState> {
  assertRole(actor, 'SUPER_ADMIN')
  const c = await loadCourse(db, courseId)
  assertUuid(productId, 'PRODUCT_NOT_FOUND')
  const [p] = await db.select().from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).limit(1)
  if (!p) throw new AppError('PRODUCT_NOT_FOUND')
  if (!isPhysical(p.type)) throw new AppError('VALIDATION', { field: 'productId' })
  await db.insert(courseProducts).values({ courseId: c.id, productId: p.id }).onConflictDoNothing()
  await db.update(courses).set({ bookProductId: p.id, priceDzd: p.priceDzd, updatedAt: new Date() }).where(eq(courses.id, c.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.book_set', entityType: 'course', entityId: c.id, newValue: { bookProductId: p.id, priceDzd: p.priceDzd, chosen: true } })
  return courseBookStateById(db, c.id)
}

/**
 * حارس النشر: دورة مدفوعة لا تُنشر بلا كتاب ورقي صالح. الدورة المجانية (سعر 0 بلا كتاب) تُنشر.
 * الدورات المنشورة سابقاً بلا كتاب لا تُمسّ (تبقى منشورة، والشراء الجديد متوقف مع تنبيه في الإدارة).
 */
export async function assertCoursePublishable(db: Db, course: Pick<CourseRow, 'bookProductId' | 'priceDzd'>): Promise<void> {
  if (!course.bookProductId && course.priceDzd === 0) return
  const s = await courseBookState(db, { bookProductId: course.bookProductId, status: 'PUBLISHED' })
  if (s.issue && s.issue !== 'OUT_OF_STOCK') throw new AppError('COURSE_BOOK_REQUIRED', { issue: s.issue })
}

/* ───────────── الشراء ───────────── */

export interface PlaceCourseOrderInput {
  courseId: string
  /** هاتف الاستلام: هاتف التلميذ أو الولي أو رقم آخر */
  phone: string
  customerName?: string | null
  wilayaId: string
  commune?: string | null
  address: string
  deliveryType?: 'HOME' | 'DESK' | null
  note?: string | null
  otpCode?: string | null
}

export interface PlacedCourseOrder {
  id: string
  number: string
  status: string
  bookTitle: string
  priceDzd: number
  shippingDzd: number
  totalDzd: number
}

/** ملخّص السعر من الخادم (للعرض قبل التأكيد) */
export async function courseQuote(db: Db, courseId: string, wilayaId: string | null, deliveryType: 'HOME' | 'DESK'): Promise<{ priceDzd: number; shippingDzd: number; totalDzd: number; bookTitle: string } | null> {
  const s = await courseBookStateById(db, courseId)
  if (!s.book) return null
  const shippingDzd = await shippingFeeFor(db, wilayaId, deliveryType)
  return { priceDzd: s.book.priceDzd, shippingDzd, totalDzd: s.book.priceDzd + shippingDzd, bookTitle: s.book.title }
}

export async function placeCourseOrder(db: Db, actor: Actor, input: PlaceCourseOrderInput, fetchImpl?: typeof fetch): Promise<PlacedCourseOrder> {
  const studentId = studentIdOf(actor)
  const c = await loadCourse(db, input.courseId)
  const state = await courseBookState(db, c)
  if (!state.purchasable || !state.book) throw new AppError('COURSE_NOT_PURCHASABLE', { issue: state.issue })
  const phone = normalizePhone(input.phone)
  assertUuid(input.wilayaId, 'VALIDATION')
  if (!input.address?.trim()) throw new AppError('VALIDATION', { field: 'address' })
  const deliveryType: 'HOME' | 'DESK' = input.deliveryType === 'DESK' ? 'DESK' : 'HOME'
  // الاستدعاءات القديمة بلا بلدية تبقى متوافقة؛ الواجهة الجديدة تطلبها.
  let commune = input.commune?.trim().slice(0, 120) || null
  if (commune) {
    const lookup = await courseCommunesForWilaya(db, input.wilayaId, fetchImpl)
    if (lookup.mode === 'select') {
      const selected = lookup.communes.find((c) => c.name === commune)
      if (!selected) throw new AppError('VALIDATION', { field: 'commune' })
      if (deliveryType === 'DESK' && !selected.hasDesk) throw new AppError('VALIDATION', { field: 'deliveryType' })
      commune = selected.name
    }
  }

  // الشعبة: من ملف التلميذ (لا من المتصفح)؛ دورة بلا شعب = لكل الشعب
  const [st] = await db.select({ streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
  if (c.streamIds.length) {
    const family = await streamFamily(db, st?.streamId ?? null)
    if (!c.streamIds.some((sid) => family.includes(sid))) throw new AppError('ORDER_STREAM_MISMATCH', { product: state.book.title })
  }
  // مشترك نشط ⇒ لا شراء ثانٍ؛ طلب مفتوح للدورة نفسها ⇒ لا طلب ثانٍ
  const [active] = await db
    .select({ id: courseEnrollments.id })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, c.id), eq(courseEnrollments.studentId, studentId), eq(courseEnrollments.status, 'ACTIVE'), sql`(${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now())`))
    .limit(1)
  if (active) throw new AppError('ALREADY_ENROLLED')
  const [open] = await db
    .select({ number: orders.number })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.courseId, c.id), eq(orders.userId, actor.userId), inArray(orders.status, OPEN)))
    .limit(1)
  if (open) throw new AppError('COURSE_ORDER_OPEN', { number: open.number })

  // كل طلب دورة يتأكد برمز جديد؛ تحقق التسجيل لا يستهلك تأكيد الطلب.
  const [policy, channels] = await Promise.all([storePolicy(db), import('./phone-gate.service').then((m) => m.phoneChannels(db))])
  let otpVerifiedAt: Date | null = null
  if (channels.sms) {
    if (!input.otpCode?.trim()) throw new AppError('ORDER_OTP_REQUIRED')
    await verifyOtp(db, { phone, purpose: 'ORDER', code: input.otpCode, userId: actor.userId })
    otpVerifiedAt = new Date()
  } else if (policy.requireOtp) {
    // بلا قناة SMS لا يظهر حقل الرمز في النموذج: يبقى الهاتف المؤكَّد سلفاً (بمكالمة مثلاً) كافياً كما كان، وإلا لتعطّلت كل الطلبات
    const pv = await isPhoneVerified(db, actor.userId)
    if (pv.verified && pv.phone === phone) otpVerifiedAt = new Date()
    else throw new AppError('ORDER_OTP_REQUIRED')
  }

  const price = state.book.priceDzd
  const shipping = await shippingFeeFor(db, input.wilayaId, deliveryType)
  const total = price + shipping
  const bookId = state.book.id
  const bookTitle = state.book.title
  const order = await db.transaction(async (tx) => {
    // المخزون يُحجز ذرّياً: لا بيع لما ليس موجوداً حتى مع طلبين في اللحظة نفسها
    const [reserved] = await tx
      .update(products)
      .set({ stock: sql`case when ${products.stock} is null then null else ${products.stock} - 1 end`, salesCount: sql`${products.salesCount} + 1` })
      .where(and(eq(products.id, bookId), sql`(${products.stock} is null or ${products.stock} >= 1)`))
      .returning({ id: products.id })
    if (!reserved) throw new AppError('OUT_OF_STOCK', { product: bookTitle })
    const [o] = await tx
      .insert(orders)
      .values({ number: orderNumber(), userId: actor.userId, status: 'PENDING', paymentMethod: 'COD', needsShipping: true, subtotalDzd: price, shippingDzd: shipping, totalDzd: total, customerName: (input.customerName?.trim() || actor.fullName).slice(0, 120), phone, wilayaId: input.wilayaId, streamId: st?.streamId ?? null, otpVerifiedAt, beneficiaryStudentId: studentId, address: input.address.trim().slice(0, 400), commune, deliveryType, note: [`دورة: ${c.title}`, input.note?.trim()].filter(Boolean).join(' — ').slice(0, 500) })
      .returning()
    await tx.insert(orderItems).values({ orderId: o!.id, productId: bookId, courseId: c.id, title: bookTitle, type: 'BOOK', unitPriceDzd: price, qty: 1, lineTotalDzd: price })
    return o!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'store.order_place', entityType: 'order', entityId: order.id, newValue: { number: order.number, courseId: c.id, bookId, price, shipping, total } })
  if (otpVerifiedAt) {
    const r = await transitionOrder(db, order.id, 'CONFIRMED', { actorUserId: actor.userId, source: 'sms' })
    return { id: order.id, number: order.number, status: r.order.status, bookTitle, priceDzd: price, shippingDzd: shipping, totalDzd: total }
  }
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  await notifyMany(db, admins.map((a) => ({ userId: a.id, workspaceId: null, type: 'SYSTEM' as const, title: `طلب دورة جديد ${order.number}`, body: `${c.title} · ${order.customerName} · ${total} دج`, link: '/admin/store/confirm' })))
  return { id: order.id, number: order.number, status: order.status, bookTitle, priceDzd: price, shippingDzd: shipping, totalDzd: total }
}

/** دورات منشورة لا يمكن شراؤها الآن (بلا كتاب صالح أو نفد المخزون) — تنبيه للإدارة */
export async function publishedCoursesBlocked(db: Db): Promise<{ id: string; title: string; issue: CourseBookIssue }[]> {
  const rows = await db.select().from(courses).where(and(eq(courses.status, 'PUBLISHED'), isNull(courses.deletedAt)))
  const out: { id: string; title: string; issue: CourseBookIssue }[] = []
  for (const c of rows) {
    if (!c.bookProductId && c.priceDzd === 0) continue
    const st = await courseBookState(db, c)
    if (st.issue) out.push({ id: c.id, title: c.title, issue: st.issue })
  }
  return out
}
