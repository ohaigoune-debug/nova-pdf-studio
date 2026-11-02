/**
 * شراء «الدورة مع كتابها» مباشرة (قرار المالك 2026-10-24).
 *  - الكتاب اختياري لكل دورة (قرار المالك 1 نوفمبر 2026): يُضاف عند إنشاء الدورة أو من صفحتها، أو لا يُضاف.
 *    الدورة بلا كتاب تُفعَّل بأكواد التفعيل أو يدويًّا (لا طلب بالدفع عند الاستلام، فلا شيء يُسلَّم).
 *  - الدورة ذات الكتاب: كتاب ورقي واحد (courses.book_product_id) سعره = سعر الدورة.
 *  - الشراء يأخذ courseId وحده: الخادم يحدّد الكتاب والسعر والمخزون والصلاحية والتوصيل، ولا يثق بسعر أو منتج
 *    أو تلميذ من المتصفح. السطر يحفظ الدورة والكتاب والسعر وقت الشراء (order_items.course_id).
 *  - التفعيل عند التسليم المؤكَّد فقط (محرّك الحالات ← course-activation.service)، أو فور تأكّد الدفع بالبطاقة.
 *  - النسخة الرقمية (قرار المالك 2 نوفمبر 2026): بطاقة مستقلة في الكتالوج بسعرها (courses.digital_price_dzd)
 *    تفتح الدورة نفسها دون كتاب ولا توصيل، بالبطاقة فقط، فور تأكّد الخادم من الدفع. ومن اشتراها ثم أراد
 *    الكتاب الورقي يطلبه من صفحة الطلب ويدفع الفرق فقط (سعر الدورة مع الكتاب − ما دفعه) + التوصيل.
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
  NO_BOOK: 'دورة بلا كتاب: تُفعَّل بأكواد التفعيل أو يدويًّا (لا طلب بالدفع عند الاستلام).',
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
  /** صورة غلاف الكتاب (ملف مرفوع)؛ غيابها يُبقي الغلاف الحالي */
  coverFileId?: string | null
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
  // سعر الدورة مع الكتاب أكبر من سعر نسختها الرقمية دائمًا (وإلا لا معنى لـ«ادفع الفرق»)
  if (c.digitalPriceDzd !== null && input.priceDzd <= c.digitalPriceDzd) throw new AppError('BOOK_PRICE_BELOW_DIGITAL', { digitalPriceDzd: c.digitalPriceDzd })
  const status = input.active ? 'PUBLISHED' : 'DRAFT'
  const now = new Date()
  const bookId = await db.transaction(async (tx) => {
    const [existing] = c.bookProductId ? await tx.select().from(products).where(and(eq(products.id, c.bookProductId), isNull(products.deletedAt))).limit(1) : []
    let id: string
    if (existing) {
      await tx.update(products).set({ title, priceDzd: input.priceDzd, stock: input.stock, status, type: isPhysical(existing.type) ? existing.type : 'BOOK', ...(input.coverFileId ? { coverFileId: input.coverFileId } : {}), updatedAt: now }).where(eq(products.id, existing.id))
      id = existing.id
    } else {
      const slug = `course-book-${c.slug}-${Date.now().toString(36)}`.slice(0, 120)
      const [p] = await tx.insert(products).values({ title, slug, type: 'BOOK', priceDzd: input.priceDzd, stock: input.stock, status, maxPerOrder: 1, levelId: c.levelId, subjectId: c.subjectId, coverFileId: input.coverFileId ?? null, createdByUserId: actor.userId }).returning({ id: products.id })
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
  if (c.digitalPriceDzd !== null && p.priceDzd <= c.digitalPriceDzd) throw new AppError('BOOK_PRICE_BELOW_DIGITAL', { digitalPriceDzd: c.digitalPriceDzd })
  await db.insert(courseProducts).values({ courseId: c.id, productId: p.id }).onConflictDoNothing()
  await db.update(courses).set({ bookProductId: p.id, priceDzd: p.priceDzd, updatedAt: new Date() }).where(eq(courses.id, c.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.book_set', entityType: 'course', entityId: c.id, newValue: { bookProductId: p.id, priceDzd: p.priceDzd, chosen: true } })
  return courseBookStateById(db, c.id)
}

/**
 * حارس النشر. الكتاب اختياري (قرار المالك 1 نوفمبر 2026): الدورة بلا كتاب تُنشر وتُفعَّل بالأكواد أو يدويًّا.
 * يُرفض النشر فقط إن كان الكتاب المرفق محذوفًا أو ليس كتابًا ورقيًّا (خطأ في الربط يُصحَّح أو يُزال الكتاب).
 * الكتاب الموقوف أو النافد لا يمنع النشر: الشراء الجديد وحده يتوقف مع تنبيه في الإدارة.
 */
export async function assertCoursePublishable(db: Db, course: Pick<CourseRow, 'bookProductId' | 'priceDzd'>): Promise<void> {
  if (!course.bookProductId) return
  const s = await courseBookState(db, { bookProductId: course.bookProductId, status: 'PUBLISHED' })
  if (s.issue === 'BOOK_DELETED' || s.issue === 'BOOK_NOT_PHYSICAL') throw new AppError('COURSE_BOOK_REQUIRED', { issue: s.issue })
}

/**
 * إزالة الكتاب من الدورة (تصبح دورة بلا كتاب). لا يُحذف المنتج ولا ربطه القديم في course_products (الطلبات
 * السابقة تبقى تمنح الدورة كما كانت)؛ يُوقف بيعه فقط حتى لا يُطلب من المتجر بعد الآن.
 */
export async function removeCourseBook(db: Db, actor: Actor, courseId: string): Promise<CourseBookState> {
  assertRole(actor, 'SUPER_ADMIN')
  const c = await loadCourse(db, courseId)
  if (!c.bookProductId) return courseBookState(db, c)
  const now = new Date()
  await db.transaction(async (tx) => {
    await tx.update(products).set({ status: 'DRAFT', updatedAt: now }).where(eq(products.id, c.bookProductId!))
    await tx.update(courses).set({ bookProductId: null, updatedAt: now }).where(eq(courses.id, c.id))
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.book_removed', entityType: 'course', entityId: c.id, oldValue: { bookProductId: c.bookProductId } })
  return courseBookStateById(db, c.id)
}

/* ───────────── النسخة الرقمية (دون كتاب) ───────────── */

/** أقل مبلغ تقبله eFawtara لطلب دفع */
export const DIGITAL_MIN_DZD = 50

export type CourseDigitalIssue = 'NO_DIGITAL' | 'COURSE_NOT_PUBLISHED' | 'PAYMENT_OFF'

export interface CourseDigitalState {
  /** سعر النسخة الرقمية، أو null إن لم تُفعَّل لهذه الدورة */
  priceDzd: number | null
  /** تظهر بطاقتها ويمكن شراؤها الآن */
  purchasable: boolean
  issue: CourseDigitalIssue | null
}

export const DIGITAL_ISSUE_AR: Record<CourseDigitalIssue, string> = {
  NO_DIGITAL: 'لا نسخة رقمية لهذه الدورة.',
  COURSE_NOT_PUBLISHED: 'الدورة غير منشورة: لا تظهر النسخة الرقمية بعد.',
  PAYMENT_OFF: 'الدفع الإلكتروني غير مفعّل: النسخة الرقمية لا تظهر للتلاميذ حتى تفعّله.'
}

/** حالة النسخة الرقمية: سعر مضبوط + دورة منشورة + دفع إلكتروني مفعّل (لا دفع عند الاستلام لشيء لا يُسلَّم) */
export async function courseDigitalState(db: Db, course: Pick<CourseRow, 'digitalPriceDzd' | 'status'>, paymentOn?: boolean): Promise<CourseDigitalState> {
  const priceDzd = course.digitalPriceDzd ?? null
  if (!priceDzd) return { priceDzd: null, purchasable: false, issue: 'NO_DIGITAL' }
  if (course.status !== 'PUBLISHED') return { priceDzd, purchasable: false, issue: 'COURSE_NOT_PUBLISHED' }
  const on = paymentOn ?? (await import('@/server/lib/guiddini').then((m) => m.onlinePaymentEnabled(db)))
  if (!on) return { priceDzd, purchasable: false, issue: 'PAYMENT_OFF' }
  return { priceDzd, purchasable: true, issue: null }
}

export async function courseDigitalStateById(db: Db, courseId: string): Promise<CourseDigitalState> {
  return courseDigitalState(db, await loadCourse(db, courseId))
}

/**
 * المشرف: سعر النسخة الرقمية (null = إيقافها). 50 دج على الأقل، وأقل من سعر الدورة مع الكتاب إن كان لها كتاب.
 * الطلبات السابقة لا تتأثر (السعر مجمَّد في سطر الطلب).
 */
export async function setCourseDigitalPrice(db: Db, actor: Actor, courseId: string, priceDzd: number | null): Promise<CourseDigitalState> {
  assertRole(actor, 'SUPER_ADMIN')
  const c = await loadCourse(db, courseId)
  if (priceDzd !== null) {
    if (!Number.isInteger(priceDzd) || priceDzd < DIGITAL_MIN_DZD || priceDzd > 1_000_000) throw new AppError('DIGITAL_PRICE_INVALID')
    const b = await courseBookState(db, c)
    if (b.book && priceDzd >= b.book.priceDzd) throw new AppError('DIGITAL_PRICE_INVALID', { bookPriceDzd: b.book.priceDzd })
  }
  await db.update(courses).set({ digitalPriceDzd: priceDzd, updatedAt: new Date() }).where(eq(courses.id, c.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'course.digital_price_set', entityType: 'course', entityId: c.id, oldValue: { digitalPriceDzd: c.digitalPriceDzd }, newValue: { digitalPriceDzd: priceDzd } })
  return courseDigitalState(db, { ...c, digitalPriceDzd: priceDzd })
}

/** طلب الدورة الرقمية مدفوع (مؤكَّد أو مكتمل) لهذا الحساب وهذه الدورة: ما دُفع فيه */
async function paidDigitalPurchase(db: Db, userId: string, courseId: string): Promise<{ orderId: string; paidDzd: number } | null> {
  const [row] = await db
    .select({ orderId: orders.id, paid: orderItems.lineTotalDzd })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.courseId, courseId), eq(orderItems.type, 'COURSE'), eq(orders.userId, userId), inArray(orders.status, ['CONFIRMED', 'DELIVERED'])))
    .orderBy(sql`${orders.createdAt} desc`)
    .limit(1)
  return row ? { orderId: row.orderId, paidDzd: row.paid } : null
}

/**
 * «أضف الكتاب الورقي» لمن اشترى النسخة الرقمية ودورته سارية ولم يطلب كتابها بعد:
 * يدفع الفرق فقط (سعر الدورة مع الكتاب − ما دفعه في النسخة الرقمية، ولا أقل من 0) + التوصيل. null = غير مؤهَّل.
 */
export async function bookUpgradeFor(db: Db, actor: Actor, course: Pick<CourseRow, 'id'>, book: { priceDzd: number }): Promise<{ priceDzd: number; paidDigitalDzd: number } | null> {
  if (actor.role !== 'STUDENT' || !actor.studentId) return null
  const [active] = await db
    .select({ id: courseEnrollments.id })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, course.id), eq(courseEnrollments.studentId, actor.studentId), eq(courseEnrollments.status, 'ACTIVE'), sql`(${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now())`))
    .limit(1)
  if (!active) return null
  const digital = await paidDigitalPurchase(db, actor.userId, course.id)
  if (!digital) return null
  // طلب كتاب سابق لهذه الدورة (مفتوح أو مسلَّم) ⇒ لا ثانٍ
  const [book0] = await db
    .select({ id: orders.id })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.courseId, course.id), sql`${orderItems.type} <> 'COURSE'`, eq(orders.userId, actor.userId), sql`${orders.status} not in ('CANCELLED', 'RETURNED')`))
    .limit(1)
  if (book0) return null
  return { priceDzd: Math.max(book.priceDzd - digital.paidDzd, 0), paidDigitalDzd: digital.paidDzd }
}

/** عرض «أضف الكتاب الورقي» لصفحات التلميذ: الكتاب متاح للشراء الآن وهو مؤهَّل، وإلا null */
export async function bookUpgradeOffer(db: Db, actor: Actor, courseId: string): Promise<{ priceDzd: number; bookTitle: string } | null> {
  const c = await loadCourse(db, courseId)
  const s = await courseBookState(db, c)
  if (!s.purchasable || !s.book) return null
  const up = await bookUpgradeFor(db, actor, c, s.book)
  return up ? { priceDzd: up.priceDzd, bookTitle: s.book.title } : null
}

export interface PlacedDigitalOrder {
  id: string
  number: string
  status: string
  totalDzd: number
  /** صفحة SATIM التي يُحوَّل إليها التلميذ */
  payUrl: string
}

/** يمنع الشراء لتلميذ من شعبة أخرى (دورة بلا شعب = لكل الشعب) */
async function assertCourseStream(db: Db, c: CourseRow, studentId: string, label: string): Promise<string | null> {
  const [st] = await db.select({ streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
  if (c.streamIds.length) {
    const family = await streamFamily(db, st?.streamId ?? null)
    if (!c.streamIds.some((sid) => family.includes(sid))) throw new AppError('ORDER_STREAM_MISMATCH', { product: label })
  }
  return st?.streamId ?? null
}

async function hasActiveEnrollment(db: Db, courseId: string, studentId: string): Promise<boolean> {
  const [active] = await db
    .select({ id: courseEnrollments.id })
    .from(courseEnrollments)
    .where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId), eq(courseEnrollments.status, 'ACTIVE'), sql`(${courseEnrollments.expiresAt} is null or ${courseEnrollments.expiresAt} > now())`))
    .limit(1)
  return Boolean(active)
}

/** طلب مفتوح لهذا الحساب وهذه الدورة: رقمه وهل هو طلب رقمي (بلا شحن) */
async function openCourseOrder(db: Db, userId: string, courseId: string): Promise<{ number: string; digital: boolean } | null> {
  const [open] = await db
    .select({ number: orders.number, needsShipping: orders.needsShipping })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(eq(orderItems.courseId, courseId), eq(orders.userId, userId), inArray(orders.status, OPEN)))
    .limit(1)
  return open ? { number: open.number, digital: !open.needsShipping } : null
}

/**
 * شراء النسخة الرقمية: بالبطاقة فقط، بلا عنوان ولا توصيل ولا رمز SMS (الدفع بالبطاقة يُثبت الجدية).
 * التلميذ يؤكّد صراحةً أنه فهم أنها دون كتاب ورقي. الخادم يحدّد السعر والدورة، ويُحوَّل التلميذ إلى SATIM؛
 * تُفتح الدورة فور تأكّد الخادم من «paid» (online-payment.service) ويُغلق الطلب «مكتملًا».
 */
export async function placeDigitalCourseOrder(db: Db, actor: Actor, input: { courseId: string; acceptNoBook: boolean }, fetchImpl?: typeof fetch): Promise<PlacedDigitalOrder> {
  const studentId = studentIdOf(actor)
  if (!input.acceptNoBook) throw new AppError('DIGITAL_ACK_REQUIRED')
  const c = await loadCourse(db, input.courseId)
  const state = await courseDigitalState(db, c)
  if (state.issue === 'PAYMENT_OFF') throw new AppError('PAYMENT_NOT_CONFIGURED')
  if (!state.purchasable || !state.priceDzd) throw new AppError('COURSE_NOT_PURCHASABLE', { issue: state.issue })
  const streamId = await assertCourseStream(db, c, studentId, c.title)
  if (await hasActiveEnrollment(db, c.id, studentId)) throw new AppError('ALREADY_ENROLLED')

  const open = await openCourseOrder(db, actor.userId, c.id)
  if (open) {
    // دفع رقمي لم يكتمل لهذه الدورة: يُفحص الآن؛ إن بقي معلّقًا يُعاد رابطه نفسه بدل طلب ثانٍ
    const { pendingPaymentForCourse, verifyPayment } = await import('./online-payment.service')
    const pending = open.digital ? await pendingPaymentForCourse(db, actor.userId, c.id) : null
    if (!pending) throw new AppError('COURSE_ORDER_OPEN', { number: open.number })
    const v = await verifyPayment(db, pending.id, fetchImpl).catch(() => null)
    if (v?.status === 'PAID') throw new AppError('ALREADY_ENROLLED')
    if (v?.status === 'PENDING' && pending.formUrl) return { id: pending.orderId, number: open.number, status: 'PENDING', totalDzd: pending.amountDzd, payUrl: pending.formUrl }
    if (v?.status === 'PENDING') throw new AppError('COURSE_ORDER_OPEN', { number: open.number })
  }

  const { customerDefaults } = await import('./store.service')
  const d = await customerDefaults(db, actor)
  const price = state.priceDzd
  const title = `${c.title} — النسخة الرقمية`
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({ number: orderNumber(), userId: actor.userId, status: 'PENDING', paymentMethod: 'ONLINE', needsShipping: false, subtotalDzd: price, shippingDzd: 0, totalDzd: price, customerName: actor.fullName.slice(0, 120), phone: d.phone ?? d.guardianPhone ?? '', wilayaId: d.wilayaId, streamId, beneficiaryStudentId: studentId, note: `دورة رقمية (دون كتاب): ${c.title}`.slice(0, 500) })
      .returning()
    await tx.insert(orderItems).values({ orderId: o!.id, productId: null, courseId: c.id, title, type: 'COURSE', unitPriceDzd: price, qty: 1, lineTotalDzd: price })
    return o!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'store.order_place', entityType: 'order', entityId: order.id, newValue: { number: order.number, courseId: c.id, digital: true, total: price } })
  const { startOrderPayment } = await import('./online-payment.service')
  try {
    const pay = await startOrderPayment(db, { orderId: order.id, userId: actor.userId, amountDzd: price }, fetchImpl)
    return { id: order.id, number: order.number, status: order.status, totalDzd: price, payUrl: pay.formUrl }
  } catch (err) {
    await transitionOrder(db, order.id, 'CANCELLED', { actorUserId: actor.userId, source: 'system', reason: 'تعذّر بدء الدفع الإلكتروني', silent: true }).catch(() => null)
    throw err
  }
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
  /** «ادفع الآن» بالبطاقة (eFawtara/SATIM): تُفعَّل الدورة فور تأكّد الخادم من الدفع */
  payNow?: boolean
}

export interface PlacedCourseOrder {
  id: string
  number: string
  status: string
  bookTitle: string
  priceDzd: number
  shippingDzd: number
  totalDzd: number
  /** «ادفع الآن»: رابط صفحة SATIM التي يُحوَّل إليها الولي */
  payUrl?: string
}

/** ملخّص السعر من الخادم (للعرض قبل التأكيد) */
export async function courseQuote(db: Db, courseId: string, wilayaId: string | null, deliveryType: 'HOME' | 'DESK', actor?: Actor | null): Promise<{ priceDzd: number; shippingDzd: number; totalDzd: number; bookTitle: string; upgrade: boolean } | null> {
  const c = await loadCourse(db, courseId)
  const s = await courseBookState(db, c)
  if (!s.book) return null
  // مشترك في النسخة الرقمية يطلب الكتاب: يدفع الفرق فقط
  const up = actor ? await bookUpgradeFor(db, actor, c, s.book) : null
  const priceDzd = up ? up.priceDzd : s.book.priceDzd
  const shippingDzd = await shippingFeeFor(db, wilayaId, deliveryType)
  return { priceDzd, shippingDzd, totalDzd: priceDzd + shippingDzd, bookTitle: s.book.title, upgrade: Boolean(up) }
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
  const streamId = await assertCourseStream(db, c, studentId, state.book.title)
  // مشترك نشط ⇒ لا شراء ثانٍ، إلا من اشترى النسخة الرقمية ويطلب كتابها (يدفع الفرق)؛ طلب مفتوح للدورة نفسها ⇒ لا طلب ثانٍ
  let upgrade: Awaited<ReturnType<typeof bookUpgradeFor>> = null
  if (await hasActiveEnrollment(db, c.id, studentId)) {
    upgrade = await bookUpgradeFor(db, actor, c, state.book)
    if (!upgrade) throw new AppError('ALREADY_ENROLLED')
  }
  const open = await openCourseOrder(db, actor.userId, c.id)
  if (open) {
    // دفع إلكتروني لم يكتمل لطلب كتاب هذه الدورة: يُفحص الآن؛ إن بقي معلّقًا يُعاد رابطه نفسه بدل طلب ثانٍ
    const { pendingPaymentForCourse, verifyPayment } = await import('./online-payment.service')
    const pending = open.digital ? null : await pendingPaymentForCourse(db, actor.userId, c.id)
    if (!pending) throw new AppError('COURSE_ORDER_OPEN', { number: open.number })
    const v = await verifyPayment(db, pending.id).catch(() => null)
    if (v?.status === 'PAID') throw new AppError('ALREADY_ENROLLED')
    if (v?.status === 'PENDING' && input.payNow && pending.formUrl) return { id: pending.orderId, number: open.number, status: 'PENDING', bookTitle: state.book.title, priceDzd: state.book.priceDzd, shippingDzd: 0, totalDzd: pending.amountDzd, payUrl: pending.formUrl }
    if (v?.status === 'PENDING') throw new AppError('COURSE_ORDER_OPEN', { number: open.number })
  }
  const payNow = Boolean(input.payNow)
  if (payNow) {
    const { onlinePaymentEnabled } = await import('@/server/lib/guiddini')
    if (!(await onlinePaymentEnabled(db))) throw new AppError('PAYMENT_NOT_CONFIGURED')
  }

  // كل طلب دورة يتأكد برمز جديد؛ تحقق التسجيل لا يستهلك تأكيد الطلب.
  const [policy, channels] = await Promise.all([storePolicy(db), import('./phone-gate.service').then((m) => m.phoneChannels(db))])
  let otpVerifiedAt: Date | null = null
  // الدفع بالبطاقة يُثبت جدية الطلب بنفسه: لا رمز SMS
  if (payNow) {
    /* بلا رمز */
  } else if (channels.sms) {
    if (!input.otpCode?.trim()) throw new AppError('ORDER_OTP_REQUIRED')
    await verifyOtp(db, { phone, purpose: 'ORDER', code: input.otpCode, userId: actor.userId })
    otpVerifiedAt = new Date()
  } else if (policy.requireOtp) {
    // بلا قناة SMS لا يظهر حقل الرمز في النموذج: يبقى الهاتف المؤكَّد سلفاً (بمكالمة مثلاً) كافياً كما كان، وإلا لتعطّلت كل الطلبات
    const pv = await isPhoneVerified(db, actor.userId)
    if (pv.verified && pv.phone === phone) otpVerifiedAt = new Date()
    else throw new AppError('ORDER_OTP_REQUIRED')
  }

  const price = upgrade ? upgrade.priceDzd : state.book.priceDzd
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
      .values({ number: orderNumber(), userId: actor.userId, status: 'PENDING', paymentMethod: payNow ? 'ONLINE' : 'COD', needsShipping: true, subtotalDzd: price, shippingDzd: shipping, totalDzd: total, customerName: (input.customerName?.trim() || actor.fullName).slice(0, 120), phone, wilayaId: input.wilayaId, streamId, otpVerifiedAt, beneficiaryStudentId: studentId, address: input.address.trim().slice(0, 400), commune, deliveryType, note: [`دورة: ${c.title}`, upgrade ? `الكتاب لمشترك في النسخة الرقمية (دفع ${upgrade.paidDigitalDzd} دج)` : null, payNow ? 'دفع إلكتروني' : null, input.note?.trim()].filter(Boolean).join(' — ').slice(0, 500) })
      .returning()
    await tx.insert(orderItems).values({ orderId: o!.id, productId: bookId, courseId: c.id, title: bookTitle, type: 'BOOK', unitPriceDzd: price, qty: 1, lineTotalDzd: price })
    return o!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'store.order_place', entityType: 'order', entityId: order.id, newValue: { number: order.number, courseId: c.id, bookId, price, shipping, total, upgrade: Boolean(upgrade) } })
  if (payNow) {
    const { startOrderPayment } = await import('./online-payment.service')
    try {
      const pay = await startOrderPayment(db, { orderId: order.id, userId: actor.userId, amountDzd: total })
      return { id: order.id, number: order.number, status: order.status, bookTitle, priceDzd: price, shippingDzd: shipping, totalDzd: total, payUrl: pay.formUrl }
    } catch (err) {
      // البوابة رفضت أو لم تُجب: يُلغى الطلب فورًا ويعود الكتاب للمخزون
      await transitionOrder(db, order.id, 'CANCELLED', { actorUserId: actor.userId, source: 'system', reason: 'تعذّر بدء الدفع الإلكتروني' }).catch(() => null)
      throw err
    }
  }
  if (otpVerifiedAt) {
    const r = await transitionOrder(db, order.id, 'CONFIRMED', { actorUserId: actor.userId, source: 'sms' })
    return { id: order.id, number: order.number, status: r.order.status, bookTitle, priceDzd: price, shippingDzd: shipping, totalDzd: total }
  }
  const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  await notifyMany(db, admins.map((a) => ({ userId: a.id, workspaceId: null, type: 'SYSTEM' as const, title: `طلب دورة جديد ${order.number}`, body: `${c.title} · ${order.customerName} · ${total} دج`, link: '/admin/store/confirm' })))
  return { id: order.id, number: order.number, status: order.status, bookTitle, priceDzd: price, shippingDzd: shipping, totalDzd: total }
}

/** دورات منشورة كتابها المرفق لا يُشترى الآن (موقوف، نفد، محذوف) — تنبيه للإدارة. الدورة بلا كتاب اختيار مقصود فلا تُنبَّه. */
export async function publishedCoursesBlocked(db: Db): Promise<{ id: string; title: string; issue: CourseBookIssue }[]> {
  const rows = await db.select().from(courses).where(and(eq(courses.status, 'PUBLISHED'), isNull(courses.deletedAt)))
  const out: { id: string; title: string; issue: CourseBookIssue }[] = []
  for (const c of rows) {
    if (!c.bookProductId) continue
    const st = await courseBookState(db, c)
    if (st.issue) out.push({ id: c.id, title: c.title, issue: st.issue })
  }
  return out
}
