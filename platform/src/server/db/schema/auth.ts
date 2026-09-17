import { check, index, inet, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { USER_ROLES, USER_STATUSES } from './enums'

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text('email').notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: text('role').notNull().default('PUBLIC'),
    status: text('status').notNull().default('ACTIVE'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('users_role_check', inList(t.role, USER_ROLES)),
    check('users_status_check', inList(t.status, USER_STATUSES)),
    index('users_role_idx').on(t.role)
  ]
)

export const profiles = pgTable('profiles', {
  id: id(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: 'cascade' }),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('ar'),
  theme: text('theme').notNull().default('system'),
  ...timestamps
})

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    deviceName: text('device_name'),
    userAgent: text('user_agent'),
    ip: inet('ip'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [index('sessions_user_idx').on(t.userId), index('sessions_expires_idx').on(t.expiresAt)]
)

export const passwordResets = pgTable(
  'password_resets',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [index('password_resets_user_idx').on(t.userId)]
)
