import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { EssayBatchItem, EvaluateEssayInput, EvaluateEssayOutput } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { aiEvaluations, appSettings, assignmentSubmissions, assignments, grades, jobs, levels, profiles, quizAttempts, quizzes, rubricItems, skills, teacherReviews, teachers } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid, PermanentJobError } from '@/server/lib/errors'
import { enqueueJob } from '@/server/jobs/queue'
import { dataInsights } from '@/server/queries/teacher-extras.queries'
import { getAssignmentForTeacher, loadSubmissionCtx, reviewSubmission, type ReviewInput } from './assignments.service'
import { getDriveSource, loadSourceDocs, queryTerms, selectPassages } from './drive-source.service'
import { assertGroupAccess } from './groups.service'
import { notify } from './notifications.service'
import { createQuiz } from './quizzes.service'
import { skillMap } from './skills.service'
import { getStudentProfile } from './students.service'
import { validateQuestion } from '@/server/lib/quiz-grading'
import { t } from '@/i18n'

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

/* --------------------------- Bulk: whole assignment ----------------------- */

export interface AssignmentAiSummary {
  eligible: number
  submitted: number
  /** إجابات مرسلة بلا اقتراح بعد (أو فشل اقتراحها) */
  awaiting: number
  pending: number
  /** اقتراحات مكتملة بانتظار قرار الأستاذ */
  suggested: number
  reviewed: number
  /** الثقة الأدنى بين الاقتراحات المكتملة غير المقرَّرة */
  minConfidence: number | null
}

/** حالة الذكاء الاصطناعي لواجب كامل: كم إجابة بلا اقتراح، كم قيد المعالجة، كم مقترحة، كم مصحَّحة */
export async function assignmentAiSummary(db: Db, actor: Actor, assignmentId: string): Promise<AssignmentAiSummary> {
  const d = await getAssignmentForTeacher(db, actor, assignmentId)
  const subs = d.submissions.filter((s) => s.submissionId && s.status && s.status !== 'DRAFT')
  const out: AssignmentAiSummary = { eligible: d.eligible, submitted: subs.length, awaiting: 0, pending: 0, suggested: 0, reviewed: 0, minConfidence: null }
  for (const s of subs) {
    if (s.status === 'REVIEWED') {
      out.reviewed++
      continue
    }
    const last = await latestEvaluationRow(db, s.submissionId!)
    if (!last || last.status === 'FAILED') out.awaiting++
    else if (last.status === 'PENDING') out.pending++
    else {
      const [decided] = await db.select({ id: teacherReviews.id }).from(teacherReviews).where(eq(teacherReviews.aiEvaluationId, last.id)).limit(1)
      if (decided) out.awaiting++
      else {
        out.suggested++
        const c = last.confidence === null ? null : Number(last.confidence)
        if (c !== null) out.minConfidence = out.minConfidence === null ? c : Math.min(out.minConfidence, c)
      }
    }
  }
  return out
}

/**
 * "تصحيح الكل": يطلب اقتراحاً لكل إجابة مرسلة ليس لها اقتراح قيد المعالجة أو مكتمل بانتظار القرار.
 * لا يمسّ الإجابات المصحَّحة. يبقى الاقتراح مخفياً عن الطالب حتى الاعتماد.
 */
export async function requestAiEvaluationForAssignment(db: Db, actor: Actor, assignmentId: string): Promise<{ queued: number; skipped: number; total: number }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const d = await getAssignmentForTeacher(db, actor, assignmentId)
  let skipped = 0
  const toRequest: string[] = []
  const subs = d.submissions.filter((s) => s.submissionId && (s.status === 'SUBMITTED' || s.status === 'AI_EVALUATED'))
  for (const s of subs) {
    const last = await latestEvaluationRow(db, s.submissionId!)
    if (last && last.status === 'PENDING') {
      skipped++
      continue
    }
    if (last && last.status === 'COMPLETED') {
      const [decided] = await db.select({ id: teacherReviews.id }).from(teacherReviews).where(eq(teacherReviews.aiEvaluationId, last.id)).limit(1)
      if (!decided) {
        skipped++
        continue
      }
    }
    toRequest.push(s.submissionId!)
  }
  const ctx = { workspaceId: d.assignment.workspaceId, rubricId: d.assignment.rubricId }
  let batched = false
  if (getAiProvider().submitEssayBatch && toRequest.length > 0) batched = await dispatchViaBatch(db, actor, d.assignment.id, toRequest, ctx)
  else for (const submissionId of toRequest) await enqueueEvaluation(db, { submissionId, ...ctx }, actor.userId)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: d.assignment.workspaceId, action: 'ai.evaluate.request_all', entityType: 'assignment', entityId: d.assignment.id, newValue: { queued: toRequest.length, skipped, batched } })
  return { queued: toRequest.length, skipped, total: subs.length }
}

/** فاصل استطلاع الدفعة: دقيقة ثم تضاعف حتى 10 دقائق (أغلب الدفعات تنتهي خلال ساعة) */
function batchPollDelay(polls: number): number {
  return Math.min(10 * 60_000, 60_000 * 2 ** polls)
}

/**
 * يرسل الإجابات في Message Batch واحد (نصف السعر) ويُجدول جامع النتائج.
 * سجلات التقييم تُنشأ أولاً؛ فإن تعذّر إرسال الدفعة تُعالَج فرادى بالمسار المعتاد ويُعاد false.
 */
async function dispatchViaBatch(db: Db, actor: Actor, assignmentId: string, submissionIds: string[], ctx: { workspaceId: string; rubricId: string | null }): Promise<boolean> {
  const provider = getAiProvider()
  if (!provider.submitEssayBatch) return false
  const info = aiProviderInfo()
  const knownSkills = await loadKnownSkills(db)
  const evaluationIds: string[] = []
  const items: EssayBatchItem[] = []
  await db.transaction(async (tx) => {
    for (const submissionId of submissionIds) {
      const [ev] = await tx
        .insert(aiEvaluations)
        .values({ workspaceId: ctx.workspaceId, submissionId, rubricId: ctx.rubricId, provider: info.name, model: info.model, status: 'PENDING', requestedByUserId: actor.userId })
        .returning()
      if (!ev) throw new AppError('INTERNAL')
      await writeAudit(tx, { actorUserId: actor.userId, workspaceId: ctx.workspaceId, action: 'ai.evaluate.request', entityType: 'ai_evaluation', entityId: ev.id, newValue: { submissionId, provider: info.name, batch: true } })
      evaluationIds.push(ev.id)
      items.push({ customId: ev.id, input: (await loadEssayContext(tx, submissionId, knownSkills)).input })
    }
  })
  try {
    const { batchId } = await provider.submitEssayBatch(items)
    await enqueueJob(db, { type: 'AI_BATCH_COLLECT', payload: { batchId, evaluationIds, assignmentId, polls: 0 }, workspaceId: ctx.workspaceId, runAfter: new Date(Date.now() + batchPollDelay(0)) })
    return true
  } catch (err) {
    if (process.env.NODE_ENV !== 'test') console.warn('[ai] batch submit failed; falling back to single jobs', err instanceof Error ? err.message : err)
    for (let i = 0; i < evaluationIds.length; i++) {
      await enqueueJob(db, { type: 'AI_EVALUATE_SUBMISSION', payload: { evaluationId: evaluationIds[i], submissionId: submissionIds[i] }, workspaceId: ctx.workspaceId })
    }
    return false
  }
}

/**
 * "اعتماد الكل": يعتمد كل الاقتراحات المكتملة غير المقرَّرة كما هي (قرار الأستاذ الصريح على الدفعة)،
 * مع حدّ ثقة اختياري: ما دونه يُترك للمراجعة اليدوية. الكتابة تمرّ عبر reviewSubmission كالمعتاد.
 */
export async function applyAllAiEvaluations(db: Db, actor: Actor, assignmentId: string, opts: { minConfidence?: number } = {}): Promise<{ approved: number; belowThreshold: number; skipped: number }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const d = await getAssignmentForTeacher(db, actor, assignmentId)
  const min = Math.max(0, Math.min(1, opts.minConfidence ?? 0))
  let approved = 0
  let belowThreshold = 0
  let skipped = 0
  for (const s of d.submissions) {
    if (!s.submissionId || s.status !== 'AI_EVALUATED') continue
    const ev = await latestEvaluationRow(db, s.submissionId)
    if (!ev || ev.status !== 'COMPLETED' || ev.suggestedScore === null) {
      skipped++
      continue
    }
    const [decided] = await db.select({ id: teacherReviews.id }).from(teacherReviews).where(eq(teacherReviews.aiEvaluationId, ev.id)).limit(1)
    if (decided) {
      skipped++
      continue
    }
    const confidence = ev.confidence === null ? 0 : Number(ev.confidence)
    if (confidence < min) {
      belowThreshold++
      continue
    }
    await applyAiEvaluation(db, actor, ev.id, {
      score: Number(ev.suggestedScore),
      strengths: ev.strengths,
      improvements: ev.weaknesses,
      notes: ev.teacherNotesSuggestion,
      rubricBreakdown: ev.rubricBreakdown ?? null
    })
    approved++
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: d.assignment.workspaceId, action: 'ai.evaluate.apply_all', entityType: 'assignment', entityId: d.assignment.id, newValue: { approved, belowThreshold, skipped, minConfidence: min } })
  return { approved, belowThreshold, skipped }
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

interface EssayContext {
  submission: typeof assignmentSubmissions.$inferSelect
  assignment: typeof assignments.$inferSelect
  items: { id: string; label: string; description: string | null; maxPoints: string; skillName: string | null }[]
  input: EvaluateEssayInput
}

async function loadKnownSkills(db: Db): Promise<string[]> {
  return (await db.select({ name: skills.nameAr }).from(skills)).map((s) => s.name)
}

/** يجمع كل ما يحتاجه المزوّد عن إجابة واحدة (الواجب، الشبكة، المهارة) */
/** مادة الأستاذ صاحب المساحة: المنصة متعددة المواد فلا تُفترض العربية */
export async function workspaceSubject(db: Db, workspaceId: string | null | undefined): Promise<string | null> {
  if (!workspaceId) return null
  const [w] = await db.select({ subject: teachers.subject }).from(teachers).where(eq(teachers.workspaceId, workspaceId)).limit(1)
  return w?.subject?.trim() || null
}

async function loadEssayContext(db: Db, submissionId: string, knownSkills: string[]): Promise<EssayContext> {
  const [row] = await db
    .select({ submission: assignmentSubmissions, assignment: assignments, skillName: skills.nameAr })
    .from(assignmentSubmissions)
    .innerJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .leftJoin(skills, eq(skills.id, assignments.skillId))
    .where(eq(assignmentSubmissions.id, submissionId))
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
  return {
    submission: row.submission,
    assignment: row.assignment,
    items,
    input: {
      // مادة الواجب إن حدّدها الأستاذ، وإلا مادة مساحة عمله
      subject: row.assignment.subject?.trim() || (await workspaceSubject(db, row.assignment.workspaceId)),
      assignmentTitle: row.assignment.title,
      prompt: row.assignment.description,
      answerText: row.submission.answerText ?? '',
      modelAnswer: row.assignment.modelAnswer,
      maxScore: Number(row.assignment.maxScore),
      rubric: items.length ? items.map((i) => ({ id: i.id, label: i.label, description: i.description, maxPoints: Number(i.maxPoints), skillName: i.skillName })) : null,
      skillName: row.skillName,
      knownSkills
    }
  }
}

/** يخزّن الاقتراح بعد تنقيته. لا يلمس `grades` إطلاقاً. */
async function storeEssayEvaluation(db: Db, evaluationId: string, ctx: EssayContext, raw: EvaluateEssayOutput, provider: { name: string; model: string }, opts: { notifyTeacher: boolean }): Promise<EvaluateEssayOutput> {
  const out = sanitize(raw, Number(ctx.assignment.maxScore), ctx.items)
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
      .where(eq(aiEvaluations.id, evaluationId))
    // لا نغيّر حالة إجابة صحّحها الأستاذ بالفعل
    await tx.update(assignmentSubmissions).set({ status: 'AI_EVALUATED' }).where(and(eq(assignmentSubmissions.id, ctx.submission.id), eq(assignmentSubmissions.status, 'SUBMITTED')))
    if (opts.notifyTeacher) {
      await notify(tx, {
        userId: ctx.assignment.createdByUserId,
        workspaceId: ctx.submission.workspaceId,
        type: 'SYSTEM',
        title: `اقتراح تصحيح جاهز لواجب "${ctx.assignment.title}"`,
        body: `النقطة المقترحة ${out.suggestedScore}/${Number(ctx.assignment.maxScore)} — بانتظار مراجعتك.`,
        link: `/teacher/assignments/${ctx.assignment.id}/submissions/${ctx.submission.id}`
      })
    }
  })
  return out
}

/** معالج المهمة الفردية: يستدعي المزوّد ويخزّن الاقتراح */
export async function runAiEvaluationJob(db: Db, evaluationId: string): Promise<Record<string, unknown>> {
  assertUuid(evaluationId, 'AI_EVAL_NOT_FOUND')
  const [ev] = await db.select().from(aiEvaluations).where(eq(aiEvaluations.id, evaluationId)).limit(1)
  if (!ev || !ev.submissionId) throw new AppError('AI_EVAL_NOT_FOUND')
  if (ev.status === 'COMPLETED') return { skipped: true }
  if (ev.status === 'FAILED') await db.update(aiEvaluations).set({ status: 'PENDING', error: null }).where(eq(aiEvaluations.id, ev.id))
  const ctx = await loadEssayContext(db, ev.submissionId, await loadKnownSkills(db))
  const provider = getAiProvider()
  try {
    const out = await storeEssayEvaluation(db, ev.id, ctx, await provider.evaluateEssay(ctx.input), provider, { notifyTeacher: true })
    return { evaluationId: ev.id, suggestedScore: out.suggestedScore, provider: provider.name }
  } catch (err) {
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000)
    await db.update(aiEvaluations).set({ status: 'FAILED', error: message }).where(eq(aiEvaluations.id, ev.id))
    throw err
  }
}

/**
 * جامع نتائج الدفعة: يستطلع الحالة، وعند الانتهاء يخزّن كل اقتراح.
 * الفشل غير المفوتَر (خطأ خادمي، انتهاء صلاحية) يُعاد فرادى؛ والنهائي يُعلَّم FAILED.
 * ما دامت الدفعة قيد المعالجة يُجدول استطلاعاً جديداً بدل استهلاك المحاولات.
 */
export async function runAiBatchCollectJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const batchId = String(payload.batchId ?? '')
  const evaluationIds = Array.isArray(payload.evaluationIds) ? (payload.evaluationIds as unknown[]).filter((x): x is string => typeof x === 'string') : []
  const polls = Number(payload.polls ?? 0)
  if (!batchId || evaluationIds.length === 0) throw new PermanentJobError('batch payload invalid')
  const provider = getAiProvider()
  if (!provider.fetchEssayBatch) throw new PermanentJobError('provider has no batch support')
  const rows = await db.select().from(aiEvaluations).where(inArray(aiEvaluations.id, evaluationIds))
  const pending = rows.filter((e) => e.status === 'PENDING' && e.submissionId)
  if (pending.length === 0) return { batchId, skipped: true }
  const workspaceId = pending[0]!.workspaceId

  // استطلاع خفيف أولاً: لا نحمّل سياق كل إجابة إلا حين تنتهي الدفعة فعلاً
  if (!(await provider.fetchEssayBatch(batchId, [])).ended) {
    await enqueueJob(db, { type: 'AI_BATCH_COLLECT', payload: { ...payload, polls: polls + 1 }, workspaceId, runAfter: new Date(Date.now() + batchPollDelay(polls + 1)) })
    return { batchId, ended: false, polls: polls + 1 }
  }
  const knownSkills = await loadKnownSkills(db)
  const ctxs = new Map<string, EssayContext>()
  for (const ev of pending) ctxs.set(ev.id, await loadEssayContext(db, ev.submissionId!, knownSkills))
  const status = await provider.fetchEssayBatch(
    batchId,
    [...ctxs].map(([customId, c]) => ({ customId, input: c.input }))
  )
  let completed = 0
  let failed = 0
  let requeued = 0
  for (const ev of pending) {
    const outcome = status.outcomes[ev.id]
    if (outcome?.type === 'succeeded') {
      await storeEssayEvaluation(db, ev.id, ctxs.get(ev.id)!, outcome.output, provider, { notifyTeacher: false })
      completed++
    } else if (outcome?.type === 'failed' && outcome.permanent) {
      await db.update(aiEvaluations).set({ status: 'FAILED', error: outcome.error.slice(0, 1000) }).where(eq(aiEvaluations.id, ev.id))
      failed++
    } else {
      await enqueueJob(db, { type: 'AI_EVALUATE_SUBMISSION', payload: { evaluationId: ev.id, submissionId: ev.submissionId }, workspaceId })
      requeued++
    }
  }
  if (completed > 0) {
    const a = ctxs.get(pending[0]!.id)!.assignment
    await notify(db, {
      userId: a.createdByUserId,
      workspaceId,
      type: 'SYSTEM',
      title: `اكتملت دفعة التصحيح لواجب "${a.title}"`,
      body: `${completed} اقتراحاً جاهزاً بانتظار مراجعتك${failed ? `، و${failed} تعذّر تصحيحه` : ''}.`,
      link: `/teacher/assignments/${a.id}`
    })
  }
  return { batchId, ended: true, completed, failed, requeued }
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
  /** المقارنة بالحل النموذجي (فارغة إن لم يُعطَ حل) */
  matched: string[]
  missing: string[]
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
    matched: listOf(ev.rawResponse?.matched),
    missing: listOf(ev.rawResponse?.missing),
    createdAt: ev.createdAt,
    completedAt: ev.completedAt,
    decision: d ?? null
  }
}

function listOf(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 20) : []
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
/** «نعم»: اعتماد الاقتراح كما هو بنقرة واحدة — العلامة والملاحظات كما اقترحها النموذج */
export async function approveAiEvaluation(db: Db, actor: Actor, evaluationId: string): Promise<{ gradeId: string }> {
  const ev = await loadEvaluationForDecision(db, actor, evaluationId)
  if (ev.suggestedScore === null) throw new AppError('AI_EVAL_NOT_READY')
  const { gradeId } = await applyAiEvaluation(db, actor, evaluationId, {
    score: Number(ev.suggestedScore),
    strengths: ev.strengths,
    improvements: ev.weaknesses,
    notes: ev.teacherNotesSuggestion,
    rubricBreakdown: ev.rubricBreakdown ?? null
  })
  return { gradeId }
}

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
  const out = await provider.generateTeacherInsights({ subject: await workspaceSubject(db, workspaceId), teacherName: actor.fullName, facts })
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

/* ------------------------- Remedial exercises (job) ----------------------- */

/** الأستاذ يطلب تمارين علاجية لمهارة (اختياريا لفوج)؛ النتيجة مسودة اختبار غير منشورة يراجعها */
export async function requestExercises(db: Db, actor: Actor, input: { skillId: string; groupId?: string | null; count?: number }): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  assertUuid(input.skillId, 'NOT_FOUND')
  const [sk] = await db.select({ id: skills.id }).from(skills).where(eq(skills.id, input.skillId)).limit(1)
  if (!sk) throw new AppError('NOT_FOUND')
  if (input.groupId) await assertGroupAccess(db, actor, input.groupId)
  // التمارين من مجلد Drive الأستاذ لا غير: بلا مجلد مربوط لا يُقبل الطلب أصلاً
  if (!(await getDriveSource(db, actor.workspaceId))) throw new AppError('DRIVE_SOURCE_MISSING')
  const count = Math.max(3, Math.min(10, input.count ?? 5))
  const job = await enqueueJob(db, {
    type: 'AI_GENERATE_EXERCISES',
    payload: { workspaceId: actor.workspaceId, userId: actor.userId, skillId: input.skillId, groupId: input.groupId ?? null, count },
    workspaceId: actor.workspaceId,
    maxAttempts: 2
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'ai.exercises.request', entityType: 'job', entityId: job.id, newValue: { skillId: input.skillId, groupId: input.groupId ?? null } })
  return { jobId: job.id }
}

export async function runGenerateExercisesJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const workspaceId = String(payload.workspaceId ?? '')
  const userId = String(payload.userId ?? '')
  const skillId = String(payload.skillId ?? '')
  const groupId = payload.groupId ? String(payload.groupId) : null
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  assertUuid(skillId, 'NOT_FOUND')
  const [sk] = await db.select().from(skills).where(eq(skills.id, skillId)).limit(1)
  if (!sk) throw new AppError('NOT_FOUND')
  const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  const actor: Actor = { userId, role: 'TEACHER', fullName: p?.fullName ?? '', email: '', workspaceId, teacherId: null, studentId: null }
  let levelName: string | null = null
  if (groupId) {
    const g = await assertGroupAccess(db, actor, groupId)
    if (g.levelId) levelName = (await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, g.levelId)).limit(1))[0]?.n ?? null
  }
  // فشل يخصّ المصدر لا يُصلحه تكرار المحاولة: يُبلَّغ الأستاذ بالسبب وتنتهي المهمة
  const stop = async (code: 'DRIVE_SOURCE_MISSING' | 'DRIVE_NO_MATCH' | 'DRIVE_NOT_SHARED' | 'DRIVE_API_DISABLED' | 'DRIVE_NOT_FOLDER' | 'DRIVE_EMPTY'): Promise<never> => {
    await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `لم تُولَّد تمارين: ${sk.nameAr}`, body: t(`errors.${code}`), link: '/teacher/settings#drive' })
    throw new PermanentJobError(code)
  }
  const source = await getDriveSource(db, workspaceId)
  if (!source) return stop('DRIVE_SOURCE_MISSING')
  let docs: Awaited<ReturnType<typeof loadSourceDocs>>
  try {
    docs = await loadSourceDocs(source.folderId)
  } catch (e) {
    if (e instanceof AppError && ['DRIVE_NOT_SHARED', 'DRIVE_API_DISABLED', 'DRIVE_NOT_FOLDER'].includes(e.code)) return stop(e.code as 'DRIVE_NOT_SHARED')
    throw e
  }
  if (docs.length === 0) return stop('DRIVE_EMPTY')
  const sources = selectPassages(docs, queryTerms(sk.nameAr))
  if (!sources) return stop('DRIVE_NO_MATCH')

  const provider = getAiProvider()
  const out = await provider.generateExercises({ subject: await workspaceSubject(db, workspaceId), skillName: sk.nameAr, skillCategory: sk.category, levelName, count: Number(payload.count ?? 5), sources })
  const questions = out.questions
    .map((q) => ({ type: q.type, prompt: q.prompt.trim(), points: 1, skillId, answerKey: q.answerKey, options: q.type === 'MCQ' ? (q.options ?? []) : [] }))
    .filter((q) => validateQuestion(q) === null)
  // النموذج لم يجد في المقاطع ما يكفي لسؤال واحد: لا اختراع
  if (questions.length === 0) return stop('DRIVE_NO_MATCH')
  const from = `المصدر: ${sources.map((s) => `«${s.title}»`).join('، ')} من مجلد Drive «${source.folderName}».`
  const quiz = await createQuiz(db, actor, {
    title: out.title.slice(0, 200),
    description: `${out.description ? `${out.description}\n\n` : ''}${from}\n(مولَّد بمساعدة الذكاء الاصطناعي — راجعه قبل النشر)`.slice(0, 2000),
    topic: sk.category,
    skillId,
    isPublic: false,
    publish: false,
    maxAttempts: 2,
    groupIds: groupId ? [groupId] : [],
    studentIds: [],
    questions
  })
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `مسودة تمارين علاجية جاهزة: ${sk.nameAr}`, body: `${questions.length} أسئلة — راجعها وانشرها.`, link: `/teacher/quizzes/${quiz.id}/edit` })
  return { quizId: quiz.id, questions: questions.length, dropped: out.questions.length - questions.length, provider: provider.name, sources: sources.map((s) => s.title) }
}

/* ---------------------------- Student analysis (job) ---------------------- */

export async function requestStudentAnalysis(db: Db, actor: Actor, studentId: string): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  await getStudentProfile(db, actor, studentId) // يتحقق من أن الطالب في مساحة الأستاذ
  const [pending] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'AI_ANALYZE_STUDENT'), eq(jobs.workspaceId, actor.workspaceId), sql`${jobs.payload}->>'studentId' = ${studentId}`, sql`${jobs.status} in ('QUEUED','PROCESSING')`))
    .limit(1)
  if (pending) return { jobId: pending.id }
  const job = await enqueueJob(db, { type: 'AI_ANALYZE_STUDENT', payload: { workspaceId: actor.workspaceId, userId: actor.userId, studentId }, workspaceId: actor.workspaceId, maxAttempts: 2 })
  return { jobId: job.id }
}

/** حقائق الطالب من قاعدة البيانات فقط (لا يخترع المزوّد شيئاً) */
export async function studentFacts(db: Db, actor: Actor, studentId: string): Promise<{ name: string; facts: string[] }> {
  const p = await getStudentProfile(db, actor, studentId)
  const facts: string[] = []
  if (p.attendance.total > 0) facts.push(`نسبة الحضور ${p.attendance.rate ?? 0}% من ${p.attendance.total} حصة (${p.attendance.late} متأخر، ${p.attendance.unexcused} غياب غير مبرر)`)
  for (const e of p.enrollments) if (e.status === 'SUSPENDED_DUE_TO_ABSENCE') facts.push(`معلّق بسبب الغياب في فوج ${e.groupName}`)
  const sk = await skillMap(db, studentId)
  for (const s of sk) facts.push(`${s.score >= 70 ? 'مهارة قوية' : s.score < 60 ? 'مهارة ضعيفة' : 'مهارة متوسطة'}: ${s.name} ${Math.round(s.score)}% (${s.attempts} تقييم)`)
  const gr = await db
    .select({ score: grades.score, maxScore: grades.maxScore, a: assignments.title, q: quizzes.title })
    .from(grades)
    .leftJoin(assignmentSubmissions, eq(assignmentSubmissions.id, grades.submissionId))
    .leftJoin(assignments, eq(assignments.id, assignmentSubmissions.assignmentId))
    .leftJoin(quizAttempts, eq(quizAttempts.id, grades.quizAttemptId))
    .leftJoin(quizzes, eq(quizzes.id, quizAttempts.quizId))
    .where(and(eq(grades.studentId, studentId), eq(grades.workspaceId, actor.workspaceId ?? ''), eq(grades.visibleToStudent, true)))
    .orderBy(desc(grades.createdAt))
    .limit(8)
  for (const g of gr) facts.push(`علامة ${Number(g.score)}/${Number(g.maxScore)} في "${g.a ?? g.q ?? 'تقييم'}"`)
  const missing = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assignments)
    .where(and(eq(assignments.workspaceId, actor.workspaceId ?? ''), sql`${assignments.deletedAt} is null`, sql`not exists (select 1 from assignment_submissions s where s.assignment_id = ${assignments.id} and s.student_id = ${studentId} and s.status <> 'DRAFT')`, sql`exists (select 1 from assignment_targets t join group_students gs on gs.group_id = t.group_id where t.assignment_id = ${assignments.id} and gs.student_id = ${studentId})`))
  if ((missing[0]?.n ?? 0) > 0) facts.push(`لم يرسل ${missing[0]!.n} واجب مسند إليه`)
  return { name: p.fullName, facts }
}

export async function runAnalyzeStudentJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const workspaceId = String(payload.workspaceId ?? '')
  const userId = String(payload.userId ?? '')
  const studentId = String(payload.studentId ?? '')
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  assertUuid(studentId, 'NOT_FOUND')
  const actor: Actor = { userId, role: 'TEACHER', fullName: '', email: '', workspaceId, teacherId: null, studentId: null }
  const { name, facts } = await studentFacts(db, actor, studentId)
  const provider = getAiProvider()
  const out = await provider.analyzeStudent({ subject: await workspaceSubject(db, workspaceId), studentName: name, facts })
  return { studentId, summary: out.summary, strengths: out.strengths, weaknesses: out.weaknesses, recommendations: out.recommendations, facts: facts.length, provider: provider.name, model: provider.model, generatedAt: new Date().toISOString() }
}

export interface StudentAnalysisView {
  status: string
  summary: string | null
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]
  generatedAt: Date | null
  provider: string | null
}

export async function latestStudentAnalysis(db: Db, actor: Actor, studentId: string): Promise<StudentAnalysisView | null> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) return null
  assertUuid(studentId, 'NOT_FOUND')
  const [job] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, 'AI_ANALYZE_STUDENT'), eq(jobs.workspaceId, actor.workspaceId), sql`${jobs.payload}->>'studentId' = ${studentId}`))
    .orderBy(desc(jobs.createdAt))
    .limit(1)
  if (!job) return null
  const r = (job.result ?? {}) as { summary?: string; strengths?: string[]; weaknesses?: string[]; recommendations?: string[]; generatedAt?: string; provider?: string }
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
  return { status: job.status, summary: r.summary ?? null, strengths: arr(r.strengths), weaknesses: arr(r.weaknesses), recommendations: arr(r.recommendations), generatedAt: r.generatedAt ? new Date(r.generatedAt) : null, provider: r.provider ?? null }
}
