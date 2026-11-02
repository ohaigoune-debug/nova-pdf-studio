import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { CALL_EVENT_RESULTS, DELIVERY_TYPES, ORDER_STATUSES, PAYMENT_METHODS, PRODUCT_STATUSES, PRODUCT_TYPES } from './enums'
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
    /** يُلزم المشتري باختيار شعبته (كتب موجّهة بالشعبة، ودورات) */
    requiresStream: boolean('requires_stream').notNull().default(false),
    /** الحدّ الأقصى للوحدات في الطلب الواحد (السياسة التجارية: وحدة واحدة للكتب المرتبطة بدورة) */
    maxPerOrder: integer('max_per_order').notNull().default(20),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('products_type_check', inList(t.type, PRODUCT_TYPES)),
    check('products_status_check', inList(t.status, PRODUCT_STATUSES)),
    check('products_price_check', sql`${t.priceDzd} >= 0`),
    check('products_stock_check', sql`${t.stock} IS NULL OR ${t.stock} >= 0`),
    check('products_max_per_order_check', sql`${t.maxPerOrder} >= 1`),
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
    /** ما خُصم من الطلب برصيد التلميذ (دعوة الزملاء / الرصيد الترحيبي): الإجمالي = المجموع + التوصيل − الرصيد */
    creditDzd: integer('credit_dzd').notNull().default(0),
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
    /** التحقق بالهاتف (OTP) قبل اعتماد الطلب */
    otpVerifiedAt: timestamp('otp_verified_at', { withTimezone: true }),
    /** شعبة المشتري وقت الطلب (إلزامية حين يتطلبها منتج) */
    streamId: uuid('stream_id').references(() => streams.id),
    /** التلميذ المستفيد إن اشترى وليّ الأمر بحسابه */
    beneficiaryStudentId: uuid('beneficiary_student_id'),
    /** شركة التوصيل ورقم التتبّع */
    deliveryProvider: text('delivery_provider'),
    deliveryTrackingId: text('delivery_tracking_id'),
    /** البلدية (شركات التوصيل تطابقها بالاسم) ونوع التسليم: HOME للمنزل، DESK لمكتب الشركة */
    commune: text('commune'),
    deliveryType: text('delivery_type').notNull().default('HOME'),
    /** التأكيد الهاتفي: عدد المحاولات وآخر اتصال */
    confirmAttempts: integer('confirm_attempts').notNull().default(0),
    lastCallAt: timestamp('last_call_at', { withTimezone: true }),
    returnedAt: timestamp('returned_at', { withTimezone: true }),
    /**
     * حجز طابور التأكيد (قرار المالك 2 نوفمبر 2026): الموظف الذي حجز الطلب ليتصل به، ومتى ينتهي حجزه.
     * الحجز المنتهي (reserved_until ≤ الآن) كأنه غير موجود: يعود الطلب إلى الطابور العام.
     */
    reservedByUserId: uuid('reserved_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reservedAt: timestamp('reserved_at', { withTimezone: true }),
    reservedUntil: timestamp('reserved_until', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('orders_status_check', inList(t.status, ORDER_STATUSES)),
    check('orders_delivery_type_check', inList(t.deliveryType, DELIVERY_TYPES)),
    check('orders_payment_check', inList(t.paymentMethod, PAYMENT_METHODS)),
    check('orders_credit_check', sql`${t.creditDzd} >= 0`),
    index('orders_user_idx').on(t.userId, t.createdAt),
    index('orders_status_idx').on(t.status, t.createdAt),
    index('orders_tracking_idx').on(t.deliveryProvider, t.deliveryTrackingId),
    index('orders_reserved_idx').on(t.reservedByUserId, t.reservedUntil)
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
    /** المنتج المشترى؛ null لسطر «الدورة الرقمية» (type = COURSE) الذي لا منتج له — الدورة في course_id */
    productId: uuid('product_id').references(() => products.id),
    title: text('title').notNull(),
    /** BOOK | PDF | PACK كنوع المنتج، أو COURSE للدورة الرقمية (بلا كتاب ولا شحن) */
    type: text('type').notNull(),
    unitPriceDzd: integer('unit_price_dzd').notNull(),
    qty: integer('qty').notNull().default(1),
    lineTotalDzd: integer('line_total_dzd').notNull(),
    /**
     * الدورة المشتراة بهذا السطر (شراء «الدورة مع كتابها»): الحقّ مثبَّت وقت الشراء —
     * تغيير ربط الكتب لاحقاً لا يغيّره، وشراء دورة لا يفعّل دورة أخرى تشترك في الكتاب.
     * null للطلبات القديمة (تُستنتج دوراتها من روابط المنتج كما كانت). FK في الترحيل 0034 (ON DELETE SET NULL).
     */
    courseId: uuid('course_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('order_items_qty_check', sql`${t.qty} >= 1`), index('order_items_order_idx').on(t.orderId), index('order_items_product_idx').on(t.productId), index('order_items_course_idx').on(t.courseId)]
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

/**
 * سجلّ المكالمات/الرسائل الواردة إلى هاتف المشرف (تطبيق NOVA Call): مكالمة من رقم طلب معلّق تؤكّده.
 * لا يُحذف شيء؛ يُعرض في صفحة التأكيد.
 */
export const callEvents = pgTable(
  'call_events',
  {
    id: id(),
    phone: text('phone').notNull(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    orderNumber: text('order_number'),
    result: text('result').notNull(),
    /** call | sms */
    channel: text('channel').notNull().default('call'),
    text: text('text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('call_events_result_check', inList(t.result, CALL_EVENT_RESULTS)), index('call_events_phone_idx').on(t.phone, t.createdAt), index('call_events_created_idx').on(t.createdAt)]
)

/** محاولات الدفع الإلكتروني (Guiddini/SATIM): الحالة كما تحقّق منها الخادم عند البوابة، لا كما ادّعاها المتصفح */
export const onlinePayments = pgTable(
  'online_payments',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('GUIDDINI'),
    amountDzd: integer('amount_dzd').notNull(),
    /** PENDING ← PAID | FAILED | EXPIRED | MISMATCH (مبلغ مختلف: يراجعه المشرف) */
    status: text('status').notNull().default('PENDING'),
    /** معرّف المعاملة عند البوابة (order_number) */
    gatewayRef: text('gateway_ref'),
    formUrl: text('form_url'),
    gatewayStatus: text('gateway_status'),
    gatewayResponse: jsonb('gateway_response'),
    checkCount: integer('check_count').notNull().default(0),
    checkedAt: timestamp('checked_at', { withTimezone: true }),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('online_payments_status_check', sql`${t.status} IN ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'MISMATCH')`),
    uniqueIndex('online_payments_gateway_ref_unique').on(t.provider, t.gatewayRef),
    index('online_payments_pending_idx').on(t.status, t.createdAt),
    index('online_payments_order_idx').on(t.orderId)
  ]
)
