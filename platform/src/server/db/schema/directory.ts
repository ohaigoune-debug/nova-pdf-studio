import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { EDUCATOR_STATUSES } from './enums'
import { educationStages, subjects } from './reference'

/** قناة يوتيوب مرشّحة عند البحث بالاسم — يختار المشرف الصحيحة */
export interface ChannelCandidate {
  channelId: string
  title: string
  description: string
  thumbnail: string | null
  handle?: string | null
  subscriberCount?: number | null
  videoCount?: number | null
}

/**
 * دليل الأساتذة (قنوات يوتيوب): ترشيح من دليل الأستاذ ← حلّ إلى قناة حقيقية بـ YouTube API ←
 * اعتماد المشرف ← مزامنة فيديوهاتها إلى المكتبة (resources) مع تصنيفها.
 */
export const educators = pgTable(
  'educators',
  {
    id: id(),
    name: text('name').notNull(),
    /** الاسم مطبَّعاً (بلا تشكيل ومسافات زائدة) لمنع التكرار عند إعادة الزرع */
    nameKey: text('name_key').notNull().unique(),
    stageId: uuid('stage_id').references(() => educationStages.id),
    /** درجة المطابقة كما في الدليل («متخصص بالبكالوريا»…) */
    note: text('note'),
    status: text('status').notNull().default('SUGGESTED'),
    youtubeChannelId: text('youtube_channel_id').unique(),
    channelTitle: text('channel_title'),
    channelHandle: text('channel_handle'),
    channelThumbnail: text('channel_thumbnail'),
    subscriberCount: integer('subscriber_count'),
    videoCount: integer('video_count'),
    uploadsPlaylistId: text('uploads_playlist_id'),
    candidates: jsonb('candidates').$type<ChannelCandidate[]>().notNull().default([]),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    syncedAt: timestamp('synced_at', { withTimezone: true }),
    lastError: text('last_error'),
    ...timestamps
  },
  (t) => [check('educators_status_check', inList(t.status, EDUCATOR_STATUSES)), index('educators_status_idx').on(t.status)]
)

export const educatorSubjects = pgTable(
  'educator_subjects',
  {
    id: id(),
    educatorId: uuid('educator_id')
      .notNull()
      .references(() => educators.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'cascade' }),
    /** ترتيب الترشيح في الدليل (1 = الأقوى) */
    rank: integer('rank').notNull().default(1),
    ...timestamps
  },
  (t) => [uniqueIndex('educator_subjects_unique').on(t.educatorId, t.subjectId), index('educator_subjects_subject_idx').on(t.subjectId, t.rank)]
)

export type EducatorRow = typeof educators.$inferSelect
