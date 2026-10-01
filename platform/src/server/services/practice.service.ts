/**
 * التدريب الذاتي للتلميذ (Exam Builder — المرحلة 7).
 * التلميذ يختار مادة (ودرساً وصعوبة اختياريين) ← سلسلة أسئلة قابلة للتصحيح الآلي من البنك
 * (منشورة وعامة فقط، بمستواه وشعبته) ← يجيب سؤالاً سؤالاً ويرى الصواب والحلّ فوراً ←
 * ملخّص بنقاط الضعف حسب الدرس. لا يُكشف مفتاح الإجابة قبل الجواب.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bankQuestions, curriculumNodes, practiceAnswers, practiceSessions, studentNodeProgress, students, subjects, type BankQuestionRow, type PracticeAnswerRow, type PracticeSessionRow } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { answerKeyText, shuffleWith } from '@/server/lib/exam-render'
import { gradeAnswer, type StudentAnswer } from '@/server/lib/quiz-grading'
import { recordNodeResult, targetDifficulties } from './adaptive.service'

/** الأنواع التي تُصحَّح آلياً (الأسئلة المفتوحة تُترك للامتحانات والواجبات) */
export const PRACTICE_TYPES = ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING'] as const
const MAX_COUNT = 30
const DEFAULT_COUNT = 10

export interface StartPracticeInput {
  subjectId: string
  curriculumNodeId?: string | null
  difficulty?: number | null
  count?: number
  /** تكيّفي: الصعوبة من تقدّم التلميذ بالدرس (يُهمل إن حُدّدت صعوبة) */
  adaptive?: boolean
}

const me = (actor: Actor): string => {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  return actor.studentId
}

async function studentScope(db: Db, studentId: string) {
  const [s] = await db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
  return { levelId: s?.levelId ?? null, streamId: s?.streamId ?? null }
}

/** شرط الأسئلة المتاحة للتدريب: منشورة عامة، رئيسية، من نوع قابل للتصحيح، بمستوى التلميذ (أو بلا مستوى) */
function poolWhere(scope: { levelId: string | null; streamId: string | null }, subjectId?: string | null) {
  return and(
    isNull(bankQuestions.deletedAt),
    isNull(bankQuestions.parentId),
    eq(bankQuestions.status, 'PUBLISHED'),
    eq(bankQuestions.visibility, 'PUBLIC'),
    inArray(bankQuestions.type, [...PRACTICE_TYPES]),
    subjectId ? eq(bankQuestions.subjectId, subjectId) : undefined,
    scope.levelId ? or(eq(bankQuestions.levelId, scope.levelId), isNull(bankQuestions.levelId)) : undefined,
    scope.streamId ? or(eq(bankQuestions.streamId, scope.streamId), isNull(bankQuestions.streamId)) : undefined
  )
}

/** العقدة وكل فروعها (الدرس وما تحته) */
async function subtreeIds(db: Db, rootId: string): Promise<string[]> {
  const ids = [rootId]
  let frontier = [rootId]
  for (let depth = 0; depth < 6 && frontier.length; depth++) {
    const rows = await db.select({ id: curriculumNodes.id }).from(curriculumNodes).where(inArray(curriculumNodes.parentId, frontier))
    frontier = rows.map((r) => r.id).filter((id) => !ids.includes(id))
    ids.push(...frontier)
  }
  return ids
}

export interface PracticeOptions {
  subjects: { id: string; name: string; questions: number }[]
  /** الدروس التي فيها أسئلة، للمادة المختارة */
  nodes: { id: string; title: string; questions: number }[]
}

/** ما يمكن للتلميذ التدرّب عليه الآن: المواد (بعدد الأسئلة) والدروس داخل مادة */
export async function practiceOptions(db: Db, actor: Actor, subjectId?: string | null): Promise<PracticeOptions> {
  const studentId = me(actor)
  const scope = await studentScope(db, studentId)
  const subjectRows = await db
    .select({ id: subjects.id, name: subjects.nameAr, questions: sql<number>`count(*)::int` })
    .from(bankQuestions)
    .innerJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .where(poolWhere(scope))
    .groupBy(subjects.id, subjects.nameAr, subjects.sortOrder)
    .orderBy(asc(subjects.sortOrder))
  let nodes: PracticeOptions['nodes'] = []
  if (subjectId) {
    assertUuid(subjectId, 'VALIDATION')
    nodes = await db
      .select({ id: curriculumNodes.id, title: curriculumNodes.title, questions: sql<number>`count(*)::int` })
      .from(bankQuestions)
      .innerJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
      .where(poolWhere(scope, subjectId))
      .groupBy(curriculumNodes.id, curriculumNodes.title, curriculumNodes.sortOrder)
      .orderBy(asc(curriculumNodes.sortOrder))
  }
  return { subjects: subjectRows, nodes }
}

/** بدء جلسة: اختيار عشوائي يفضّل ما لم يره التلميذ في آخر 30 يوماً */
export async function startPractice(db: Db, actor: Actor, input: StartPracticeInput): Promise<PracticeSessionRow> {
  const studentId = me(actor)
  assertUuid(input.subjectId, 'VALIDATION')
  if (input.curriculumNodeId) assertUuid(input.curriculumNodeId, 'VALIDATION')
  if (input.difficulty != null && ![1, 2, 3, 4].includes(input.difficulty)) throw new AppError('VALIDATION', { field: 'difficulty' })
  const count = Math.min(MAX_COUNT, Math.max(1, Math.round(input.count ?? DEFAULT_COUNT)))
  const scope = await studentScope(db, studentId)
  const nodeIds = input.curriculumNodeId ? await subtreeIds(db, input.curriculumNodeId) : null
  const since = new Date(Date.now() - 30 * 24 * 3600_000)
  const seen = sql<number>`(select count(*) from ${practiceAnswers} pa where pa.question_id = ${bankQuestions.id} and pa.student_id = ${studentId} and pa.answered_at >= ${since})`
  const adaptive = Boolean(input.adaptive) && !input.difficulty
  const candidates = await db
    .select({ id: bankQuestions.id, points: bankQuestions.points, difficulty: bankQuestions.difficulty, nodeId: bankQuestions.curriculumNodeId })
    .from(bankQuestions)
    .where(and(poolWhere(scope, input.subjectId), nodeIds ? inArray(bankQuestions.curriculumNodeId, nodeIds) : undefined, input.difficulty ? eq(bankQuestions.difficulty, input.difficulty) : undefined))
    .orderBy(asc(seen), sql`random()`)
    .limit(adaptive ? count * 4 : count)
  let rows = candidates
  if (adaptive && candidates.length > count) {
    // الصعوبة المناسبة لكل درس من تقدّم التلميذ؛ ما يطابقها أولاً، ثم الباقي لإكمال العدد
    const nodeIdsSeen = [...new Set(candidates.map((c) => c.nodeId).filter((x): x is string => Boolean(x)))]
    const progress = nodeIdsSeen.length ? await db.select().from(studentNodeProgress).where(and(eq(studentNodeProgress.studentId, studentId), inArray(studentNodeProgress.curriculumNodeId, nodeIdsSeen))) : []
    const byNode = new Map(progress.map((p) => [p.curriculumNodeId, p]))
    const fits = candidates.filter((c) => targetDifficulties(c.nodeId ? (byNode.get(c.nodeId) ?? null) : null).includes(c.difficulty))
    const rest = candidates.filter((c) => !fits.includes(c))
    rows = [...fits, ...rest].slice(0, count)
  }
  if (rows.length === 0) throw new AppError('PRACTICE_NO_QUESTIONS')
  const session = await db.transaction(async (tx) => {
    const [s] = await tx
      .insert(practiceSessions)
      .values({ studentId, subjectId: input.subjectId, levelId: scope.levelId, streamId: scope.streamId, curriculumNodeId: input.curriculumNodeId ?? null, difficulty: input.difficulty ?? null, questionCount: rows.length })
      .returning()
    await tx.insert(practiceAnswers).values(rows.map((r, i) => ({ sessionId: s!.id, studentId, questionId: r.id, position: i, points: r.points })))
    return s!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'practice.start', entityType: 'practice_session', entityId: session.id, newValue: { subjectId: input.subjectId, count: rows.length, difficulty: input.difficulty ?? null } })
  return session
}

async function ownSession(db: Db, actor: Actor, id: string): Promise<PracticeSessionRow> {
  const studentId = me(actor)
  assertUuid(id, 'PRACTICE_NOT_FOUND')
  const [s] = await db.select().from(practiceSessions).where(and(eq(practiceSessions.id, id), eq(practiceSessions.studentId, studentId))).limit(1)
  if (!s) throw new AppError('PRACTICE_NOT_FOUND')
  return s
}

export interface PracticeQuestionView {
  id: string
  position: number
  type: string
  body: string
  points: number
  difficulty: number
  options: { id: string; label: string }[]
  blanksCount: number
  matching: { lefts: string[]; rights: { index: number; label: string }[] } | null
  nodeTitle: string | null
  /** بعد الإجابة فقط */
  result: PracticeAnswerResult | null
}

export interface PracticeAnswerResult {
  isCorrect: boolean
  score: number
  points: number
  /** الإجابة الصحيحة نصّاً (للتعلّم) */
  correctText: string | null
  /** فهارس الاختيارات الصحيحة (MCQ) */
  correctOptionIds: string[]
  solution: string | null
  answer: Record<string, unknown> | null
}

export interface PracticeView {
  session: PracticeSessionRow & { subjectName: string | null; nodeTitle: string | null }
  questions: PracticeQuestionView[]
  summary: PracticeSummary | null
}

export interface PracticeSummary {
  answered: number
  correct: number
  total: number
  scorePct: number
  /** حسب الدرس: الصواب/المجموع — ما دون 60% نقطة ضعف */
  byNode: { title: string; correct: number; total: number }[]
  weak: string[]
}

function resultOf(q: Pick<BankQuestionRow, 'type' | 'options' | 'answerKey' | 'solution'>, a: PracticeAnswerRow): PracticeAnswerResult {
  return {
    isCorrect: Boolean(a.isCorrect),
    score: Number(a.score ?? 0),
    points: Number(a.points),
    correctText: answerKeyText(q.type, q.answerKey, q.options),
    correctOptionIds: q.options.map((o, i) => (o.isCorrect ? String(i) : null)).filter((x): x is string => x !== null),
    solution: q.solution,
    answer: a.answer
  }
}

function viewOf(q: BankQuestionRow & { nodeTitle: string | null }, a: PracticeAnswerRow, sessionId: string): PracticeQuestionView {
  const key = (q.answerKey ?? {}) as Record<string, unknown>
  const pairs = q.type === 'MATCHING' && Array.isArray(key.pairs) ? (key.pairs as { left: string; right: string }[]) : []
  let seed = 0
  for (const ch of sessionId + q.id) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  return {
    id: q.id,
    position: a.position,
    type: q.type,
    body: q.body,
    points: Number(q.points),
    difficulty: q.difficulty,
    options: q.options.map((o, i) => ({ id: String(i), label: o.label })),
    blanksCount: (q.body.match(/___/g) ?? []).length,
    matching: pairs.length ? { lefts: pairs.map((p) => p.left), rights: shuffleWith(pairs.map((p, index) => ({ index, label: p.right })), seed) } : null,
    nodeTitle: q.nodeTitle,
    result: a.answeredAt ? resultOf(q, a) : null
  }
}

async function loadQuestions(db: Db, session: PracticeSessionRow) {
  const answers = await db.select().from(practiceAnswers).where(eq(practiceAnswers.sessionId, session.id)).orderBy(asc(practiceAnswers.position))
  const qs = answers.length
    ? await db
        .select({ q: bankQuestions, nodeTitle: curriculumNodes.title })
        .from(bankQuestions)
        .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
        .where(inArray(bankQuestions.id, answers.map((a) => a.questionId)))
    : []
  const byId = new Map(qs.map((r) => [r.q.id, { ...r.q, nodeTitle: r.nodeTitle }]))
  return answers.map((a) => ({ a, q: byId.get(a.questionId)! })).filter((x) => x.q)
}

function summarize(items: { a: PracticeAnswerRow; q: { nodeTitle: string | null } }[]): PracticeSummary {
  const answered = items.filter((x) => x.a.answeredAt)
  const correct = answered.filter((x) => x.a.isCorrect).length
  const totalPoints = items.reduce((s, x) => s + Number(x.a.points), 0)
  const got = answered.reduce((s, x) => s + Number(x.a.score ?? 0), 0)
  const map = new Map<string, { correct: number; total: number }>()
  for (const x of items) {
    const k = x.q.nodeTitle ?? 'بلا درس محدّد'
    const e = map.get(k) ?? { correct: 0, total: 0 }
    e.total++
    if (x.a.isCorrect) e.correct++
    map.set(k, e)
  }
  const byNode = [...map.entries()].map(([title, v]) => ({ title, ...v })).sort((p, r) => p.correct / p.total - r.correct / r.total)
  return { answered: answered.length, correct, total: items.length, scorePct: totalPoints ? Math.round((got / totalPoints) * 1000) / 10 : 0, byNode, weak: byNode.filter((n) => n.total >= 2 && n.correct / n.total < 0.6).map((n) => n.title) }
}

export async function getPractice(db: Db, actor: Actor, id: string): Promise<PracticeView> {
  const session = await ownSession(db, actor, id)
  const [names] = await db
    .select({ subjectName: subjects.nameAr, nodeTitle: curriculumNodes.title })
    .from(practiceSessions)
    .leftJoin(subjects, eq(subjects.id, practiceSessions.subjectId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, practiceSessions.curriculumNodeId))
    .where(eq(practiceSessions.id, id))
    .limit(1)
  const items = await loadQuestions(db, session)
  return { session: { ...session, subjectName: names?.subjectName ?? null, nodeTitle: names?.nodeTitle ?? null }, questions: items.map((x) => viewOf(x.q, x.a, session.id)), summary: session.status === 'FINISHED' ? summarize(items) : null }
}

/** إجابة سؤال واحد: تصحيح فوري، ولا تُعاد الإجابة على ما أُجيب */
export async function answerPractice(db: Db, actor: Actor, sessionId: string, questionId: string, answer: Omit<StudentAnswer, 'questionId'>): Promise<PracticeAnswerResult> {
  const session = await ownSession(db, actor, sessionId)
  if (session.status !== 'ACTIVE') throw new AppError('PRACTICE_FINISHED')
  assertUuid(questionId, 'NOT_FOUND')
  const [row] = await db.select().from(practiceAnswers).where(and(eq(practiceAnswers.sessionId, sessionId), eq(practiceAnswers.questionId, questionId))).limit(1)
  if (!row) throw new AppError('NOT_FOUND')
  const [q] = await db.select().from(bankQuestions).where(eq(bankQuestions.id, questionId)).limit(1)
  if (!q) throw new AppError('NOT_FOUND')
  if (row.answeredAt) return resultOf(q, row)
  const g = gradeAnswer({ id: q.id, type: q.type, points: Number(q.points), answerKey: q.answerKey ?? null, options: q.options.map((o, i) => ({ id: String(i), isCorrect: o.isCorrect })) }, { questionId, ...answer })
  const isCorrect = g.isCorrect === true
  const [updated] = await db
    .update(practiceAnswers)
    .set({ answer: answer as Record<string, unknown>, isCorrect, score: String(g.score ?? 0), answeredAt: new Date() })
    .where(eq(practiceAnswers.id, row.id))
    .returning()
  await db
    .update(practiceSessions)
    .set({ answeredCount: sql`${practiceSessions.answeredCount} + 1`, correctCount: sql`${practiceSessions.correctCount} + ${isCorrect ? 1 : 0}`, updatedAt: new Date() })
    .where(eq(practiceSessions.id, sessionId))
  // المرحلة 8: تقدّم التلميذ بالدرس
  if (q.curriculumNodeId && q.subjectId) await recordNodeResult(db, { studentId: session.studentId, subjectId: q.subjectId, curriculumNodeId: q.curriculumNodeId, isCorrect, difficulty: q.difficulty })
  return resultOf(q, updated!)
}

/** إنهاء الجلسة: ما لم يُجب يُعدّ خطأ؛ تُحسب النسبة ويُكتب الملخّص */
export async function finishPractice(db: Db, actor: Actor, sessionId: string): Promise<PracticeSummary> {
  const session = await ownSession(db, actor, sessionId)
  const items = await loadQuestions(db, session)
  if (session.status === 'ACTIVE') {
    const summary = summarize(items)
    await db.update(practiceSessions).set({ status: 'FINISHED', finishedAt: new Date(), scorePct: String(summary.scorePct), answeredCount: summary.answered, correctCount: summary.correct, updatedAt: new Date() }).where(eq(practiceSessions.id, sessionId))
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'practice.finish', entityType: 'practice_session', entityId: sessionId, newValue: { scorePct: summary.scorePct, correct: summary.correct, total: summary.total } })
    return summary
  }
  return summarize(items)
}

export interface PracticeOverview {
  sessions: { id: string; subjectName: string | null; nodeTitle: string | null; status: string; questionCount: number; correctCount: number; scorePct: number | null; startedAt: Date }[]
  totals: { sessions: number; answered: number; correct: number }
  /** أضعف الدروس في آخر 200 إجابة (≥3 إجابات، أقل من 60%) مع ما يلزم لبدء تدريب عليها */
  weak: { title: string; subjectId: string; nodeId: string; correct: number; total: number }[]
  bySubject: { subjectId: string; name: string; correct: number; total: number }[]
}

export async function practiceOverview(db: Db, actor: Actor): Promise<PracticeOverview> {
  const studentId = me(actor)
  const [sessions, totals, recent] = await Promise.all([
    db
      .select({ id: practiceSessions.id, subjectName: subjects.nameAr, nodeTitle: curriculumNodes.title, status: practiceSessions.status, questionCount: practiceSessions.questionCount, correctCount: practiceSessions.correctCount, scorePct: practiceSessions.scorePct, startedAt: practiceSessions.startedAt })
      .from(practiceSessions)
      .leftJoin(subjects, eq(subjects.id, practiceSessions.subjectId))
      .leftJoin(curriculumNodes, eq(curriculumNodes.id, practiceSessions.curriculumNodeId))
      .where(eq(practiceSessions.studentId, studentId))
      .orderBy(desc(practiceSessions.startedAt))
      .limit(10),
    db
      .select({ sessions: sql<number>`count(distinct ${practiceAnswers.sessionId})::int`, answered: sql<number>`count(*) filter (where ${practiceAnswers.answeredAt} is not null)::int`, correct: sql<number>`count(*) filter (where ${practiceAnswers.isCorrect})::int` })
      .from(practiceAnswers)
      .where(eq(practiceAnswers.studentId, studentId)),
    db
      .select({ isCorrect: practiceAnswers.isCorrect, subjectId: bankQuestions.subjectId, subjectName: subjects.nameAr, nodeId: bankQuestions.curriculumNodeId, nodeTitle: curriculumNodes.title })
      .from(practiceAnswers)
      .innerJoin(bankQuestions, eq(bankQuestions.id, practiceAnswers.questionId))
      .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
      .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
      .where(and(eq(practiceAnswers.studentId, studentId), sql`${practiceAnswers.answeredAt} is not null`))
      .orderBy(desc(practiceAnswers.answeredAt))
      .limit(200)
  ])
  const nodes = new Map<string, { title: string; subjectId: string; nodeId: string; correct: number; total: number }>()
  const subj = new Map<string, { subjectId: string; name: string; correct: number; total: number }>()
  for (const r of recent) {
    if (r.subjectId) {
      const e = subj.get(r.subjectId) ?? { subjectId: r.subjectId, name: r.subjectName ?? '', correct: 0, total: 0 }
      e.total++
      if (r.isCorrect) e.correct++
      subj.set(r.subjectId, e)
    }
    if (r.nodeId && r.subjectId) {
      const e = nodes.get(r.nodeId) ?? { title: r.nodeTitle ?? '', subjectId: r.subjectId, nodeId: r.nodeId, correct: 0, total: 0 }
      e.total++
      if (r.isCorrect) e.correct++
      nodes.set(r.nodeId, e)
    }
  }
  const weak = [...nodes.values()].filter((n) => n.total >= 3 && n.correct / n.total < 0.6).sort((a, b) => a.correct / a.total - b.correct / b.total).slice(0, 5)
  return { sessions: sessions.map((s) => ({ ...s, scorePct: s.scorePct == null ? null : Number(s.scorePct) })), totals: { sessions: totals[0]?.sessions ?? 0, answered: totals[0]?.answered ?? 0, correct: totals[0]?.correct ?? 0 }, weak, bySubject: [...subj.values()].sort((a, b) => b.total - a.total) }
}
