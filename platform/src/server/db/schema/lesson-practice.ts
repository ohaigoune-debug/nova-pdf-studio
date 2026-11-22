import { sql } from 'drizzle-orm'
import { check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id } from './_common'
import { users } from './auth'
import { content } from './content'
import { playExamSets, playLessons } from './play'

export const LESSON_PRACTICE_KINDS = ['LESSON', 'EXAM_SET'] as const
export type LessonPracticeKind = (typeof LESSON_PRACTICE_KINDS)[number]

/**
 * تمارين من بنك مدرسة PLAY تحت درس الدورة (22 نوفمبر 2026): لعبة درس من المنهاج، أو بكالوريا/فرض محوَّل.
 * مشترك الدورة يلعبها مجانًا من تحت الدرس (لا تجربة ولا قسم PLAY المستقل).
 */
export const contentPlayLinks = pgTable(
  'content_play_links',
  {
    id: id(),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    playLessonId: uuid('play_lesson_id').references(() => playLessons.id, { onDelete: 'cascade' }),
    examSetId: uuid('exam_set_id').references(() => playExamSets.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdByUserId: uuid('created_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check(
      'content_play_links_kind_check',
      sql`(${t.kind} = 'LESSON' AND ${t.playLessonId} IS NOT NULL AND ${t.examSetId} IS NULL) OR (${t.kind} = 'EXAM_SET' AND ${t.examSetId} IS NOT NULL AND ${t.playLessonId} IS NULL)`
    ),
    uniqueIndex('content_play_links_lesson_unique').on(t.contentId, t.playLessonId).where(sql`${t.playLessonId} IS NOT NULL`),
    uniqueIndex('content_play_links_exam_unique').on(t.contentId, t.examSetId).where(sql`${t.examSetId} IS NOT NULL`),
    index('content_play_links_content_idx').on(t.contentId, t.sortOrder)
  ]
)
