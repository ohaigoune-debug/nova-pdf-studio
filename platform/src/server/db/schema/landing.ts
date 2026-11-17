/**
 * صفحات الهبوط (قرار المالك 17 نوفمبر 2026): صفحة عامة لكل دورة على /go/<slug> لجلب التلاميذ من الترويج.
 * landing_visits: زوار كل صفحة يوميًا لكل مصدر (ig, fb, yt...)؛ والطلبات تحمل landing_id و traffic_source (store.ts).
 */
import { sql } from 'drizzle-orm'
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, uuid } from 'drizzle-orm/pg-core'
import { id, timestamps } from './_common'
import { courses } from './academy'
import { users } from './auth'

export interface LandingFaq {
  q: string
  a: string
}

export const landingPages = pgTable(
  'landing_pages',
  {
    id: id(),
    slug: text('slug').notNull().unique(),
    courseId: uuid('course_id')
      .notNull()
      .references(() => courses.id, { onDelete: 'cascade' }),
    headline: text('headline').notNull(),
    subheadline: text('subheadline'),
    /** رابط فيديو يوتيوب أو Bunny (يُحوَّل إلى رابط تضمين عند العرض) */
    videoUrl: text('video_url'),
    bullets: jsonb('bullets').$type<string[]>().notNull().default([]),
    about: text('about'),
    faq: jsonb('faq').$type<LandingFaq[]>().notNull().default([]),
    active: boolean('active').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    ...timestamps
  },
  (t) => [index('landing_pages_course_idx').on(t.courseId), check('landing_pages_slug_check', sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,39}$'`)]
)

export const landingVisits = pgTable(
  'landing_visits',
  {
    landingId: uuid('landing_id')
      .notNull()
      .references(() => landingPages.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    source: text('source').notNull(),
    visits: integer('visits').notNull().default(0)
  },
  (t) => [primaryKey({ name: 'landing_visits_pk', columns: [t.landingId, t.day, t.source] }), check('landing_visits_source_check', sql`${t.source} ~ '^[a-z0-9_-]{1,24}$'`)]
)
