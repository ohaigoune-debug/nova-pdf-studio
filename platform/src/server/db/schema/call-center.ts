import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { orders } from './store'

/**
 * مركز الاتصال الذكي (قرار المالك 27 نوفمبر 2026، الترحيل 0061).
 * المنصّة تخطّط الرسائل والمكالمات من حالات 48HR؛ الصندوق المحلي (Asterisk + Yeastar TG400L) يسحب المكالمات ويعيد النتائج.
 * الإعدادات في app_settings بالمفتاح callcenter.config.
 */

export const CC_TASK_KINDS = ['SMS', 'CALL'] as const
export type CcTaskKind = (typeof CC_TASK_KINDS)[number]

export const CC_TASK_STATUSES = ['QUEUED', 'DISPATCHED', 'DONE', 'FAILED', 'CANCELLED'] as const
export type CcTaskStatus = (typeof CC_TASK_STATUSES)[number]

/** لمن المكالمة: الولي أولًا، ثم التلميذ؛ ORDER = هاتف الطلب؛ CALLER = من اتصل بنا */
export const CC_TARGETS = ['GUARDIAN', 'STUDENT', 'ORDER', 'CALLER'] as const
export type CcTarget = (typeof CC_TARGETS)[number]

export const CC_OUTCOMES = ['ANSWERED', 'NO_ANSWER', 'BUSY', 'REJECTED', 'FAILED', 'SENT', 'SIMULATED'] as const
export type CcOutcome = (typeof CC_OUTCOMES)[number]

export const CC_INBOUND_STATUSES = ['NEW', 'DONE'] as const

/** الشريحة الثابتة لكل رقم: الزبون يرى الرقم نفسه في كل مكالمة فيعيد الاتصال به */
export const ccContacts = pgTable(
  'cc_contacts',
  {
    phone: text('phone').primaryKey(),
    simSlot: integer('sim_slot'),
    optedOutAt: timestamp('opted_out_at', { withTimezone: true }),
    lastContactAt: timestamp('last_contact_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('cc_contacts_phone_check', sql`${t.phone} ~ '^0[5-7][0-9]{8}$'`),
    check('cc_contacts_sim_check', sql`${t.simSlot} IS NULL OR (${t.simSlot} >= 1 AND ${t.simSlot} <= 32)`)
  ]
)

/** رسالة أو مكالمة مخطَّطة؛ dedupe_key يمنع تكرار القاعدة نفسها للطلب نفسه */
export const ccTasks = pgTable(
  'cc_tasks',
  {
    id: id(),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    kind: text('kind').notNull(),
    rule: text('rule').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    target: text('target').notNull().default('ORDER'),
    phone: text('phone').notNull(),
    simSlot: integer('sim_slot'),
    /** مفتاح النص المسجَّل الذي يُشغّله الصندوق (SUSPENDED، HOME_STUCK…) */
    script: text('script'),
    /** نص الرسالة القصيرة بعد تعويض المتغيّرات */
    message: text('message'),
    status: text('status').notNull().default('QUEUED'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    runAfter: timestamp('run_after', { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
    leaseUntil: timestamp('lease_until', { withTimezone: true }),
    outcome: text('outcome'),
    digit: text('digit'),
    durationSec: integer('duration_sec'),
    resultAction: text('result_action'),
    /** وضع التجربة: لم يُرسَل شيء حقيقي لهذا الرقم (ليس من أرقام التجربة) */
    simulated: boolean('simulated').notNull().default(false),
    /** ينتظر الموظف: اختيار يحتاج تنفيذًا عند 48HR، أو لم يردّ أحد بعد كل المحاولات */
    needsHuman: boolean('needs_human').notNull().default(false),
    humanReason: text('human_reason'),
    /** سبب إنشاء المهمة كما يراه الموظف (مثل: «مبلغ مرتفع + هاتف مختلف») */
    context: text('context'),
    handledByUserId: uuid('handled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    handledNote: text('handled_note'),
    error: text('error'),
    ...timestamps
  },
  (t) => [
    check('cc_tasks_kind_check', inList(t.kind, CC_TASK_KINDS)),
    check('cc_tasks_status_check', inList(t.status, CC_TASK_STATUSES)),
    check('cc_tasks_target_check', inList(t.target, CC_TARGETS)),
    check('cc_tasks_outcome_check', sql`${t.outcome} IS NULL OR ${inList(t.outcome, CC_OUTCOMES)}`),
    check('cc_tasks_attempts_check', sql`${t.attempts} >= 0 AND ${t.maxAttempts} >= 1`),
    uniqueIndex('cc_tasks_dedupe_unique').on(t.dedupeKey),
    index('cc_tasks_due_idx').on(t.status, t.runAfter),
    index('cc_tasks_order_idx').on(t.orderId),
    index('cc_tasks_human_idx').on(t.needsHuman, t.handledAt),
    index('cc_tasks_phone_idx').on(t.phone, t.createdAt)
  ]
)

/** كل محاولة (السقف اليومي لكل شريحة، وسجلّ الموظف) */
export const ccAttempts = pgTable(
  'cc_attempts',
  {
    id: id(),
    taskId: uuid('task_id')
      .notNull()
      .references(() => ccTasks.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    simSlot: integer('sim_slot'),
    phone: text('phone').notNull(),
    outcome: text('outcome'),
    digit: text('digit'),
    durationSec: integer('duration_sec'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true })
  },
  (t) => [check('cc_attempts_kind_check', inList(t.kind, CC_TASK_KINDS)), index('cc_attempts_sim_day_idx').on(t.simSlot, t.createdAt), index('cc_attempts_task_idx').on(t.taskId)]
)

/** المكالمات الواردة: اختيار المتصل في القائمة، ورسالته الصوتية، ومعالجة الموظف */
export const ccInbound = pgTable(
  'cc_inbound',
  {
    id: id(),
    phone: text('phone').notNull(),
    simSlot: integer('sim_slot'),
    choice: text('choice'),
    durationSec: integer('duration_sec'),
    recordingKey: text('recording_key'),
    recordingMime: text('recording_mime'),
    recordingBytes: integer('recording_bytes'),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('NEW'),
    handledByUserId: uuid('handled_by_user_id').references(() => users.id, { onDelete: 'set null' }),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    handledNote: text('handled_note'),
    ...timestamps
  },
  (t) => [check('cc_inbound_status_check', inList(t.status, CC_INBOUND_STATUSES)), index('cc_inbound_status_idx').on(t.status, t.createdAt), index('cc_inbound_phone_idx').on(t.phone, t.createdAt)]
)
