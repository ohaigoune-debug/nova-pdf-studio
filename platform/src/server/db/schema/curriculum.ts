import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, numeric, pgTable, text, unique, uniqueIndex, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { CURRICULUM_NODE_KINDS } from './enums'
import { levels, streams, subjects } from './reference'

/** إصدار المنهاج (إصلاح 2016…) حتى لا يُخلط محتوى برنامج قديم بجديد */
export const curriculumVersions = pgTable('curriculum_versions', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  startYear: integer('start_year').notNull(),
  endYear: integer('end_year'),
  isCurrent: boolean('is_current').notNull().default(false),
  ...timestamps
})

/** أيّ الشعب تُدرَّس في أيّ صف (1AS: جذعان مشتركان؛ 2AS و3AS: الشعب الست) */
export const gradeStreams = pgTable(
  'grade_streams',
  {
    id: id(),
    levelId: uuid('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    streamId: uuid('stream_id')
      .notNull()
      .references(() => streams.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [uniqueIndex('grade_streams_unique').on(t.levelId, t.streamId)]
)

/**
 * المادة المقرّرة لصفّ (ولشعبة إن وُجدت) في إصدار منهاج. stream_id فارغ = لكل تلاميذ الصف.
 * is_exam_subject: تُمتحن في الامتحان الوطني للطور (BAC، BEM…).
 */
export const subjectOfferings = pgTable(
  'subject_offerings',
  {
    id: id(),
    levelId: uuid('level_id')
      .notNull()
      .references(() => levels.id, { onDelete: 'cascade' }),
    streamId: uuid('stream_id').references(() => streams.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    curriculumVersionId: uuid('curriculum_version_id').references(() => curriculumVersions.id),
    isExamSubject: boolean('is_exam_subject').notNull().default(false),
    /** المعامل — يُملأ من المصدر الرسمي حين يتوفّر، ولا يُخمَّن */
    coefficient: numeric('coefficient', { precision: 4, scale: 1 }),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [
    // فارغان متساويان: لا عرضان لنفس المادة في نفس الصف بلا شعبة
    unique('subject_offerings_unique').on(t.levelId, t.streamId, t.subjectId, t.curriculumVersionId).nullsNotDistinct(),
    index('subject_offerings_subject_idx').on(t.subjectId)
  ]
)

/**
 * شجرة المنهاج: وحدة ← فصل ← درس ← موضوع (parent_id). عمق الشجرة يختلف بين المواد،
 * فجدول واحد بنوع العقدة أدقّ من أربعة جداول تتكرّر فيها الحقول.
 */
export const curriculumNodes = pgTable(
  'curriculum_nodes',
  {
    id: id(),
    curriculumVersionId: uuid('curriculum_version_id').references(() => curriculumVersions.id),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    levelId: uuid('level_id')
      .notNull()
      .references(() => levels.id),
    /** فارغ = مشترك بين كل شعب الصف */
    streamId: uuid('stream_id').references(() => streams.id),
    parentId: uuid('parent_id').references((): AnyPgColumn => curriculumNodes.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    /** الفصل الدراسي 1–3 إن عُرف */
    schoolTerm: integer('school_term'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [
    check('curriculum_nodes_kind_check', inList(t.kind, CURRICULUM_NODE_KINDS)),
    check('curriculum_nodes_term_check', sqlTerm(t.schoolTerm)),
    unique('curriculum_nodes_unique').on(t.curriculumVersionId, t.subjectId, t.levelId, t.streamId, t.parentId, t.slug).nullsNotDistinct(),
    index('curriculum_nodes_scope_idx').on(t.subjectId, t.levelId, t.streamId),
    index('curriculum_nodes_parent_idx').on(t.parentId, t.sortOrder)
  ]
)

/** الفصل الدراسي بين 1 و3 أو غير معروف */
function sqlTerm(col: unknown) {
  return sql`${col} IS NULL OR ${col} BETWEEN 1 AND 3`
}
