/**
 * MADRASADZ PLAY — جداول الألعاب التعليمية. مستقلة تماماً عن جداول الاختبارات الحالية (quizzes).
 * بنك الأسئلة عام على مستوى المنصة (لا workspace)، والتقدم مرتبط بالطالب.
 */
import { sql } from 'drizzle-orm'
import { boolean, check, date, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { students } from './students'
import {
  PLAY_CHALLENGE_TYPES,
  PLAY_DIFFICULTIES,
  PLAY_EXAM_ATTEMPT_STATUSES,
  PLAY_EXAM_KINDS,
  PLAY_EXAM_MODES,
  PLAY_EXAM_SET_STATUSES,
  PLAY_LANGUAGES,
  PLAY_QUESTION_TYPES,
  PLAY_REPORT_REASONS,
  PLAY_REPORT_STATUSES,
  PLAY_REVIEW_STATUSES,
  PLAY_SESSION_STATUSES,
  PLAY_SOURCES
} from '@/server/play/constants'
import type { ExamSetDocument, StepAnswer } from '@/server/play/exams/types'
import type { PlayAnswerKey, PlayPublicPayload, PlayStudentAnswer } from '@/server/play/question-types'

export const playSubjects = pgTable('play_subjects', {
  code: text('code').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameFr: text('name_fr'),
  /** لغة أسئلة المادة الافتراضية */
  language: text('language').notNull().default('ar'),
  color: text('color').notNull().default('primary'),
  icon: text('icon').notNull().default('BookOpen'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps
})

/** خريطة المنهاج: وحدة + درس لكل (سنة، مادة، شعب). الوحدة مضمّنة لتبسيط الاستعلام. */
export const playLessons = pgTable(
  'play_lessons',
  {
    id: id(),
    gradeCode: text('grade_code').notNull(),
    /** فارغة = كل شعب السنة */
    streamCodes: text('stream_codes').array().notNull().default(sql`'{}'::text[]`),
    subjectCode: text('subject_code')
      .notNull()
      .references(() => playSubjects.code),
    unitCode: text('unit_code').notNull(),
    unitName: text('unit_name').notNull(),
    unitOrder: integer('unit_order').notNull().default(0),
    lessonCode: text('lesson_code').notNull(),
    lessonName: text('lesson_name').notNull(),
    lessonOrder: integer('lesson_order').notNull().default(0),
    objective: text('objective'),
    /** مطابق للمنهاج الرسمي (false = يحتاج مراجعة الأستاذ) */
    verified: boolean('verified').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps
  },
  (t) => [
    uniqueIndex('play_lessons_unique').on(t.gradeCode, t.subjectCode, t.streamCodes, t.unitCode, t.lessonCode),
    index('play_lessons_grade_subject_idx').on(t.gradeCode, t.subjectCode)
  ]
)

export const playQuestions = pgTable(
  'play_questions',
  {
    id: id(),
    /** مفتاح ثابت من ملفات المحتوى — يضمن الاستيراد المتكرر بلا تكرار */
    key: text('key').notNull().unique(),
    type: text('type').notNull(),
    gradeCode: text('grade_code').notNull(),
    streamCodes: text('stream_codes').array().notNull().default(sql`'{}'::text[]`),
    subjectCode: text('subject_code')
      .notNull()
      .references(() => playSubjects.code),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => playLessons.id),
    unitCode: text('unit_code').notNull(),
    lessonCode: text('lesson_code').notNull(),
    objective: text('objective'),
    difficulty: text('difficulty').notNull().default('MEDIUM'),
    language: text('language').notNull().default('ar'),
    questionText: text('question_text').notNull(),
    /** ما يُرسل للمتصفح — بلا إجابة */
    payload: jsonb('payload').$type<PlayPublicPayload>().notNull(),
    /** لا يُرسل للمتصفح قبل التصحيح */
    answerKey: jsonb('answer_key').$type<PlayAnswerKey>().notNull(),
    explanation: text('explanation').notNull(),
    tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
    contentHash: text('content_hash').notNull(),
    source: text('source').notNull().default('AI_AUTHORED'),
    reviewStatus: text('review_status').notNull().default('DRAFT'),
    qualityFlags: text('quality_flags').array().notNull().default(sql`'{}'::text[]`),
    note: text('note'),
    reviewedByUserId: uuid('reviewed_by_user_id').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    /** تعليق مؤقت (بلاغ) دون تغيير حالة المراجعة */
    isSuspended: boolean('is_suspended').notNull().default(false),
    timesServed: integer('times_served').notNull().default(0),
    timesCorrect: integer('times_correct').notNull().default(0),
    timesWrong: integer('times_wrong').notNull().default(0),
    reportsCount: integer('reports_count').notNull().default(0),
    ...timestamps,
    ...softDelete
  },
  (t) => [
    check('play_questions_type_check', inList(t.type, PLAY_QUESTION_TYPES)),
    check('play_questions_difficulty_check', inList(t.difficulty, PLAY_DIFFICULTIES)),
    check('play_questions_language_check', inList(t.language, PLAY_LANGUAGES)),
    check('play_questions_review_check', inList(t.reviewStatus, PLAY_REVIEW_STATUSES)),
    check('play_questions_source_check', inList(t.source, PLAY_SOURCES)),
    index('play_questions_pick_idx').on(t.gradeCode, t.subjectCode, t.lessonId, t.reviewStatus),
    index('play_questions_hash_idx').on(t.contentHash),
    index('play_questions_review_idx').on(t.reviewStatus, t.createdAt)
  ]
)

export const playSessions = pgTable(
  'play_sessions',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    gradeCode: text('grade_code').notNull(),
    streamCode: text('stream_code'),
    subjectCode: text('subject_code').references(() => playSubjects.code),
    unitCode: text('unit_code'),
    lessonId: uuid('lesson_id').references(() => playLessons.id),
    challengeType: text('challenge_type').notNull(),
    timed: boolean('timed').notNull().default(false),
    status: text('status').notNull().default('ACTIVE'),
    /** الأسئلة بالترتيب */
    questionIds: uuid('question_ids').array().notNull(),
    seed: integer('seed').notNull(),
    answeredCount: integer('answered_count').notNull().default(0),
    correctCount: integer('correct_count').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('play_sessions_type_check', inList(t.challengeType, PLAY_CHALLENGE_TYPES)),
    check('play_sessions_status_check', inList(t.status, PLAY_SESSION_STATUSES)),
    index('play_sessions_student_idx').on(t.studentId, t.startedAt)
  ]
)

export const playAnswers = pgTable(
  'play_answers',
  {
    id: id(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => playSessions.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => playQuestions.id),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
    answer: jsonb('answer').$type<PlayStudentAnswer | null>(),
    isCorrect: boolean('is_correct').notNull(),
    xpAwarded: integer('xp_awarded').notNull().default(0),
    timeMs: integer('time_ms'),
    answeredAt: timestamp('answered_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    /** يمنع تسجيل نتيجة السؤال مرتين في الجلسة نفسها */
    uniqueIndex('play_answers_unique').on(t.sessionId, t.questionId),
    index('play_answers_student_idx').on(t.studentId, t.answeredAt),
    index('play_answers_question_idx').on(t.questionId)
  ]
)

export const playStudentStats = pgTable(
  'play_student_stats',
  {
    studentId: uuid('student_id')
      .primaryKey()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** الملف الدراسي المختار في PLAY (قد يختلف عن ملف الحساب) */
    gradeCode: text('grade_code'),
    streamCode: text('stream_code'),
    xpTotal: integer('xp_total').notNull().default(0),
    levelIndex: integer('level_index').notNull().default(0),
    streakDays: integer('streak_days').notNull().default(0),
    lastActiveDate: date('last_active_date'),
    sessionsCompleted: integer('sessions_completed').notNull().default(0),
    answeredTotal: integer('answered_total').notNull().default(0),
    correctTotal: integer('correct_total').notNull().default(0),
    hardCorrectTotal: integer('hard_correct_total').notNull().default(0),
    lessonsMastered: integer('lessons_mastered').notNull().default(0),
    prefs: jsonb('prefs').$type<{ sound?: boolean; motion?: boolean }>().notNull().default({}),
    ...timestamps
  }
)

export const playSubjectStats = pgTable(
  'play_subject_stats',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    gradeCode: text('grade_code').notNull(),
    subjectCode: text('subject_code')
      .notNull()
      .references(() => playSubjects.code),
    xp: integer('xp').notNull().default(0),
    answered: integer('answered').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [uniqueIndex('play_subject_stats_unique').on(t.studentId, t.gradeCode, t.subjectCode)]
)

export const playLessonProgress = pgTable(
  'play_lesson_progress',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => playLessons.id),
    answered: integer('answered').notNull().default(0),
    correct: integer('correct').notNull().default(0),
    /** 0–100 على آخر 20 إجابة */
    masteryPct: integer('mastery_pct').notNull().default(0),
    masteredAt: timestamp('mastered_at', { withTimezone: true }),
    lastPlayedAt: timestamp('last_played_at', { withTimezone: true }),
    /** آخر 20 نتيجة (1 صحيح / 0 خطأ) للنافذة المتحركة */
    recent: text('recent').notNull().default(''),
    ...timestamps
  },
  (t) => [uniqueIndex('play_lesson_progress_unique').on(t.studentId, t.lessonId), index('play_lesson_progress_student_idx').on(t.studentId, t.lastPlayedAt)]
)

/** ذاكرة Leitner لكل سؤال/طالب — أساس «عالج أخطاءك» والمراجعة المتباعدة */
export const playQuestionMemory = pgTable(
  'play_question_memory',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => playQuestions.id, { onDelete: 'cascade' }),
    lessonId: uuid('lesson_id')
      .notNull()
      .references(() => playLessons.id),
    box: integer('box').notNull().default(0),
    dueAt: timestamp('due_at', { withTimezone: true }).notNull().defaultNow(),
    lastResult: boolean('last_result'),
    wrongCount: integer('wrong_count').notNull().default(0),
    correctStreak: integer('correct_streak').notNull().default(0),
    seenCount: integer('seen_count').notNull().default(0),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [uniqueIndex('play_question_memory_unique').on(t.studentId, t.questionId), index('play_question_memory_due_idx').on(t.studentId, t.dueAt)]
)

export const playStudentBadges = pgTable(
  'play_student_badges',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    badgeCode: text('badge_code').notNull(),
    earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [uniqueIndex('play_student_badges_unique').on(t.studentId, t.badgeCode)]
)

export const playQuestionReports = pgTable(
  'play_question_reports',
  {
    id: id(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => playQuestions.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'set null' }),
    sessionId: uuid('session_id').references(() => playSessions.id, { onDelete: 'set null' }),
    reason: text('reason').notNull(),
    message: text('message'),
    status: text('status').notNull().default('OPEN'),
    resolvedByUserId: uuid('resolved_by_user_id').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolution: text('resolution'),
    ...timestamps
  },
  (t) => [
    check('play_reports_reason_check', inList(t.reason, PLAY_REPORT_REASONS)),
    check('play_reports_status_check', inList(t.status, PLAY_REPORT_STATUSES)),
    index('play_reports_status_idx').on(t.status, t.createdAt),
    index('play_reports_question_idx').on(t.questionId)
  ]
)

/* ─────────────── الوصول: تجربة PLAY المجانية (72 ساعة، مرة واحدة، الخادم مصدر الحقيقة) ─────────────── */

export const playAccessTrials = pgTable(
  'play_access_trials',
  {
    studentId: uuid('student_id')
      .primaryKey()
      .references(() => students.id, { onDelete: 'cascade' }),
    /** أول بدء لعب فعلي (وقت الخادم)، لا وقت إنشاء الحساب */
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [check('play_access_trials_window_check', sql`${t.endsAt} > ${t.startedAt}`)]
)

/* ─────────────── الفروض والاختبارات والبكالوريا: مجموعات تدريب مشتقة من مصادر أصلية ─────────────── */

export const playExamSets = pgTable(
  'play_exam_sets',
  {
    id: id(),
    /** معرّف ثابت من ملف المحتوى (content/play-exams/sets/**) */
    setId: text('set_id').notNull().unique(),
    kind: text('kind').notNull(),
    gradeCode: text('grade_code').notNull(),
    /** فارغة = كل شعب المستوى */
    streamCodes: text('stream_codes').array().notNull().default([]),
    subjectCode: text('subject_code').notNull(),
    year: integer('year'),
    term: integer('term'),
    paper: integer('paper'),
    title: text('title').notNull(),
    status: text('status').notNull().default('NEEDS_HUMAN_REVIEW'),
    /** نتيجة المدقق وقت الاستيراد: يُعرض للتلاميذ فقط ما كان قابلًا للنشر */
    publishable: boolean('publishable').notNull().default(false),
    scoreTotal: doublePrecision('score_total').notNull().default(20),
    stepCount: integer('step_count').notNull().default(0),
    checksum: text('checksum').notNull(),
    document: jsonb('document').$type<ExamSetDocument>().notNull(),
    ...timestamps
  },
  (t) => [
    check('play_exam_sets_kind_check', inList(t.kind, PLAY_EXAM_KINDS)),
    check('play_exam_sets_status_check', inList(t.status, PLAY_EXAM_SET_STATUSES)),
    check('play_exam_sets_term_check', sql`${t.term} IS NULL OR ${t.term} BETWEEN 1 AND 3`),
    check('play_exam_sets_paper_check', sql`${t.paper} IS NULL OR ${t.paper} IN (1, 2)`),
    index('play_exam_sets_browse_idx').on(t.gradeCode, t.subjectCode, t.kind, t.publishable)
  ]
)

export interface ExamStepRecord {
  answer: StepAnswer
  /** الدرجة 0..1 والوزن، محسوبان في الخادم */
  s: number
  w: number
  at: string
}

export const playExamAttempts = pgTable(
  'play_exam_attempts',
  {
    id: id(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    setId: uuid('set_id')
      .notNull()
      .references(() => playExamSets.id, { onDelete: 'cascade' }),
    /** نسخة المحتوى التي لُعبت (لا تتغير النتيجة إن عُدّلت المجموعة لاحقًا) */
    setChecksum: text('set_checksum').notNull(),
    mode: text('mode').notNull(),
    status: text('status').notNull().default('ACTIVE'),
    answers: jsonb('answers').$type<Record<string, ExamStepRecord>>().notNull().default({}),
    score: doublePrecision('score').notNull().default(0),
    maxScore: doublePrecision('max_score').notNull().default(20),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('play_exam_attempts_mode_check', inList(t.mode, PLAY_EXAM_MODES)),
    check('play_exam_attempts_status_check', inList(t.status, PLAY_EXAM_ATTEMPT_STATUSES)),
    index('play_exam_attempts_student_idx').on(t.studentId, t.startedAt),
    index('play_exam_attempts_set_idx').on(t.setId)
  ]
)
