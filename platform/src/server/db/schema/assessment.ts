import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { id, inList, softDelete, timestamps } from './_common'
import { users } from './auth'
import { files, skills } from './content'
import {
  AI_EVAL_STATUSES,
  ATTEMPT_STATUSES,
  GRADE_SOURCES,
  QUESTION_TYPES,
  REVIEW_DECISIONS,
  SUBMISSION_MESSAGE_KINDS,
  SUBMISSION_STATUSES
} from './enums'
import { groups } from './groups'
import { students } from './students'
import { teacherWorkspaces } from './tenancy'

export const rubrics = pgTable(
  'rubrics',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    maxScore: numeric('max_score', { precision: 6, scale: 2 }).notNull().default('20'),
    createdByUserId: uuid('created_by_user_id').references(() => users.id),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('rubrics_workspace_idx').on(t.workspaceId)]
)

export const rubricItems = pgTable(
  'rubric_items',
  {
    id: id(),
    rubricId: uuid('rubric_id')
      .notNull()
      .references(() => rubrics.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    description: text('description'),
    maxPoints: numeric('max_points', { precision: 6, scale: 2 }).notNull(),
    skillId: uuid('skill_id').references(() => skills.id),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [index('rubric_items_rubric_idx').on(t.rubricId)]
)

export const assignments = pgTable(
  'assignments',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    subject: text('subject'),
    topic: text('topic'),
    skillId: uuid('skill_id').references(() => skills.id),
    rubricId: uuid('rubric_id').references(() => rubrics.id),
    maxScore: numeric('max_score', { precision: 6, scale: 2 }).notNull().default('20'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    attachmentFileId: uuid('attachment_file_id').references(() => files.id),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('assignments_workspace_idx').on(t.workspaceId, t.dueAt)]
)

export const assignmentTargets = pgTable(
  'assignment_targets',
  {
    id: id(),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [
    index('assignment_targets_assignment_idx').on(t.assignmentId),
    index('assignment_targets_group_idx').on(t.groupId),
    index('assignment_targets_student_idx').on(t.studentId)
  ]
)

export const assignmentSubmissions = pgTable(
  'assignment_submissions',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    assignmentId: uuid('assignment_id')
      .notNull()
      .references(() => assignments.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    answerText: text('answer_text'),
    selectedOption: text('selected_option'),
    fileId: uuid('file_id').references(() => files.id),
    /** النسخة الأصلية لا تُعدَّل أبداً */
    originalFileId: uuid('original_file_id').references(() => files.id),
    ocrText: text('ocr_text'),
    ocrConfirmed: boolean('ocr_confirmed').notNull().default(false),
    status: text('status').notNull().default('DRAFT'),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('submission_status_check', inList(t.status, SUBMISSION_STATUSES)),
    uniqueIndex('submissions_unique_per_student').on(t.assignmentId, t.studentId),
    index('submissions_student_idx').on(t.studentId)
  ]
)

/**
 * سلسلة رسائل الإجابة: إجابة الطالب (ANSWER) ← تصحيح/ملاحظة الأستاذ (FEEDBACK) ← ردّ الطالب (REPLY).
 * الرسائل لا تُعدَّل ولا تُحذف بعد إرسالها.
 */
export const submissionMessages = pgTable(
  'submission_messages',
  {
    id: id(),
    submissionId: uuid('submission_id')
      .notNull()
      .references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    authorUserId: uuid('author_user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
  },
  (t) => [
    check('submission_messages_kind_check', inList(t.kind, SUBMISSION_MESSAGE_KINDS)),
    index('submission_messages_submission_idx').on(t.submissionId, t.createdAt)
  ]
)

export const quizzes = pgTable(
  'quizzes',
  {
    id: id(),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('created_by_user_id')
      .notNull()
      .references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    topic: text('topic'),
    skillId: uuid('skill_id').references(() => skills.id),
    timeLimitMinutes: integer('time_limit_minutes'),
    maxScore: numeric('max_score', { precision: 6, scale: 2 }).notNull().default('20'),
    isPublic: boolean('is_public').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    dueAt: timestamp('due_at', { withTimezone: true }),
    maxAttempts: integer('max_attempts').notNull().default(1),
    ...timestamps,
    ...softDelete
  },
  (t) => [index('quizzes_workspace_idx').on(t.workspaceId)]
)

export const quizTargets = pgTable(
  'quiz_targets',
  {
    id: id(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id').references(() => students.id, { onDelete: 'cascade' }),
    ...timestamps
  },
  (t) => [index('quiz_targets_quiz_idx').on(t.quizId), index('quiz_targets_group_idx').on(t.groupId)]
)

export const questions = pgTable(
  'questions',
  {
    id: id(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    prompt: text('prompt').notNull(),
    imageFileId: uuid('image_file_id').references(() => files.id),
    points: numeric('points', { precision: 6, scale: 2 }).notNull().default('1'),
    skillId: uuid('skill_id').references(() => skills.id),
    /** إجابة نموذجية / مفاتيح المطابقة / الفراغات */
    answerKey: jsonb('answer_key').$type<Record<string, unknown>>(),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [
    check('questions_type_check', inList(t.type, QUESTION_TYPES)),
    index('questions_quiz_idx').on(t.quizId)
  ]
)

export const questionOptions = pgTable(
  'question_options',
  {
    id: id(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    isCorrect: boolean('is_correct').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    ...timestamps
  },
  (t) => [index('question_options_question_idx').on(t.questionId)]
)

export const quizAttempts = pgTable(
  'quiz_attempts',
  {
    id: id(),
    quizId: uuid('quiz_id')
      .notNull()
      .references(() => quizzes.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    workspaceId: uuid('workspace_id').references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('IN_PROGRESS'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    autoScore: numeric('auto_score', { precision: 6, scale: 2 }),
    finalScore: numeric('final_score', { precision: 6, scale: 2 }),
    /** هل توجد أسئلة مقالية تنتظر مراجعة الأستاذ */
    needsReview: boolean('needs_review').notNull().default(false),
    ...timestamps
  },
  (t) => [
    check('quiz_attempts_status_check', inList(t.status, ATTEMPT_STATUSES)),
    index('quiz_attempts_student_idx').on(t.studentId, t.quizId),
    index('quiz_attempts_quiz_idx').on(t.quizId, t.status)
  ]
)

export const answers = pgTable(
  'answers',
  {
    id: id(),
    attemptId: uuid('attempt_id')
      .notNull()
      .references(() => quizAttempts.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    selectedOptionId: uuid('selected_option_id').references(() => questionOptions.id),
    answerText: text('answer_text'),
    answerJson: jsonb('answer_json').$type<Record<string, unknown>>(),
    isCorrect: boolean('is_correct'),
    score: numeric('score', { precision: 6, scale: 2 }),
    ...timestamps
  },
  (t) => [index('answers_attempt_idx').on(t.attemptId)]
)

export const aiEvaluations = pgTable(
  'ai_evaluations',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    submissionId: uuid('submission_id').references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    answerId: uuid('answer_id').references(() => answers.id, { onDelete: 'cascade' }),
    rubricId: uuid('rubric_id').references(() => rubrics.id),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    status: text('status').notNull().default('PENDING'),
    suggestedScore: numeric('suggested_score', { precision: 6, scale: 2 }),
    confidence: numeric('confidence', { precision: 4, scale: 3 }),
    mistakes: jsonb('mistakes').$type<string[]>().notNull().default([]),
    strengths: jsonb('strengths').$type<string[]>().notNull().default([]),
    weaknesses: jsonb('weaknesses').$type<string[]>().notNull().default([]),
    skillsDetected: jsonb('skills_detected').$type<string[]>().notNull().default([]),
    skillsToImprove: jsonb('skills_to_improve').$type<string[]>().notNull().default([]),
    rubricBreakdown: jsonb('rubric_breakdown').$type<Record<string, number>>(),
    teacherNotesSuggestion: text('teacher_notes_suggestion'),
    rawResponse: jsonb('raw_response').$type<Record<string, unknown>>(),
    /** رسالة الخطأ الداخلية (لا تُعرض للطالب أبداً) */
    error: text('error'),
    /** من طلب التقييم (الأستاذ) أو NULL إن كان تلقائياً عند الإرسال */
    requestedByUserId: uuid('requested_by_user_id').references(() => users.id),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps
  },
  (t) => [
    check('ai_eval_status_check', inList(t.status, AI_EVAL_STATUSES)),
    index('ai_evaluations_submission_idx').on(t.submissionId),
    index('ai_evaluations_workspace_idx').on(t.workspaceId, t.status)
  ]
)

export const teacherReviews = pgTable(
  'teacher_reviews',
  {
    id: id(),
    aiEvaluationId: uuid('ai_evaluation_id').references(() => aiEvaluations.id, { onDelete: 'set null' }),
    submissionId: uuid('submission_id').references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    reviewerUserId: uuid('reviewer_user_id')
      .notNull()
      .references(() => users.id),
    decision: text('decision').notNull(),
    finalScore: numeric('final_score', { precision: 6, scale: 2 }),
    notes: text('notes'),
    ...timestamps
  },
  (t) => [
    check('teacher_reviews_decision_check', inList(t.decision, REVIEW_DECISIONS)),
    index('teacher_reviews_submission_idx').on(t.submissionId)
  ]
)

export const grades = pgTable(
  'grades',
  {
    id: id(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => teacherWorkspaces.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id),
    submissionId: uuid('submission_id').references(() => assignmentSubmissions.id, { onDelete: 'cascade' }),
    quizAttemptId: uuid('quiz_attempt_id').references(() => quizAttempts.id, { onDelete: 'cascade' }),
    score: numeric('score', { precision: 6, scale: 2 }).notNull(),
    maxScore: numeric('max_score', { precision: 6, scale: 2 }).notNull(),
    source: text('source').notNull(),
    approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    feedbackStrengths: jsonb('feedback_strengths').$type<string[]>().notNull().default([]),
    feedbackImprovements: jsonb('feedback_improvements').$type<string[]>().notNull().default([]),
    teacherNotes: text('teacher_notes'),
    /** نقاط كل بند من الـRubric: { rubricItemId: points } */
    rubricBreakdown: jsonb('rubric_breakdown').$type<Record<string, number>>(),
    /** ما يراه الطالب فقط بعد الاعتماد */
    visibleToStudent: boolean('visible_to_student').notNull().default(false),
    ...timestamps
  },
  (t) => [
    check('grades_source_check', inList(t.source, GRADE_SOURCES)),
    index('grades_student_idx').on(t.studentId),
    index('grades_workspace_idx').on(t.workspaceId)
  ]
)
