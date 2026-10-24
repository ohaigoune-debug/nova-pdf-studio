import { check, index, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { id } from './_common'
import { quizzes } from './assessment'
import { users } from './auth'
import { content } from './content'

/**
 * ما تحت فيديو الحصة (قرار المالك 2026-10-24): اختبار QCM مرتبط، وتعليقات لا تظهر إلا بموافقة الأستاذ.
 */

/** اختبار QCM واحد لكل حصة/درس */
export const lessonQuizzes = pgTable(
  'lesson_quizzes',
  {
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [primaryKey({ columns: [t.contentId] })]
)

export const COMMENT_STATUSES = ['PENDING', 'APPROVED', 'REJECTED'] as const
export type CommentStatus = (typeof COMMENT_STATUSES)[number]

/** تعليق تلميذ تحت الحصة: PENDING حتى يوافق الأستاذ؛ المرفوض لا يظهر لأحد غير صاحبه */
export const lessonComments = pgTable(
  'lesson_comments',
  {
    id: id(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    status: text('status').notNull().default('PENDING'),
    /** ردّ الأستاذ (اختياري) يظهر تحت التعليق */
    reply: text('reply'),
    moderatedByUserId: uuid('moderated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('lesson_comments_status_check', sql`${t.status} IN ('PENDING', 'APPROVED', 'REJECTED')`), index('lesson_comments_content_idx').on(t.contentId, t.status, t.createdAt)]
)
