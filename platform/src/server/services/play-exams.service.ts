/**
 * MADRASA PLAY — الفروض والاختبارات والبكالوريا داخل اللعبة (03_PRODUCT_BLUEPRINT).
 * محرك واحد: كل مجموعة مشتقة من مصدر أصلي وتصحيحه، تُلعب «تدريبًا» (تغذية راجعة فورية) أو «محاكاة امتحان» (تصحيح في النهاية).
 *
 * الحماية:
 *  - يرى التلميذ المجموعات القابلة للنشر فقط (اعتمدها صاحب المنصة). في بيئة التطوير وحدها يمكن تفعيل
 *    PLAY_EXAM_PREVIEW=1 لعرض المجموعات «قيد المراجعة» مع شارة واضحة؛ لا يُضبط هذا في الإنتاج.
 *  - الوصول (اشتراك الدورة الملائمة أو تجربة 72 ساعة) يُفحص عند البدء وعند كل إجابة.
 *  - التصحيح في الخادم فقط؛ لا تُرسل مفاتيح الإجابة قبل الإجابة (تدريب) أو قبل الإنهاء (امتحان).
 *  - الإجابة الأولى لكل خطوة هي المحتسبة (لا تنقيط مزدوج).
 */
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { playExamAttempts, playExamSets, type ExamStepRecord } from '@/server/db/schema'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import type { PlayExamKind, PlayExamMode } from '@/server/play/constants'
import { answerText, gradeStep, publicSteps } from '@/server/play/exams/engine'
import { skillLabel } from '@/server/play/exams/skills'
import { QUEUED_STEP_TYPES, type ExamSetDocument, type PublicStep, type StepAnswer, type TrainingStep } from '@/server/play/exams/types'
import { assertPlayAccess, beginPlayAccess } from './play-access.service'
import { getPlayProfile } from './play.service'

const PREVIEWABLE = ['NEEDS_HUMAN_REVIEW', 'AUTO_VALIDATED', 'APPROVED', 'STAGED']

export function examPreviewEnabled(): boolean {
  return process.env.PLAY_EXAM_PREVIEW === '1' && process.env.NODE_ENV !== 'production'
}

const isQueued = (t: string) => (QUEUED_STEP_TYPES as readonly string[]).includes(t)
const round2 = (n: number) => Math.round(n * 100) / 100

type SetRow = typeof playExamSets.$inferSelect

function visible(row: Pick<SetRow, 'publishable' | 'status'>): { ok: boolean; preview: boolean } {
  if (row.publishable) return { ok: true, preview: false }
  if (examPreviewEnabled() && PREVIEWABLE.includes(row.status)) return { ok: true, preview: true }
  return { ok: false, preview: false }
}

function interactivePoints(doc: ExamSetDocument): number {
  return doc.steps.filter((s) => !isQueued(s.type)).reduce((a, s) => a + s.points, 0)
}

function deferredElements(doc: ExamSetDocument) {
  const labels = new Map(doc.original_questions.flatMap((q) => q.rubric_elements.map((e) => [e.id, { label: e.label, part: q.part }] as const)))
  const out = new Map<string, { label: string; part: string; points: number }>()
  for (const s of doc.steps.filter((x) => isQueued(x.type))) {
    const l = labels.get(s.rubric_element_id)
    const prev = out.get(s.rubric_element_id)
    out.set(s.rubric_element_id, { label: l?.label ?? s.prompt, part: l?.part ?? '', points: (prev?.points ?? 0) + s.points })
  }
  return [...out.values()]
}

export interface ExamListItem {
  id: string
  setId: string
  kind: PlayExamKind
  year: number | null
  term: number | null
  paper: number | null
  title: string
  streamCodes: string[]
  stepCount: number
  interactivePoints: number
  deferredPoints: number
  scoreTotal: number
  preview: boolean
  attempts: number
  best: { score: number; max: number } | null
}

/** مجموعات المستوى والمادة المتاحة للتلميذ (حسب شعبته) */
export async function listExamSets(db: Db, actor: Actor, filter: { subjectCode: string; kind?: PlayExamKind | 'TESTS' }): Promise<{ items: ExamListItem[]; gradeCode: string | null; streamCode: string | null; preview: boolean }> {
  const studentId = studentIdOf(actor)
  const profile = await getPlayProfile(db, actor)
  if (!profile.gradeCode) return { items: [], gradeCode: null, streamCode: null, preview: examPreviewEnabled() }
  const conds = [eq(playExamSets.gradeCode, profile.gradeCode), eq(playExamSets.subjectCode, filter.subjectCode)]
  if (filter.kind === 'TESTS') conds.push(inArray(playExamSets.kind, ['TEST', 'DEVOIR']))
  else if (filter.kind) conds.push(eq(playExamSets.kind, filter.kind))
  const rows = await db.select().from(playExamSets).where(and(...conds))
  const shown = rows.filter((r) => visible(r).ok && (!r.streamCodes.length || !profile.streamCode || r.streamCodes.includes(profile.streamCode)))
  const attempts = shown.length
    ? await db
        .select({ setId: playExamAttempts.setId, score: playExamAttempts.score, max: playExamAttempts.maxScore, status: playExamAttempts.status })
        .from(playExamAttempts)
        .where(and(eq(playExamAttempts.studentId, studentId), inArray(playExamAttempts.setId, shown.map((r) => r.id))))
    : []
  const items = shown.map((r): ExamListItem => {
    const mine = attempts.filter((a) => a.setId === r.id && a.status === 'COMPLETED')
    const best = mine.reduce<{ score: number; max: number } | null>((b, a) => (!b || a.score / (a.max || 1) > b.score / (b.max || 1) ? { score: a.score, max: a.max } : b), null)
    const ip = interactivePoints(r.document)
    return {
      id: r.id,
      setId: r.setId,
      kind: r.kind as PlayExamKind,
      year: r.year,
      term: r.term,
      paper: r.paper,
      title: r.title,
      streamCodes: r.streamCodes,
      stepCount: r.document.steps.filter((s) => !isQueued(s.type)).length,
      interactivePoints: round2(ip),
      deferredPoints: round2(r.scoreTotal - ip),
      scoreTotal: r.scoreTotal,
      preview: visible(r).preview,
      attempts: mine.length,
      best
    }
  })
  items.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || (a.term ?? 0) - (b.term ?? 0) || (a.paper ?? 0) - (b.paper ?? 0) || a.title.localeCompare(b.title, 'ar'))
  return { items, gradeCode: profile.gradeCode, streamCode: profile.streamCode, preview: examPreviewEnabled() }
}

async function loadVisibleSet(db: Db, setUuid: string): Promise<SetRow & { preview: boolean }> {
  assertUuid(setUuid, 'PLAY_EXAM_NOT_FOUND')
  const [row] = await db.select().from(playExamSets).where(eq(playExamSets.id, setUuid)).limit(1)
  if (!row) throw new AppError('PLAY_EXAM_NOT_FOUND')
  const v = visible(row)
  if (!v.ok) throw new AppError('PLAY_EXAM_NOT_FOUND')
  return { ...row, preview: v.preview }
}

/** بدء (أو استئناف) محاولة: أول بدء فعلي يفعّل التجربة لغير المشترك */
export async function startExamAttempt(db: Db, actor: Actor, setUuid: string, mode: PlayExamMode, now: Date = new Date()): Promise<{ attemptId: string; resumed: boolean }> {
  const studentId = studentIdOf(actor)
  const set = await loadVisibleSet(db, setUuid)
  const profile = await getPlayProfile(db, actor)
  if (set.streamCodes.length && profile.streamCode && !set.streamCodes.includes(profile.streamCode)) throw new AppError('PLAY_EXAM_NOT_FOUND')
  await beginPlayAccess(db, actor, { gradeCode: set.gradeCode, streamCode: profile.streamCode, subjectCode: set.subjectCode }, now)
  const [active] = await db
    .select({ id: playExamAttempts.id, mode: playExamAttempts.mode, checksum: playExamAttempts.setChecksum })
    .from(playExamAttempts)
    .where(and(eq(playExamAttempts.studentId, studentId), eq(playExamAttempts.setId, set.id), eq(playExamAttempts.status, 'ACTIVE')))
    .orderBy(desc(playExamAttempts.startedAt))
    .limit(1)
  if (active && active.mode === mode && active.checksum === set.checksum) return { attemptId: active.id, resumed: true }
  if (active) await db.update(playExamAttempts).set({ status: 'ABANDONED', updatedAt: now }).where(eq(playExamAttempts.id, active.id))
  const [created] = await db
    .insert(playExamAttempts)
    .values({ studentId, setId: set.id, setChecksum: set.checksum, mode, status: 'ACTIVE', answers: {}, score: 0, maxScore: interactivePoints(set.document), startedAt: now })
    .returning({ id: playExamAttempts.id })
  return { attemptId: created!.id, resumed: false }
}

async function loadAttempt(db: Db, actor: Actor, attemptId: string) {
  assertUuid(attemptId, 'PLAY_EXAM_ATTEMPT_NOT_FOUND')
  const studentId = studentIdOf(actor)
  const [row] = await db
    .select({ attempt: playExamAttempts, set: playExamSets })
    .from(playExamAttempts)
    .innerJoin(playExamSets, eq(playExamSets.id, playExamAttempts.setId))
    .where(and(eq(playExamAttempts.id, attemptId), eq(playExamAttempts.studentId, studentId)))
    .limit(1)
  if (!row) throw new AppError('PLAY_EXAM_ATTEMPT_NOT_FOUND')
  return row
}

export interface StepFeedback {
  s: number
  w: number
  earned: number
  correct: boolean
  correctText: string
  explanation: string
  yourAnswer: string
}

function feedbackFor(step: TrainingStep, rec: ExamStepRecord): StepFeedback {
  return { s: rec.s, w: rec.w, earned: round2(rec.s * rec.w), correct: rec.s >= 0.999, correctText: answerText(step), explanation: step.explanation, yourAnswer: studentAnswerText(step, rec.answer) }
}

export function studentAnswerText(step: Pick<TrainingStep, 'payload'>, a: StepAnswer | null | undefined): string {
  if (!a) return '—'
  const p = step.payload
  switch (a.type) {
    case 'mcq':
    case 'portrait':
      return 'options' in p ? (p.options[a.choice] ?? '—') : '—'
    case 'multi':
      return 'options' in p ? a.choices.map((i) => p.options[i]).filter(Boolean).join(' ، ') || '—' : '—'
    case 'fill_blank':
      return a.blanks.join(' ، ') || '—'
    case 'ordering':
      return 'items' in p ? a.order.map((i) => p.items[i]).join(' ← ') : '—'
    case 'matching':
      return 'lefts' in p ? p.lefts.map((l, i) => `${l} ← ${p.rights[a.pairs[i]!] ?? '؟'}`).join(' | ') : '—'
    case 'numeric':
      return String(a.value)
    case 'short_text':
      return a.text || '—'
  }
}

export interface AttemptView {
  attemptId: string
  mode: PlayExamMode
  status: string
  preview: boolean
  set: { id: string; setId: string; kind: PlayExamKind; title: string; year: number | null; term: number | null; paper: number | null; subjectCode: string; gradeCode: string; streamCodes: string[]; scoreTotal: number; trust: string; originalRef: string | null; correctionRef: string | null; reviewed: boolean }
  steps: PublicStep[]
  answered: Record<string, { earned: number; w: number; feedback: StepFeedback | null }>
  score: number
  maxScore: number
  deferred: { label: string; part: string; points: number }[]
  stale: boolean
}

export async function getExamAttemptView(db: Db, actor: Actor, attemptId: string): Promise<AttemptView> {
  const { attempt, set } = await loadAttempt(db, actor, attemptId)
  const doc = set.document
  const byId = new Map(doc.steps.map((s) => [s.id, s]))
  const reveal = attempt.mode === 'PRACTICE' || attempt.status === 'COMPLETED'
  const answered: AttemptView['answered'] = {}
  for (const [sid, rec] of Object.entries(attempt.answers ?? {})) {
    const step = byId.get(sid)
    answered[sid] = { earned: reveal ? round2(rec.s * rec.w) : 0, w: rec.w, feedback: reveal && step ? feedbackFor(step, rec) : null }
  }
  return {
    attemptId: attempt.id,
    mode: attempt.mode as PlayExamMode,
    status: attempt.status,
    preview: !set.publishable,
    set: {
      id: set.id,
      setId: set.setId,
      kind: set.kind as PlayExamKind,
      title: set.title,
      year: set.year,
      term: set.term,
      paper: set.paper,
      subjectCode: set.subjectCode,
      gradeCode: set.gradeCode,
      streamCodes: set.streamCodes,
      scoreTotal: set.scoreTotal,
      trust: doc.source.trust,
      originalRef: doc.source.original_url,
      correctionRef: doc.source.correction_url,
      reviewed: doc.source.verified
    },
    steps: publicSteps(doc),
    answered,
    score: reveal ? round2(attempt.score) : 0,
    maxScore: round2(attempt.maxScore),
    deferred: deferredElements(doc),
    stale: attempt.setChecksum !== set.checksum
  }
}

export interface ExamSubmitResult {
  stepId: string
  answeredCount: number
  total: number
  feedback: StepFeedback | null
  score: number | null
  alreadyAnswered: boolean
}

export async function submitExamStep(db: Db, actor: Actor, attemptId: string, stepId: string, answer: StepAnswer, now: Date = new Date()): Promise<ExamSubmitResult> {
  const { attempt, set } = await loadAttempt(db, actor, attemptId)
  if (attempt.status !== 'ACTIVE') throw new AppError('PLAY_EXAM_CLOSED')
  const profile = await getPlayProfile(db, actor)
  await assertPlayAccess(db, actor, { gradeCode: set.gradeCode, streamCode: profile.streamCode, subjectCode: set.subjectCode }, now)
  const step = set.document.steps.find((s) => s.id === stepId)
  if (!step || isQueued(step.type)) throw new AppError('PLAY_STEP_NOT_FOUND')
  const total = set.document.steps.filter((s) => !isQueued(s.type)).length
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(playExamAttempts).where(eq(playExamAttempts.id, attempt.id)).for('update')
    if (!row || row.status !== 'ACTIVE') throw new AppError('PLAY_EXAM_CLOSED')
    const answers = { ...(row.answers ?? {}) }
    const reveal = row.mode === 'PRACTICE'
    const prev = answers[stepId]
    if (prev) {
      return { stepId, answeredCount: Object.keys(answers).length, total, feedback: reveal ? feedbackFor(step, prev) : null, score: reveal ? round2(row.score) : null, alreadyAnswered: true }
    }
    const s = gradeStep(step.answer, answer)
    const rec: ExamStepRecord = { answer, s, w: step.points, at: now.toISOString() }
    answers[stepId] = rec
    const score = Object.values(answers).reduce((a, r) => a + r.s * r.w, 0)
    await tx.update(playExamAttempts).set({ answers, score, updatedAt: now }).where(eq(playExamAttempts.id, row.id))
    return { stepId, answeredCount: Object.keys(answers).length, total, feedback: reveal ? feedbackFor(step, rec) : null, score: reveal ? round2(score) : null, alreadyAnswered: false }
  })
}

export async function finishExamAttempt(db: Db, actor: Actor, attemptId: string, now: Date = new Date()): Promise<{ attemptId: string }> {
  const { attempt } = await loadAttempt(db, actor, attemptId)
  if (attempt.status === 'ACTIVE') {
    await db.update(playExamAttempts).set({ status: 'COMPLETED', completedAt: now, updatedAt: now }).where(and(eq(playExamAttempts.id, attempt.id), eq(playExamAttempts.status, 'ACTIVE')))
  }
  return { attemptId: attempt.id }
}

export interface ExamResult {
  view: AttemptView
  /** على 20 (أو مجموع الورقة): النقاط التفاعلية المحصّلة + العناصر المؤجلة تُعرض منفصلة */
  earned: number
  interactiveMax: number
  deferredPoints: number
  /** تقدير على 20 من الجزء التفاعلي فقط (للمقارنة)، ليس العلامة الرسمية */
  scaledTo20: number
  byQuestion: { id: string; number: string; part: string; text: string; earned: number; max: number; deferred: number }[]
  byPart: { part: string; earned: number; max: number; deferred: number }[]
  steps: { id: string; prompt: string; questionNumber: string; part: string; rubricLabel: string; feedback: StepFeedback | null; points: number }[]
}

export async function getExamResult(db: Db, actor: Actor, attemptId: string): Promise<ExamResult> {
  const view = await getExamAttemptView(db, actor, attemptId)
  if (view.status !== 'COMPLETED') throw new AppError('PLAY_EXAM_CLOSED')
  const { set } = await loadAttempt(db, actor, attemptId)
  const doc = set.document
  const byQuestion = doc.original_questions.map((q) => {
    const steps = doc.steps.filter((s) => s.source_question_id === q.id)
    const max = steps.filter((s) => !isQueued(s.type)).reduce((a, s) => a + s.points, 0)
    const deferred = steps.filter((s) => isQueued(s.type)).reduce((a, s) => a + s.points, 0)
    const earned = steps.reduce((a, s) => a + (view.answered[s.id]?.earned ?? 0), 0)
    return { id: q.id, number: q.number, part: q.part, text: q.verbatim_text, earned: round2(earned), max: round2(max), deferred: round2(deferred) }
  })
  const parts = new Map<string, { part: string; earned: number; max: number; deferred: number }>()
  for (const q of byQuestion) {
    const p = parts.get(q.part) ?? { part: q.part, earned: 0, max: 0, deferred: 0 }
    p.earned = round2(p.earned + q.earned)
    p.max = round2(p.max + q.max)
    p.deferred = round2(p.deferred + q.deferred)
    parts.set(q.part, p)
  }
  const qById = new Map(doc.original_questions.map((q) => [q.id, q]))
  return {
    view,
    earned: view.score,
    interactiveMax: view.maxScore,
    deferredPoints: round2(view.deferred.reduce((a, d) => a + d.points, 0)),
    scaledTo20: view.maxScore ? round2((view.score / view.maxScore) * 20) : 0,
    byQuestion,
    byPart: [...parts.values()],
    steps: view.steps.map((s) => ({ id: s.id, prompt: s.prompt, questionNumber: qById.get(s.source_question.id)?.number ?? '', part: s.source_question.part, rubricLabel: s.rubric_label, feedback: view.answered[s.id]?.feedback ?? null, points: s.points }))
  }
}

export interface ExamProgress {
  attempts: { id: string; setUuid: string; title: string; kind: PlayExamKind; mode: PlayExamMode; status: string; score: number; max: number; startedAt: string; completedAt: string | null; answered: number }[]
  byKind: { kind: PlayExamKind; completed: number; avgPct: number | null; bestPct: number | null }[]
  skills: { id: string; label: string; earned: number; max: number; pct: number; answered: number }[]
}

/** «نتائجي وتقدمي»: المحاولات والمتوسطات ونقاط القوة والضعف حسب المهارة */
export async function getExamProgress(db: Db, actor: Actor): Promise<ExamProgress> {
  const studentId = studentIdOf(actor)
  const rows = await db
    .select({ attempt: playExamAttempts, set: { id: playExamSets.id, title: playExamSets.title, kind: playExamSets.kind, document: playExamSets.document } })
    .from(playExamAttempts)
    .innerJoin(playExamSets, eq(playExamSets.id, playExamAttempts.setId))
    .where(eq(playExamAttempts.studentId, studentId))
    .orderBy(desc(playExamAttempts.startedAt))
    .limit(200)
  const attempts = rows
    .filter((r) => r.attempt.status !== 'ABANDONED' || Object.keys(r.attempt.answers ?? {}).length > 0)
    .slice(0, 40)
    .map((r) => ({
      id: r.attempt.id,
      setUuid: r.set.id,
      title: r.set.title,
      kind: r.set.kind as PlayExamKind,
      mode: r.attempt.mode as PlayExamMode,
      status: r.attempt.status,
      score: r.attempt.mode === 'EXAM' && r.attempt.status !== 'COMPLETED' ? 0 : round2(r.attempt.score),
      max: round2(r.attempt.maxScore),
      startedAt: r.attempt.startedAt.toISOString(),
      completedAt: r.attempt.completedAt?.toISOString() ?? null,
      answered: Object.keys(r.attempt.answers ?? {}).length
    }))
  const kinds: PlayExamKind[] = ['TEST', 'DEVOIR', 'BAC']
  const byKind = kinds.map((kind) => {
    const done = rows.filter((r) => r.set.kind === kind && r.attempt.status === 'COMPLETED' && r.attempt.maxScore > 0)
    const pcts = done.map((r) => (r.attempt.score / r.attempt.maxScore) * 100)
    return { kind, completed: done.length, avgPct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null, bestPct: pcts.length ? Math.round(Math.max(...pcts)) : null }
  })
  // المهارات: من الإجابات المكشوفة فقط (تدريب، أو امتحان منتهٍ)
  const skills = new Map<string, { earned: number; max: number; answered: number }>()
  for (const r of rows) {
    if (r.attempt.mode === 'EXAM' && r.attempt.status !== 'COMPLETED') continue
    const stepById = new Map(r.set.document.steps.map((s) => [s.id, s]))
    for (const [sid, rec] of Object.entries(r.attempt.answers ?? {})) {
      const key = stepById.get(sid)?.skill_id ?? 'other'
      const cur = skills.get(key) ?? { earned: 0, max: 0, answered: 0 }
      cur.earned += rec.s * rec.w
      cur.max += rec.w
      cur.answered += 1
      skills.set(key, cur)
    }
  }
  return {
    attempts,
    byKind,
    skills: [...skills.entries()]
      .map(([id, v]) => ({ id, label: skillLabel(id === 'other' ? null : id), earned: round2(v.earned), max: round2(v.max), pct: v.max ? Math.round((v.earned / v.max) * 100) : 0, answered: v.answered }))
      .sort((a, b) => a.pct - b.pct || b.answered - a.answered)
  }
}
