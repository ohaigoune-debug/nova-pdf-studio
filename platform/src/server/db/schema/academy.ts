/**
 * الأكاديمية المدفوعة (M8): الدورات، الاشتراكات، الحصص المباشرة، تفعيل الدورة بشراء الكتاب،
 * رموز OTP، أحداث شركة التوصيل، ومركز الشكاوى.
 *
 * مبدأ التصميم: الدورة = فوج (groups) يملكه أستاذ المنصة، فيُعاد استعمال كل ما يعمل على الأفواج
 * (الدروس الموجّهة، الفيديو المحمي، القسم الافتراضي، الواجبات، الإشعارات). الاشتراك = عضوية في الفوج بمدة.
 */
import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { content, files } from './content'
import {
  COURSE_STATUSES,
  DELIVERY_EVENT_STATUSES,
  ENROLLMENT_SOURCES,
  COURSE_ENROLLMENT_STATUSES,
  LIVE_PROVIDERS,
  LIVE_SESSION_STATUSES,
  OTP_PURPOSES,
  POS_STATUSES,
  SUPPORT_KINDS,
  SUPPORT_STATUSES
} from './enums'
import { groups } from './groups'
import { levels, subjects, wilayas } from './reference'
import { orders, products } from './store'
import { students } from './students'
import { teacherWorkspaces } from './tenancy'

export const courses = pgTable(
  'courses',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    description: text('description'),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id),
    /** الفوج الذي يحمل محتوى الدورة وتلاميذها */
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id),
    levelId: uuid('level_id').references(() => levels.id),
    /** الشعب المعنية (فارغ = كل الشعب) */
    streamIds: uuid('stream_ids').array().notNull().default([]),
    subjectId: uuid('subject_id').references(() => subjects.id),
    /** «2026/2027» */
    season: text('season').notNull(),
    /** ANNUAL (اشتراك سنوي) أو TERM (فصلي) */
    plan: text('plan').notNull().default('ANNUAL'),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    /** آخر يوم يُفتح فيه المحتوى (بعد البكالوريا تختفي الفيديوهات) */
    accessEndsOn: date('access_ends_on'),
    priceDzd: integer('price_dzd').notNull().default(0),
    /**
     * النسخة الرقمية (قرار المالك 2026-11-02): سعر الدورة دون كتاب، بالبطاقة فقط، تُفتح فور تأكّد الدفع.
     * تظهر في الكتالوج بطاقةً مستقلة تفتح الدورة نفسها. null = لا نسخة رقمية.
     */
    digitalPriceDzd: integer('digital_price_dzd'),
    /**
     * الكتاب الورقي المرفق بالدورة (قرار المالك 2026-10-24: كل دورة مدفوعة تشمل كتاباً).
     * سعره هو سعر الدورة؛ يُدار من صفحة الدورة. null = دورة قديمة غير مكتملة (لا شراء جديد) أو مجانية.
     */
    bookProductId: uuid('book_product_id').references(() => products.id, { onDelete: 'set null' }),
    coverFileId: uuid('cover_file_id').references(() => files.id, { onDelete: 'set null' }),
    /** نص النظام الداخلي والشروط التي يوافق عليها التلميذ قبل الدخول (Markdown) */
    termsText: text('terms_text'),
    termsVersion: integer('terms_version').notNull().default(1),
    status: text('status').notNull().default('DRAFT'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('courses_status_check', inList(t.status, COURSE_STATUSES)),
    check('courses_plan_check', sql`${t.plan} IN ('ANNUAL', 'TERM')`),
    check('courses_price_check', sql`${t.priceDzd} >= 0`),
    check('courses_digital_price_check', sql`${t.digitalPriceDzd} IS NULL OR ${t.digitalPriceDzd} >= 50`),
    uniqueIndex('courses_group_unique').on(t.groupId),
    index('courses_status_idx').on(t.status, t.season)
  ]
)

/** شراء هذا المنتج (الكتاب) يمنح هذه الدورة */
export const courseProducts = pgTable(
  'course_products',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('course_products_unique').on(t.courseId, t.productId), index('course_products_product_idx').on(t.productId)]
)

/** الدورات المسندة لرافع المحتوى (CONTENT_UPLOADER): لا يرى ولا يعدّل غيرها — 1 نوفمبر 2026 */
export const courseStaff = pgTable(
  'course_staff',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('course_staff_unique').on(t.courseId, t.userId), index('course_staff_user_idx').on(t.userId)]
)

export const courseEnrollments = pgTable(
  'course_enrollments',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    source: text('source').notNull().default('MANUAL'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    activatedAt: timestamp('activated_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    acceptedTermsAt: timestamp('accepted_terms_at', { withTimezone: true }),
    acceptedTermsVersion: integer('accepted_terms_version'),
    status: text('status').notNull().default('ACTIVE'),
    revokedReason: text('revoked_reason'),
    activatedByUserId: uuid('activated_by_user_id').references(() => users.id),
    ...timestamps
  },
  (t) => [
    check('course_enrollments_source_check', inList(t.source, ENROLLMENT_SOURCES)),
    check('course_enrollments_status_check', inList(t.status, COURSE_ENROLLMENT_STATUSES)),
    uniqueIndex('course_enrollments_unique').on(t.courseId, t.studentId),
    index('course_enrollments_student_idx').on(t.studentId, t.status),
    index('course_enrollments_expiry_idx').on(t.status, t.expiresAt)
  ]
)

/**
 * رابط مطالبة: حين يشتري وليّ الأمر الكتاب بحسابه (أو بلا حساب تلميذ)، يُرسَل رمز بالـSMS
 * يربط الدورة بحساب التلميذ عند أول دخول. لا تفعيل على حساب الولي أبداً.
 */
/**
 * أكواد تفعيل الدورة (قرار المالك 2026-10-24): المشرف يولّد دفعة ويختار الدورة الموجّهة لها؛
 * كل كود يفتح تلك الدورة وحدها، مرة واحدة، لأول تلميذ يُدخله. لا يُخزَّن إلا hash الكود وبادئته.
 */
export const courseCodes = pgTable(
  'course_codes',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').notNull(),
    batchLabel: text('batch_label'),
    codeHash: text('code_hash').notNull().unique(),
    codePrefix: text('code_prefix').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usedByStudentId: uuid('used_by_student_id').references(() => students.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    /** كود وُلِّد في نقطة بيع لحظة بيع باقة (0040): النقطة، والكود مختومًا ليُعاد عرضه لها، والسعر والعمولة وقت البيع */
    posId: uuid('pos_id').references(() => pointsOfSale.id, { onDelete: 'restrict' }),
    codeSealed: text('code_sealed'),
    salePriceDzd: integer('sale_price_dzd'),
    commissionDzd: integer('commission_dzd'),
    /** ألغته نقطة البيع قبل استعماله (خلال 48 ساعة): الباقة تعود إلى عدّادها */
    cancelledAt: timestamp('cancelled_at', { withTimezone: true })
  },
  (t) => [check('course_codes_status_check', sql`${t.status} IN ('ACTIVE', 'USED', 'DISABLED')`), index('course_codes_course_idx').on(t.courseId, t.batchId), index('course_codes_pos_idx').on(t.posId, t.createdAt)]
)

/**
 * نقاط البيع (قرار المالك 2026-11-02): مدارس ومكتبات شريكة تستلم باقات (كتب + دورة) وتولّد كود التفعيل
 * لحظة بيع كل باقة. عمولتها مبلغ ثابت عن كل باقة، والباقي تسدّده للمنصة.
 */
export const pointsOfSale = pgTable(
  'points_of_sale',
  {
    id: id(),
    name: text('name').notNull(),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id, { onDelete: 'set null' }),
    address: text('address'),
    /** هاتف النقطة الظاهر للتلاميذ في صفحة «نقاط البيع» */
    phone: text('phone'),
    commissionDzd: integer('commission_dzd').notNull().default(1000),
    /** تنبيه المشرف حين يبلغ المتبقي هذا العدد */
    lowStockAlert: integer('low_stock_alert').notNull().default(5),
    status: text('status').notNull().default('ACTIVE'),
    /** تظهر في صفحة «نقاط البيع» العامة */
    listed: boolean('listed').notNull().default(true),
    note: text('note'),
    ...timestamps
  },
  (t) => [
    check('points_of_sale_status_check', inList(t.status, POS_STATUSES)),
    check('points_of_sale_commission_check', sql`${t.commissionDzd} >= 0`),
    check('points_of_sale_low_stock_check', sql`${t.lowStockAlert} >= 0`)
  ]
)

/** حسابات نقطة البيع (صاحبها وموظفوها): حساب واحد لنقطة واحدة */
export const posMembers = pgTable(
  'pos_members',
  {
    id: id(),
    posId: uuid('pos_id')
      .notNull()
      .references(() => pointsOfSale.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('pos_members_user_unique').on(t.userId), index('pos_members_pos_idx').on(t.posId)]
)

/** حركات مخزون الباقات: + إرسال باقات، − استرجاع ما لم يُبع. المتبقي = المجموع − الأكواد المولَّدة غير الملغاة */
export const posStockMoves = pgTable(
  'pos_stock_moves',
  {
    id: id(),
    posId: uuid('pos_id')
      .notNull()
      .references(() => pointsOfSale.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    qty: integer('qty').notNull(),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('pos_stock_moves_qty_check', sql`${t.qty} <> 0`), index('pos_stock_moves_pos_idx').on(t.posId, t.courseId)]
)

/** ما سدّدته نقطة البيع للمنصة */
export const posPayments = pgTable(
  'pos_payments',
  {
    id: id(),
    posId: uuid('pos_id')
      .notNull()
      .references(() => pointsOfSale.id, { onDelete: 'cascade' }),
    amountDzd: integer('amount_dzd').notNull(),
    note: text('note'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('pos_payments_amount_check', sql`${t.amountDzd} > 0`), index('pos_payments_pos_idx').on(t.posId, t.createdAt)]
)

export const courseClaims = pgTable(
  'course_claims',
  {
    id: id(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    phone: text('phone').notNull(),
    codeHash: text('code_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedByStudentId: uuid('claimed_by_student_id').references(() => students.id),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('course_claims_order_idx').on(t.orderId), index('course_claims_phone_idx').on(t.phone, t.claimedAt)]
)

export const liveSessions = pgTable(
  'live_sessions',
  {
    id: id(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    durationMinutes: integer('duration_minutes').notNull().default(90),
    provider: text('provider').notNull().default('ZOOM'),
    /** رابط الانضمام مختوماً (secret-box) — لا يُعرض إلا للمشترك النشط وقت الحصة */
    joinUrlSealed: text('join_url_sealed'),
    providerMeetingId: text('provider_meeting_id'),
    /** التسجيل بعد الحصة: محتوى فيديو داخل الدورة */
    recordingContentId: uuid('recording_content_id').references(() => content.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('SCHEDULED'),
    reminderSentAt: timestamp('reminder_sent_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('live_sessions_provider_check', inList(t.provider, LIVE_PROVIDERS)),
    check('live_sessions_status_check', inList(t.status, LIVE_SESSION_STATUSES)),
    index('live_sessions_course_idx').on(t.courseId, t.startsAt),
    index('live_sessions_upcoming_idx').on(t.status, t.startsAt)
  ]
)

/** رموز التحقق بالهاتف: عند التسجيل وعند تأكيد الطلب. لا يُخزَّن الرمز إلا hash. */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    phone: text('phone').notNull(),
    purpose: text('purpose').notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    /** معرّف تحدّي OTP لدى البوابة (SuiviSMS) حين تولّد هي الرمز؛ null حين نولّده نحن */
    providerRef: text('provider_ref'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    attempts: integer('attempts').notNull().default(0),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('otp_codes_purpose_check', inList(t.purpose, OTP_PURPOSES)), index('otp_codes_phone_idx').on(t.phone, t.purpose, t.createdAt)]
)

/** أحداث شركة التوصيل (webhook) — المفتاح الخارجي فريد لإزالة التكرار؛ لا يُحذف شيء */
export const deliveryEvents = pgTable(
  'delivery_events',
  {
    id: id(),
    provider: text('provider').notNull(),
    externalId: text('external_id').notNull(),
    trackingId: text('tracking_id'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    status: text('status').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    error: text('error')
  },
  (t) => [
    check('delivery_events_status_check', inList(t.status, DELIVERY_EVENT_STATUSES)),
    uniqueIndex('delivery_events_external_unique').on(t.provider, t.externalId),
    index('delivery_events_order_idx').on(t.orderId, t.receivedAt)
  ]
)

export const supportTickets = pgTable(
  'support_tickets',
  {
    id: id(),
    number: serial('number').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    courseId: uuid('course_id').references(() => courses.id, { onDelete: 'set null' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    kind: text('kind').notNull().default('OTHER'),
    subject: text('subject').notNull(),
    status: text('status').notNull().default('OPEN'),
    /** شكوى عن أستاذ أو مسألة حساسة: لا يراها إلا SUPER_ADMIN */
    isSensitive: boolean('is_sensitive').notNull().default(false),
    assignedToUserId: uuid('assigned_to_user_id').references(() => users.id, { onDelete: 'set null' }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('support_tickets_kind_check', inList(t.kind, SUPPORT_KINDS)),
    check('support_tickets_status_check', inList(t.status, SUPPORT_STATUSES)),
    uniqueIndex('support_tickets_number_unique').on(t.number),
    index('support_tickets_user_idx').on(t.userId, t.lastMessageAt),
    index('support_tickets_status_idx').on(t.status, t.lastMessageAt)
  ]
)

export const supportMessages = pgTable(
  'support_messages',
  {
    id: id(),
    ticketId: uuid('ticket_id')
      .notNull()
      .references(() => supportTickets.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    /** ملاحظة داخلية بين موظفي الدعم لا يراها صاحب التذكرة */
    isInternal: boolean('is_internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('support_messages_ticket_idx').on(t.ticketId, t.createdAt)]
)

export type CourseRow = typeof courses.$inferSelect
export type CourseEnrollmentRow = typeof courseEnrollments.$inferSelect
export type LiveSessionRow = typeof liveSessions.$inferSelect
export type SupportTicketRow = typeof supportTickets.$inferSelect
