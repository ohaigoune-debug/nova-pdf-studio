import { sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex, uuid, check } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { levels, streams } from './reference'
import { students } from './students'

/**
 * طلب تغيير المستوى/الشعبة (قرار المالك 16 نوفمبر 2026): التلميذ لا يغيّر شعبته بنفسه بعد أول اختيار، بل يرسل طلبًا
 * يراجعه عون التأكيد (أو المشرف) ويؤكده أو يرفضه. طلب واحد معلَّق على الأكثر لكل تلميذ.
 * «من» محفوظ وقت الطلب (للمراجعة)، و«إلى» يُطبَّق على الحساب عند القبول فقط.
 */
export const SCOPE_REQUEST_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const
export type ScopeRequestStatus = (typeof SCOPE_REQUEST_STATUSES)[number]

export const scopeChangeRequests = pgTable(
  'scope_change_requests',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    fromLevelId: uuid('from_level_id').references(() => levels.id),
    fromStreamId: uuid('from_stream_id').references(() => streams.id),
    toLevelId: uuid('to_level_id')
      .notNull()
      .references(() => levels.id),
    toStreamId: uuid('to_stream_id').references(() => streams.id),
    reason: text('reason'),
    status: text('status').notNull().default('PENDING'),
    decidedByUserId: uuid('decided_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    ...timestamps
  },
  (t) => [
    check('scope_change_requests_status_check', inList(t.status, SCOPE_REQUEST_STATUSES)),
    uniqueIndex('scope_change_requests_one_pending').on(t.studentId).where(sql`${t.status} = 'PENDING'`),
    index('scope_change_requests_status_idx').on(t.status, t.createdAt)
  ]
)

export type ScopeChangeRequestRow = typeof scopeChangeRequests.$inferSelect
