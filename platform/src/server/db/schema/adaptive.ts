import { index, integer, numeric, pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps } from './_common'
import { curriculumNodes } from './curriculum'
import { subjects } from './reference'
import { students } from './students'

/**
 * تقدّم التلميذ بالدرس (المرحلة 8): يُغذّى من كل إجابة تدريب ذاتي.
 * `score` 0–100 متوسط متحرّك (الأحدث أثقل) يقود اختيار الصعوبة والتوصيات.
 */
export const studentNodeProgress = pgTable(
  'student_node_progress',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    curriculumNodeId: uuid('curriculum_node_id')
      .notNull()
      .references(() => curriculumNodes.id, { onDelete: 'cascade' }),
    attempts: integer('attempts').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    score: numeric('score', { precision: 5, scale: 2 }).notNull().default('0'),
    /** إجابات صحيحة متتالية (تصفر عند الخطأ) */
    streak: integer('streak').notNull().default(0),
    /** آخر صعوبة أُجيبت صواباً (1–4) */
    masteredDifficulty: integer('mastered_difficulty').notNull().default(0),
    lastAt: timestamp('last_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [uniqueIndex('student_node_progress_unique').on(t.studentId, t.curriculumNodeId), index('student_node_progress_student_idx').on(t.studentId, t.subjectId)]
)

export type StudentNodeProgressRow = typeof studentNodeProgress.$inferSelect
