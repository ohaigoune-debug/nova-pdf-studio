import { check, index, integer, jsonb, numeric, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { skills } from './content'
import { TIMELINE_TYPES } from './enums'
import { students } from './students'
import { teacherWorkspaces } from './tenancy'

export const studentSkills = pgTable(
  'student_skills',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id),
    /** 0–100 */
    score: numeric('score', { precision: 5, scale: 2 }).notNull().default('0'),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull().default('0'),
    attempts: integer('attempts').notNull().default(0),
    lastUpdated: timestamp('last_updated', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [uniqueIndex('student_skills_unique').on(t.studentId, t.skillId)]
)

export const studentSkillHistory = pgTable(
  'student_skill_history',
  {
    id: id(),
    studentSkillId: uuid('student_skill_id')
      .notNull()
      .references(() => studentSkills.id, { onDelete: 'cascade' }),
    score: numeric('score', { precision: 5, scale: 2 }).notNull(),
    confidence: numeric('confidence', { precision: 4, scale: 3 }).notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: uuid('source_id'),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('skill_history_ss_idx').on(t.studentSkillId, t.recordedAt)]
)

export const studentTimeline = pgTable(
  'student_timeline',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().notNull().default({}),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    ...timestamps
  },
  (t) => [
    check('timeline_type_check', inList(t.type, TIMELINE_TYPES)),
    index('timeline_student_idx').on(t.studentId, t.occurredAt)
  ]
)
