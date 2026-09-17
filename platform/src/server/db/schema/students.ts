import { check, date, index, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { STUDENT_TYPES } from './enums'
import { levels, schools, streams, wilayas } from './reference'

export const students = pgTable(
  'students',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    studentType: text('student_type').notNull().default('FREE'),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id),
    schoolId: uuid('school_id').references(() => schools.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    guardianPhone: text('guardian_phone'),
    birthDate: date('birth_date'),
    ...timestamps
  },
  (t) => [
    check('students_type_check', inList(t.studentType, STUDENT_TYPES)),
    index('students_level_idx').on(t.levelId)
  ]
)
