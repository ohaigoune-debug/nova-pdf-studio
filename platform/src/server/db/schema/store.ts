import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { ORDER_STATUSES, PAYMENT_METHODS, PRODUCT_STATUSES, PRODUCT_TYPES } from './enums'
import { levels, streams, subjects, wilayas } from './reference'
import { teacherWorkspaces } from './tenancy'

/**
 * متجر الكتب (المرحلة 10): كتب ورقية (دفع عند الاستلام)، ملفات PDF (تنزيل بعد التأكيد)، أو حزمة.
 * الأسعار بالدينار الجزائري أعداداً صحيحة. `workspace_id` فارغ = منتج المنصة؛ وإلا منتج أستاذ (السوق لاحقاً).
 */
export const products = pgTable(
  'products',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull().default('BOOK'),
    author: text('author'),
    pages: integer('pages'),
    priceDzd: integer('price_dzd').notNull().default(0),
    comparePriceDzd: integer('compare_price_dzd'),
    /** فارغ = غير محدود (رقمي)؛ للمادي عدد النسخ المتاحة */
    stock: integer('stock'),
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    coverFileId: uuid('cover_file_id').references(() => files.id, { onDelete: 'set null' }),
    coverUrl: text('cover_url'),
    status: text('status').notNull().default('DRAFT'),
    sortOrder: integer('sort_order').notNull().default(0),
    salesCount: integer('sales_count').notNull().default(0),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('products_type_check', inList(t.type, PRODUCT_TYPES)),
    check('products_status_check', inList(t.status, PRODUCT_STATUSES)),
    check('products_price_check', sql`${t.priceDzd} >= 0`),
    check('products_stock_check', sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
    index('products_browse_idx').on(t.status, t.type, t.subjectId, t.levelId),
    index('products_workspace_idx').on(t.workspaceId)
  ]
)

/** الملفات الرقمية للمنتج (PDF…) — تُنزَّل بعد تأكيد الطلب فقط */
export const productFiles = pgTable(
  'product_files',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    label: text('label'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('product_files_product_idx').on(t.productId, t.sortOrder)]
)

export const orders = pgTable(
  'orders',
  {
    id: id(),
    /** رقم يُقرأ: MD-20261001-A7K2 */
    number: text('number').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: text('status').notNull().default('PENDING'),
    paymentMethod: text('payment_method').notNull().default('COD'),
    /** يحوي منتجاً مادياً يُشحن */
    needsShipping: boolean('needs_shipping').notNull().default(false),
    subtotalDzd: integer('subtotal_dzd').notNull().default(0),
    shippingDzd: integer('shipping_dzd').notNull().default(0),
    totalDzd: integer('total_dzd').notNull().default(0),
    customerName: text('customer_name').notNull(),
    phone: text('phone').notNull(),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id),
    address: text('address'),
    note: text('note'),
    adminNote: text('admin_note'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    shippedAt: timestamp('shipped_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    cancelReason: text('cancel_reason'),
    ...timestamps
  },
  (t) => [
    check('orders_status_check', inList(t.status, ORDER_STATUSES)),
    check('orders_payment_check', inList(t.paymentMethod, PAYMENT_METHODS)),
    index('orders_user_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt)
  ]
)

/** سطر طلب بنسخة مجمّدة من العنوان والسعر وقت الشراء */
export const orderItems = pgTable(
  'order_items',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    title: text('title').notNull(),
    type: text('type').notNull(),
    unitPriceDzd: integer('unit_price_dzd').notNull(),
    qty: integer('qty').notNull().default(1),
    lineTotalDzd: integer('line_total_dzd').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('order_items_qty_check', sql`${t.qty} >= 1`), index('order_items_order_idx').on(t.orderId), index('order_items_product_idx').on(t.productId)]
)

/** سجلّ التنزيلات الرقمية (من اشترى ماذا ومتى) */
export const downloads = pgTable(
  'downloads',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id, { onDelete: 'cascade' }),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('downloads_user_idx').on(t.userId, t.downloadedAt), index('downloads_order_idx').on(t.orderId)]
)

export type ProductRow = typeof products.$inferSelect
export type ProductFileRow = typeof productFiles.$inferSelect
export type OrderRow = typeof orders.$inferSelect
export type OrderItemRow = typeof orderItems.$inferSelect
