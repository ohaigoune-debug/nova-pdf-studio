/**
 * متجر الكتب (Exam Builder — المرحلة 10).
 * المشرف ينشر منتجات (كتاب ورقي، PDF، حزمة) بأسعار بالدينار؛ الزائر يتصفّح، والمسجّل يطلب:
 * الدفع عند الاستلام للمادي، تحويل يؤكّده المشرف للرقمي المدفوع، ومجاني فوراً.
 * الملفات الرقمية تُنزَّل بعد التأكيد فقط عبر روابط موقّعة قصيرة العمر، وكل تنزيل يُسجَّل.
 */
import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, courseProducts, courses, downloads, files, levels, listings, orderItems, orders, productFiles, products, profiles, streams, students, subjects, teacherWorkspaces, users, wilayas, type OrderRow, type ProductRow } from '@/server/db/schema'
import type { OrderStatus, PaymentMethod, ProductStatus, ProductType } from '@/server/db/schema/enums'
import { CONFIRMATION_STATUSES, ORDER_STATUSES, PRODUCT_STATUSES, PRODUCT_TYPES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { grantPurchasesForOrder } from './marketplace.service'
import { notify } from './notifications.service'
import { streamFamily } from './academy-catalog.service'
import { ecotrackFeeFor, listEcotrackFees } from './ecotrack.service'
import { transitionOrder } from './order-status.service'
import { isPhoneVerified, normalizePhone, verifyOtp } from './otp.service'

export const PRODUCT_TYPE_AR: Record<ProductType, string> = { BOOK: 'كتاب ورقي', PDF: 'ملف PDF', PACK: 'حزمة (ورقي + رقمي)' }
export { ORDER_STATUS_AR } from './order-status.service'
export const PAYMENT_AR: Record<PaymentMethod, string> = { COD: 'الدفع عند الاستلام', TRANSFER: 'تحويل (CCP / BaridiMob)', FREE: 'مجاني' }

/** رسوم الشحن للطلبات المادية (دج) — من البيئة، صفر إن لم تُضبط */
export const shippingFeeDzd = (): number => Math.max(0, Number(process.env.STORE_SHIPPING_DZD ?? 0) || 0)

/** رسم التوصيل: جدول EcoTrack للولاية إن كان محفوظاً، وإلا الرسم الثابت من البيئة */
export async function shippingFeeFor(db: Db, wilayaId: string | null, deliveryType: 'HOME' | 'DESK'): Promise<number> {
  if (wilayaId) {
    const [w] = await db.select({ code: wilayas.code }).from(wilayas).where(eq(wilayas.id, wilayaId)).limit(1)
    const fee = w ? await ecotrackFeeFor(db, w.code, deliveryType) : null
    if (fee != null) return fee
  }
  return shippingFeeDzd()
}

/** خريطة الرسوم لكل ولاية (للسلة): null حين لا جدول EcoTrack محفوظ */
export async function shippingFeeTable(db: Db): Promise<Record<string, { home: number; desk: number }> | null> {
  const fees = await listEcotrackFees(db)
  if (!fees.length) return null
  const ws = await db.select({ id: wilayas.id, code: wilayas.code }).from(wilayas)
  const byCode = new Map(fees.map((f) => [f.wilayaCode, f]))
  const out: Record<string, { home: number; desk: number }> = {}
  for (const w of ws) {
    const f = byCode.get(w.code.padStart(2, '0'))
    if (f) out[w.id] = { home: f.homeDzd, desk: f.deskDzd }
  }
  return out
}

const isPhysical = (type: string) => type === 'BOOK' || type === 'PACK'
const isDigital = (type: string) => type === 'PDF' || type === 'PACK'

export interface ProductInput {
  title: string
  slug?: string | null
  description?: string | null
  type?: ProductType
  author?: string | null
  pages?: number | null
  priceDzd: number
  comparePriceDzd?: number | null
  stock?: number | null
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  coverFileId?: string | null
  coverUrl?: string | null
  status?: ProductStatus
  sortOrder?: number
  /** يُلزم المشتري باختيار شعبته */
  requiresStream?: boolean
  /** الحدّ الأقصى للوحدات في الطلب الواحد (افتراضي 20) */
  maxPerOrder?: number
}

export const DEFAULT_MAX_PER_ORDER = 20

export function slugify(title: string): string {
  const s = normalizeArabic(title).replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '').slice(0, 80)
  return s || `p-${Date.now().toString(36)}`
}

function validate(input: ProductInput) {
  if (!input.title?.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (input.type && !PRODUCT_TYPES.includes(input.type)) throw new AppError('VALIDATION', { field: 'type' })
  if (!(Number.isInteger(input.priceDzd) && input.priceDzd >= 0 && input.priceDzd <= 1_000_000)) throw new AppError('VALIDATION', { field: 'priceDzd' })
  if (input.comparePriceDzd != null && !(Number.isInteger(input.comparePriceDzd) && input.comparePriceDzd >= 0)) throw new AppError('VALIDATION', { field: 'comparePriceDzd' })
  if (input.stock != null && !(Number.isInteger(input.stock) && input.stock >= 0)) throw new AppError('VALIDATION', { field: 'stock' })
  if (input.status && !PRODUCT_STATUSES.includes(input.status)) throw new AppError('VALIDATION', { field: 'status' })
  if (input.maxPerOrder != null && !(Number.isInteger(input.maxPerOrder) && input.maxPerOrder >= 1 && input.maxPerOrder <= 1000)) throw new AppError('VALIDATION', { field: 'maxPerOrder' })
}

async function uniqueSlug(db: Db, base: string, excludeId?: string): Promise<string> {
  let slug = base
  for (let i = 2; i < 50; i++) {
    const [hit] = await db.select({ id: products.id }).from(products).where(eq(products.slug, slug)).limit(1)
    if (!hit || hit.id === excludeId) return slug
    slug = `${base}-${i}`
  }
  return `${base}-${Date.now().toString(36)}`
}

/* --------------------------------- الإدارة --------------------------------- */

export async function createProduct(db: Db, actor: Actor, input: ProductInput): Promise<ProductRow> {
  assertRole(actor, 'SUPER_ADMIN')
  validate(input)
  const slug = await uniqueSlug(db, slugify(input.slug?.trim() || input.title))
  const [row] = await db
    .insert(products)
    .values({ createdByUserId: actor.userId, slug, title: input.title.trim(), description: input.description?.trim() || null, type: input.type ?? 'BOOK', author: input.author?.trim() || null, pages: input.pages ?? null, priceDzd: input.priceDzd, comparePriceDzd: input.comparePriceDzd ?? null, stock: input.stock ?? null, subjectId: input.subjectId ?? null, levelId: input.levelId ?? null, streamId: input.streamId ?? null, coverFileId: input.coverFileId ?? null, coverUrl: input.coverUrl?.trim() || null, status: input.status ?? 'DRAFT', sortOrder: input.sortOrder ?? 0, requiresStream: Boolean(input.requiresStream), maxPerOrder: input.maxPerOrder ?? DEFAULT_MAX_PER_ORDER })
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.product_create', entityType: 'product', entityId: row!.id, newValue: { title: row!.title, type: row!.type, priceDzd: row!.priceDzd } })
  return row!
}

export async function updateProduct(db: Db, actor: Actor, id: string, input: Partial<ProductInput>): Promise<ProductRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PRODUCT_NOT_FOUND')
  const [current] = await db.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt))).limit(1)
  if (!current) throw new AppError('PRODUCT_NOT_FOUND')
  const merged: ProductInput = { ...current, ...input, title: input.title ?? current.title, priceDzd: input.priceDzd ?? current.priceDzd, type: (input.type ?? current.type) as ProductType, status: (input.status ?? current.status) as ProductStatus }
  validate(merged)
  const slug = input.slug !== undefined || input.title !== undefined ? await uniqueSlug(db, slugify(input.slug?.trim() || merged.title), id) : current.slug
  const [row] = await db
    .update(products)
    .set({ slug, title: merged.title.trim(), description: merged.description?.trim() || null, type: merged.type, author: merged.author?.trim() || null, pages: merged.pages ?? null, priceDzd: merged.priceDzd, comparePriceDzd: merged.comparePriceDzd ?? null, stock: merged.stock ?? null, subjectId: merged.subjectId ?? null, levelId: merged.levelId ?? null, streamId: merged.streamId ?? null, coverFileId: merged.coverFileId ?? null, coverUrl: merged.coverUrl?.trim() || null, status: merged.status, sortOrder: merged.sortOrder ?? 0, requiresStream: Boolean(merged.requiresStream), maxPerOrder: merged.maxPerOrder ?? DEFAULT_MAX_PER_ORDER, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.product_update', entityType: 'product', entityId: id, newValue: { ...input } })
  return row!
}

export async function deleteProduct(db: Db, actor: Actor, id: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PRODUCT_NOT_FOUND')
  await db.update(products).set({ deletedAt: new Date(), status: 'ARCHIVED' }).where(eq(products.id, id))
}

/** ربط ملف (مرفوع سلفاً في files) بمنتج رقمي */
export async function attachProductFile(db: Db, actor: Actor, productId: string, fileId: string, label?: string | null) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(productId, 'PRODUCT_NOT_FOUND')
  assertUuid(fileId, 'FILE_NOT_FOUND')
  const [p] = await db.select({ id: products.id }).from(products).where(and(eq(products.id, productId), isNull(products.deletedAt))).limit(1)
  if (!p) throw new AppError('PRODUCT_NOT_FOUND')
  const [f] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1)
  if (!f) throw new AppError('FILE_NOT_FOUND')
  const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(productFiles).where(eq(productFiles.productId, productId))
  const [row] = await db.insert(productFiles).values({ productId, fileId, label: label?.trim() || null, sortOrder: n?.n ?? 0 }).returning()
  return row!
}

export async function detachProductFile(db: Db, actor: Actor, productFileId: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(productFileId, 'NOT_FOUND')
  await db.delete(productFiles).where(eq(productFiles.id, productFileId))
}

export async function listProductsAdmin(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ p: products, subjectName: subjects.nameAr, levelName: levels.nameAr, filesCount: sql<number>`(select count(*)::int from product_files pf where pf.product_id = products.id)` })
    .from(products)
    .leftJoin(subjects, eq(subjects.id, products.subjectId))
    .leftJoin(levels, eq(levels.id, products.levelId))
    .where(isNull(products.deletedAt))
    .orderBy(asc(products.sortOrder), desc(products.createdAt))
}

/* ---------------------------------- العرض ---------------------------------- */

export interface ProductCard {
  id: string
  slug: string
  title: string
  type: ProductType
  author: string | null
  priceDzd: number
  comparePriceDzd: number | null
  coverUrl: string | null
  subjectName: string | null
  levelName: string | null
  inStock: boolean
  digital: boolean
  physical: boolean
  requiresStream: boolean
  maxPerOrder: number
}

const cardOf = (p: ProductRow, subjectName: string | null, levelName: string | null): ProductCard => ({ id: p.id, slug: p.slug, title: p.title, type: p.type as ProductType, author: p.author, priceDzd: p.priceDzd, comparePriceDzd: p.comparePriceDzd, coverUrl: p.coverUrl, subjectName, levelName, inStock: !isPhysical(p.type) || p.stock === null || p.stock > 0, digital: isDigital(p.type), physical: isPhysical(p.type), requiresStream: p.requiresStream, maxPerOrder: p.maxPerOrder })

export async function listProducts(db: Db, f: { type?: ProductType | null; subjectId?: string | null; levelId?: string | null; q?: string | null } = {}): Promise<ProductCard[]> {
  const q = f.q?.trim()
  const rows = await db
    .select({ p: products, subjectName: subjects.nameAr, levelName: levels.nameAr })
    .from(products)
    .leftJoin(subjects, eq(subjects.id, products.subjectId))
    .leftJoin(levels, eq(levels.id, products.levelId))
    .where(and(isNull(products.deletedAt), eq(products.status, 'PUBLISHED'), f.type ? eq(products.type, f.type) : undefined, f.subjectId ? eq(products.subjectId, f.subjectId) : undefined, f.levelId ? eq(products.levelId, f.levelId) : undefined, q ? or(sql`${products.title} ilike ${'%' + q.replace(/[%_]/g, '') + '%'}`, sql`${products.author} ilike ${'%' + q.replace(/[%_]/g, '') + '%'}`) : undefined))
    .orderBy(asc(products.sortOrder), desc(products.createdAt))
    .limit(200)
  return rows.map((r) => cardOf(r.p, r.subjectName, r.levelName))
}

export async function getProduct(db: Db, slug: string) {
  const [row] = await db
    .select({ p: products, subjectName: subjects.nameAr, levelName: levels.nameAr })
    .from(products)
    .leftJoin(subjects, eq(subjects.id, products.subjectId))
    .leftJoin(levels, eq(levels.id, products.levelId))
    .where(and(eq(products.slug, slug), isNull(products.deletedAt), eq(products.status, 'PUBLISHED')))
    .limit(1)
  if (!row) throw new AppError('PRODUCT_NOT_FOUND')
  const fileRows = await db
    .select({ id: productFiles.id, label: productFiles.label, name: files.originalName, sizeBytes: files.sizeBytes })
    .from(productFiles)
    .innerJoin(files, eq(files.id, productFiles.fileId))
    .where(eq(productFiles.productId, row.p.id))
    .orderBy(asc(productFiles.sortOrder))
  const [seller] = row.p.workspaceId ? await db.select({ name: teacherWorkspaces.name }).from(teacherWorkspaces).where(eq(teacherWorkspaces.id, row.p.workspaceId)).limit(1) : []
  const [listing] = await db.select({ id: listings.id, kind: listings.kind, teachersOnly: listings.teachersOnly, salesCount: listings.salesCount }).from(listings).where(eq(listings.productId, row.p.id)).limit(1)
  return { ...cardOf(row.p, row.subjectName, row.levelName), description: row.p.description, pages: row.p.pages, stock: row.p.stock, files: fileRows, sellerName: seller?.name ?? null, listing: listing ?? null }
}

/* ---------------------------------- الطلب ---------------------------------- */

export interface PlaceOrderInput {
  items: { productId: string; qty: number }[]
  customerName: string
  phone: string
  wilayaId?: string | null
  address?: string | null
  /** البلدية ونوع التسليم (منزل/مكتب) — لشركة التوصيل */
  commune?: string | null
  deliveryType?: 'HOME' | 'DESK' | null
  note?: string | null
  /** شعبة المشتري — إلزامية حين يتطلبها منتج (للتلميذ تُؤخذ من ملفه إن لم تُمرَّر) */
  streamId?: string | null
  /** رمز التحقق بالهاتف حين تفرضه سياسة المتجر */
  otpCode?: string | null
  /** التلميذ المستفيد إن اشترى وليّ الأمر بحسابه */
  beneficiaryStudentId?: string | null
}

/* ------------------------------- سياسة المتجر ------------------------------- */

const STORE_POLICY_KEY = 'store.requireOtp'

export interface StorePolicy {
  /** يُطلب رمز تحقق بالهاتف قبل إرسال الطلب (افتراضي: لا) */
  requireOtp: boolean
}

export async function storePolicy(db: Db): Promise<StorePolicy> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, STORE_POLICY_KEY)).limit(1)
  return { requireOtp: row?.value === true }
}

export async function setStorePolicy(db: Db, actor: Actor, input: Partial<StorePolicy>): Promise<StorePolicy> {
  assertRole(actor, 'SUPER_ADMIN')
  const previous = await storePolicy(db)
  const next: StorePolicy = { requireOtp: input.requireOtp ?? previous.requireOtp }
  await db
    .insert(appSettings)
    .values({ key: STORE_POLICY_KEY, value: next.requireOtp })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next.requireOtp, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.store_policy', entityType: 'settings', entityId: null, oldValue: { ...previous }, newValue: { ...next } })
  return next
}

export const orderNumber = () => `MD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`

/**
 * إرسال طلب: يثبّت الأسعار والعناوين، يخصم المخزون المادي، ويحدّد الدفع:
 * مادي ⇒ عند الاستلام؛ رقمي مدفوع ⇒ تحويل ينتظر تأكيد المشرف؛ مجاني ⇒ مؤكَّد ومُسلَّم فوراً.
 */
export async function placeOrder(db: Db, actor: Actor, input: PlaceOrderInput): Promise<OrderRow> {
  if (!input.items.length) throw new AppError('ORDER_EMPTY')
  if (!input.customerName.trim()) throw new AppError('VALIDATION', { field: 'customerName' })
  const phone = normalizePhone(input.phone)
  if (input.streamId) assertUuid(input.streamId, 'VALIDATION')
  if (input.beneficiaryStudentId) assertUuid(input.beneficiaryStudentId, 'VALIDATION')
  const ids = [...new Set(input.items.map((i) => i.productId))]
  for (const id of ids) assertUuid(id, 'PRODUCT_NOT_FOUND')
  const rows = await db.select().from(products).where(and(inArray(products.id, ids), isNull(products.deletedAt)))
  const byId = new Map(rows.map((p) => [p.id, p]))
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId)
    if (!p) throw new AppError('PRODUCT_NOT_FOUND')
    if (p.status !== 'PUBLISHED') throw new AppError('PRODUCT_UNAVAILABLE')
    const requested = Math.max(1, Math.round(i.qty))
    if (requested > p.maxPerOrder) throw new AppError('ORDER_MAX_PER_PRODUCT', { product: p.title, max: p.maxPerOrder })
    const qty = Math.min(p.maxPerOrder, requested)
    if (isPhysical(p.type) && p.stock !== null && p.stock < qty) throw new AppError('OUT_OF_STOCK', { product: p.title })
    return { p, qty, total: p.priceDzd * qty }
  })
  // عروض السوق الموجّهة للأساتذة (تُنسخ إلى مساحتهم) لا يشتريها غيرهم
  if (actor.role !== 'TEACHER') {
    const [tOnly] = await db.select({ id: listings.id }).from(listings).where(and(inArray(listings.productId, ids), eq(listings.teachersOnly, true))).limit(1)
    if (tOnly) throw new AppError('LISTING_TEACHERS_ONLY')
  }
  // الشعبة: إلزامية حين يتطلبها منتج؛ للتلميذ تُؤخذ من ملفه افتراضياً
  let streamId: string | null = input.streamId ?? null
  if (!streamId && actor.role === 'STUDENT' && actor.studentId) {
    const [st] = await db.select({ streamId: students.streamId }).from(students).where(eq(students.id, actor.studentId)).limit(1)
    streamId = st?.streamId ?? null
  }
  if (streamId) {
    const [sr] = await db.select({ id: streams.id }).from(streams).where(eq(streams.id, streamId)).limit(1)
    if (!sr) throw new AppError('ORDER_STREAM_REQUIRED')
  }
  if (lines.some((l) => l.p.requiresStream) && !streamId) throw new AppError('ORDER_STREAM_REQUIRED')
  // كتب الدورات: لا يُطلب كتاب دورة لشعبة غير شعبة التلميذ (قرار المالك 2026-10-24). دورة بلا شعب = لكل الشعب.
  const courseLinks = await db
    .select({ productId: courseProducts.productId, streamIds: courses.streamIds })
    .from(courseProducts)
    .innerJoin(courses, eq(courses.id, courseProducts.courseId))
    .where(and(inArray(courseProducts.productId, ids), isNull(courses.deletedAt)))
  const isCourseOrder = courseLinks.length > 0
  if (isCourseOrder && actor.role === 'STUDENT') {
    const [own] = actor.studentId ? await db.select({ streamId: students.streamId }).from(students).where(eq(students.id, actor.studentId)).limit(1) : []
    const family = await streamFamily(db, own?.streamId ?? streamId)
    for (const pid of new Set(courseLinks.map((l) => l.productId))) {
      const ls = courseLinks.filter((l) => l.productId === pid)
      const open = ls.some((l) => l.streamIds.length === 0 || l.streamIds.some((sid) => family.includes(sid)))
      if (!open) throw new AppError('ORDER_STREAM_MISMATCH', { product: byId.get(pid)?.title ?? '' })
    }
  }
  // التحقق بالهاتف حين تفرضه السياسة: يُعفى من أكّد هذا الهاتف نفسه سلفاً
  let otpVerifiedAt: Date | null = null
  const policy = await storePolicy(db)
  // شراء دورة = رمز تأكيد إلى الهاتف المختار (هاتف التلميذ أو الولي أو آخر)، متى وُجدت قناة SMS فعلية
  const smsReady = isCourseOrder ? (await import('./phone-gate.service').then((m) => m.phoneChannels(db))).sms : false
  if (policy.requireOtp || smsReady) {
    const pv = await isPhoneVerified(db, actor.userId)
    if (pv.verified && pv.phone === phone) otpVerifiedAt = new Date()
    else {
      if (!input.otpCode?.trim()) throw new AppError('ORDER_OTP_REQUIRED')
      await verifyOtp(db, { phone, purpose: 'ORDER', code: input.otpCode, userId: actor.userId })
      otpVerifiedAt = new Date()
    }
  }
  const needsShipping = lines.some((l) => isPhysical(l.p.type))
  if (needsShipping && !input.wilayaId) throw new AppError('VALIDATION', { field: 'wilayaId' })
  if (needsShipping && !input.address?.trim()) throw new AppError('VALIDATION', { field: 'address' })
  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const deliveryType: 'HOME' | 'DESK' = input.deliveryType === 'DESK' ? 'DESK' : 'HOME'
  const shipping = needsShipping ? await shippingFeeFor(db, input.wilayaId ?? null, deliveryType) : 0
  const total = subtotal + shipping
  const paymentMethod: PaymentMethod = total === 0 ? 'FREE' : needsShipping ? 'COD' : 'TRANSFER'
  const status: OrderStatus = paymentMethod === 'FREE' ? 'DELIVERED' : 'PENDING'
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({ number: orderNumber(), userId: actor.userId, status, paymentMethod, needsShipping, subtotalDzd: subtotal, shippingDzd: shipping, totalDzd: total, customerName: input.customerName.trim(), phone, wilayaId: input.wilayaId ?? null, streamId, otpVerifiedAt, beneficiaryStudentId: input.beneficiaryStudentId ?? null, address: input.address?.trim() || null, commune: input.commune?.trim().slice(0, 120) || null, deliveryType, note: input.note?.trim() || null, confirmedAt: status === 'DELIVERED' ? new Date() : null, deliveredAt: status === 'DELIVERED' ? new Date() : null })
      .returning()
    await tx.insert(orderItems).values(lines.map((l) => ({ orderId: o!.id, productId: l.p.id, title: l.p.title, type: l.p.type, unitPriceDzd: l.p.priceDzd, qty: l.qty, lineTotalDzd: l.total })))
    for (const l of lines) {
      if (isPhysical(l.p.type) && l.p.stock !== null) await tx.update(products).set({ stock: sql`${products.stock} - ${l.qty}` }).where(eq(products.id, l.p.id))
      await tx.update(products).set({ salesCount: sql`${products.salesCount} + ${l.qty}` }).where(eq(products.id, l.p.id))
    }
    return o!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.order_place', entityType: 'order', entityId: order.id, newValue: { number: order.number, total, paymentMethod, items: lines.length } })
  if (status === 'DELIVERED') await grantPurchasesForOrder(db, order.id)
  // شراء دورة برمز تأكيد ناجح (أو بهاتف مؤكَّد سلفاً): الطلب مؤكَّد مباشرة — لا ينتظر مكالمة (نسق NOVA)
  if (status === 'PENDING' && isCourseOrder && otpVerifiedAt) {
    return (await transitionOrder(db, order.id, 'CONFIRMED', { actorUserId: actor.userId, source: 'sms' })).order
  }
  // المشرفون يُخطرون بالطلبات التي تنتظرهم
  if (status === 'PENDING') {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
    for (const a of admins) await notify(db, { userId: a.id, workspaceId: null, type: 'SYSTEM', title: `طلب جديد ${order.number}`, body: `${input.customerName.trim()} · ${total} دج · ${PAYMENT_AR[paymentMethod]}`, link: '/admin/store' })
  }
  return order
}

export interface OrderView {
  order: OrderRow & { wilayaName: string | null; customerEmail: string | null }
  items: { id: string; productId: string; title: string; type: string; unitPriceDzd: number; qty: number; lineTotalDzd: number; slug: string | null; files: { id: string; fileId: string; label: string | null; name: string }[] }[]
  /** هل تُتاح التنزيلات الرقمية (مؤكَّد فما فوق) */
  canDownload: boolean
}

const DOWNLOADABLE: OrderStatus[] = ['CONFIRMED', 'SHIPPED', 'DELIVERED']

export async function getOrder(db: Db, actor: Actor, id: string): Promise<OrderView> {
  assertUuid(id, 'ORDER_NOT_FOUND')
  const [row] = await db
    .select({ o: orders, wilayaName: wilayas.nameAr, customerEmail: users.email })
    .from(orders)
    .leftJoin(wilayas, eq(wilayas.id, orders.wilayaId))
    .leftJoin(users, eq(users.id, orders.userId))
    .where(and(eq(orders.id, id), actor.role === 'SUPER_ADMIN' ? undefined : eq(orders.userId, actor.userId)))
    .limit(1)
  if (!row) throw new AppError('ORDER_NOT_FOUND')
  const items = await db.select({ it: orderItems, slug: products.slug }).from(orderItems).leftJoin(products, eq(products.id, orderItems.productId)).where(eq(orderItems.orderId, id)).orderBy(asc(orderItems.createdAt))
  const pf = items.length
    ? await db
        .select({ productId: productFiles.productId, id: productFiles.id, fileId: productFiles.fileId, label: productFiles.label, name: files.originalName })
        .from(productFiles)
        .innerJoin(files, eq(files.id, productFiles.fileId))
        .where(inArray(productFiles.productId, items.map((i) => i.it.productId)))
        .orderBy(asc(productFiles.sortOrder))
    : []
  return {
    order: { ...row.o, wilayaName: row.wilayaName, customerEmail: row.customerEmail },
    items: items.map((i) => ({ id: i.it.id, productId: i.it.productId, title: i.it.title, type: i.it.type, unitPriceDzd: i.it.unitPriceDzd, qty: i.it.qty, lineTotalDzd: i.it.lineTotalDzd, slug: i.slug, files: isDigital(i.it.type) ? pf.filter((f) => f.productId === i.it.productId).map((f) => ({ id: f.id, fileId: f.fileId, label: f.label, name: f.name })) : [] })),
    canDownload: DOWNLOADABLE.includes(row.o.status as OrderStatus)
  }
}

export async function myOrders(db: Db, actor: Actor) {
  return db
    .select({ id: orders.id, number: orders.number, status: orders.status, paymentMethod: orders.paymentMethod, totalDzd: orders.totalDzd, createdAt: orders.createdAt, items: sql<number>`(select coalesce(sum(i.qty), 0)::int from order_items i where i.order_id = orders.id)` })
    .from(orders)
    .where(eq(orders.userId, actor.userId))
    .orderBy(desc(orders.createdAt))
    .limit(100)
}

export async function listOrdersAdmin(db: Db, actor: Actor, f: { status?: OrderStatus | null } = {}) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ id: orders.id, number: orders.number, status: orders.status, paymentMethod: orders.paymentMethod, needsShipping: orders.needsShipping, totalDzd: orders.totalDzd, customerName: orders.customerName, phone: orders.phone, wilayaName: wilayas.nameAr, createdAt: orders.createdAt, items: sql<number>`(select coalesce(sum(i.qty), 0)::int from order_items i where i.order_id = orders.id)` })
    .from(orders)
    .leftJoin(wilayas, eq(wilayas.id, orders.wilayaId))
    .where(f.status ? eq(orders.status, f.status) : undefined)
    .orderBy(desc(orders.createdAt))
    .limit(300)
}

/** طابور التأكيد الهاتفي: الطلبات التي تنتظر مكالمة، الأقدم أولاً (الحالة ثم تاريخ الإنشاء) */
export async function listConfirmationQueue(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ id: orders.id, number: orders.number, status: orders.status, paymentMethod: orders.paymentMethod, needsShipping: orders.needsShipping, totalDzd: orders.totalDzd, customerName: orders.customerName, phone: orders.phone, wilayaName: wilayas.nameAr, commune: orders.commune, address: orders.address, note: orders.note, otpVerifiedAt: orders.otpVerifiedAt, confirmAttempts: orders.confirmAttempts, lastCallAt: orders.lastCallAt, createdAt: orders.createdAt, itemsText: sql<string>`(select coalesce(string_agg(i.title || case when i.qty > 1 then ' ×' || i.qty else '' end, ' + ' order by i.created_at), '') from order_items i where i.order_id = orders.id)` })
    .from(orders)
    .leftJoin(wilayas, eq(wilayas.id, orders.wilayaId))
    .where(inArray(orders.status, [...CONFIRMATION_STATUSES]))
    .orderBy(asc(orders.createdAt))
    .limit(300)
}

/** تغيير حالة الطلب (المشرف): يمرّ من محرّك الحالات الموحّد (مخزون، تفعيل الدورة، إشعارات) */
export async function setOrderStatus(db: Db, actor: Actor, id: string, next: OrderStatus, opts: { reason?: string | null; adminNote?: string | null; shippingDzd?: number | null } = {}): Promise<OrderRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'ORDER_NOT_FOUND')
  if (!ORDER_STATUSES.includes(next)) throw new AppError('VALIDATION', { field: 'status' })
  const r = await transitionOrder(db, id, next, { actorUserId: actor.userId, source: 'admin', reason: opts.reason ?? null, adminNote: opts.adminNote, shippingDzd: opts.shippingDzd ?? null })
  return r.order
}

/** رابط تنزيل موقّع قصير العمر لملف من طلب مؤكَّد لصاحبه (أو المشرف)، مع تسجيل التنزيل */
export async function downloadUrl(db: Db, actor: Actor, orderId: string, productFileId: string): Promise<{ url: string; name: string }> {
  const v = await getOrder(db, actor, orderId)
  if (!v.canDownload) throw new AppError('DOWNLOAD_NOT_ALLOWED')
  for (const it of v.items) {
    const f = it.files.find((x) => x.id === productFileId)
    if (f) {
      await db.insert(downloads).values({ userId: actor.userId, orderId, productId: it.productId, fileId: f.fileId })
      await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.download', entityType: 'order', entityId: orderId, newValue: { productId: it.productId, fileId: f.fileId } })
      return { url: signFileUrl(f.fileId, 600), name: f.name }
    }
  }
  throw new AppError('NOT_FOUND')
}

export async function storeStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const [byStatus, [revenue], [prods], [dl]] = await Promise.all([
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db.select({ total: sql<number>`coalesce(sum(${orders.totalDzd}), 0)::int` }).from(orders).where(eq(orders.status, 'DELIVERED')),
    db.select({ n: sql<number>`count(*)::int`, published: sql<number>`count(*) filter (where ${products.status} = 'PUBLISHED')::int` }).from(products).where(isNull(products.deletedAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(downloads)
  ])
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x.n])) as Partial<Record<OrderStatus, number>>
  return { pending: (s.PENDING ?? 0) + (s.NO_ANSWER ?? 0) + (s.CALL_LATER ?? 0), confirmed: s.CONFIRMED ?? 0, shipped: s.SHIPPED ?? 0, delivered: s.DELIVERED ?? 0, returned: s.RETURNED ?? 0, cancelled: s.CANCELLED ?? 0, revenueDzd: revenue?.total ?? 0, products: prods?.n ?? 0, published: prods?.published ?? 0, downloads: dl?.n ?? 0 }
}

/** اسم العميل الافتراضي من ملفه */
export async function customerDefaults(db: Db, actor: Actor): Promise<{ name: string; phone: string | null; phoneVerified: boolean; guardianPhone: string | null; wilayaId: string | null; streamId: string | null }> {
  const [p] = await db.select({ phone: profiles.phone, verifiedAt: profiles.phoneVerifiedAt }).from(profiles).where(eq(profiles.userId, actor.userId)).limit(1)
  const [st] = actor.studentId ? await db.select({ streamId: students.streamId, guardianPhone: students.guardianPhone, wilayaId: students.wilayaId }).from(students).where(eq(students.id, actor.studentId)).limit(1) : []
  return { name: actor.fullName, phone: p?.phone ?? null, phoneVerified: Boolean(p?.verifiedAt), guardianPhone: st?.guardianPhone ?? null, wilayaId: st?.wilayaId ?? null, streamId: st?.streamId ?? null }
}

/** كل ما تحتاجه استمارة «شراء الدورة» (المعلومات تُعبّأ من التسجيل مباشرة) */
export async function courseCheckoutData(db: Db, actor: Actor) {
  const [defaults, ws, feeTable, channels] = await Promise.all([customerDefaults(db, actor), db.select({ id: wilayas.id, code: wilayas.code, nameAr: wilayas.nameAr }).from(wilayas).orderBy(asc(wilayas.code)), shippingFeeTable(db), import('./phone-gate.service').then((m) => m.phoneChannels(db))])
  return { defaults, wilayas: ws.map((w) => ({ id: w.id, name: `${w.code} — ${w.nameAr}` })), feeTable, shippingDzd: shippingFeeDzd(), smsReady: channels.sms }
}
