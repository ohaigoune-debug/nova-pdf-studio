/**
 * متجر الكتب (Exam Builder — المرحلة 10).
 * المشرف ينشر منتجات (كتاب ورقي، PDF، حزمة) بأسعار بالدينار؛ الزائر يتصفّح، والمسجّل يطلب:
 * الدفع عند الاستلام للمادي، تحويل يؤكّده المشرف للرقمي المدفوع، ومجاني فوراً.
 * الملفات الرقمية تُنزَّل بعد التأكيد فقط عبر روابط موقّعة قصيرة العمر، وكل تنزيل يُسجَّل.
 */
import { randomBytes } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { downloads, files, levels, orderItems, orders, productFiles, products, profiles, subjects, users, wilayas, type OrderRow, type ProductRow } from '@/server/db/schema'
import type { OrderStatus, PaymentMethod, ProductStatus, ProductType } from '@/server/db/schema/enums'
import { ORDER_STATUSES, PRODUCT_STATUSES, PRODUCT_TYPES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { notify } from './notifications.service'

export const PRODUCT_TYPE_AR: Record<ProductType, string> = { BOOK: 'كتاب ورقي', PDF: 'ملف PDF', PACK: 'حزمة (ورقي + رقمي)' }
export const ORDER_STATUS_AR: Record<OrderStatus, string> = { PENDING: 'بانتظار التأكيد', CONFIRMED: 'مؤكَّد', SHIPPED: 'في الطريق', DELIVERED: 'سُلِّم', CANCELLED: 'أُلغي' }
export const PAYMENT_AR: Record<PaymentMethod, string> = { COD: 'الدفع عند الاستلام', TRANSFER: 'تحويل (CCP / BaridiMob)', FREE: 'مجاني' }

/** رسوم الشحن للطلبات المادية (دج) — من البيئة، صفر إن لم تُضبط */
export const shippingFeeDzd = (): number => Math.max(0, Number(process.env.STORE_SHIPPING_DZD ?? 0) || 0)

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
}

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
    .values({ createdByUserId: actor.userId, slug, title: input.title.trim(), description: input.description?.trim() || null, type: input.type ?? 'BOOK', author: input.author?.trim() || null, pages: input.pages ?? null, priceDzd: input.priceDzd, comparePriceDzd: input.comparePriceDzd ?? null, stock: input.stock ?? null, subjectId: input.subjectId ?? null, levelId: input.levelId ?? null, streamId: input.streamId ?? null, coverFileId: input.coverFileId ?? null, coverUrl: input.coverUrl?.trim() || null, status: input.status ?? 'DRAFT', sortOrder: input.sortOrder ?? 0 })
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
    .set({ slug, title: merged.title.trim(), description: merged.description?.trim() || null, type: merged.type, author: merged.author?.trim() || null, pages: merged.pages ?? null, priceDzd: merged.priceDzd, comparePriceDzd: merged.comparePriceDzd ?? null, stock: merged.stock ?? null, subjectId: merged.subjectId ?? null, levelId: merged.levelId ?? null, streamId: merged.streamId ?? null, coverFileId: merged.coverFileId ?? null, coverUrl: merged.coverUrl?.trim() || null, status: merged.status, sortOrder: merged.sortOrder ?? 0, updatedAt: new Date() })
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
}

const cardOf = (p: ProductRow, subjectName: string | null, levelName: string | null): ProductCard => ({ id: p.id, slug: p.slug, title: p.title, type: p.type as ProductType, author: p.author, priceDzd: p.priceDzd, comparePriceDzd: p.comparePriceDzd, coverUrl: p.coverUrl, subjectName, levelName, inStock: !isPhysical(p.type) || p.stock === null || p.stock > 0, digital: isDigital(p.type), physical: isPhysical(p.type) })

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
  return { ...cardOf(row.p, row.subjectName, row.levelName), description: row.p.description, pages: row.p.pages, stock: row.p.stock, files: fileRows }
}

/* ---------------------------------- الطلب ---------------------------------- */

export interface PlaceOrderInput {
  items: { productId: string; qty: number }[]
  customerName: string
  phone: string
  wilayaId?: string | null
  address?: string | null
  note?: string | null
}

const orderNumber = () => `MD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(3).toString('hex').toUpperCase()}`

/**
 * إرسال طلب: يثبّت الأسعار والعناوين، يخصم المخزون المادي، ويحدّد الدفع:
 * مادي ⇒ عند الاستلام؛ رقمي مدفوع ⇒ تحويل ينتظر تأكيد المشرف؛ مجاني ⇒ مؤكَّد ومُسلَّم فوراً.
 */
export async function placeOrder(db: Db, actor: Actor, input: PlaceOrderInput): Promise<OrderRow> {
  if (!input.items.length) throw new AppError('ORDER_EMPTY')
  if (!input.customerName.trim()) throw new AppError('VALIDATION', { field: 'customerName' })
  if (!/^0[5-7]\d{8}$/.test(input.phone.replace(/\s/g, ''))) throw new AppError('VALIDATION', { field: 'phone' })
  const ids = [...new Set(input.items.map((i) => i.productId))]
  for (const id of ids) assertUuid(id, 'PRODUCT_NOT_FOUND')
  const rows = await db.select().from(products).where(and(inArray(products.id, ids), isNull(products.deletedAt)))
  const byId = new Map(rows.map((p) => [p.id, p]))
  const lines = input.items.map((i) => {
    const p = byId.get(i.productId)
    if (!p) throw new AppError('PRODUCT_NOT_FOUND')
    if (p.status !== 'PUBLISHED') throw new AppError('PRODUCT_UNAVAILABLE')
    const qty = Math.max(1, Math.min(20, Math.round(i.qty)))
    if (isPhysical(p.type) && p.stock !== null && p.stock < qty) throw new AppError('OUT_OF_STOCK', { product: p.title })
    return { p, qty, total: p.priceDzd * qty }
  })
  const needsShipping = lines.some((l) => isPhysical(l.p.type))
  if (needsShipping && !input.wilayaId) throw new AppError('VALIDATION', { field: 'wilayaId' })
  if (needsShipping && !input.address?.trim()) throw new AppError('VALIDATION', { field: 'address' })
  const subtotal = lines.reduce((s, l) => s + l.total, 0)
  const shipping = needsShipping ? shippingFeeDzd() : 0
  const total = subtotal + shipping
  const paymentMethod: PaymentMethod = total === 0 ? 'FREE' : needsShipping ? 'COD' : 'TRANSFER'
  const status: OrderStatus = paymentMethod === 'FREE' ? 'DELIVERED' : 'PENDING'
  const order = await db.transaction(async (tx) => {
    const [o] = await tx
      .insert(orders)
      .values({ number: orderNumber(), userId: actor.userId, status, paymentMethod, needsShipping, subtotalDzd: subtotal, shippingDzd: shipping, totalDzd: total, customerName: input.customerName.trim(), phone: input.phone.replace(/\s/g, ''), wilayaId: input.wilayaId ?? null, address: input.address?.trim() || null, note: input.note?.trim() || null, confirmedAt: status === 'DELIVERED' ? new Date() : null, deliveredAt: status === 'DELIVERED' ? new Date() : null })
      .returning()
    await tx.insert(orderItems).values(lines.map((l) => ({ orderId: o!.id, productId: l.p.id, title: l.p.title, type: l.p.type, unitPriceDzd: l.p.priceDzd, qty: l.qty, lineTotalDzd: l.total })))
    for (const l of lines) {
      if (isPhysical(l.p.type) && l.p.stock !== null) await tx.update(products).set({ stock: sql`${products.stock} - ${l.qty}` }).where(eq(products.id, l.p.id))
      await tx.update(products).set({ salesCount: sql`${products.salesCount} + ${l.qty}` }).where(eq(products.id, l.p.id))
    }
    return o!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.order_place', entityType: 'order', entityId: order.id, newValue: { number: order.number, total, paymentMethod, items: lines.length } })
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

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = { PENDING: ['CONFIRMED', 'CANCELLED'], CONFIRMED: ['SHIPPED', 'DELIVERED', 'CANCELLED'], SHIPPED: ['DELIVERED', 'CANCELLED'], DELIVERED: [], CANCELLED: [] }

/** تغيير حالة الطلب (المشرف): الإلغاء يعيد المخزون؛ صاحب الطلب يُخطر */
export async function setOrderStatus(db: Db, actor: Actor, id: string, next: OrderStatus, opts: { reason?: string | null; adminNote?: string | null; shippingDzd?: number | null } = {}): Promise<OrderRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'ORDER_NOT_FOUND')
  if (!ORDER_STATUSES.includes(next)) throw new AppError('VALIDATION', { field: 'status' })
  const [o] = await db.select().from(orders).where(eq(orders.id, id)).limit(1)
  if (!o) throw new AppError('ORDER_NOT_FOUND')
  if (!TRANSITIONS[o.status as OrderStatus].includes(next)) throw new AppError('ORDER_INVALID_TRANSITION')
  const now = new Date()
  const shipping = opts.shippingDzd != null && Number.isInteger(opts.shippingDzd) && opts.shippingDzd >= 0 ? opts.shippingDzd : o.shippingDzd
  const row = await db.transaction(async (tx) => {
    const [r] = await tx
      .update(orders)
      .set({ status: next, shippingDzd: shipping, totalDzd: o.subtotalDzd + shipping, adminNote: opts.adminNote !== undefined ? opts.adminNote?.trim() || null : o.adminNote, confirmedAt: next === 'CONFIRMED' ? now : o.confirmedAt, shippedAt: next === 'SHIPPED' ? now : o.shippedAt, deliveredAt: next === 'DELIVERED' ? now : o.deliveredAt, cancelledAt: next === 'CANCELLED' ? now : o.cancelledAt, cancelReason: next === 'CANCELLED' ? opts.reason?.trim() || null : o.cancelReason, updatedAt: now })
      .where(eq(orders.id, id))
      .returning()
    if (next === 'CANCELLED') {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, id))
      for (const it of items) {
        if (isPhysical(it.type)) await tx.update(products).set({ stock: sql`case when ${products.stock} is null then null else ${products.stock} + ${it.qty} end` }).where(eq(products.id, it.productId))
        await tx.update(products).set({ salesCount: sql`greatest(0, ${products.salesCount} - ${it.qty})` }).where(eq(products.id, it.productId))
      }
    }
    return r!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'store.order_status', entityType: 'order', entityId: id, oldValue: { status: o.status }, newValue: { status: next, reason: opts.reason ?? null } })
  const msg: Record<OrderStatus, string> = { PENDING: '', CONFIRMED: o.needsShipping ? 'أُكّد طلبك وسيُشحن قريباً.' : 'أُكّد طلبك: ملفاتك جاهزة للتنزيل من «طلباتي».', SHIPPED: 'طلبك في الطريق إليك.', DELIVERED: 'سُلّم طلبك. شكراً لك.', CANCELLED: `أُلغي طلبك${opts.reason ? `: ${opts.reason}` : ''}.` }
  if (msg[next]) await notify(db, { userId: o.userId, workspaceId: null, type: 'SYSTEM', title: `طلب ${o.number}: ${ORDER_STATUS_AR[next]}`, body: msg[next], link: `/store/orders/${o.id}` })
  return row
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
  return { pending: s.PENDING ?? 0, confirmed: s.CONFIRMED ?? 0, shipped: s.SHIPPED ?? 0, delivered: s.DELIVERED ?? 0, cancelled: s.CANCELLED ?? 0, revenueDzd: revenue?.total ?? 0, products: prods?.n ?? 0, published: prods?.published ?? 0, downloads: dl?.n ?? 0 }
}

/** اسم العميل الافتراضي من ملفه */
export async function customerDefaults(db: Db, actor: Actor): Promise<{ name: string; phone: string | null }> {
  const [p] = await db.select({ phone: profiles.phone }).from(profiles).where(eq(profiles.userId, actor.userId)).limit(1)
  return { name: actor.fullName, phone: p?.phone ?? null }
}
