import { bigint, check, index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { CONTENT_TYPES, VISIBILITIES } from './enums'
import { groups } from './groups'
import { levels, streams } from './reference'
import { students } from './students'
import { teacherWorkspaces } from './tenancy'

export const files = pgTable(
  'files',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id),
    bucket: text('bucket').notNull().default('private'),
    storageKey: text('storage_key').notNull().unique(),
    originalName: text('original_name').notNull(),
    mimeType: text('mime_type').notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    checksum: text('checksum'),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('files_workspace_idx').on(t.workspaceId), index('files_owner_idx').on(t.ownerUserId)]
)

export const skills = pgTable('skills', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  category: text('category').notNull().default('GENERAL'),
  description: text('description'),
  ...timestamps
})

export const content = pgTable(
  'content',
  {
    id: id(),
    /** NULL = محتوى عام تديره المنصة */
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    type: text('type').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    body: text('body'),
    fileId: uuid('file_id').references(() => files.id),
    externalUrl: text('external_url'),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    topic: text('topic'),
    skillId: uuid('skill_id').references(() => skills.id),
    visibility: text('visibility').notNull().default('PUBLIC'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('content_type_check', inList(t.type, CONTENT_TYPES)),
    check('content_visibility_check', inList(t.visibility, VISIBILITIES)),
    index('content_workspace_idx').on(t.workspaceId),
    index('content_public_idx').on(t.visibility, t.publishedAt),
    index('content_level_idx').on(t.levelId, t.type)
  ]
)

export const contentTargets = pgTable(
  'content_targets',
  {
    id: id(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [index('content_targets_content_idx').on(t.contentId)]
)
