import { boolean, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { levels, subjects } from './reference'

export const FORUM_THREAD_STATUSES = ['OPEN', 'LOCKED', 'HIDDEN'] as const
export type ForumThreadStatus = (typeof FORUM_THREAD_STATUSES)[number]

/**
 * المنتدى العامّ: نقاش مفتوح لكل التلاميذ (انضمّوا إلى أستاذ بكود أم لا) ولكل الأساتذة.
 * الموضوع يُصنَّف بالمادة والمستوى ليصل إلى من يهمّه؛ الزائر يقرأ، والمسجّل يكتب.
 */
export const forumThreads = pgTable(
  'forum_threads',
  {
    id: id(),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    body: text('body').notNull(),
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    status: text('status').notNull().default('OPEN'),
    pinned: boolean('pinned').notNull().default(false),
    repliesCount: integer('replies_count').notNull().default(0),
    lastPostAt: timestamp('last_post_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
    ...softDelete
  },
  (t) => [check('forum_threads_status_check', inList(t.status, FORUM_THREAD_STATUSES)), index('forum_threads_recent_idx').on(t.pinned, t.lastPostAt), index('forum_threads_scope_idx').on(t.levelId, t.subjectId, t.lastPostAt), index('forum_threads_author_idx').on(t.authorUserId)]
)

export const forumPosts = pgTable(
  'forum_posts',
  {
    id: id(),
    threadId: uuid('thread_id')
      .notNull()
      .references(() => forumThreads.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    /** أخفاه المشرف (يبقى للسجلّ) */
    hidden: boolean('hidden').notNull().default(false),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('forum_posts_thread_idx').on(t.threadId, t.createdAt), index('forum_posts_author_idx').on(t.authorUserId)]
)
