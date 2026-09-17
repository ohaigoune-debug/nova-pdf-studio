import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { CODE_STATUSES, ENROLLMENT_STATUSES, GROUP_STATUSES } from './enums'
import { academicYears, levels, schools, streams, wilayas } from './reference'
import { students } from './students'
import { teacherWorkspaces, teachers } from './tenancy'

export const groups = pgTable(
  'groups',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id),
    name: text('name').notNull(),
    wilayaId: uuid('wilaya_id').references(() => wilayas.id),
    schoolId: uuid('school_id').references(() => schools.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    academicYearId: uuid('academic_year_id').references(() => academicYears.id),
    /** 0 = الأحد ... 6 = السبت (حسب JS getDay) */
    dayOfWeek: integer('day_of_week'),
    startTime: time('start_time'),
    durationMinutes: integer('duration_minutes').notNull().default(90),
    room: text('room'),
    capacity: integer('capacity'),
    startsOn: date('starts_on'),
    endsOn: date('ends_on'),
    status: text('status').notNull().default('ACTIVE'),
    lateAfterMinutes: integer('late_after_minutes').notNull().default(10),
    maxUnexcusedAbsences: integer('max_unexcused_absences').notNull().default(4),
    notes: text('notes'),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('groups_status_check', inList(t.status, GROUP_STATUSES)),
    check('groups_day_check', sql`${t.dayOfWeek} IS NULL OR (${t.dayOfWeek} BETWEEN 0 AND 6)`),
    index('groups_workspace_status_idx').on(t.workspaceId, t.status),
    index('groups_teacher_idx').on(t.teacherId)
  ]
)

export const enrollmentCodeBatches = pgTable(
  'enrollment_code_batches',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    label: text('label'),
    count: integer('count').notNull(),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [index('code_batches_group_idx').on(t.groupId)]
)

export const enrollmentCodes = pgTable(
  'enrollment_codes',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    batchId: uuid('batch_id').references(() => enrollmentCodeBatches.id, { onDelete: 'set null' }),
    codeHash: text('code_hash').notNull().unique(),
    /** أول 3 أحرف للعرض فقط (مثال: HG8-****) */
    codePrefix: text('code_prefix').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    usedByStudentId: uuid('used_by_student_id').references(() => students.id),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('codes_status_check', inList(t.status, CODE_STATUSES)),
    index('codes_group_status_idx').on(t.groupId, t.status),
    index('codes_batch_idx').on(t.batchId)
  ]
)

export const groupStudents = pgTable(
  'group_students',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    status: text('status').notNull().default('ACTIVE'),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    enrolledViaCodeId: uuid('enrolled_via_code_id').references(() => enrollmentCodes.id),
    leftAt: timestamp('left_at', { withTimezone: true }),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspensionReason: text('suspension_reason'),
    /** cache يُعاد حسابه من attendance_records عند كل تغيير */
    unexcusedAbsencesCount: integer('unexcused_absences_count').notNull().default(0),
    ...timestamps
  },
  (t) => [
    check('group_students_status_check', inList(t.status, ENROLLMENT_STATUSES)),
    uniqueIndex('group_students_unique').on(t.groupId, t.studentId),
    index('group_students_student_idx').on(t.studentId),
    index('group_students_workspace_idx').on(t.workspaceId, t.status)
  ]
)

export const studentStatusHistory = pgTable(
  'student_status_history',
  {
    id: id(),
    groupStudentId: uuid('group_student_id')
      .notNull()
      .references(() => groupStudents.id, { onDelete: 'cascade' }),
    fromStatus: text('from_status'),
    toStatus: text('to_status').notNull(),
    reason: text('reason'),
    changedByUserId: uuid('changed_by_user_id').references(() => users.id),
    changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('status_history_gs_idx').on(t.groupStudentId)]
)
