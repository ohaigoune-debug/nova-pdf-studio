import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList } from './_common'
import { users } from './auth'
import { FEEDBACK_KINDS, FEEDBACK_STATUSES } from './enums'
import { exams } from './exams'
import { teacherWorkspaces } from './tenancy'

/**
 * تعليقات الأساتذة في مرحلة Beta على محرّك الامتحانات: خلل، اقتراح، أو تقييم من 5.
 * يحترم الخصوصية: لا يُخزَّن إلا معرّف المستخدم (قابل للفكّ) والرسالة والصفحة؛ لا بريد ولا جهاز.
 */
export const examFeedback = pgTable(
  'exam_feedback',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    examId: uuid('exam_id').references(() => exams.id, { onDelete: 'set null' }),
    kind: text('kind').notNull().default('SUGGESTION'),
    rating: integer('rating'),
    message: text('message').notNull(),
    page: text('page'),
    status: text('status').notNull().default('NEW'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('exam_feedback_kind_check', inList(t.kind, FEEDBACK_KINDS)), check('exam_feedback_status_check', inList(t.status, FEEDBACK_STATUSES)), check('exam_feedback_rating_check', sql`${t.rating} IS NULL OR ${t.rating} BETWEEN 1 AND 5`), index('exam_feedback_status_idx').on(t.status, t.createdAt)]
)

export type ExamFeedbackRow = typeof examFeedback.$inferSelect
