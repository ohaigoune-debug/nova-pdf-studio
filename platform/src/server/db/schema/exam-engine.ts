import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, unique, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { files } from './content'
import { curriculumNodes } from './curriculum'
import { EXAM_DOC_STATUSES, EXAM_DOC_TYPES } from './enums'
import { contentSources, resources } from './library'
import { levels, streams, subjects } from './reference'
import { teacherWorkspaces } from './tenancy'

/**
 * MADRASADZ EXAM ENGINE — سجلّ معالجة الوثائق (بكالوريا، اختبار، فرض…):
 * كل وثيقة في الأرشيف تُحمَّل وتُخزَّن وتُقرأ ثم تُقسَّم تمارين مستقلة في البنك المركزي،
 * مربوطة بها (`bank_questions.document_id`) ليبقى «عرض الامتحان الأصلي» ممكناً دائماً.
 * بيانات المصدر (الموقع، السنة، الدورة، الشعبة، الرابط الأصلي، تاريخ الاستيراد) لا تُمسح.
 */
export const examDocuments = pgTable(
  'exam_documents',
  {
    id: id(),
    /** المورد في المكتبة (موضوع الامتحان) — فريد: وثيقة واحدة لكل مورد */
    resourceId: uuid('resource_id').references(() => resources.id, { onDelete: 'set null' }),
    solutionResourceId: uuid('solution_resource_id').references(() => resources.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    docType: text('doc_type').notNull().default('BAC'),
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    schoolTerm: integer('school_term'),
    examYear: integer('exam_year'),
    examSession: text('exam_session'),
    sourceId: uuid('source_id').references(() => contentSources.id),
    sourceUrl: text('source_url'),
    /** النسخة المخزَّنة محلياً (للمعاينة داخل الموقع والمعالجة) */
    fileId: uuid('file_id').references(() => files.id, { onDelete: 'set null' }),
    solutionFileId: uuid('solution_file_id').references(() => files.id, { onDelete: 'set null' }),
    /** بنك البكالوريا: رقم الموضوع (الأول/الثاني) إن كانت الوثيقة موضوعاً واحداً من اثنين */
    topicNumber: integer('topic_number'),
    /** لغة الوثيقة: ar | fr | en | de | es | it | ber */
    language: text('language'),
    pagesCount: integer('pages_count'),
    /** بصمة SHA-256 لملف الموضوع والتصحيح (كشف المكرّرات عبر المصادر) */
    pdfHash: text('pdf_hash'),
    solutionPdfHash: text('solution_pdf_hash'),
    /** مراقبة الجودة: قائمة الفحص التي أكّدها المشرف قبل النشر */
    quality: jsonb('quality').$type<QualityChecklist>().notNull().default({}),
    verifiedByUserId: uuid('verified_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    status: text('status').notNull().default('PENDING'),
    error: text('error'),
    textChars: integer('text_chars').notNull().default(0),
    exercisesCount: integer('exercises_count').notNull().default(0),
    duplicatesCount: integer('duplicates_count').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    /** تكلفة الذكاء الاصطناعي المقدّرة لهذه الوثيقة */
    aiCostUsd: numeric('ai_cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    processedAt: timestamp('processed_at', { withTimezone: true }),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ...timestamps
  },
  (t) => [
    check('exam_documents_status_check', inList(t.status, EXAM_DOC_STATUSES)),
    check('exam_documents_type_check', inList(t.docType, EXAM_DOC_TYPES)),
    check('exam_documents_term_check', sql`${t.schoolTerm} IS NULL OR ${t.schoolTerm} BETWEEN 1 AND 3`),
    uniqueIndex('exam_documents_resource_unique').on(t.resourceId),
    index('exam_documents_status_idx').on(t.status, t.updatedAt),
    index('exam_documents_scope_idx').on(t.subjectId, t.levelId, t.streamId, t.examYear),
    index('exam_documents_bac_key_idx').on(t.subjectId, t.streamId, t.examYear, t.examSession, t.topicNumber),
    index('exam_documents_pdf_hash_idx').on(t.pdfHash)
  ]
)

/** قائمة فحص الجودة قبل النشر (كل بند true/false يؤكّده المشرف أو يُستنتج آلياً) */
export interface QualityChecklist {
  year?: boolean
  subject?: boolean
  stream?: boolean
  topic?: boolean
  pages?: boolean
  questions?: boolean
  numbers?: boolean
  equations?: boolean
  figures?: boolean
  bareme?: boolean
  solution?: boolean
  complete?: boolean
  notDuplicate?: boolean
  note?: string
}

/** «حدّد أين وصلت في البرنامج»: آخر درس بلغه الأستاذ لمادة في صف (وشعبة)؛ التوليد التلقائي لا يتجاوزه */
export const teacherProgress = pgTable(
  'teacher_progress',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    levelId: uuid('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    streamId: uuid('stream_id').references(() => streams.id, { onDelete: 'cascade' }),
    nodeId: uuid('node_id').references(() => curriculumNodes.id, { onDelete: 'set null' }),
    updatedByUserId: uuid('updated_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps
  },
  (t) => [unique('teacher_progress_unique').on(t.workspaceId, t.subjectId, t.levelId, t.streamId).nullsNotDistinct()]
)

/** استهلاك الذكاء الاصطناعي: كل نداء بمهمته ونموذجه ورموزه وتكلفته المقدّرة (لا نصوص ولا بيانات شخصية) */
export const aiUsageLogs = pgTable(
  'ai_usage_logs',
  {
    id: id(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    task: text('task').notNull(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: text('entity_type'),
    entityId: uuid('entity_id'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    durationMs: integer('duration_ms').notNull().default(0),
    ok: boolean('ok').notNull().default(true),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('ai_usage_logs_created_idx').on(t.createdAt), index('ai_usage_logs_task_idx').on(t.task, t.createdAt), index('ai_usage_logs_entity_idx').on(t.entityType, t.entityId)]
)

export type ExamDocumentRow = typeof examDocuments.$inferSelect
export type ExamDocumentInsert = typeof examDocuments.$inferInsert
export type TeacherProgressRow = typeof teacherProgress.$inferSelect
export type AiUsageLogRow = typeof aiUsageLogs.$inferSelect
