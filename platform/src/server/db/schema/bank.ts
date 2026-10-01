import { sql } from 'drizzle-orm'
import { check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { curriculumNodes } from './curriculum'
import { BANK_EXAM_KINDS, BANK_KINDS, BANK_QUESTION_TYPES, BANK_STATUSES, BANK_VISIBILITIES, RIGHTS_STATUSES } from './enums'
import { contentSources, resources } from './library'
import { levels, streams, subjects } from './reference'
import { teacherWorkspaces } from './tenancy'

export interface BankOption {
  label: string
  isCorrect: boolean
}

/** بند في سلّم التنقيط: «الفهم 2ن»، «المنهجية 1ن»… */
export interface BaremeItem {
  label: string
  points: number
}

export interface BankAttachment {
  fileId: string
  caption?: string
}

/**
 * بنك الأسئلة المركزي والشخصي — الوحدة القابلة لإعادة الاستعمال في كل امتحان.
 * السؤال يحمل تصنيفه الكامل بمعرّفات (مادة/صف/شعبة/عقدة منهاج)، صعوبته ومدته ونقاطه،
 * مصدره وحقوقه، وحلّه وسلّمه. `workspace_id` فارغ = بنك Madrasadz المركزي.
 * `parent_id`: أسئلة فرعية تحت تمرين أو نصّ (PASSAGE ← أسئلته).
 */
export const bankQuestions = pgTable(
  'bank_questions',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id').references(() => users.id, { onDelete: 'set null' }),
    parentId: uuid('parent_id').references((): AnyPgColumn => bankQuestions.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull().default('QUESTION'),
    type: text('type').notNull().default('OPEN'),
    title: text('title'),
    /** Markdown؛ المعادلات بين $…$ */
    body: text('body').notNull(),
    options: jsonb('options').$type<BankOption[]>().notNull().default([]),
    /** نفس مفاتيح quiz-grading (TRUE_FALSE/SHORT_ANSWER/FILL_BLANK/MATCHING) ليصلح السؤال للاختبار الإلكتروني أيضاً */
    answerKey: jsonb('answer_key').$type<Record<string, unknown>>(),
    /** الحلّ النموذجي (Markdown) */
    solution: text('solution'),
    bareme: jsonb('bareme').$type<BaremeItem[]>().notNull().default([]),
    points: numeric('points', { precision: 6, scale: 2 }).notNull().default('1'),
    /** 1 سهل · 2 متوسط · 3 صعب · 4 صعب جداً */
    difficulty: integer('difficulty').notNull().default(2),
    estimatedMinutes: integer('estimated_minutes'),
    // ── التصنيف
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    curriculumNodeId: uuid('curriculum_node_id').references(() => curriculumNodes.id, { onDelete: 'set null' }),
    schoolTerm: integer('school_term'),
    examKind: text('exam_kind'),
    // ── المصدر والحقوق (لا تُمسح أبداً)
    sourceId: uuid('source_id').references(() => contentSources.id),
    sourceResourceId: uuid('source_resource_id').references(() => resources.id, { onDelete: 'set null' }),
    sourceYear: integer('source_year'),
    /** وصف حرّ: «بكالوريا 2024 — شعبة آداب»، «ثانوية X — قسنطينة» */
    sourceLabel: text('source_label'),
    originalFileId: uuid('original_file_id').references(() => files.id, { onDelete: 'set null' }),
    rightsStatus: text('rights_status').notNull().default('OWN'),
    language: text('language').notNull().default('ar'),
    keywords: text('keywords').array().notNull().default([]),
    imageFileId: uuid('image_file_id').references(() => files.id, { onDelete: 'set null' }),
    attachments: jsonb('attachments').$type<BankAttachment[]>().notNull().default([]),
    // ── الرؤية والحالة
    visibility: text('visibility').notNull().default('PRIVATE'),
    status: text('status').notNull().default('DRAFT'),
    /** دفعة استخراج من ملف واحد: تُراجَع معاً */
    importBatchId: uuid('import_batch_id'),
    contentHash: text('content_hash'),
    /** نصّ مطبَّع يُبنى منه عمود البحث `search` (tsvector مولَّد في الهجرة) */
    searchText: text('search_text').notNull().default(''),
    usageCount: integer('usage_count').notNull().default(0),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('bank_questions_kind_check', inList(t.kind, BANK_KINDS)),
    check('bank_questions_type_check', inList(t.type, BANK_QUESTION_TYPES)),
    check('bank_questions_status_check', inList(t.status, BANK_STATUSES)),
    check('bank_questions_visibility_check', inList(t.visibility, BANK_VISIBILITIES)),
    check('bank_questions_rights_check', inList(t.rightsStatus, RIGHTS_STATUSES)),
    check('bank_questions_exam_kind_check', sql`${t.examKind} IS NULL OR ${inList(t.examKind, BANK_EXAM_KINDS)}`),
    check('bank_questions_difficulty_check', sql`${t.difficulty} BETWEEN 1 AND 4`),
    check('bank_questions_term_check', sql`${t.schoolTerm} IS NULL OR ${t.schoolTerm} BETWEEN 1 AND 3`),
    check('bank_questions_points_check', sql`${t.points} > 0`),
    index('bank_questions_browse_idx').on(t.subjectId, t.levelId, t.streamId, t.status),
    index('bank_questions_workspace_idx').on(t.workspaceId, t.status, t.createdAt),
    index('bank_questions_node_idx').on(t.curriculumNodeId),
    index('bank_questions_parent_idx').on(t.parentId, t.sortOrder),
    index('bank_questions_difficulty_idx').on(t.difficulty, t.type),
    index('bank_questions_batch_idx').on(t.importBatchId),
    index('bank_questions_hash_idx').on(t.contentHash)
  ]
)

export const bankFavorites = pgTable(
  'bank_favorites',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => bankQuestions.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [uniqueIndex('bank_favorites_unique').on(t.userId, t.questionId)]
)

export type BankQuestionRow = typeof bankQuestions.$inferSelect
export type BankQuestionInsert = typeof bankQuestions.$inferInsert
