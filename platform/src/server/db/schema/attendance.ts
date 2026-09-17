import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { users } from './auth'
import { ATTENDANCE_SOURCES, ATTENDANCE_STATUSES, SESSION_STATUSES } from './enums'
import { groupStudents, groups } from './groups'
import { students } from './students'
import { teacherWorkspaces, teachers } from './tenancy'

export const classSessions = pgTable(
  'class_sessions',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id')
      .notNull()
      .references(() => groups.id, { onDelete: 'cascade' }),
    teacherId: uuid('teacher_id')
      .notNull()
      .references(() => teachers.id),
    title: text('title'),
    topic: text('topic'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    status: text('status').notNull().default('PLANNED'),
    attendanceOpen: boolean('attendance_open').notNull().default(false),
    lateAfterMinutes: integer('late_after_minutes').notNull().default(10),
    closedByUserId: uuid('closed_by_user_id').references(() => users.id),
    ...timestamps
  },
  (t) => [
    check('class_sessions_status_check', inList(t.status, SESSION_STATUSES)),
    index('class_sessions_group_idx').on(t.groupId, t.scheduledAt),
    index('class_sessions_workspace_idx').on(t.workspaceId, t.status),
    uniqueIndex('class_sessions_one_open_per_group')
      .on(t.groupId)
      .where(sql`${t.status} = 'OPEN'`)
  ]
)

export const scannerSessions = pgTable(
  'scanner_sessions',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    classSessionId: uuid('class_session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'cascade' }),
    teacherUserId: uuid('teacher_user_id')
      .notNull()
      .references(() => users.id),
    deviceLabel: text('device_label'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    scansCount: integer('scans_count').notNull().default(0),
    ...timestamps
  },
  (t) => [index('scanner_sessions_class_idx').on(t.classSessionId)]
)

export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    classSessionId: uuid('class_session_id')
      .notNull()
      .references(() => classSessions.id, { onDelete: 'cascade' }),
    groupStudentId: uuid('group_student_id')
      .notNull()
      .references(() => groupStudents.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    status: text('status').notNull(),
    source: text('source').notNull().default('SCAN'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),
    minutesLate: integer('minutes_late').notNull().default(0),
    scannerSessionId: uuid('scanner_session_id').references(() => scannerSessions.id),
    recordedByUserId: uuid('recorded_by_user_id').references(() => users.id),
    excuseReason: text('excuse_reason'),
    excuseNotes: text('excuse_notes'),
    excuseFileUrl: text('excuse_file_url'),
    excusedByUserId: uuid('excused_by_user_id').references(() => users.id),
    excusedAt: timestamp('excused_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('attendance_status_check', inList(t.status, ATTENDANCE_STATUSES)),
    check('attendance_source_check', inList(t.source, ATTENDANCE_SOURCES)),
    uniqueIndex('attendance_unique_per_session').on(t.classSessionId, t.studentId),
    index('attendance_student_idx').on(t.studentId, t.status),
    index('attendance_gs_idx').on(t.groupStudentId, t.status)
  ]
)

/** Replay protection لرموز QR: كل nonce يُستهلك مرة واحدة */
export const qrNonces = pgTable(
  'qr_nonces',
  {
    nonce: text('nonce').primaryKey(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('qr_nonces_expires_idx').on(t.expiresAt)]
)
