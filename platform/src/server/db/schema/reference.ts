import { boolean, check, date, index, integer, pgTable, text, uuid, type AnyPgColumn } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { EDUCATION_STAGES, SCHOOL_TYPES } from './enums'
import { teacherWorkspaces } from './tenancy'

export const wilayas = pgTable('wilayas', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr').notNull(),
  ...timestamps
})

export const schools = pgTable(
  'schools',
  {
    id: id(),
    wilayaId: uuid('wilaya_id')
      .notNull()
      .references(() => wilayas.id),
    /** NULL = مدرسة عامة متاحة للجميع؛ وإلا خاصة بمساحة أستاذ */
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull().default('LYCEE'),
    address: text('address'),
    ...timestamps
  },
  (t) => [
    check('schools_type_check', inList(t.type, SCHOOL_TYPES)),
    index('schools_wilaya_idx').on(t.wilayaId),
    index('schools_workspace_idx').on(t.workspaceId)
  ]
)

export const academicYears = pgTable('academic_years', {
  id: id(),
  label: text('label').notNull().unique(),
  startsOn: date('starts_on').notNull(),
  endsOn: date('ends_on').notNull(),
  isCurrent: boolean('is_current').notNull().default(false),
  ...timestamps
})

/** الأطوار: ابتدائي، متوسط، ثانوي — ولكل طور امتحانه الوطني (شهادة الابتدائي، BEM، BAC) */
export const educationStages = pgTable(
  'education_stages',
  {
    id: id(),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    nameFr: text('name_fr').notNull(),
    /** رمز الامتحان الوطني للطور: 5AP، BEM، BAC */
    examCode: text('exam_code'),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [check('education_stages_code_check', inList(t.code, EDUCATION_STAGES))]
)

/**
 * «الصفوف» (1AP…5AP، 1AM…4AM، 1AS…3AS). الاسم التاريخي للجدول levels يبقى
 * لأن أعمدة levelId منتشرة في الأفواج والتلاميذ والمحتوى.
 */
export const levels = pgTable(
  'levels',
  {
    id: id(),
    code: text('code').notNull().unique(),
    nameAr: text('name_ar').notNull(),
    /** اسم قصير للروابط والشارات: 3AS، 4AM */
    slug: text('slug'),
    stageId: uuid('stage_id').references(() => educationStages.id),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [index('levels_stage_idx').on(t.stageId, t.sortOrder)]
)

export const streams = pgTable('streams', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  slug: text('slug'),
  /** خيارات شعبة تقني رياضي (هندسة مدنية، ميكانيكية، كهربائية، طرائق) تتفرّع عنها */
  parentId: uuid('parent_id').references((): AnyPgColumn => streams.id),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
})

/** المواد — مصدر واحد لكل التسميات بدل النصوص الحرّة المنتشرة */
export const subjects = pgTable('subjects', {
  id: id(),
  code: text('code').notNull().unique(),
  /** للروابط العامة: /3as/sciences/math */
  slug: text('slug').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
})
