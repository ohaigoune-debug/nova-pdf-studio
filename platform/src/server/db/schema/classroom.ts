import { boolean, index, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { groups } from './groups'
import { teacherWorkspaces } from './tenancy'

/** رسالة الأستاذ إلى تلاميذه (الكل أو أفواج محدّدة) — تصل إشعاراً، ويبقى سجلّها هنا */
export const announcements = pgTable(
  'announcements',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    body: text('body').notNull(),
    link: text('link'),
    /** فارغة ⇒ كل تلاميذ الأستاذ */
    groupIds: jsonb('group_ids').$type<string[]>().notNull().default([]),
    recipients: integer('recipients').notNull().default(0),
    ...timestamps
  },
  (t) => [index('announcements_workspace_idx').on(t.workspaceId, t.createdAt)]
)

/** منشور في القسم الافتراضي لفوج (أو لكل أفواج الأستاذ إن كان group_id فارغاً) */
export const classPosts = pgTable(
  'class_posts',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    linkUrl: text('link_url'),
    fileId: uuid('file_id').references(() => files.id),
    pinned: boolean('pinned').notNull().default(false),
    allowComments: boolean('allow_comments').notNull().default(true),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('class_posts_workspace_idx').on(t.workspaceId, t.createdAt), index('class_posts_group_idx').on(t.groupId, t.createdAt)]
)

/** تعليق تلميذ (أو الأستاذ) على منشور */
export const classComments = pgTable(
  'class_comments',
  {
    id: id(),
    postId: uuid('post_id')
      .notNull()
      .references(() => classPosts.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('class_comments_post_idx').on(t.postId, t.createdAt)]
)
