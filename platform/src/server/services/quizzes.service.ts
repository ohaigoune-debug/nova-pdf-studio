import { and, asc, count, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { answers, grades, groupStudents, groups, profiles, questionOptions, questions, quizAttempts, quizTargets, quizzes, skills, students, teachers, users } from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import { assertRole, studentIdOf, workspaceOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { gradeAnswer, summarize, validateQuestion, type StudentAnswer } from '@/server/lib/quiz-grading'
import { assertGroupAccess } from './groups.service'
import { notify, notifyMany } from './notifications.service'
import { recordSkillResult } from './skills.service'
import { addTimeline } from './timeline.service'

export interface QuestionInput {
  id?: string
  type: string
  prompt: string
  imageFileId?: string | null
  points: number
  skillId?: string | null
  answerKey: Record<string, unknown> | null
  options: { label: string; isCorrect: boolean }[]
}

export interface QuizInput {
  title: string
  description?: string | null
  topic?: string | null
  skillId?: string | null
  timeLimitMinutes?: number | null
  maxAttempts?: number
  dueAt?: Date | null
  isPublic?: boolean
  publish?: boolean
  groupIds: string[]
  studentIds: string[]
  /** إن كانت undefined لا تُمسّ الأسئلة (تعديل البيانات الوصفية فقط) */
  questions?: QuestionInput[]
}

type QuizRow = typeof quizzes.$inferSelect

async function assertQuizAccess(db: Db, actor: Actor, id: string): Promise<QuizRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'QUIZ_NOT_FOUND')
  const [q] = await db.select().from(quizzes).where(and(eq(quizzes.id, id), isNull(quizzes.deletedAt))).limit(1)
  if (!q) throw new AppError('QUIZ_NOT_FOUND')
  if (actor.role === 'TEACHER' && q.workspaceId !== actor.workspaceId) throw new AppError('QUIZ_NOT_FOUND')
  return q
}

async function targetedStudentIds(db: Db, quizId: string): Promise<string[]> {
  const targets = await db.select().from(quizTargets).where(eq(quizTargets.quizId, quizId))
  const gids = targets.map((t) => t.groupId).filter((x): x is string => !!x)
  const set = new Set(targets.map((t) => t.studentId).filter((x): x is string => !!x))
  if (gids.length) {
    const rows = await db.select({ studentId: groupStudents.studentId }).from(groupStudents).where(and(inArray(groupStudents.groupId, gids), eq(groupStudents.status, 'ACTIVE')))
    for (const r of rows) set.add(r.studentId)
  }
  return [...set]
}

async function writeQuestions(tx: Db, quizId: string, list: QuestionInput[]) {
  if (list.length === 0) throw new AppError('QUIZ_NO_QUESTIONS')
  for (const q of list) {
    const err = validateQuestion(q)
    if (err) throw new AppError('VALIDATION', { question: q.prompt.slice(0, 40), reason: err })
  }
  await tx.delete(questions).where(eq(questions.quizId, quizId))
  let total = 0
  for (let i = 0; i < list.length; i++) {
    const q = list[i]!
    total += q.points
    const [row] = await tx
      .insert(questions)
      .values({ quizId, type: q.type, prompt: q.prompt.trim(), imageFileId: q.imageFileId ?? null, points: String(q.points), skillId: q.skillId ?? null, answerKey: q.answerKey, sortOrder: i })
      .returning({ id: questions.id })
    if (!row) throw new AppError('INTERNAL')
    if (q.options.length) await tx.insert(questionOptions).values(q.options.map((o, j) => ({ questionId: row.id, label: o.label.trim(), isCorrect: o.isCorrect, sortOrder: j })))
  }
  return Math.round(total * 100) / 100
}

async function writeTargets(tx: Db, actor: Actor, quizId: string, groupIds: string[], studentIds: string[]) {
  for (const g of groupIds) await assertGroupAccess(tx, actor, g)
  await tx.delete(quizTargets).where(eq(quizTargets.quizId, quizId))
  if (groupIds.length || studentIds.length) {
    await tx.insert(quizTargets).values([...groupIds.map((groupId) => ({ quizId, groupId })), ...studentIds.map((studentId) => ({ quizId, studentId }))])
  }
}

async function notifyTargets(tx: Db, quiz: QuizRow) {
  const ids = await targetedStudentIds(tx, quiz.id)
  if (ids.length === 0) return
  const rows = await tx.select({ userId: students.userId }).from(students).where(inArray(students.id, ids))
  await notifyMany(tx, rows.map((u) => ({ userId: u.userId, workspaceId: quiz.workspaceId, type: 'NEW_QUIZ' as const, title: `اختبار جديد: ${quiz.title}`, link: `/student/quizzes/${quiz.id}` })))
}

export async function createQuiz(db: Db, actor: Actor, input: QuizInput) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = actor.role === 'TEACHER' ? workspaceOf(actor) : actor.workspaceId
  if (!input.title.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (!input.isPublic && input.groupIds.length === 0 && input.studentIds.length === 0) throw new AppError('VALIDATION', { field: 'targets' })
  return db.transaction(async (tx) => {
    const [q] = await tx
      .insert(quizzes)
      .values({
        workspaceId,
        createdByUserId: actor.userId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        topic: input.topic?.trim() || null,
        skillId: input.skillId ?? null,
        timeLimitMinutes: input.timeLimitMinutes ?? null,
        maxAttempts: input.maxAttempts ?? 1,
        dueAt: input.dueAt ?? null,
        isPublic: input.isPublic ?? false,
        publishedAt: input.publish ? new Date() : null,
        maxScore: '0'
      })
      .returning()
    if (!q) throw new AppError('INTERNAL')
    const maxScore = await writeQuestions(tx, q.id, input.questions ?? [])
    await tx.update(quizzes).set({ maxScore: String(maxScore) }).where(eq(quizzes.id, q.id))
    await writeTargets(tx, actor, q.id, input.groupIds, input.studentIds)
    if (q.publishedAt) await notifyTargets(tx, q)
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'quiz.create', entityType: 'quiz', entityId: q.id, newValue: { title: q.title, questions: input.questions?.length ?? 0, maxScore } })
    return { ...q, maxScore: String(maxScore) }
  })
}

export async function updateQuiz(db: Db, actor: Actor, id: string, input: QuizInput) {
  const q = await assertQuizAccess(db, actor, id)
  if (!input.title.trim()) throw new AppError('VALIDATION', { field: 'title' })
  if (!input.isPublic && input.groupIds.length === 0 && input.studentIds.length === 0) throw new AppError('VALIDATION', { field: 'targets' })
  return db.transaction(async (tx) => {
    const [att] = await tx.select({ n: count() }).from(quizAttempts).where(eq(quizAttempts.quizId, q.id))
    let maxScore = Number(q.maxScore)
    if (input.questions !== undefined) {
      if ((att?.n ?? 0) > 0) throw new AppError('QUIZ_HAS_ATTEMPTS')
      maxScore = await writeQuestions(tx, q.id, input.questions)
    }
    const wasPublished = !!q.publishedAt
    const [row] = await tx
      .update(quizzes)
      .set({
        title: input.title.trim(),
        description: input.description?.trim() || null,
        topic: input.topic?.trim() || null,
        skillId: input.skillId ?? null,
        timeLimitMinutes: input.timeLimitMinutes ?? null,
        maxAttempts: input.maxAttempts ?? 1,
        dueAt: input.dueAt ?? null,
        isPublic: input.isPublic ?? false,
        publishedAt: input.publish ? (q.publishedAt ?? new Date()) : null,
        maxScore: String(maxScore)
      })
      .where(eq(quizzes.id, q.id))
      .returning()
    await writeTargets(tx, actor, q.id, input.groupIds, input.studentIds)
    if (row && !wasPublished && row.publishedAt) await notifyTargets(tx, row)
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: q.workspaceId, action: 'quiz.update', entityType: 'quiz', entityId: q.id, oldValue: { title: q.title }, newValue: { title: input.title } })
    return row
  })
}

export async function deleteQuiz(db: Db, actor: Actor, id: string) {
  const q = await assertQuizAccess(db, actor, id)
  await db.transaction(async (tx) => {
    await tx.update(quizzes).set({ deletedAt: new Date() }).where(eq(quizzes.id, q.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: q.workspaceId, action: 'quiz.delete', entityType: 'quiz', entityId: q.id, oldValue: { title: q.title } })
  })
}

export async function listQuizzesForTeacher(db: Db, actor: Actor) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const ws = actor.role === 'TEACHER' ? actor.workspaceId : null
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      topic: quizzes.topic,
      isPublic: quizzes.isPublic,
      publishedAt: quizzes.publishedAt,
      dueAt: quizzes.dueAt,
      maxScore: quizzes.maxScore,
      createdAt: quizzes.createdAt,
      questionsCount: sql<number>`(select count(*)::int from ${questions} qq where qq.quiz_id = ${qcol(quizzes.id)})`,
      attempts: sql<number>`(select count(*)::int from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.status <> 'IN_PROGRESS')`,
      pending: sql<number>`(select count(*)::int from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.status = 'SUBMITTED')`,
      average: sql<number | null>`(select avg(a.final_score) from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.status = 'REVIEWED')`
    })
    .from(quizzes)
    .where(and(ws ? eq(quizzes.workspaceId, ws) : undefined, isNull(quizzes.deletedAt)))
    .orderBy(desc(quizzes.createdAt))
}

export async function getQuizForEdit(db: Db, actor: Actor, id: string) {
  const q = await assertQuizAccess(db, actor, id)
  const qs = await db.select().from(questions).where(eq(questions.quizId, q.id)).orderBy(asc(questions.sortOrder))
  const opts = qs.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qs.map((x) => x.id))).orderBy(asc(questionOptions.sortOrder)) : []
  const targets = await db.select().from(quizTargets).where(eq(quizTargets.quizId, q.id))
  const [att] = await db.select({ n: count() }).from(quizAttempts).where(eq(quizAttempts.quizId, q.id))
  return {
    ...q,
    hasAttempts: (att?.n ?? 0) > 0,
    groupIds: targets.map((t) => t.groupId).filter((x): x is string => !!x),
    studentIds: targets.map((t) => t.studentId).filter((x): x is string => !!x),
    questions: qs.map((x) => ({ id: x.id, type: x.type, prompt: x.prompt, imageFileId: x.imageFileId, points: Number(x.points), skillId: x.skillId, answerKey: x.answerKey, options: opts.filter((o) => o.questionId === x.id).map((o) => ({ label: o.label, isCorrect: o.isCorrect })) }))
  }
}

export async function getQuizForTeacher(db: Db, actor: Actor, id: string) {
  const edit = await getQuizForEdit(db, actor, id)
  const eligible = await targetedStudentIds(db, id)
  const attempts = await db
    .select({ id: quizAttempts.id, studentId: quizAttempts.studentId, fullName: profiles.fullName, email: users.email, status: quizAttempts.status, startedAt: quizAttempts.startedAt, submittedAt: quizAttempts.submittedAt, autoScore: quizAttempts.autoScore, finalScore: quizAttempts.finalScore, needsReview: quizAttempts.needsReview })
    .from(quizAttempts)
    .innerJoin(students, eq(students.id, quizAttempts.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(quizAttempts.quizId, id))
    .orderBy(desc(quizAttempts.startedAt))
  const groupNames = edit.groupIds.length ? await db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, edit.groupIds)) : []
  return { ...edit, eligible: eligible.length, groupNames, attempts: attempts.map((a) => ({ ...a, fullName: a.fullName ?? a.email })) }
}

/* ------------------------------- Student ---------------------------------- */

async function studentGroupIds(db: Db, studentId: string) {
  return (await db.select({ groupId: groupStudents.groupId }).from(groupStudents).where(and(eq(groupStudents.studentId, studentId), eq(groupStudents.status, 'ACTIVE')))).map((r) => r.groupId)
}

export async function listQuizzesForStudent(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  const gids = await studentGroupIds(db, studentId)
  const targeted = db.select({ id: quizTargets.quizId }).from(quizTargets).where(or(gids.length ? inArray(quizTargets.groupId, gids) : sql`false`, eq(quizTargets.studentId, studentId)))
  return db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      topic: quizzes.topic,
      timeLimitMinutes: quizzes.timeLimitMinutes,
      maxScore: quizzes.maxScore,
      maxAttempts: quizzes.maxAttempts,
      dueAt: quizzes.dueAt,
      isPublic: quizzes.isPublic,
      teacherName: teachers.displayName,
      questionsCount: sql<number>`(select count(*)::int from ${questions} qq where qq.quiz_id = ${qcol(quizzes.id)})`,
      attemptsUsed: sql<number>`(select count(*)::int from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.student_id = ${studentId} and a.status <> 'IN_PROGRESS')`,
      inProgress: sql<string | null>`(select a.id from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.student_id = ${studentId} and a.status = 'IN_PROGRESS' limit 1)`,
      bestScore: sql<number | null>`(select max(a.final_score) from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.student_id = ${studentId} and a.status = 'REVIEWED')`,
      pending: sql<boolean>`exists(select 1 from ${quizAttempts} a where a.quiz_id = ${qcol(quizzes.id)} and a.student_id = ${studentId} and a.status = 'SUBMITTED')`
    })
    .from(quizzes)
    .leftJoin(teachers, eq(teachers.userId, quizzes.createdByUserId))
    .where(and(isNull(quizzes.deletedAt), isNotNull(quizzes.publishedAt), or(eq(quizzes.isPublic, true), inArray(quizzes.id, targeted))))
    .orderBy(desc(quizzes.publishedAt))
}

async function assertStudentQuizAccess(db: Db, studentId: string, quizId: string): Promise<QuizRow> {
  assertUuid(quizId, 'QUIZ_NOT_FOUND')
  const [q] = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), isNull(quizzes.deletedAt))).limit(1)
  if (!q) throw new AppError('QUIZ_NOT_FOUND')
  if (!q.publishedAt) throw new AppError('QUIZ_NOT_PUBLISHED')
  if (q.isPublic) return q
  const ids = await targetedStudentIds(db, quizId)
  if (!ids.includes(studentId)) throw new AppError('NOT_TARGETED')
  return q
}

/** الأسئلة للطالب بلا مفاتيح الإجابة */
export async function getQuizForStudent(db: Db, actor: Actor, quizId: string) {
  const studentId = studentIdOf(actor)
  const q = await assertStudentQuizAccess(db, studentId, quizId)
  const qs = await db.select().from(questions).where(eq(questions.quizId, q.id)).orderBy(asc(questions.sortOrder))
  const opts = qs.length ? await db.select({ id: questionOptions.id, questionId: questionOptions.questionId, label: questionOptions.label, sortOrder: questionOptions.sortOrder }).from(questionOptions).where(inArray(questionOptions.questionId, qs.map((x) => x.id))).orderBy(asc(questionOptions.sortOrder)) : []
  const attempts = await db
    .select({ id: quizAttempts.id, status: quizAttempts.status, startedAt: quizAttempts.startedAt, submittedAt: quizAttempts.submittedAt, expiresAt: quizAttempts.expiresAt, finalScore: quizAttempts.finalScore, autoScore: quizAttempts.autoScore, needsReview: quizAttempts.needsReview })
    .from(quizAttempts)
    .where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, studentId)))
    .orderBy(desc(quizAttempts.startedAt))
  const [teacher] = await db.select({ name: teachers.displayName }).from(teachers).where(eq(teachers.userId, q.createdByUserId)).limit(1)
  return {
    quiz: { ...q, teacherName: teacher?.name ?? null },
    questions: qs.map((x) => ({
      id: x.id,
      type: x.type,
      prompt: x.prompt,
      imageFileId: x.imageFileId,
      points: Number(x.points),
      options: opts.filter((o) => o.questionId === x.id).map((o) => ({ id: o.id, label: o.label })),
      /** للمطابقة: أطراف اليسار بالترتيب واليمين مخلوطة مع الفهرس الأصلي */
      matching: x.type === 'MATCHING' ? matchingView(x.answerKey) : null,
      blanksCount: x.type === 'FILL_BLANK' ? (x.prompt.match(/___/g) ?? []).length : 0
    })),
    attempts,
    inProgress: attempts.find((a) => a.status === 'IN_PROGRESS') ?? null,
    used: attempts.filter((a) => a.status !== 'IN_PROGRESS').length
  }
}

function matchingView(answerKey: Record<string, unknown> | null) {
  const pairs = Array.isArray(answerKey?.pairs) ? (answerKey!.pairs as { left: string; right: string }[]) : []
  const rights = pairs.map((p, i) => ({ index: i, label: p.right }))
  // خلط ثابت حسب الطول لتبقى نفس الترتيب في كل عرض
  const shuffled = [...rights].sort((a, b) => (a.label.localeCompare(b.label, 'ar')))
  return { lefts: pairs.map((p) => p.left), rights: shuffled }
}

export async function startAttempt(db: Db, actor: Actor, quizId: string, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const q = await assertStudentQuizAccess(db, studentId, quizId)
  if (q.dueAt && q.dueAt < now) throw new AppError('QUIZ_CLOSED')
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(quizAttempts).where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, studentId), eq(quizAttempts.status, 'IN_PROGRESS'))).limit(1)
    if (existing) return existing
    const [used] = await tx.select({ n: count() }).from(quizAttempts).where(and(eq(quizAttempts.quizId, q.id), eq(quizAttempts.studentId, studentId)))
    if ((used?.n ?? 0) >= q.maxAttempts) throw new AppError('ATTEMPT_LIMIT')
    const [row] = await tx
      .insert(quizAttempts)
      .values({ quizId: q.id, studentId, workspaceId: q.workspaceId, status: 'IN_PROGRESS', startedAt: now, expiresAt: q.timeLimitMinutes ? new Date(now.getTime() + q.timeLimitMinutes * 60_000) : null })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    return row
  })
}

async function finalizeAttempt(tx: Db, actor: Actor, attemptId: string, source: 'AUTO' | 'TEACHER', now: Date) {
  const [a] = await tx.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).for('update').limit(1)
  if (!a) throw new AppError('ATTEMPT_NOT_FOUND')
  const [q] = await tx.select().from(quizzes).where(eq(quizzes.id, a.quizId)).limit(1)
  if (!q) throw new AppError('QUIZ_NOT_FOUND')
  const rows = await tx
    .select({ score: answers.score, points: questions.points, skillId: questions.skillId })
    .from(answers)
    .innerJoin(questions, eq(questions.id, answers.questionId))
    .where(eq(answers.attemptId, attemptId))
  const finalScore = Math.round(rows.reduce((s, r) => s + Number(r.score ?? 0), 0) * 100) / 100
  await tx.update(quizAttempts).set({ status: 'REVIEWED', finalScore: String(finalScore), needsReview: false }).where(eq(quizAttempts.id, attemptId))

  const [existingGrade] = await tx.select({ id: grades.id }).from(grades).where(eq(grades.quizAttemptId, attemptId)).limit(1)
  const gradeValues = { score: String(finalScore), maxScore: q.maxScore, source, approvedByUserId: source === 'TEACHER' ? actor.userId : null, approvedAt: now, visibleToStudent: true }
  if (existingGrade) await tx.update(grades).set(gradeValues).where(eq(grades.id, existingGrade.id))
  else if (q.workspaceId) await tx.insert(grades).values({ workspaceId: q.workspaceId, studentId: a.studentId, quizAttemptId: attemptId, ...gradeValues })

  // المهارات: نسبة لكل مهارة من أسئلتها + المهارة العامة للاختبار
  const bySkill = new Map<string, { got: number; max: number }>()
  for (const r of rows) {
    if (!r.skillId) continue
    const s = bySkill.get(r.skillId) ?? { got: 0, max: 0 }
    s.got += Number(r.score ?? 0)
    s.max += Number(r.points)
    bySkill.set(r.skillId, s)
  }
  for (const [skillId, s] of bySkill) if (s.max > 0) await recordSkillResult(tx, { studentId: a.studentId, skillId, percent: (s.got / s.max) * 100, sourceType: 'QUIZ', sourceId: attemptId })
  if (q.skillId && !bySkill.has(q.skillId) && Number(q.maxScore) > 0) await recordSkillResult(tx, { studentId: a.studentId, skillId: q.skillId, percent: (finalScore / Number(q.maxScore)) * 100, sourceType: 'QUIZ', sourceId: attemptId })

  const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, a.studentId)).limit(1)
  await addTimeline(tx, { studentId: a.studentId, workspaceId: q.workspaceId, type: 'QUIZ_COMPLETED', title: `أنهى اختبار "${q.title}" بنتيجة ${finalScore}/${Number(q.maxScore)}`, meta: { quizId: q.id, attemptId }, occurredAt: now })
  if (st && source === 'TEACHER') await notify(tx, { userId: st.userId, workspaceId: q.workspaceId, type: 'NEW_GRADE', title: `نتيجة اختبار "${q.title}": ${finalScore}/${Number(q.maxScore)}`, link: `/student/quizzes/${q.id}` })
  return { finalScore, maxScore: Number(q.maxScore) }
}

/** إرسال إجابات المحاولة: تصحيح آلي للموضوعي، وانتظار الأستاذ للمقالي */
export async function submitAttempt(db: Db, actor: Actor, attemptId: string, studentAnswers: StudentAnswer[], now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  return db.transaction(async (tx) => {
    const [a] = await tx.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).for('update').limit(1)
    if (!a || a.studentId !== studentId) throw new AppError('ATTEMPT_NOT_FOUND')
    if (a.status !== 'IN_PROGRESS') throw new AppError('ATTEMPT_CLOSED')
    const qs = await tx.select().from(questions).where(eq(questions.quizId, a.quizId)).orderBy(asc(questions.sortOrder))
    const opts = qs.length ? await tx.select().from(questionOptions).where(inArray(questionOptions.questionId, qs.map((x) => x.id))) : []
    const byId = new Map(studentAnswers.map((x) => [x.questionId, x]))
    const results = qs.map((q) => {
      const r = gradeAnswer({ id: q.id, type: q.type, points: Number(q.points), answerKey: q.answerKey, options: opts.filter((o) => o.questionId === q.id).map((o) => ({ id: o.id, isCorrect: o.isCorrect })) }, byId.get(q.id))
      return { q, a: byId.get(q.id), r }
    })
    await tx.delete(answers).where(eq(answers.attemptId, a.id))
    if (results.length) {
      await tx.insert(answers).values(
        results.map(({ q, a: sa, r }) => ({
          attemptId: a.id,
          questionId: q.id,
          selectedOptionId: sa?.optionIds?.length === 1 ? sa.optionIds[0] : null,
          answerText: sa?.text ?? null,
          answerJson: sa ? ({ optionIds: sa.optionIds, value: sa.value, blanks: sa.blanks, matches: sa.matches } as Record<string, unknown>) : null,
          isCorrect: r.isCorrect,
          score: r.score === null ? null : String(r.score)
        }))
      )
    }
    const sum = summarize(results.map((x) => x.r))
    const late = a.expiresAt ? now.getTime() > a.expiresAt.getTime() + 60_000 : false
    await tx.update(quizAttempts).set({ status: 'SUBMITTED', submittedAt: now, autoScore: String(sum.autoScore), needsReview: sum.needsReview }).where(eq(quizAttempts.id, a.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: a.workspaceId, action: 'quiz.submit', entityType: 'quiz_attempt', entityId: a.id, newValue: { autoScore: sum.autoScore, needsReview: sum.needsReview, late } })
    if (!sum.needsReview) {
      const f = await finalizeAttempt(tx, actor, a.id, 'AUTO', now)
      return { attemptId: a.id, status: 'REVIEWED' as const, ...f, needsReview: false }
    }
    const [q] = await tx.select({ title: quizzes.title, createdBy: quizzes.createdByUserId, workspaceId: quizzes.workspaceId }).from(quizzes).where(eq(quizzes.id, a.quizId)).limit(1)
    if (q) await notify(tx, { userId: q.createdBy, workspaceId: q.workspaceId, type: 'SYSTEM', title: `${actor.fullName} أنهى اختبار "${q.title}" — أسئلة مقالية بانتظار التصحيح`, link: `/teacher/quizzes/${a.quizId}/attempts/${a.id}` })
    return { attemptId: a.id, status: 'SUBMITTED' as const, finalScore: null, maxScore: null, needsReview: true, autoScore: sum.autoScore }
  })
}

export interface AttemptView {
  attempt: typeof quizAttempts.$inferSelect
  quiz: QuizRow
  student: { id: string; fullName: string } | null
  items: {
    answerId: string | null
    questionId: string
    type: string
    prompt: string
    points: number
    score: number | null
    isCorrect: boolean | null
    answerText: string | null
    answerJson: Record<string, unknown> | null
    options: { id: string; label: string; isCorrect: boolean }[]
    answerKey: Record<string, unknown> | null
  }[]
}

async function loadAttempt(db: Db, attemptId: string, revealKeys: boolean): Promise<Omit<AttemptView, 'student'>> {
  assertUuid(attemptId, 'ATTEMPT_NOT_FOUND')
  const [a] = await db.select().from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1)
  if (!a) throw new AppError('ATTEMPT_NOT_FOUND')
  const [q] = await db.select().from(quizzes).where(eq(quizzes.id, a.quizId)).limit(1)
  if (!q) throw new AppError('QUIZ_NOT_FOUND')
  const qs = await db.select().from(questions).where(eq(questions.quizId, q.id)).orderBy(asc(questions.sortOrder))
  const opts = qs.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qs.map((x) => x.id))).orderBy(asc(questionOptions.sortOrder)) : []
  const ans = await db.select().from(answers).where(eq(answers.attemptId, a.id))
  return {
    attempt: a,
    quiz: q,
    items: qs.map((x) => {
      const an = ans.find((y) => y.questionId === x.id)
      return {
        answerId: an?.id ?? null,
        questionId: x.id,
        type: x.type,
        prompt: x.prompt,
        points: Number(x.points),
        score: an?.score === null || an?.score === undefined ? null : Number(an.score),
        isCorrect: an?.isCorrect ?? null,
        answerText: an?.answerText ?? null,
        answerJson: an?.answerJson ?? null,
        options: opts.filter((o) => o.questionId === x.id).map((o) => ({ id: o.id, label: o.label, isCorrect: revealKeys ? o.isCorrect : false })),
        answerKey: revealKeys ? x.answerKey : null
      }
    })
  }
}

export async function getAttemptForStudent(db: Db, actor: Actor, attemptId: string): Promise<AttemptView> {
  const studentId = studentIdOf(actor)
  assertUuid(attemptId, 'ATTEMPT_NOT_FOUND')
  const [a] = await db.select({ studentId: quizAttempts.studentId, status: quizAttempts.status }).from(quizAttempts).where(eq(quizAttempts.id, attemptId)).limit(1)
  if (!a || a.studentId !== studentId) throw new AppError('ATTEMPT_NOT_FOUND')
  const v = await loadAttempt(db, attemptId, a.status === 'REVIEWED')
  return { ...v, student: null }
}

export async function getAttemptForTeacher(db: Db, actor: Actor, attemptId: string): Promise<AttemptView> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const v = await loadAttempt(db, attemptId, true)
  if (actor.role === 'TEACHER' && v.quiz.workspaceId !== actor.workspaceId) throw new AppError('ATTEMPT_NOT_FOUND')
  const [st] = await db.select({ id: students.id, fullName: profiles.fullName, email: users.email }).from(students).innerJoin(users, eq(users.id, students.userId)).leftJoin(profiles, eq(profiles.userId, users.id)).where(eq(students.id, v.attempt.studentId))
  return { ...v, student: st ? { id: st.id, fullName: st.fullName ?? st.email } : null }
}

/** الأستاذ يضع نقاط الأسئلة المقالية ثم يعتمد النتيجة */
export async function reviewAttempt(db: Db, actor: Actor, attemptId: string, scores: Record<string, number>, now: Date = new Date()) {
  const v = await getAttemptForTeacher(db, actor, attemptId)
  if (v.attempt.status === 'IN_PROGRESS') throw new AppError('ATTEMPT_NOT_SUBMITTED')
  return db.transaction(async (tx) => {
    for (const item of v.items) {
      if (item.type !== 'LONG_ANSWER' && !(item.type === 'IMAGE' && item.options.length === 0)) continue
      if (!item.answerId) continue
      const s = scores[item.answerId]
      if (s === undefined || !Number.isFinite(s) || s < 0 || s > item.points) throw new AppError('INVALID_SCORE')
      await tx.update(answers).set({ score: String(s), isCorrect: s >= item.points }).where(eq(answers.id, item.answerId))
    }
    const f = await finalizeAttempt(tx, actor, attemptId, 'TEACHER', now)
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: v.quiz.workspaceId, action: 'quiz.review', entityType: 'quiz_attempt', entityId: attemptId, oldValue: { finalScore: v.attempt.finalScore }, newValue: { finalScore: f.finalScore } })
    return f
  })
}

/** الاختبارات العامة للزوار (بلا أسئلة) */
export async function listPublicQuizzesCards(db: Db) {
  return db
    .select({ id: quizzes.id, title: quizzes.title, description: quizzes.description, topic: quizzes.topic, timeLimitMinutes: quizzes.timeLimitMinutes, maxScore: quizzes.maxScore, skillName: skills.nameAr, questionsCount: sql<number>`(select count(*)::int from ${questions} qq where qq.quiz_id = ${qcol(quizzes.id)})` })
    .from(quizzes)
    .leftJoin(skills, eq(skills.id, quizzes.skillId))
    .where(and(eq(quizzes.isPublic, true), isNotNull(quizzes.publishedAt), isNull(quizzes.deletedAt)))
    .orderBy(desc(quizzes.publishedAt))
}
