import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { classComments } from './classroom'
import { files } from './content'
import { teacherWorkspaces } from './tenancy'

/** أجر «الأستاذ المساعد» (قرار المالك 23 نوفمبر 2026). الإعدادات في settings بالمفتاح assistant.pay */

export const ASSISTANT_CONTENT_KINDS = ['SUMMARY', 'EXERCISES', 'EXAM', 'PROPOSAL'] as const

/** محتوى يرفعه المساعد (ملخّص، تمارين، اختبار، موضوع مقترح): يُحسب بالصّفحة فور رفعه ما لم يحذفه المشرف */
export const assistantContent = pgTable(
  'assistant_content',
  {
    id: id(),
    assistantUserId: uuid('assistant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, {
      onDelete: 'set null'
    }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    /** عدد الصّفحات كما صرّح به المساعد */
    pages: integer('pages').notNull(),
    fileId: uuid('file_id')
      .notNull()
      .references(() => files.id),
    note: text('note'),
    /** حذفه المشرف ⇒ لا يُحسب */
    removedAt: timestamp('removed_at', { withTimezone: true }),
    removedByUserId: uuid('removed_by_user_id').references(() => users.id),
    ...timestamps
  },
  (t) => [
    check('assistant_content_kind_check', inList(t.kind, ASSISTANT_CONTENT_KINDS)),
    check('assistant_content_pages_check', sql`${t.pages} > 0 AND ${t.pages} <= 500`),
    index('assistant_content_user_created_idx').on(t.assistantUserId, t.createdAt)
  ]
)

/** ردّ وسمه المساعد «تصحيح تعبير» (أعلى ثمنًا) */
export const assistantReplyMarks = pgTable(
  'assistant_reply_marks',
  {
    commentId: uuid('comment_id')
      .notNull()
      .references(() => classComments.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('CORRECTION'),
    markedByUserId: uuid('marked_by_user_id').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.commentId] }), check('assistant_reply_marks_kind_check', inList(t.kind, ['CORRECTION'] as const))]
)

/** الكشف الشّهريّ المدفوع: صورة الحساب يوم الدّفع، ومن دفع ومتى */
export const assistantPayouts = pgTable(
  'assistant_payouts',
  {
    id: id(),
    assistantUserId: uuid('assistant_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    month: text('month').notNull(),
    amount: integer('amount').notNull(),
    breakdown: jsonb('breakdown').$type<unknown>().notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
    paidByUserId: uuid('paid_by_user_id').references(() => users.id),
    ...timestamps
  },
  (t) => [uniqueIndex('assistant_payouts_user_month_unique').on(t.assistantUserId, t.month)]
)
