import { boolean, check, date, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { SCHOOL_TYPES } from './enums'
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

export const levels = pgTable('levels', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
})

export const streams = pgTable('streams', {
  id: id(),
  code: text('code').notNull().unique(),
  nameAr: text('name_ar').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps
})
