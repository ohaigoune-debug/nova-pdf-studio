import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { bankQuestions, type BankOption, type BaremeItem } from './bank'
import { files } from './content'
import { EXAM_ITEM_KINDS, EXAM_KINDS, EXAM_STATUSES } from './enums'
import { groups } from './groups'
import { levels, streams, subjects } from './reference'
import { teacherWorkspaces } from './tenancy'
import type { ExamLayout, StudioBlock } from '@/lib/exam-blocks'

export type { ExamLayout, StudioBlock }

/** ترويسة الورقة الرسمية: ما لا يأتي من التصنيف يكتبه الأستاذ مرة ويُعاد في كل امتحان */
export interface ExamHeader {
  school?: string
  wilaya?: string
  teacherName?: string
  /** «اختبار الفصل الأول» — يُشتقّ من النوع والفصل إن تُرك فارغاً */
  heading?: string
  date?: string
  showSources?: boolean
}

/** نسخة مجمّدة من السؤال وقت إدراجه: تعديل البنك لاحقاً لا يغيّر امتحاناً جاهزاً */
export interface ExamItemSnapshot {
  kind?: string
  type?: string
  title?: string | null
  body: string
  options?: BankOption[]
  answerKey?: Record<string, unknown> | null
  solution?: string | null
  bareme?: BaremeItem[]
  points?: number
  difficulty?: number
  estimatedMinutes?: number | null
  sourceLabel?: string | null
  sourceYear?: number | null
  keywords?: string[]
  children?: ExamItemSnapshot[]
  /** الاستوديو: كتلة منظّمة (للعنصر من نوع BLOCK) */
  block?: StudioBlock
  /** الاستوديو: أشكال داخل التمرين (منحنى/جدول/معادلة…) تُعرض بين النصّ والأسئلة الفرعية */
  figures?: StudioBlock[]
  /** عدد أعمدة اختيارات QCM في الورقة */
  optionsColumns?: 1 | 2 | 3 | 4
}

export interface DifficultySummary {
  counts?: Record<string, number>
  /** 1–4 مرجّح بالنقاط */
  score?: number | null
  label?: string | null
  minutes?: number
}

export const exams = pgTable(
  'exams',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('TEST'),
    subjectId: uuid('subject_id').references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    schoolTerm: integer('school_term'),
    academicYear: text('academic_year'),
    durationMinutes: integer('duration_minutes').notNull().default(120),
    /** المجموع المستهدف (20 عادة): يُقترح إعادة التوزيع حين يخالفه المجموع الفعلي */
    targetPoints: numeric('target_points', { precision: 6, scale: 2 }).notNull().default('20'),
    totalPoints: numeric('total_points', { precision: 8, scale: 2 }).notNull().default('0'),
    instructions: text('instructions'),
    header: jsonb('header').$type<ExamHeader>().notNull().default({}),
    difficultySummary: jsonb('difficulty_summary').$type<DifficultySummary>().notNull().default({}),
    /** الاستوديو: تخطيط الورقة (خطّ، هوامش، ترويسة، تذييل، QR…) — فارغ = الافتراضي */
    layout: jsonb('layout').$type<ExamLayout>().notNull().default({}),
    /** الاستوديو: مفضّلة الأستاذ (امتحانات وقوالب) */
    isFavorite: boolean('is_favorite').notNull().default(false),
    status: text('status').notNull().default('DRAFT'),
    sourceExamId: uuid('source_exam_id').references((): AnyPgColumn => exams.id, { onDelete: 'set null' }),
    pdfFileId: uuid('pdf_file_id').references(() => files.id, { onDelete: 'set null' }),
    solutionPdfFileId: uuid('solution_pdf_file_id').references(() => files.id, { onDelete: 'set null' }),
    /** قالب: يُستنسخ منه امتحان جديد بترويسته وإعداداته وعناصره (المرحلة 6) */
    isTemplate: boolean('is_template').notNull().default(false),
    /** الفوج الذي أُعدّ له الامتحان (اختياري) */
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'set null' }),
    printCount: integer('print_count').notNull().default(0),
    lastPrintedAt: timestamp('last_printed_at', { withTimezone: true }),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('exams_kind_check', inList(t.kind, EXAM_KINDS)),
    check('exams_status_check', inList(t.status, EXAM_STATUSES)),
    check('exams_term_check', sql`${t.schoolTerm} IS NULL OR ${t.schoolTerm} BETWEEN 1 AND 3`),
    check('exams_duration_check', sql`${t.durationMinutes} BETWEEN 5 AND 600`),
    index('exams_workspace_idx').on(t.workspaceId, t.status, t.updatedAt),
    index('exams_template_idx').on(t.workspaceId, t.isTemplate),
    index('exams_group_idx').on(t.groupId)
  ]
)

/**
 * عنصر في الورقة بترتيبه: تمرين/سؤال (من البنك أو حرّ)، نصّ تعليمات، أو فاصل صفحة.
 * `points` يغلب نقاط النسخة المجمّدة إن حُدّد.
 */
export const examItems = pgTable(
  'exam_items',
  {
    id: id(),
    examId: uuid('exam_id')
      .notNull()
      .references(() => exams.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    kind: text('kind').notNull().default('EXERCISE'),
    bankQuestionId: uuid('bank_question_id').references(() => bankQuestions.id, { onDelete: 'set null' }),
    title: text('title'),
    points: numeric('points', { precision: 6, scale: 2 }),
    snapshot: jsonb('snapshot').$type<ExamItemSnapshot>().notNull().default({ body: '' }),
    ...timestamps
  },
  (t) => [check('exam_items_kind_check', inList(t.kind, EXAM_ITEM_KINDS)), index('exam_items_exam_idx').on(t.examId, t.position), index('exam_items_question_idx').on(t.bankQuestionId)]
)

export type ExamRow = typeof exams.$inferSelect
export type ExamItemRow = typeof examItems.$inferSelect
