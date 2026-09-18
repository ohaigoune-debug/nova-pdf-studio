import { sql } from 'drizzle-orm'
import { check, index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { ASSISTANT_STATUSES, CODE_STATUSES } from './enums'
import { teacherWorkspaces, teachers } from './tenancy'

/**
 * كود دعوة مساعد: يولّده الأستاذ لبريد محدّد، ويُستعمل مرة واحدة.
 * يُحفظ الـhash والبادئة فقط (كما في أكواد التسجيل).
 */
export const assistantCodes = pgTable(
  'assistant_codes',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    /** بريد المساعد (lowercase) — الكود لا يعمل إلا مع هذا البريد */
    email: text('email').notNull(),
    codeHash: text('code_hash').notNull().unique(),
    codePrefix: text('code_prefix').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    usedByUserId: uuid('used_by_user_id').references(() => users.id),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('assistant_codes_status_check', inList(t.status, CODE_STATUSES)),
    index('assistant_codes_workspace_status_idx').on(t.workspaceId, t.status),
    index('assistant_codes_email_idx').on(t.email)
  ]
)

/** عضوية مساعد الأستاذ: مستخدم بدور ASSISTANT مرتبط بمساحة أستاذ واحد (نشطة واحدة في كل وقت). */
export const teacherAssistants = pgTable(
  'teacher_assistants',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('ACTIVE'),
    joinedViaCodeId: uuid('joined_via_code_id').references(() => assistantCodes.id, { onDelete: 'set null' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedByUserId: uuid('revoked_by_user_id').references(() => users.id),
    ...timestamps
  },
  (t) => [
    check('teacher_assistants_status_check', inList(t.status, ASSISTANT_STATUSES)),
    uniqueIndex('teacher_assistants_active_user_unique').on(t.userId).where(sql`${t.status} = 'ACTIVE'`),
    index('teacher_assistants_workspace_idx').on(t.workspaceId, t.status),
    index('teacher_assistants_user_idx').on(t.userId)
  ]
)
