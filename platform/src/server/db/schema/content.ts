import { bigint, boolean, check, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { CONTENT_TYPES, FILE_STATUSES, VISIBILITIES } from './enums'
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
    /** PENDING = تذكرة رفع مباشر لم تكتمل بعد؛ READY = الملف موجود في التخزين */
    status: text('status').notNull().default('READY'),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('files_status_check', inList(t.status, FILE_STATUSES)),
    index('files_workspace_idx').on(t.workspaceId),
    index('files_owner_idx').on(t.ownerUserId)
  ]
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
    /** فيديو: YOUTUBE (مضمّن داخل التطبيق) أو UPLOAD (ملف خاص يُبثّ عبر رابط موقّع بهوية المشاهد) */
    videoProvider: text('video_provider'),
    youtubeId: text('youtube_id'),
    /** PDF: السماح بالتنزيل الخام؛ الافتراضي عرض داخل التطبيق مع ختم مائي باسم الطالب */
    allowDownload: boolean('allow_download').notNull().default(false),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('content_type_check', inList(t.type, CONTENT_TYPES)),
    check('content_visibility_check', inList(t.visibility, VISIBILITIES)),
    check('content_video_provider_check', sql`${t.videoProvider} IS NULL OR ${t.videoProvider} IN ('YOUTUBE', 'UPLOAD')`),
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

/**
 * سجل مشاهدة الوسائط الخاصة (فيديو/PDF): من شاهد ماذا، متى، من أي عنوان/جهاز، وكم ثانية.
 * يُغذّي كشف مشاركة الحساب (عناوين IP متعددة في وقت قصير) وإحصاءات الأستاذ.
 */
export const mediaViews = pgTable(
  'media_views',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
    /** معرّف جهاز/تبويب يولّده المشغّل لكل جلسة مشاهدة */
    viewerKey: text('viewer_key').notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    secondsWatched: integer('seconds_watched').notNull().default(0),
    maxPosition: integer('max_position').notNull().default(0),
    completed: boolean('completed').notNull().default(false)
  },
  (t) => [
    index('media_views_content_user_idx').on(t.contentId, t.userId),
    index('media_views_user_seen_idx').on(t.userId, t.lastSeenAt),
    index('media_views_workspace_idx').on(t.workspaceId, t.lastSeenAt)
  ]
)
