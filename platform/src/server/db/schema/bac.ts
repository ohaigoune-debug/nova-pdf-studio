import { index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { id, timestamps } from './_common'

/**
 * مواضيع البكالوريا السابقة: روابط مباشرة إلى مصدرها (DzExams) لا ملفات مخزّنة.
 * تُحدَّث بزاحف مهذّب يعمل على الخادم (scripts/bac-sync.sh)؛ page_url فريد فلا تتكرّر.
 */
export const bacExams = pgTable(
  'bac_exams',
  {
    id: id(),
    source: text('source').notNull().default('dzexams'),
    subjectSlug: text('subject_slug').notNull(),
    subjectName: text('subject_name').notNull(),
    streamSlug: text('stream_slug'),
    streamName: text('stream_name'),
    year: integer('year'),
    title: text('title').notNull(),
    /** صفحة الموضوع في المصدر — تُفتح إن لم يوجد رابط تنزيل مباشر */
    pageUrl: text('page_url').notNull().unique(),
    /** رابط تنزيل الموضوع مباشرة (PDF) إن وُجد */
    examUrl: text('exam_url'),
    /** رابط تنزيل التصحيح النموذجي إن وُجد */
    correctionUrl: text('correction_url'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [index('bac_exams_subject_idx').on(t.subjectSlug, t.year), index('bac_exams_stream_idx').on(t.streamSlug)]
)
export type BacExamRow = typeof bacExams.$inferSelect
