import { check, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { content } from './content'
import { teacherWorkspaces } from './tenancy'

export const UPLOAD_BATCH_STATUSES = ['ANALYZING', 'READY', 'PUBLISHED', 'FAILED'] as const
export type UploadBatchStatus = (typeof UPLOAD_BATCH_STATUSES)[number]

/** أنواع ما ينشره الأستاذ أو المشرف من صفحة «نشر» */
export const PUBLISH_TYPES = ['LESSON', 'SUMMARY', 'EXERCISE', 'HOMEWORK', 'TEST', 'SOLUTION'] as const
export type PublishType = (typeof PUBLISH_TYPES)[number]

export interface BatchDefaults {
  /** AUTO = يُستنتج من اسم الملف أو يقترحه الذكاء الاصطناعي */
  type: PublishType | 'AUTO'
  subjectId: string | null
  levelId: string | null
  streamId: string | null
  term: number | null
  year: number | null
  audience: 'PUBLIC' | 'GROUPS'
  groupIds: string[]
  /** «من إنشاء: …» تحت كل مورد */
  author: string
}

/** عنصر واحد سيُنشر: ملف كامل، أو صفحات من ملف مجمَّع (سلسلة فروض) */
export interface BatchItem {
  key: string
  fileId: string
  fileName: string
  fromPage: number | null
  toPage: number | null
  type: PublishType
  title: string
  subjectId: string | null
  levelId: string | null
  streamId: string | null
  term: number | null
  year: number | null
  /** مفتاح العنصر الذي هذا حلّه */
  solutionFor: string | null
  include: boolean
  resourceId?: string | null
}

/**
 * دفعة نشر: ملفات رفعها أستاذ أو المشرف (مفردة، مجلد، أو ZIP)، يقترح الذكاء الاصطناعي تقسيمها وتصنيفها
 * أو تُترك كما رُفعت، ثم يراجعها صاحبها وينشرها في «الفروض والاختبارات» أو «الدروس والموارد».
 */
export const uploadBatches = pgTable(
  'upload_batches',
  {
    id: id(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('READY'),
    mode: text('mode').notNull().default('manual'),
    defaults: jsonb('defaults').$type<BatchDefaults>().notNull(),
    items: jsonb('items').$type<BatchItem[]>().notNull().default([]),
    /** تفكيك محتوى منشور سابقاً (سلسلة PDF في «الدروس»): الكتاب يبقى هناك، والمواضيع تُضاف إلى «الفروض والاختبارات» */
    sourceContentId: uuid('source_content_id').references(() => content.id, { onDelete: 'set null' }),
    note: text('note'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [check('upload_batches_status_check', inList(t.status, UPLOAD_BATCH_STATUSES)), index('upload_batches_owner_idx').on(t.ownerUserId, t.createdAt)]
)
