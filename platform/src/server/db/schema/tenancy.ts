import { check, index, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { WORKSPACE_STATUSES } from './enums'

export const teacherWorkspaces = pgTable(
  'teacher_workspaces',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    plan: text('plan').notNull().default('FREE'),
    status: text('status').notNull().default('ACTIVE'),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (t) => [check('workspaces_status_check', inList(t.status, WORKSPACE_STATUSES))]
)

export const teachers = pgTable(
  'teachers',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    subject: text('subject').notNull().default('اللغة العربية وآدابها'),
    bio: text('bio'),
    ...timestamps
  },
  (t) => [index('teachers_workspace_idx').on(t.workspaceId)]
)

