import { sql } from 'drizzle-orm'
import { boolean, check, index, integer, jsonb, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { id, inList, timestamps } from './_common'
import { bankQuestions } from './bank'
import { curriculumNodes } from './curriculum'
import { PRACTICE_STATUSES } from './enums'
import { levels, streams, subjects } from './reference'
import { students } from './students'

/**
 * جلسة تدريب ذاتي (المرحلة 7): التلميذ يختار مادة (ودرساً وصعوبة اختياريين) فتُسحب أسئلة
 * منشورة عامة من البنك، تُصحَّح آلياً سؤالاً سؤالاً، وتُحفظ النتائج لرصد نقاط الضعف.
 */
export const practiceSessions = pgTable(
  'practice_sessions',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    subjectId: uuid('subject_id')
      .notNull()
      .references(() => subjects.id),
    levelId: uuid('level_id').references(() => levels.id),
    streamId: uuid('stream_id').references(() => streams.id),
    curriculumNodeId: uuid('curriculum_node_id').references(() => curriculumNodes.id, { onDelete: 'set null' }),
    /** 1–4 أو فارغ = كل الصعوبات */
    difficulty: integer('difficulty'),
    status: text('status').notNull().default('ACTIVE'),
    questionCount: integer('question_count').notNull().default(0),
    answeredCount: integer('answered_count').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    /** 0–100 عند الإنهاء */
    scorePct: numeric('score_pct', { precision: 5, scale: 2 }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('practice_sessions_status_check', inList(t.status, PRACTICE_STATUSES)),
    check('practice_sessions_difficulty_check', sql`${t.difficulty} IS NULL OR ${t.difficulty} BETWEEN 1 AND 4`),
    index('practice_sessions_student_idx').on(t.studentId, t.startedAt)
  ]
)

export const practiceAnswers = pgTable(
  'practice_answers',
  {
    id: id(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => practiceSessions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => bankQuestions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    /** إجابة التلميذ بصيغة quiz-grading (optionIds فهارس الاختيارات) */
    answer: jsonb('answer').$type<Record<string, unknown>>(),
    isCorrect: boolean('is_correct'),
    score: numeric('score', { precision: 6, scale: 2 }),
    points: numeric('points', { precision: 6, scale: 2 }).notNull().default('1'),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [index('practice_answers_session_idx').on(t.sessionId, t.position), index('practice_answers_student_idx').on(t.studentId, t.answeredAt), index('practice_answers_question_idx').on(t.questionId)]
)

export type PracticeSessionRow = typeof practiceSessions.$inferSelect
export type PracticeAnswerRow = typeof practiceAnswers.$inferSelect
