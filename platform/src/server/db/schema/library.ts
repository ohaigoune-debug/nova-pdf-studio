import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { content, files } from './content'
import { curriculumNodes, curriculumVersions } from './curriculum'
import { ACCESS_LEVELS, CONTENT_SOURCE_TYPES, EXAM_SESSIONS, RESOURCE_STATUSES, RESOURCE_TYPES } from './enums'
import { groups } from './groups'
import { educationStages, levels, streams, subjects } from './reference'
import { teacherWorkspaces } from './tenancy'

/** مصادر المحتوى — تُذكر دائماً للمستخدم («المصدر: DzExams») ولا تُخفى */
export const contentSources = pgTable(
  'content_sources',
  {
    id: id(),
    type: text('type').notNull(),
    /** مفتاح ثابت للشيفرة: dzexams، youtube، haigoun، madrasadz، onec */
    code: text('code').notNull().unique(),
    name: text('name').notNull(),
    baseUrl: text('base_url'),
    /** نصّ الإسناد الظاهر تحت كل مورد */
    attribution: text('attribution').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps
  },
  (t) => [check('content_sources_type_check', inList(t.type, CONTENT_SOURCE_TYPES))]
)

/**
 * النموذج الموحّد: كل مورد تعليمي (درس، ملخّص، تمرين، فرض، اختبار، امتحان رسمي، حلّ، فيديو…)
 * مصنّف بمعرّفات المنهاج لا بنصوص، مع مصدره وحالته وصدقيته ومستوى الوصول إليه.
 */
export const resources = pgTable(
  'resources',
  {
    id: id(),
    title: text('title').notNull(),
    description: text('description'),
    type: text('type').notNull(),
    // ── التصنيف
    stageId: uuid('stage_id').references(() => educationStages.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    subjectId: uuid('subject_id').references(() => subjects.id),
    /** أدقّ عقدة منهاج معروفة (وحدة أو درس أو موضوع) */
    curriculumNodeId: uuid('curriculum_node_id').references(() => curriculumNodes.id),
    curriculumVersionId: uuid('curriculum_version_id').references(() => curriculumVersions.id),
    schoolTerm: integer('school_term'),
    /** السنة الدراسية التي يبدأ بها الموسم (2025 = 2025/2026) */
    academicYear: integer('academic_year'),
    examYear: integer('exam_year'),
    examSession: text('exam_session'),
    /** 1 سهل … 5 صعب */
    difficulty: integer('difficulty'),
    language: text('language').notNull().default('ar'),
    // ── المصدر
    sourceId: uuid('source_id')
      .notNull()
      .references(() => contentSources.id),
    sourceUrl: text('source_url'),
    /** معرّف المورد عند مصدره (رابط الصفحة، معرّف الفيديو…) */
    sourceRef: text('source_ref'),
    originalAuthor: text('original_author'),
    // ── الوسائط
    fileId: uuid('file_id').references(() => files.id),
    fileUrl: text('file_url'),
    thumbnailUrl: text('thumbnail_url'),
    youtubeVideoId: text('youtube_video_id'),
    youtubeChannelId: text('youtube_channel_id'),
    // ── الحلّ
    hasSolution: boolean('has_solution').notNull().default(false),
    solutionResourceId: uuid('solution_resource_id').references((): AnyPgColumn => resources.id, { onDelete: 'set null' }),
    // ── الصدقية: الرسمي لا يكون مولّداً أبداً (قيد في القاعدة)
    isOfficial: boolean('is_official').notNull().default(false),
    isAiGenerated: boolean('is_ai_generated').notNull().default(false),
    // ── الوصول
    accessLevel: text('access_level').notNull().default('PUBLIC'),
    /** مورد أكاديمية أستاذ (HAIGOUN…) */
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    /** ربط بدرس الأكاديمية القائم إن كان المورد منشوراً منه */
    contentId: uuid('content_id').references(() => content.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('PUBLISHED'),
    // ── منع التكرار: البصمة فريدة (المصدر + المرجع أو الرابط)، وبصمة المحتوى لاكتشاف النسخ عبر المصادر
    fingerprint: text('fingerprint').notNull().unique(),
    contentHash: text('content_hash'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('resources_type_check', inList(t.type, RESOURCE_TYPES)),
    check('resources_status_check', inList(t.status, RESOURCE_STATUSES)),
    check('resources_access_check', inList(t.accessLevel, ACCESS_LEVELS)),
    check('resources_session_check', sql`${t.examSession} IS NULL OR ${inList(t.examSession, EXAM_SESSIONS)}`),
    check('resources_official_not_ai', sql`NOT (${t.isOfficial} AND ${t.isAiGenerated})`),
    check('resources_difficulty_check', sql`${t.difficulty} IS NULL OR ${t.difficulty} BETWEEN 1 AND 5`),
    check('resources_term_check', sql`${t.schoolTerm} IS NULL OR ${t.schoolTerm} BETWEEN 1 AND 3`),
    // الفلترة الأساسية في المكتبة ومراكز المواد: مادة ← صف ← شعبة ← نوع، للمنشور فقط
    index('resources_browse_idx').on(t.subjectId, t.levelId, t.streamId, t.type, t.status),
    index('resources_exam_idx').on(t.type, t.examYear),
    index('resources_node_idx').on(t.curriculumNodeId),
    index('resources_source_idx').on(t.sourceId, t.createdAt),
    index('resources_status_idx').on(t.status, t.updatedAt),
    index('resources_content_hash_idx').on(t.contentHash),
    index('resources_workspace_idx').on(t.workspaceId)
  ]
)

/** قصر مورد (access_level = GROUP) على أفواج بعينها */
export const resourceGroups = pgTable(
  'resource_groups',
  {
    id: id(),
    resourceId: uuid('resource_id')
      .notNull()
      .references(() => resources.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [uniqueIndex('resource_groups_unique').on(t.resourceId, t.groupId), index('resource_groups_group_idx').on(t.groupId)]
)

export type ResourceRow = typeof resources.$inferSelect
export type ResourceInsert = typeof resources.$inferInsert
