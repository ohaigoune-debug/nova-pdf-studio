/**
 * Teacher Exam Studio: مراجعات الورقة (لقطات كاملة للاسترجاع) ومكتبة الأستاذ (كتل وترويسات قابلة لإعادة الاستعمال).
 * جداول إضافية فقط؛ الورقة نفسها تبقى في `exams` + `exam_items`.
 */
import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { StudioBlock } from '@/lib/exam-blocks'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { EXAM_REVISION_REASONS, LIBRARY_ITEM_KINDS } from './enums'
import { exams, type ExamHeader, type ExamItemSnapshot, type ExamLayout } from './exams'
import { levels, subjects } from './reference'
import { teacherWorkspaces } from './tenancy'

/** لقطة كاملة من الورقة: إعداداتها وعناصرها بترتيبها (بلا معرّفات العناصر) */
export interface ExamRevisionSnapshot {
  exam: {
    title: string
    kind: string
    subjectId: string | null
    levelId: string | null
    streamId: string | null
    schoolTerm: number | null
    academicYear: string | null
    durationMinutes: number
    targetPoints: number
    instructions: string | null
    header: ExamHeader
    layout: ExamLayout
  }
  items: { kind: string; bankQuestionId: string | null; title: string | null; points: number | null; snapshot: ExamItemSnapshot }[]
}

export const examRevisions = pgTable(
  'exam_revisions',
  {
    id: id(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    reason: text('reason').notNull().default('AUTO'),
    label: text('label'),
    snapshot: jsonb('snapshot').$type<ExamRevisionSnapshot>().notNull(),
    itemsCount: integer('items_count').notNull().default(0),
    totalPoints: text('total_points'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('exam_revisions_reason_check', inList(t.reason, EXAM_REVISION_REASONS)), index('exam_revisions_exam_idx').on(t.examId, t.number)]
)

/** الحمولة: كتلة (block) أو ترويسة (header + layout) */
export interface LibraryItemPayload {
  block?: StudioBlock
  header?: ExamHeader
  layout?: ExamLayout
}

export const teacherLibraryItems = pgTable(
  'teacher_library_items',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').notNull().default('BLOCK'),
    title: text('title').notNull(),
    subjectId: uuid('subject_id').references(() => subjects.id, { onDelete: 'set null' }),
    levelId: uuid('level_id').references(() => levels.id, { onDelete: 'set null' }),
    tags: text('tags').array().notNull().default([]),
    payload: jsonb('payload').$type<LibraryItemPayload>().notNull().default({}),
    isFavorite: boolean('is_favorite').notNull().default(false),
    usageCount: integer('usage_count').notNull().default(0),
    ...timestamps,
    ...softDelete
  },
  (t) => [check('teacher_library_items_kind_check', inList(t.kind, LIBRARY_ITEM_KINDS)), index('teacher_library_items_ws_idx').on(t.workspaceId, t.kind, t.updatedAt)]
)

export type ExamRevisionRow = typeof examRevisions.$inferSelect
export type TeacherLibraryItemRow = typeof teacherLibraryItems.$inferSelect
