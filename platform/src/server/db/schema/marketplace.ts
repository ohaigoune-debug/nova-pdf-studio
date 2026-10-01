import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { LISTING_KINDS, LISTING_STATUSES, PAYOUT_STATUSES } from './enums'
import { exams } from './exams'
import { levels, streams, subjects } from './reference'
import { orders, products } from './store'
import { teacherWorkspaces } from './tenancy'

/**
 * سوق الأساتذة (المرحلة 11): الأستاذ يعرض امتحاناً أو مجموعة تمارين أو ملخّصاً أو حزمة أسئلة من بنكه،
 * مجاناً أو بثمن؛ المشرف يراجع ثم يُنشر كمنتج في المتجر. الشراء عبر طلبات المتجر نفسها،
 * والتسليم: نسخة في مساحة المشتري (امتحان/أسئلة) أو تنزيل (ملف). الحقوق مؤكَّدة عند النشر.
 */
export const listings = pgTable(
  'listings',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    teacherUserId: uuid('teacher_user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    priceDzd: integer('price_dzd').notNull().default(0),
    status: text('status').notNull().default('DRAFT'),
    reviewNote: text('review_note'),
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    /** المصدر حسب النوع */
    examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    questionIds: jsonb('question_ids').$type<string[]>().notNull().default([]),
    /** المنتج المقابل في المتجر بعد النشر */
    productId: uuid('product_id').references(() => products.id, { onDelete: 'set null' }),
    /** المشتري يجب أن يكون أستاذاً (نسخة في مساحته) */
    teachersOnly: boolean('teachers_only').notNull().default(false),
    rightsConfirmed: boolean('rights_confirmed').notNull().default(false),
    /** نصيب الأستاذ % وقت النشر */
    teacherSharePct: integer('teacher_share_pct').notNull().default(70),
    salesCount: integer('sales_count').notNull().default(0),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('listings_kind_check', inList(t.kind, LISTING_KINDS)),
    check('listings_status_check', inList(t.status, LISTING_STATUSES)),
    check('listings_price_check', sql`${t.priceDzd} >= 0`),
    check('listings_share_check', sql`${t.teacherSharePct} BETWEEN 0 AND 100`),
    index('listings_workspace_idx').on(t.workspaceId, t.status),
    index('listings_status_idx').on(t.status, t.submittedAt)
  ]
)

/** شراء مُنح: من اشترى ماذا، وبأي ثمن، ونصيب كل طرف */
export const listingPurchases = pgTable(
  'listing_purchases',
  {
    id: id(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => listings.id, { onDelete: 'cascade' }),
    buyerUserId: uuid('buyer_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    priceDzd: integer('price_dzd').notNull().default(0),
    teacherShareDzd: integer('teacher_share_dzd').notNull().default(0),
    platformShareDzd: integer('platform_share_dzd').notNull().default(0),
    /** ما سُلّم للمشتري: معرّف الامتحان المنسوخ أو عدد الأسئلة المنسوخة */
    delivered: jsonb('delivered').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('listing_purchases_unique').on(t.listingId, t.buyerUserId), index('listing_purchases_buyer_idx').on(t.buyerUserId), index('listing_purchases_listing_idx').on(t.listingId, t.createdAt)]
)

/** دفعات الأساتذة (يسجّلها المشرف بعد التحويل) */
export const teacherPayouts = pgTable(
  'teacher_payouts',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    amountDzd: integer('amount_dzd').notNull(),
    periodStart: timestamp('period_start', { withTimezone: true }),
    periodEnd: timestamp('period_end', { withTimezone: true }),
    status: text('status').notNull().default('PENDING'),
    note: text('note'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('teacher_payouts_status_check', inList(t.status, PAYOUT_STATUSES)), check('teacher_payouts_amount_check', sql`${t.amountDzd} >= 0`), index('teacher_payouts_workspace_idx').on(t.workspaceId, t.createdAt)]
)

export type ListingRow = typeof listings.$inferSelect
export type ListingPurchaseRow = typeof listingPurchases.$inferSelect
export type TeacherPayoutRow = typeof teacherPayouts.$inferSelect
