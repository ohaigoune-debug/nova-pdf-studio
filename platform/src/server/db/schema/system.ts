import { check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { JOB_STATUSES, NOTIFICATION_TYPES } from './enums'
import { teacherWorkspaces } from './tenancy'

export const notifications = pgTable(
  'notifications',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body'),
    link: text('link'),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    readAt: timestamp('read_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('notifications_type_check', inList(t.type, NOTIFICATION_TYPES)),
    index('notifications_user_idx').on(t.userId, t.readAt)
  ]
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: id(),
    actorUserId: uuid('actor_user_id').references(() => users.id),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    oldValue: jsonb('old_value').$type<Record<string, unknown> | null>(),
    newValue: jsonb('new_value').$type<Record<string, unknown> | null>(),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_workspace_idx').on(t.workspaceId, t.createdAt),
    index('audit_logs_actor_idx').on(t.actorUserId)
  ]
)

export const activityLogs = pgTable(
  'activity_logs',
  {
    id: id(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'set null' }),
    event: text('event').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('activity_logs_user_idx').on(t.userId, t.createdAt), index('activity_logs_event_idx').on(t.event, t.createdAt)]
)

export const jobs = pgTable(
  'jobs',
  {
    id: id(),
    type: text('type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
    status: text('status').notNull().default('QUEUED'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    result: jsonb('result').$type<Record<string, unknown> | null>(),
    error: text('error'),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [
    check('jobs_status_check', inList(t.status, JOB_STATUSES)),
    index('jobs_status_run_idx').on(t.status, t.runAfter)
  ]
)

export const appSettings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').$type<unknown>().notNull(),
  ...timestamps
})
