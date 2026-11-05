import { boolean, check, index, inet, integer, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core'
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
  /** تحقق OTP من الهاتف */
  phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
  avatarUrl: text('avatar_url'),
  locale: text('locale').notNull().default('ar'),
  theme: text('theme').notNull().default('system'),
  ...timestamps
})

/** نافذة ثابتة للحدّ من المحاولات: المفتاح = المسار + IP أو المستخدم */
export const rateLimits = pgTable(
  'rate_limits',
  {
    key: text('key').primaryKey(),
    windowStart: timestamp('window_start', { withTimezone: true }).notNull(),
    count: integer('count').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('rate_limits_window_idx').on(t.windowStart)]
)

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
    requestedIp: text('requested_ip'),
    ...timestamps
  },
  (t) => [index('password_resets_user_idx').on(t.userId), index('password_resets_expires_idx').on(t.expiresAt)]
)

/** مزوّدو الدخول الخارجي (5 نوفمبر 2026): Google وApple (iCloud) */
export const OAUTH_PROVIDERS = ['GOOGLE', 'APPLE'] as const
export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number]

/**
 * ربط حساب بهوية Google أو Apple: المعرّف الثابت (sub) لا البريد، لأن Apple قد يعطي بريدًا وسيطًا
 * ولأن بريد الحساب قد يتغيّر. refreshToken لـ Apple وحده: يُلغى به الإذن عند حذف الحساب (شرط Apple).
 */
export const oauthIdentities = pgTable(
  'oauth_identities',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    refreshToken: text('refresh_token'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('oauth_identities_provider_check', inList(t.provider, OAUTH_PROVIDERS)),
    unique('oauth_identities_provider_subject_unique').on(t.provider, t.subject),
    index('oauth_identities_user_idx').on(t.userId)
  ]
)

/**
 * تذاكر قصيرة العمر بعد التحقق من هوية خارجية (يُخزَّن تجزيء الرمز فقط):
 *  - SIGNUP: هوية جديدة تنتظر إكمال الحساب (الهاتف والولي والمستوى والشعبة والولاية) — 30 دقيقة.
 *  - LOGIN: تسليم الدخول من المتصفح إلى تطبيق الآيفون (Google) — دقيقتان، مرة واحدة.
 */
export const oauthTickets = pgTable(
  'oauth_tickets',
  {
    id: id(),
    tokenHash: text('token_hash').notNull().unique(),
    kind: text('kind').notNull(),
    provider: text('provider').notNull(),
    subject: text('subject').notNull(),
    email: text('email'),
    emailVerified: boolean('email_verified').notNull().default(false),
    fullName: text('full_name'),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('oauth_tickets_kind_check', inList(t.kind, ['SIGNUP', 'LOGIN'])),
    check('oauth_tickets_provider_check', inList(t.provider, OAUTH_PROVIDERS)),
    index('oauth_tickets_expires_idx').on(t.expiresAt)
  ]
)
