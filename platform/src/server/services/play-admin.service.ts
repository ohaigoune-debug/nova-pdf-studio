/**
 * MADRASADZ PLAY — خدمة الإدارة: تصفية البنك، المراجعة والاعتماد، التعليق، البلاغات، التغطية، الإحصاءات.
 * للمشرف العام فقط (بنك عام على مستوى المنصة).
 */
import { and, asc, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { playAnswers, playLessons, playQuestionReports, playQuestions, playSessions, playStudentStats, playSubjects } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { PLAY_GRADES, PLAY_REVIEW_STATUSES, type PlayDifficulty, type PlayQuestionType, type PlayReportStatus, type PlayReviewStatus } from '@/server/play/constants'
import { contentHash, normalizeContentQuestion, validateContentQuestion } from '@/server/play/engine'
import type { PlayContentQuestion } from '@/server/play/question-types'

export interface QuestionFilter {
  grade?: string | null
  stream?: string | null
  subject?: string | null
  unit?: string | null
  lessonId?: string | null
  type?: PlayQuestionType | null
  difficulty?: PlayDifficulty | null
  status?: PlayReviewStatus | null
  search?: string | null
  suspended?: boolean | null
  reported?: boolean | null
  page?: number
  pageSize?: number
}

function filterConds(f: QuestionFilter) {
  const conds = [isNull(playQuestions.deletedAt)]
  if (f.grade) conds.push(eq(playQuestions.gradeCode, f.grade))
  if (f.stream) conds.push(sql`(cardinality(${playQuestions.streamCodes}) = 0 OR ${f.stream} = ANY(${playQuestions.streamCodes}))`)
  if (f.subject) conds.push(eq(playQuestions.subjectCode, f.subject))
  if (f.unit) conds.push(eq(playQuestions.unitCode, f.unit))
  if (f.lessonId) conds.push(eq(playQuestions.lessonId, f.lessonId))
  if (f.type) conds.push(eq(playQuestions.type, f.type))
  if (f.difficulty) conds.push(eq(playQuestions.difficulty, f.difficulty))
  if (f.status) conds.push(eq(playQuestions.reviewStatus, f.status))
  if (f.suspended) conds.push(eq(playQuestions.isSuspended, true))
  if (f.reported) conds.push(sql`${playQuestions.reportsCount} > 0`)
  if (f.search?.trim()) {
    const term = `%${f.search.trim()}%`
    conds.push(or(ilike(playQuestions.questionText, term), ilike(playQuestions.key, term), ilike(playQuestions.explanation, term))!)
  }
  return and(...conds)
}

export async function listQuestionsAdmin(db: Db, actor: Actor, f: QuestionFilter) {
  assertRole(actor, 'SUPER_ADMIN')
  const page = Math.max(1, f.page ?? 1)
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 25))
  const where = filterConds(f)
  const [totalRow] = await db.select({ total: count() }).from(playQuestions).where(where)
  const total = totalRow?.total ?? 0
  const items = await db
    .select({
      id: playQuestions.id,
      key: playQuestions.key,
      type: playQuestions.type,
      gradeCode: playQuestions.gradeCode,
      streamCodes: playQuestions.streamCodes,
      subjectCode: playQuestions.subjectCode,
      unitCode: playQuestions.unitCode,
      lessonCode: playQuestions.lessonCode,
      lessonName: playLessons.lessonName,
      difficulty: playQuestions.difficulty,
      questionText: playQuestions.questionText,
      reviewStatus: playQuestions.reviewStatus,
      isSuspended: playQuestions.isSuspended,
      qualityFlags: playQuestions.qualityFlags,
      timesServed: playQuestions.timesServed,
      timesCorrect: playQuestions.timesCorrect,
      timesWrong: playQuestions.timesWrong,
      reportsCount: playQuestions.reportsCount,
      updatedAt: playQuestions.updatedAt
    })
    .from(playQuestions)
    .innerJoin(playLessons, eq(playLessons.id, playQuestions.lessonId))
    .where(where)
    .orderBy(desc(playQuestions.reportsCount), asc(playQuestions.key))
    .limit(pageSize)
    .offset((page - 1) * pageSize)
  return { items, total: Number(total), page, pageSize }
}

export async function getQuestionAdmin(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PLAY_QUESTION_NOT_FOUND')
  const [row] = await db
    .select({ q: playQuestions, lessonName: playLessons.lessonName, unitName: playLessons.unitName })
    .from(playQuestions)
    .innerJoin(playLessons, eq(playLessons.id, playQuestions.lessonId))
    .where(eq(playQuestions.id, id))
    .limit(1)
  if (!row) throw new AppError('PLAY_QUESTION_NOT_FOUND')
  const reports = await db.select().from(playQuestionReports).where(eq(playQuestionReports.questionId, id)).orderBy(desc(playQuestionReports.createdAt)).limit(20)
  return { ...row.q, lessonName: row.lessonName, unitName: row.unitName, reports }
}

export async function setReviewStatus(db: Db, actor: Actor, id: string, status: PlayReviewStatus, note?: string | null) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PLAY_QUESTION_NOT_FOUND')
  if (!PLAY_REVIEW_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  const [prev] = await db.select({ reviewStatus: playQuestions.reviewStatus }).from(playQuestions).where(eq(playQuestions.id, id)).limit(1)
  if (!prev) throw new AppError('PLAY_QUESTION_NOT_FOUND')
  await db
    .update(playQuestions)
    .set({ reviewStatus: status, reviewedByUserId: actor.userId, reviewedAt: new Date(), note: note === undefined ? undefined : note })
    .where(eq(playQuestions.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.review', entityType: 'play_question', entityId: id, oldValue: { status: prev.reviewStatus }, newValue: { status } })
}

export async function bulkSetReviewStatus(db: Db, actor: Actor, ids: string[], status: PlayReviewStatus) {
  assertRole(actor, 'SUPER_ADMIN')
  if (!PLAY_REVIEW_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  const valid = ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 500)
  if (!valid.length) return 0
  const rows = await db.update(playQuestions).set({ reviewStatus: status, reviewedByUserId: actor.userId, reviewedAt: new Date() }).where(inArray(playQuestions.id, valid)).returning({ id: playQuestions.id })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.bulk_review', entityType: 'play_question', entityId: null, oldValue: null, newValue: { status, count: rows.length } })
  return rows.length
}

/** اعتماد جماعي بالتصفية (مثلاً كل AUTO_VALIDATED في مادة) */
export async function bulkReviewByFilter(db: Db, actor: Actor, f: QuestionFilter, status: PlayReviewStatus) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db.update(playQuestions).set({ reviewStatus: status, reviewedByUserId: actor.userId, reviewedAt: new Date() }).where(filterConds(f)).returning({ id: playQuestions.id })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.bulk_review_filter', entityType: 'play_question', entityId: null, oldValue: null, newValue: { status, count: rows.length, filter: f as Record<string, unknown> } })
  return rows.length
}

export async function setSuspended(db: Db, actor: Actor, id: string, suspended: boolean) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PLAY_QUESTION_NOT_FOUND')
  await db.update(playQuestions).set({ isSuspended: suspended }).where(eq(playQuestions.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: suspended ? 'play.question.suspend' : 'play.question.unsuspend', entityType: 'play_question', entityId: id, oldValue: null, newValue: { suspended } })
}

export async function archiveQuestion(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'PLAY_QUESTION_NOT_FOUND')
  await db.update(playQuestions).set({ deletedAt: new Date(), isSuspended: true }).where(eq(playQuestions.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.archive', entityType: 'play_question', entityId: id, oldValue: null, newValue: null })
}

/** إنشاء/تعديل سؤال يدوياً من اللوحة (بصيغة ملف المحتوى نفسها) */
export async function upsertQuestionManual(db: Db, actor: Actor, input: PlayContentQuestion, existingId?: string | null) {
  assertRole(actor, 'SUPER_ADMIN')
  const v = validateContentQuestion(input)
  if (v.errors.length) throw new AppError('VALIDATION', { reasons: v.errors })
  const [lesson] = await db
    .select({ id: playLessons.id })
    .from(playLessons)
    .where(and(eq(playLessons.gradeCode, input.grade), eq(playLessons.subjectCode, input.subject), eq(playLessons.unitCode, input.unit), eq(playLessons.lessonCode, input.lesson)))
    .orderBy(sql`cardinality(${playLessons.streamCodes})`)
    .limit(1)
  if (!lesson) throw new AppError('PLAY_LESSON_NOT_FOUND')
  const n = normalizeContentQuestion({ ...input, source: input.source ?? 'TEACHER' })
  const base = {
    type: n.type,
    gradeCode: n.gradeCode,
    streamCodes: n.streamCodes,
    subjectCode: n.subjectCode,
    lessonId: lesson.id,
    unitCode: n.unitCode,
    lessonCode: n.lessonCode,
    objective: n.objective,
    difficulty: n.difficulty,
    language: n.language,
    questionText: n.questionText,
    payload: n.payload,
    answerKey: n.answerKey,
    explanation: n.explanation,
    tags: n.tags,
    contentHash: contentHash(input),
    source: n.source,
    qualityFlags: v.warnings,
    note: n.note,
    reviewStatus: input.reviewStatus ?? 'APPROVED',
    reviewedByUserId: actor.userId,
    reviewedAt: new Date()
  }
  if (existingId) {
    assertUuid(existingId, 'PLAY_QUESTION_NOT_FOUND')
    const [row] = await db.update(playQuestions).set({ ...base, updatedAt: new Date() }).where(eq(playQuestions.id, existingId)).returning({ id: playQuestions.id })
    if (!row) throw new AppError('PLAY_QUESTION_NOT_FOUND')
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.update', entityType: 'play_question', entityId: row.id, oldValue: null, newValue: { key: n.key } })
    return row.id
  }
  const [row] = await db
    .insert(playQuestions)
    .values({ key: n.key, ...base })
    .onConflictDoUpdate({ target: playQuestions.key, set: { ...base, updatedAt: new Date(), deletedAt: null } })
    .returning({ id: playQuestions.id })
  if (!row) throw new AppError('INTERNAL')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'play.question.create', entityType: 'play_question', entityId: row.id, oldValue: null, newValue: { key: n.key } })
  return row.id
}

/* -------------------------------- البلاغات -------------------------------- */

export async function listReports(db: Db, actor: Actor, status: PlayReportStatus | null = 'OPEN', limit = 100) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: playQuestionReports.id,
      questionId: playQuestionReports.questionId,
      key: playQuestions.key,
      questionText: playQuestions.questionText,
      reason: playQuestionReports.reason,
      message: playQuestionReports.message,
      status: playQuestionReports.status,
      createdAt: playQuestionReports.createdAt,
      isSuspended: playQuestions.isSuspended
    })
    .from(playQuestionReports)
    .innerJoin(playQuestions, eq(playQuestions.id, playQuestionReports.questionId))
    .where(status ? eq(playQuestionReports.status, status) : undefined)
    .orderBy(desc(playQuestionReports.createdAt))
    .limit(limit)
}

export async function resolveReport(db: Db, actor: Actor, id: string, status: 'RESOLVED' | 'DISMISSED', resolution?: string | null) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'NOT_FOUND')
  const [row] = await db.update(playQuestionReports).set({ status, resolvedByUserId: actor.userId, resolvedAt: new Date(), resolution: resolution?.trim() || null }).where(eq(playQuestionReports.id, id)).returning({ id: playQuestionReports.id })
  if (!row) throw new AppError('NOT_FOUND')
}

/* ------------------------------ نظرة عامة ------------------------------ */

export async function playAdminOverview(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const byStatus = await db.select({ status: playQuestions.reviewStatus, n: count() }).from(playQuestions).where(isNull(playQuestions.deletedAt)).groupBy(playQuestions.reviewStatus)
  const byGrade = await db.select({ grade: playQuestions.gradeCode, n: count() }).from(playQuestions).where(isNull(playQuestions.deletedAt)).groupBy(playQuestions.gradeCode)
  const byType = await db.select({ type: playQuestions.type, n: count() }).from(playQuestions).where(isNull(playQuestions.deletedAt)).groupBy(playQuestions.type)
  const byDifficulty = await db.select({ difficulty: playQuestions.difficulty, n: count() }).from(playQuestions).where(isNull(playQuestions.deletedAt)).groupBy(playQuestions.difficulty)
  const [reports] = await db.select({ n: count() }).from(playQuestionReports).where(eq(playQuestionReports.status, 'OPEN'))
  const [players] = await db.select({ n: count() }).from(playStudentStats)
  const [sessions] = await db.select({ n: count() }).from(playSessions)
  const [answers] = await db.select({ n: count() }).from(playAnswers)
  const [suspended] = await db.select({ n: count() }).from(playQuestions).where(and(isNull(playQuestions.deletedAt), eq(playQuestions.isSuspended, true)))
  const total = byStatus.reduce((a, b) => a + Number(b.n), 0)
  return {
    total,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    byGrade: Object.fromEntries(byGrade.map((r) => [r.grade, Number(r.n)])) as Record<string, number>,
    byType: Object.fromEntries(byType.map((r) => [r.type, Number(r.n)])) as Record<string, number>,
    byDifficulty: Object.fromEntries(byDifficulty.map((r) => [r.difficulty, Number(r.n)])) as Record<string, number>,
    openReports: Number(reports?.n ?? 0),
    players: Number(players?.n ?? 0),
    sessions: Number(sessions?.n ?? 0),
    answers: Number(answers?.n ?? 0),
    suspended: Number(suspended?.n ?? 0)
  }
}

/** تغطية المنهاج: لكل (سنة، مادة) عدد الدروس وعدد الدروس بلا أسئلة وعدد الأسئلة */
export async function coverageMatrix(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({
      gradeCode: playLessons.gradeCode,
      subjectCode: playLessons.subjectCode,
      subjectName: playSubjects.nameAr,
      lessons: sql<number>`count(distinct ${playLessons.id})`.mapWith(Number),
      lessonsWithQuestions: sql<number>`count(distinct case when ${playQuestions.id} is not null then ${playLessons.id} end)`.mapWith(Number),
      questions: sql<number>`count(${playQuestions.id})`.mapWith(Number),
      verifiedLessons: sql<number>`count(distinct case when ${playLessons.verified} then ${playLessons.id} end)`.mapWith(Number)
    })
    .from(playLessons)
    .innerJoin(playSubjects, eq(playSubjects.code, playLessons.subjectCode))
    .leftJoin(playQuestions, and(eq(playQuestions.lessonId, playLessons.id), isNull(playQuestions.deletedAt)))
    .groupBy(playLessons.gradeCode, playLessons.subjectCode, playSubjects.nameAr)
  const order = new Map(PLAY_GRADES.map((g) => [g.code, g.sortOrder]))
  return rows.sort((a, b) => (order.get(a.gradeCode) ?? 99) - (order.get(b.gradeCode) ?? 99) || a.subjectCode.localeCompare(b.subjectCode))
}

/** الدروس التي تفتقر إلى أسئلة (أقل من الحد) */
export async function lessonsLackingQuestions(db: Db, actor: Actor, minQuestions = 3, limit = 200) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: playLessons.id,
      gradeCode: playLessons.gradeCode,
      subjectCode: playLessons.subjectCode,
      streamCodes: playLessons.streamCodes,
      unitName: playLessons.unitName,
      lessonCode: playLessons.lessonCode,
      lessonName: playLessons.lessonName,
      verified: playLessons.verified,
      questions: sql<number>`count(${playQuestions.id})`.mapWith(Number)
    })
    .from(playLessons)
    .leftJoin(playQuestions, and(eq(playQuestions.lessonId, playLessons.id), isNull(playQuestions.deletedAt)))
    .where(eq(playLessons.isActive, true))
    .groupBy(playLessons.id)
    .having(sql`count(${playQuestions.id}) < ${minQuestions}`)
    .orderBy(asc(playLessons.gradeCode), asc(playLessons.subjectCode), asc(playLessons.unitOrder), asc(playLessons.lessonOrder))
    .limit(limit)
}

/** الأسئلة الأكثر خطأً (بعد 10 عرضات على الأقل) */
export async function hardestQuestions(db: Db, actor: Actor, limit = 30) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: playQuestions.id,
      key: playQuestions.key,
      questionText: playQuestions.questionText,
      subjectCode: playQuestions.subjectCode,
      gradeCode: playQuestions.gradeCode,
      difficulty: playQuestions.difficulty,
      timesCorrect: playQuestions.timesCorrect,
      timesWrong: playQuestions.timesWrong,
      wrongRate: sql<number>`round(100.0 * ${playQuestions.timesWrong} / nullif(${playQuestions.timesCorrect} + ${playQuestions.timesWrong}, 0))`.mapWith(Number)
    })
    .from(playQuestions)
    .where(and(isNull(playQuestions.deletedAt), sql`${playQuestions.timesCorrect} + ${playQuestions.timesWrong} >= 10`))
    .orderBy(desc(sql`1.0 * ${playQuestions.timesWrong} / nullif(${playQuestions.timesCorrect} + ${playQuestions.timesWrong}, 0)`))
    .limit(limit)
}

/** الأسئلة المكررة (نفس بصمة المحتوى) */
export async function duplicateGroups(db: Db, actor: Actor, limit = 100) {
  assertRole(actor, 'SUPER_ADMIN')
  const groups = await db
    .select({ hash: playQuestions.contentHash, n: count(), keys: sql<string[]>`array_agg(${playQuestions.key} order by ${playQuestions.key})` })
    .from(playQuestions)
    .where(isNull(playQuestions.deletedAt))
    .groupBy(playQuestions.contentHash)
    .having(sql`count(*) > 1`)
    .orderBy(desc(count()))
    .limit(limit)
  return groups.map((g) => ({ hash: g.hash, count: Number(g.n), keys: g.keys }))
}

/** تصدير الأسئلة (للنسخ الاحتياطي/المراجعة الخارجية) بصيغة ملف المحتوى */
export async function exportQuestions(db: Db, actor: Actor, f: QuestionFilter, limit = 5000) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db.select().from(playQuestions).where(filterConds(f)).orderBy(asc(playQuestions.key)).limit(limit)
  return rows.map((r) => ({
    key: r.key,
    type: r.type,
    grade: r.gradeCode,
    streams: r.streamCodes,
    subject: r.subjectCode,
    unit: r.unitCode,
    lesson: r.lessonCode,
    objective: r.objective,
    difficulty: r.difficulty,
    language: r.language,
    question: r.questionText,
    payload: r.payload,
    answerKey: r.answerKey,
    explanation: r.explanation,
    tags: r.tags,
    reviewStatus: r.reviewStatus,
    source: r.source,
    qualityFlags: r.qualityFlags
  }))
}
