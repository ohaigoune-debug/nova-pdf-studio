import { and, desc, eq, sql } from 'drizzle-orm'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { EvaluateEssayOutput } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { aiEvaluations, appSettings, assignmentSubmissions, assignments, jobs, profiles, rubricItems, skills, teacherReviews } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { enqueueJob } from '@/server/jobs/queue'
import { dataInsights } from '@/server/queries/teacher-extras.queries'
import { loadSubmissionCtx, reviewSubmission, type ReviewInput } from './assignments.service'
import { notify } from './notifications.service'

/**
 * التصحيح بمساعدة الذكاء الاصطناعي — القواعد الثابتة:
 *  1. الذكاء الاصطناعي يقترح فقط؛ لا يكتب أبداً في جدول `grades` ولا في رسائل الطالب.
 *  2. العلامة تُكتب حصراً عبر `reviewSubmission` بفاعل أستاذ (اعتماد/تعديل)، ويُسجَّل القرار في `teacher_reviews`.
 *  3. الطالب لا يرى أي أثر للاقتراح (لا حالة، لا نص) حتى يعتمد الأستاذ.
 *  4. أي فشل يُخزَّن داخلياً ويُعرض للأستاذ كرسالة عربية عامة.
 */

export type AiEvaluationRow = typeof aiEvaluations.$inferSelect

/* -------------------------------- Settings -------------------------------- */

export interface AiSettings {
  autoEvaluate: boolean
}

export async function getAiSettings(db: Db): Promise<AiSettings> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, 'ai')).limit(1)
  const v = (row?.value as Partial<AiSettings> | undefined) ?? {}
  return { autoEvaluate: Boolean(v.autoEvaluate) }
}

export async function updateAiSettings(db: Db, actor: Actor, patch: Partial<AiSettings>): Promise<AiSettings> {
  assertRole(actor, 'SUPER_ADMIN')
  const current = await getAiSettings(db)
  const next = { ...current, ...patch }
  await db
    .insert(appSettings)
    .values({ key: 'ai', value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.ai', entityType: 'settings', entityId: null, oldValue: { ...current }, newValue: { ...next } })
  return next
}

/* ------------------------------- Requesting ------------------------------- */

async function latestEvaluationRow(db: Db, submissionId: string): Promise<AiEvaluationRow | null> {
  const [row] = await db.select().from(aiEvaluations).where(eq(aiEvaluations.submissionId, submissionId)).orderBy(desc(aiEvaluations.createdAt)).limit(1)
  return row ?? null
}

/** ينشئ سجل تقييم PENDING ومهمة خلفية داخل معاملة واحدة */
async function enqueueEvaluation(db: Db, ctx: { submissionId: string; workspaceId: string; rubricId: string | null }, requestedByUserId: string | null) {
  const info = aiProviderInfo()
  return db.transaction(async (tx) => {
    const [ev] = await tx
      .insert(aiEvaluations)
      .values({ workspaceId: ctx.workspaceId, submissionId: ctx.submissionId, rubricId: ctx.rubricId, provider: info.name, model: info.model, status: 'PENDING', requestedByUserId })
      .returning()
    if (!ev) throw new AppError('INTERNAL')
    const job = await enqueueJob(tx, { type: 'AI_EVALUATE_SUBMISSION', payload: { evaluationId: ev.id, submissionId: ctx.submissionId }, workspaceId: ctx.workspaceId })
    await writeAudit(tx, { actorUserId: requestedByUserId, workspaceId: ctx.workspaceId, action: 'ai.evaluate.request', entityType: 'ai_evaluation', entityId: ev.id, newValue: { submissionId: ctx.submissionId, provider: info.name } })
    return { evaluationId: ev.id, jobId: job.id, reused: false }
  })
}

/** الأستاذ يطلب اقتراح تصحيح لإجابة مرسلة. إن وُجد طلب قيد المعالجة يُعاد هو نفسه. */
export async function requestAiEvaluation(db: Db, actor: Actor, submissionId: string): Promise<{ evaluationId: string; jobId: string | null; reused: boolean }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const ctx = await loadSubmissionCtx(db, actor, submissionId)
  if (ctx.submission.status === 'DRAFT' || !ctx.submission.answerText?.trim()) throw new AppError('SUBMISSION_NOT_SUBMITTED')
  const last = await latestEvaluationRow(db, submissionId)
  if (last && last.status === 'PENDING') return { evaluationId: last.id, jobId: null, reused: true }
  return enqueueEvaluation(db, { submissionId, workspaceId: ctx.submission.workspaceId, rubricId: ctx.assignment.rubricId }, actor.userId)
}

/** يُستدعى بعد إرسال الطالب إجابته عندما يكون التقييم التلقائي مفعّلاً (بلا فاعل بشري) */
export async function maybeAutoEvaluate(db: Db, submissionId: string): Promise<{ evaluationId: string } | null> {
  const settings = await getAiSettings(db)
  if (!settings.autoEvaluate) return null
  const [row] = await db
    .select({ id: assignmentSubmissions.id, workspaceId: assignmentSubmissions.workspaceId, status: assignmentSubmissions.status, answerText: assignmentSubmissions.answerText, rubricId: assignments.rubricId })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .where(eq(assignmentSubmissions.id, submissionId))
    .limit(1)
  if (!row || row.status !== 'SUBMITTED' || !row.answerText?.trim()) return null
  const last = await latestEvaluationRow(db, submissionId)
  if (last && last.status === 'PENDING') return { evaluationId: last.id }
  const r = await enqueueEvaluation(db, { submissionId, workspaceId: row.workspaceId, rubricId: row.rubricId }, null)
  return { evaluationId: r.evaluationId }
}

/* ------------------------------- Job handler ------------------------------ */

function sanitize(out: EvaluateEssayOutput, maxScore: number, items: { id: string; maxPoints: string }[]): EvaluateEssayOutput {
  let breakdown: Record<string, number> | null = null
  let score = out.suggestedScore
  if (items.length > 0 && out.rubricBreakdown) {
    breakdown = {}
    let total = 0
    for (const it of items) {
      const v = Number(out.rubricBreakdown[it.id] ?? 0)
      const clamped = Math.max(0, Math.min(Number(it.maxPoints), Number.isFinite(v) ? v : 0))
      breakdown[it.id] = Math.round(clamped * 100) / 100
      total += breakdown[it.id]!
    }
    score = total
  }
  score = Math.max(0, Math.min(maxScore, Number.isFinite(score) ? score : 0))
  const list = (a: string[]) => a.map((s) => String(s).trim()).filter(Boolean).slice(0, 8)
  return {
    suggestedScore: Math.round(score * 100) / 100,
    confidence: Math.max(0, Math.min(1, Number.isFinite(out.confidence) ? out.confidence : 0)),
    rubricBreakdown: breakdown,
    strengths: list(out.strengths),
    weaknesses: list(out.weaknesses),
    mistakes: list(out.mistakes),
    skillsDetected: list(out.skillsDetected),
    skillsToImprove: list(out.skillsToImprove),
    teacherNotesSuggestion: (out.teacherNotesSuggestion ?? '').slice(0, 2000),
    raw: out.raw
  }
}

/** معالج المهمة: يستدعي المزوّد ويخزّن الاقتراح. لا يلمس `grades` إطلاقاً. */
export async function runAiEvaluationJob(db: Db, evaluationId: string): Promise<Record<string, unknown>> {
  assertUuid(evaluationId, 'AI_EVAL_NOT_FOUND')
  const [ev] = await db.select().from(aiEvaluations).where(eq(aiEvaluations.id, evaluationId)).limit(1)
  if (!ev || !ev.submissionId) throw new AppError('AI_EVAL_NOT_FOUND')
  if (ev.status === 'COMPLETED') return { skipped: true }
  if (ev.status === 'FAILED') await db.update(aiEvaluations).set({ status: 'PENDING', error: null }).where(eq(aiEvaluations.id, ev.id))

  const [row] = await db
    .select({ submission: assignmentSubmissions, assignment: assignments, skillName: skills.nameAr })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .leftJoin(skills, eq(skills.id, assignments.skillId))
    .where(eq(assignmentSubmissions.id, ev.submissionId))
    .limit(1)
  if (!row) throw new AppError('SUBMISSION_NOT_FOUND')
  const items = row.assignment.rubricId
    ? await db
        .select({ id: rubricItems.id, label: rubricItems.label, description: rubricItems.description, maxPoints: rubricItems.maxPoints, skillName: skills.nameAr })
        .from(rubricItems)
        .leftJoin(skills, eq(skills.id, rubricItems.skillId))
        .where(eq(rubricItems.rubricId, row.assignment.rubricId))
        .orderBy(rubricItems.sortOrder)
    : []
  const knownSkills = (await db.select({ name: skills.nameAr }).from(skills)).map((s) => s.name)
  const provider = getAiProvider()
  try {
    const raw = await provider.evaluateEssay({
      assignmentTitle: row.assignment.title,
      prompt: row.assignment.description,
      answerText: row.submission.answerText ?? '',
      maxScore: Number(row.assignment.maxScore),
      rubric: items.length ? items.map((i) => ({ id: i.id, label: i.label, description: i.description, maxPoints: Number(i.maxPoints), skillName: i.skillName })) : null,
      skillName: row.skillName,
      knownSkills
    })
    const out = sanitize(raw, Number(row.assignment.maxScore), items)
    await db.transaction(async (tx) => {
      await tx
        .update(aiEvaluations)
        .set({
          status: 'COMPLETED',
          provider: provider.name,
          model: provider.model,
          suggestedScore: String(out.suggestedScore),
          confidence: String(out.confidence),
          rubricBreakdown: out.rubricBreakdown,
          strengths: out.strengths,
          weaknesses: out.weaknesses,
          mistakes: out.mistakes,
          skillsDetected: out.skillsDetected,
          skillsToImprove: out.skillsToImprove,
          teacherNotesSuggestion: out.teacherNotesSuggestion,
          rawResponse: out.raw ?? null,
          error: null,
          completedAt: new Date()
        })
        .where(eq(aiEvaluations.id, ev.id))
      // لا نغيّر حالة إجابة صحّحها الأستاذ بالفعل
      await tx.update(assignmentSubmissions).set({ status: 'AI_EVALUATED' }).where(and(eq(assignmentSubmissions.id, row.submission.id), eq(assignmentSubmissions.status, 'SUBMITTED')))
      await notify(tx, {
        userId: row.assignment.createdByUserId,
        workspaceId: row.submission.workspaceId,
        type: 'SYSTEM',
        title: `اقتراح تصحيح جاهز لواجب "${row.assignment.title}"`,
        body: `النقطة المقترحة ${out.suggestedScore}/${Number(row.assignment.maxScore)} — بانتظار مراجعتك.`,
        link: `/teacher/assignments/${row.assignment.id}/submissions/${row.submission.id}`
      })
    })
    return { evaluationId: ev.id, suggestedScore: out.suggestedScore, provider: provider.name }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000)
    await db.update(aiEvaluations).set({ status: 'FAILED', error: message }).where(eq(aiEvaluations.id, ev.id))
    throw err
  }
}

/* ------------------------------ Teacher view ------------------------------ */

export interface AiEvaluationView {
  id: string
  status: string
  provider: string
  model: string
  suggestedScore: number | null
  confidence: number | null
  rubricBreakdown: Record<string, number> | null
  strengths: string[]
  weaknesses: string[]
  mistakes: string[]
  skillsDetected: string[]
  skillsToImprove: string[]
  teacherNotesSuggestion: string | null
  createdAt: Date
  completedAt: Date | null
  decision: { decision: string; finalScore: string | null; reviewerName: string | null; createdAt: Date } | null
}

/** آخر اقتراح لإجابة ما (للأستاذ فقط). الفشل يُعرض كحالة بلا تفاصيل داخلية. */
export async function getLatestAiEvaluation(db: Db, actor: Actor, submissionId: string): Promise<AiEvaluationView | null> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  await loadSubmissionCtx(db, actor, submissionId)
  const ev = await latestEvaluationRow(db, submissionId)
  if (!ev) return null
  const [d] = await db
    .select({ decision: teacherReviews.decision, finalScore: teacherReviews.finalScore, reviewerName: profiles.fullName, createdAt: teacherReviews.createdAt })
    .from(teacherReviews)
    .leftJoin(profiles, eq(profiles.userId, teacherReviews.reviewerUserId))
    .where(eq(teacherReviews.aiEvaluationId, ev.id))
    .orderBy(desc(teacherReviews.createdAt))
    .limit(1)
  return {
    id: ev.id,
    status: ev.status,
    provider: ev.provider,
    model: ev.model,
    suggestedScore: ev.suggestedScore === null ? null : Number(ev.suggestedScore),
    confidence: ev.confidence === null ? null : Number(ev.confidence),
    rubricBreakdown: ev.rubricBreakdown ?? null,
    strengths: ev.strengths,
    weaknesses: ev.weaknesses,
    mistakes: ev.mistakes,
    skillsDetected: ev.skillsDetected,
    skillsToImprove: ev.skillsToImprove,
    teacherNotesSuggestion: ev.teacherNotesSuggestion,
    createdAt: ev.createdAt,
    completedAt: ev.completedAt,
    decision: d ?? null
  }
}

/* ------------------------------- Decisions -------------------------------- */

async function loadEvaluationForDecision(db: Db, actor: Actor, evaluationId: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(evaluationId, 'AI_EVAL_NOT_FOUND')
  const [ev] = await db.select().from(aiEvaluations).where(eq(aiEvaluations.id, evaluationId)).limit(1)
  if (!ev || !ev.submissionId) throw new AppError('AI_EVAL_NOT_FOUND')
  if (actor.role === 'TEACHER' && ev.workspaceId !== actor.workspaceId) throw new AppError('AI_EVAL_NOT_FOUND')
  if (ev.status !== 'COMPLETED') throw new AppError('AI_EVAL_NOT_READY')
  const [existing] = await db.select({ id: teacherReviews.id }).from(teacherReviews).where(eq(teacherReviews.aiEvaluationId, ev.id)).limit(1)
  if (existing) throw new AppError('AI_EVAL_ALREADY_DECIDED')
  return ev
}

function sameBreakdown(a: Record<string, number> | null | undefined, b: Record<string, number> | null | undefined): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every((k) => Number(a[k]) === Number(b[k]))
}

/**
 * الأستاذ يعتمد الاقتراح (كما هو أو بعد تعديل): العلامة تُكتب عبر مسار الأستاذ نفسه
 * (`reviewSubmission`) فيبقى مصدرها TEACHER، ثم يُسجَّل القرار APPROVED/EDITED.
 */
export async function applyAiEvaluation(db: Db, actor: Actor, evaluationId: string, input: ReviewInput): Promise<{ gradeId: string; decision: 'APPROVED' | 'EDITED' }> {
  const ev = await loadEvaluationForDecision(db, actor, evaluationId)
  const suggested = ev.suggestedScore === null ? null : Number(ev.suggestedScore)
  const sameText = (x: string[], y: string[]) => x.length === y.length && x.every((v, i) => v.trim() === (y[i] ?? '').trim())
  const untouched =
    suggested !== null &&
    Number(input.score) === suggested &&
    sameBreakdown(input.rubricBreakdown, ev.rubricBreakdown) &&
    sameText(input.strengths, ev.strengths) &&
    sameText(input.improvements, ev.weaknesses)
  const decision = untouched ? 'APPROVED' : 'EDITED'
  const { gradeId } = await reviewSubmission(db, actor, ev.submissionId!, input)
  await db.transaction(async (tx) => {
    await tx.insert(teacherReviews).values({ aiEvaluationId: ev.id, submissionId: ev.submissionId, reviewerUserId: actor.userId, decision, finalScore: String(input.score), notes: input.notes ?? null })
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: ev.workspaceId, action: 'ai.evaluate.decide', entityType: 'ai_evaluation', entityId: ev.id, newValue: { decision, suggested, final: input.score } })
  })
  return { gradeId, decision }
}

/** رفض الاقتراح: لا علامة، وتعود الإجابة إلى "مرسلة" إن لم يكن الأستاذ صحّحها */
export async function rejectAiEvaluation(db: Db, actor: Actor, evaluationId: string, notes?: string | null): Promise<void> {
  const ev = await loadEvaluationForDecision(db, actor, evaluationId)
  await db.transaction(async (tx) => {
    await tx.insert(teacherReviews).values({ aiEvaluationId: ev.id, submissionId: ev.submissionId, reviewerUserId: actor.userId, decision: 'REJECTED', finalScore: null, notes: notes?.trim() || null })
    await tx.update(assignmentSubmissions).set({ status: 'SUBMITTED' }).where(and(eq(assignmentSubmissions.id, ev.submissionId!), eq(assignmentSubmissions.status, 'AI_EVALUATED')))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: ev.workspaceId, action: 'ai.evaluate.decide', entityType: 'ai_evaluation', entityId: ev.id, newValue: { decision: 'REJECTED' } })
  })
}

/* --------------------------- Teacher insights job ------------------------- */

export async function requestTeacherInsights(db: Db, actor: Actor): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  const [pending] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'AI_TEACHER_INSIGHTS'), eq(jobs.workspaceId, actor.workspaceId), sql`${jobs.status} in ('QUEUED','PROCESSING')`))
    .limit(1)
  if (pending) return { jobId: pending.id }
  const job = await enqueueJob(db, { type: 'AI_TEACHER_INSIGHTS', payload: { workspaceId: actor.workspaceId, userId: actor.userId }, workspaceId: actor.workspaceId, maxAttempts: 2 })
  return { jobId: job.id }
}

export async function runTeacherInsightsJob(db: Db, workspaceId: string, userId: string): Promise<Record<string, unknown>> {
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  // فاعل داخلي محدود بمساحة العمل (لا يُبنى من مدخلات العميل)
  const actor: Actor = { userId, role: 'TEACHER', fullName: p?.fullName ?? 'الأستاذ', email: '', workspaceId, teacherId: null, studentId: null }
  const facts = (await dataInsights(db, actor)).map((i) => i.text)
  const provider = getAiProvider()
  const out = await provider.generateTeacherInsights({ teacherName: actor.fullName, facts })
  return { summary: out.summary, nextLessonSuggestions: out.nextLessonSuggestions, facts: facts.length, provider: provider.name, model: provider.model, generatedAt: new Date().toISOString() }
}

export interface TeacherInsightsView {
  status: string
  summary: string | null
  nextLessonSuggestions: string[]
  generatedAt: Date | null
  provider: string | null
}

export async function latestTeacherInsights(db: Db, actor: Actor): Promise<TeacherInsightsView | null> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) return null
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, 'AI_TEACHER_INSIGHTS'), eq(jobs.workspaceId, actor.workspaceId)))
    .orderBy(desc(jobs.createdAt))
    .limit(1)
  if (!job) return null
  const r = (job.result ?? {}) as { summary?: string; nextLessonSuggestions?: string[]; generatedAt?: string; provider?: string }
  return {
    status: job.status,
    summary: r.summary ?? null,
    nextLessonSuggestions: Array.isArray(r.nextLessonSuggestions) ? r.nextLessonSuggestions : [],
    generatedAt: r.generatedAt ? new Date(r.generatedAt) : null,
    provider: r.provider ?? null
  }
}

/* -------------------------------- Admin stats ----------------------------- */

export async function aiAdminStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const evals = await db.select({ status: aiEvaluations.status, n: sql<number>`count(*)::int` }).from(aiEvaluations).groupBy(aiEvaluations.status)
  const decisions = await db.select({ decision: teacherReviews.decision, n: sql<number>`count(*)::int` }).from(teacherReviews).groupBy(teacherReviews.decision)
  const jobsByStatus = await db.select({ status: jobs.status, n: sql<number>`count(*)::int` }).from(jobs).groupBy(jobs.status)
  const failures = await db.select({ id: jobs.id, type: jobs.type, error: jobs.error, finishedAt: jobs.finishedAt }).from(jobs).where(eq(jobs.status, 'FAILED')).orderBy(desc(jobs.finishedAt)).limit(10)
  const toMap = (rows: { k: string; n: number }[]) => Object.fromEntries(rows.map((r) => [r.k, r.n])) as Record<string, number>
  return {
    provider: aiProviderInfo(),
    settings: await getAiSettings(db),
    evaluations: toMap(evals.map((e) => ({ k: e.status, n: e.n }))),
    decisions: toMap(decisions.map((d) => ({ k: d.decision, n: d.n }))),
    jobs: toMap(jobsByStatus.map((j) => ({ k: j.status, n: j.n }))),
    failures,
    inlineWorker: process.env.JOBS_INLINE_WORKER !== '0'
  }
}
