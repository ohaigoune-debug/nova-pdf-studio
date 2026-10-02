/**
 * ورقة الامتحان (Exam Builder — المرحلة 2).
 * الامتحان مجموعة عناصر مرتّبة؛ كل عنصر من البنك يحمل نسخة مجمّدة من السؤال وقت إدراجه،
 * فتعديل البنك لاحقاً لا يغيّر امتحاناً جاهزاً، وتعديل العنصر لا يمسّ البنك.
 * المجموع والصعوبة يُحسبان عند كل تغيير ويُخزّنان في الامتحان.
 */
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { figuresSchema, imageIdsOf, layoutSchema, parseBlock, type ExamLayout, type StudioBlock } from '@/lib/exam-blocks'
import type { Db } from '@/server/db/connect'
import { academicYears, auditLogs, bankQuestions, examItems, examRevisions, exams, groups, levels, profiles, streams, subjects, type BankQuestionRow, type BaremeItem, type DifficultySummary, type ExamHeader, type ExamItemRow, type ExamItemSnapshot, type ExamRevisionSnapshot, type ExamRow } from '@/server/db/schema'
import type { ExamItemKind, ExamKind, ExamStatus } from '@/server/db/schema/enums'
import { EXAM_KINDS, EXAM_STATUSES } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { autoTitle, itemPoints } from '@/lib/exam-points'
import { EXAM_KIND_AR } from '@/lib/exam-labels'

export { EXAM_KIND_AR }
const TERM_AR = ['', 'الفصل الأول', 'الفصل الثاني', 'الفصل الثالث']
const MAX_ITEMS = 60

export interface ExamInput {
  title?: string
  kind?: ExamKind
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  schoolTerm?: number | null
  academicYear?: string | null
  durationMinutes?: number
  targetPoints?: number
  instructions?: string | null
  header?: ExamHeader
  status?: ExamStatus
  /** المرحلة 6: قالب يُستنسخ منه، والفوج المعدّ له */
  isTemplate?: boolean
  groupId?: string | null
  /** الاستوديو: تخطيط الورقة (يُدمج مع الحالي) والمفضّلة */
  layout?: ExamLayout
  isFavorite?: boolean
}

/** مراجعة تلقائية: لقطة قبل أول تغيير في كل نافذة زمنية (وتُحذف الأقدم بعد الحدّ) */
export const AUTO_REVISION_MINUTES = 10
const MAX_AUTO_REVISIONS = 40

const ws = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

const round2 = (n: number) => Math.round(n * 100) / 100

export { autoTitle, itemPoints }

export function summarize(items: Pick<ExamItemRow, 'kind' | 'points' | 'snapshot'>[], targetPoints: number): { total: number; summary: DifficultySummary } {
  const graded = items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION')
  const total = round2(graded.reduce((a, i) => a + itemPoints(i), 0))
  const counts: Record<string, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  let weighted = 0
  let minutes = 0
  for (const i of graded) {
    const d = i.snapshot.difficulty ?? 2
    counts[d] = (counts[d] ?? 0) + 1
    weighted += d * itemPoints(i)
    minutes += i.snapshot.estimatedMinutes ?? 0
  }
  const score = total > 0 ? round2(weighted / total) : null
  const label = score == null ? null : score < 1.6 ? 'سهل' : score < 2.4 ? 'متوسط' : score < 3.2 ? 'متوسط إلى صعب' : 'صعب'
  void targetPoints
  return { total, summary: { counts, score, label, minutes } }
}

async function recompute(db: Db, examId: string): Promise<{ total: number; summary: DifficultySummary }> {
  const [ex] = await db.select({ target: exams.targetPoints }).from(exams).where(eq(exams.id, examId)).limit(1)
  const items = await db.select({ kind: examItems.kind, points: examItems.points, snapshot: examItems.snapshot }).from(examItems).where(eq(examItems.examId, examId))
  const r = summarize(items, Number(ex?.target ?? 20))
  await db.update(exams).set({ totalPoints: String(r.total), difficultySummary: r.summary, updatedAt: new Date() }).where(eq(exams.id, examId))
  return r
}

/* ------------------------------- الامتحان ------------------------------- */

export async function createExam(db: Db, actor: Actor, input: ExamInput): Promise<ExamRow> {
  const workspaceId = ws(actor)
  const title = input.title?.trim()
  if (!title) throw new AppError('VALIDATION', { field: 'title' })
  if (input.kind && !EXAM_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  const [year] = await db.select({ label: academicYears.label }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1)
  const [row] = await db
    .insert(exams)
    .values({
      workspaceId,
      createdByUserId: actor.userId,
      title,
      kind: input.kind ?? 'TEST',
      subjectId: input.subjectId ?? null,
      levelId: input.levelId ?? null,
      streamId: input.streamId ?? null,
      schoolTerm: input.schoolTerm ?? null,
      academicYear: input.academicYear ?? year?.label ?? null,
      durationMinutes: input.durationMinutes ?? 120,
      targetPoints: String(input.targetPoints ?? 20),
      instructions: input.instructions?.trim() || null,
      header: { teacherName: actor.fullName, ...(input.header ?? {}) }
    })
    .returning()
  if (!row) throw new AppError('INTERNAL')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'exam.create', entityType: 'exam', entityId: row.id, newValue: { title, kind: row.kind } })
  return row
}

export async function getOwnExam(db: Db, actor: Actor, id: string): Promise<ExamRow> {
  const workspaceId = ws(actor)
  assertUuid(id, 'EXAM_NOT_FOUND')
  const [row] = await db.select().from(exams).where(and(eq(exams.id, id), eq(exams.workspaceId, workspaceId), isNull(exams.deletedAt))).limit(1)
  if (!row) throw new AppError('EXAM_NOT_FOUND')
  return row
}

export async function updateExam(db: Db, actor: Actor, id: string, input: ExamInput): Promise<ExamRow> {
  const current = await getOwnExam(db, actor, id)
  if (!(input.isFavorite !== undefined && Object.keys(input).length === 1)) await autoRevision(db, current, actor.userId)
  const patch: Partial<typeof exams.$inferInsert> = { updatedAt: new Date() }
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new AppError('VALIDATION', { field: 'title' })
    patch.title = input.title.trim()
  }
  if (input.kind !== undefined) {
    if (!EXAM_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
    patch.kind = input.kind
  }
  if (input.status !== undefined) {
    if (!EXAM_STATUSES.includes(input.status)) throw new AppError('VALIDATION', { field: 'status' })
    patch.status = input.status
  }
  if (input.subjectId !== undefined) patch.subjectId = input.subjectId
  if (input.levelId !== undefined) patch.levelId = input.levelId
  if (input.streamId !== undefined) patch.streamId = input.streamId
  if (input.schoolTerm !== undefined) {
    if (input.schoolTerm != null && ![1, 2, 3].includes(input.schoolTerm)) throw new AppError('VALIDATION', { field: 'schoolTerm' })
    patch.schoolTerm = input.schoolTerm
  }
  if (input.academicYear !== undefined) patch.academicYear = input.academicYear?.trim() || null
  if (input.durationMinutes !== undefined) {
    if (input.durationMinutes < 5 || input.durationMinutes > 600) throw new AppError('VALIDATION', { field: 'durationMinutes' })
    patch.durationMinutes = input.durationMinutes
  }
  if (input.targetPoints !== undefined) {
    if (!(input.targetPoints > 0) || input.targetPoints > 200) throw new AppError('VALIDATION', { field: 'targetPoints' })
    patch.targetPoints = String(input.targetPoints)
  }
  if (input.instructions !== undefined) patch.instructions = input.instructions?.trim() || null
  if (input.header !== undefined) patch.header = { ...current.header, ...input.header }
  if (input.isTemplate !== undefined) patch.isTemplate = input.isTemplate
  if (input.isFavorite !== undefined) patch.isFavorite = input.isFavorite
  if (input.layout !== undefined) {
    const parsed = layoutSchema.safeParse({ ...current.layout, ...input.layout })
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'layout' })
    patch.layout = parsed.data
  }
  if (input.groupId !== undefined) {
    if (input.groupId) {
      assertUuid(input.groupId, 'VALIDATION')
      const [g] = await db.select({ id: groups.id }).from(groups).where(and(eq(groups.id, input.groupId), eq(groups.workspaceId, current.workspaceId))).limit(1)
      if (!g) throw new AppError('VALIDATION', { field: 'groupId' })
    }
    patch.groupId = input.groupId
  }
  const [row] = await db.update(exams).set(patch).where(eq(exams.id, id)).returning()
  if (input.isTemplate !== undefined && Object.keys(input).length === 1) await writeAudit(db, { actorUserId: actor.userId, workspaceId: current.workspaceId, action: 'exam.template', entityType: 'exam', entityId: id, newValue: { isTemplate: input.isTemplate } })
  else {
    // في السجلّ: ما تغيّر فعلاً فقط (المحرّر يرسل كل الحقول عند كل حفظ)
    const changed: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(patch)) if (k !== 'updatedAt' && k !== 'header' && k !== 'layout' && JSON.stringify(v) !== JSON.stringify((current as Record<string, unknown>)[k])) changed[k] = v
    if (input.header !== undefined && JSON.stringify(patch.header) !== JSON.stringify(current.header)) changed.header = true
    if (input.layout !== undefined && JSON.stringify(patch.layout) !== JSON.stringify(current.layout)) changed.layout = true
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: current.workspaceId, action: 'exam.update', entityType: 'exam', entityId: id, newValue: changed })
  }
  return row!
}

export async function deleteExam(db: Db, actor: Actor, id: string): Promise<void> {
  const ex = await getOwnExam(db, actor, id)
  await db.update(exams).set({ deletedAt: new Date() }).where(eq(exams.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.delete', entityType: 'exam', entityId: id, oldValue: { title: ex.title } })
}

export async function duplicateExam(db: Db, actor: Actor, id: string): Promise<ExamRow> {
  const ex = await getOwnExam(db, actor, id)
  const items = await db.select().from(examItems).where(eq(examItems.examId, id)).orderBy(asc(examItems.position))
  const copy = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(exams)
      .values({ ...ex, id: undefined, title: `${ex.title} (نسخة)`, status: 'DRAFT', isTemplate: false, printCount: 0, lastPrintedAt: null, sourceExamId: ex.id, pdfFileId: null, solutionPdfFileId: null, createdAt: undefined, updatedAt: undefined, deletedAt: null })
      .returning()
    if (items.length) await tx.insert(examItems).values(items.map((it) => ({ examId: row!.id, position: it.position, kind: it.kind, bankQuestionId: it.bankQuestionId, title: it.title, points: it.points, snapshot: it.snapshot })))
    return row!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.duplicate', entityType: 'exam', entityId: copy.id, newValue: { from: id } })
  return copy
}

export type ExamScope = 'all' | 'draft' | 'ready' | 'templates' | 'archived' | 'favorites'

export interface ExamFilter {
  scope?: ExamScope
  subjectId?: string | null
  levelId?: string | null
  kind?: ExamKind | null
  groupId?: string | null
  q?: string | null
}

/** قائمة الورشة: «الكل» = غير المؤرشف وغير القالب؛ القوالب والأرشيف نطاقان مستقلّان */
export async function listExams(db: Db, actor: Actor, filter: ExamFilter = {}) {
  const workspaceId = ws(actor)
  const scope = filter.scope ?? 'all'
  const q = filter.q?.trim()
  return db
    .select({
      id: exams.id,
      title: exams.title,
      kind: exams.kind,
      status: exams.status,
      isTemplate: exams.isTemplate,
      isFavorite: exams.isFavorite,
      totalPoints: exams.totalPoints,
      targetPoints: exams.targetPoints,
      durationMinutes: exams.durationMinutes,
      schoolTerm: exams.schoolTerm,
      printCount: exams.printCount,
      lastPrintedAt: exams.lastPrintedAt,
      updatedAt: exams.updatedAt,
      subjectName: subjects.nameAr,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      groupName: groups.name,
      items: sql<number>`(select count(*)::int from ${examItems} i where i.exam_id = ${exams.id} and i.kind in ('EXERCISE','QUESTION'))`
    })
    .from(exams)
    .leftJoin(subjects, eq(subjects.id, exams.subjectId))
    .leftJoin(levels, eq(levels.id, exams.levelId))
    .leftJoin(streams, eq(streams.id, exams.streamId))
    .leftJoin(groups, eq(groups.id, exams.groupId))
    .where(
      and(
        eq(exams.workspaceId, workspaceId),
        isNull(exams.deletedAt),
        scope === 'archived' ? eq(exams.status, 'ARCHIVED') : sql`${exams.status} <> 'ARCHIVED'`,
        scope === 'templates' ? eq(exams.isTemplate, true) : scope === 'archived' || scope === 'favorites' ? undefined : eq(exams.isTemplate, false),
        scope === 'draft' ? eq(exams.status, 'DRAFT') : scope === 'ready' ? eq(exams.status, 'READY') : undefined,
        scope === 'favorites' ? eq(exams.isFavorite, true) : undefined,
        filter.subjectId ? eq(exams.subjectId, filter.subjectId) : undefined,
        filter.levelId ? eq(exams.levelId, filter.levelId) : undefined,
        filter.kind ? eq(exams.kind, filter.kind) : undefined,
        filter.groupId ? eq(exams.groupId, filter.groupId) : undefined,
        q ? sql`${exams.title} ilike ${'%' + q.replace(/[%_]/g, '') + '%'}` : undefined
      )
    )
    .orderBy(desc(exams.updatedAt))
    .limit(200)
}

/* ------------------------------ ورشة الأستاذ (المرحلة 6) ------------------------------ */

/** إنشاء امتحان من قالب: نسخة كاملة (ترويسة، إعدادات، عناصر) بعنوان القالب، ليست قالباً */
export async function createFromTemplate(db: Db, actor: Actor, templateId: string): Promise<ExamRow> {
  const tpl = await getOwnExam(db, actor, templateId)
  if (!tpl.isTemplate) throw new AppError('EXAM_NOT_FOUND')
  const items = await db.select().from(examItems).where(eq(examItems.examId, templateId)).orderBy(asc(examItems.position))
  const row = await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(exams)
      .values({ ...tpl, id: undefined, title: tpl.title.replace(/\s*\(قالب\)\s*$/, ''), status: 'DRAFT', isTemplate: false, sourceExamId: tpl.id, pdfFileId: null, solutionPdfFileId: null, printCount: 0, lastPrintedAt: null, createdAt: undefined, updatedAt: undefined, deletedAt: null })
      .returning()
    if (items.length) await tx.insert(examItems).values(items.map((it) => ({ examId: r!.id, position: it.position, kind: it.kind, bankQuestionId: it.bankQuestionId, title: it.title, points: it.points, snapshot: it.snapshot })))
    return r!
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: tpl.workspaceId, action: 'exam.from_template', entityType: 'exam', entityId: row.id, newValue: { template: templateId, title: row.title } })
  return row
}

/** تسجيل طباعة/حفظ PDF (من زرّ الطباعة): عدّاد وتاريخ وسجلّ */
export async function recordPrint(db: Db, actor: Actor, id: string, meta: { mode: 'subject' | 'correction'; variant: string }): Promise<void> {
  const ex = await getOwnExam(db, actor, id)
  await db.update(exams).set({ printCount: sql`${exams.printCount} + 1`, lastPrintedAt: new Date() }).where(eq(exams.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.print', entityType: 'exam', entityId: id, newValue: { mode: meta.mode, variant: meta.variant } })
}

export interface ExamHistory {
  events: { id: string; action: string; createdAt: Date; actorName: string | null; newValue: Record<string, unknown> | null }[]
  /** الامتحانات المشتقّة من هذا (نسخ أو من القالب) */
  copies: { id: string; title: string; status: string; createdAt: Date }[]
  source: { id: string; title: string } | null
}

/** سجلّ الامتحان: الأحداث (إنشاء، تعديل، طباعة، نسخ…) والنسخ المشتقّة والأصل */
export async function examHistory(db: Db, actor: Actor, id: string): Promise<ExamHistory> {
  const ex = await getOwnExam(db, actor, id)
  const [events, copies, src] = await Promise.all([
    db
      .select({ id: auditLogs.id, action: auditLogs.action, createdAt: auditLogs.createdAt, actorName: profiles.fullName, newValue: auditLogs.newValue })
      .from(auditLogs)
      .leftJoin(profiles, eq(profiles.userId, auditLogs.actorUserId))
      .where(and(eq(auditLogs.entityType, 'exam'), eq(auditLogs.entityId, id)))
      .orderBy(desc(auditLogs.createdAt))
      .limit(100),
    db.select({ id: exams.id, title: exams.title, status: exams.status, createdAt: exams.createdAt }).from(exams).where(and(eq(exams.sourceExamId, id), isNull(exams.deletedAt))).orderBy(desc(exams.createdAt)).limit(50),
    ex.sourceExamId ? db.select({ id: exams.id, title: exams.title }).from(exams).where(and(eq(exams.id, ex.sourceExamId), isNull(exams.deletedAt))).limit(1) : Promise.resolve([])
  ])
  return { events, copies, source: src[0] ?? null }
}

export interface WorkspaceStats {
  exams: { total: number; draft: number; ready: number; templates: number; archived: number }
  prints: { total: number; month: number }
  bySubject: { name: string; n: number }[]
  byKind: { kind: string; n: number }[]
  /** توزيع صعوبة عناصر الامتحانات الجاهزة (1–4) */
  difficulty: Record<number, number>
  topQuestions: { id: string; title: string | null; body: string; usageCount: number }[]
  recent: { id: string; title: string; status: string; updatedAt: Date }[]
  /** الطباعات في آخر 6 أشهر (YYYY-MM) */
  printsByMonth: { month: string; n: number }[]
}

/** إحصاءات الورشة: الامتحانات والطباعة والمواد والأنواع والصعوبة والأسئلة الأكثر استعمالاً */
export async function workspaceStats(db: Db, actor: Actor): Promise<WorkspaceStats> {
  const workspaceId = ws(actor)
  const live = and(eq(exams.workspaceId, workspaceId), isNull(exams.deletedAt))
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const sixMonths = new Date(monthStart)
  sixMonths.setMonth(sixMonths.getMonth() - 5)
  const [counts, prints, bySubject, byKind, diff, topQuestions, recent, printsByMonth] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*) filter (where ${exams.status} <> 'ARCHIVED' and not ${exams.isTemplate})::int`,
        draft: sql<number>`count(*) filter (where ${exams.status} = 'DRAFT' and not ${exams.isTemplate})::int`,
        ready: sql<number>`count(*) filter (where ${exams.status} = 'READY' and not ${exams.isTemplate})::int`,
        templates: sql<number>`count(*) filter (where ${exams.isTemplate} and ${exams.status} <> 'ARCHIVED')::int`,
        archived: sql<number>`count(*) filter (where ${exams.status} = 'ARCHIVED')::int`
      })
      .from(exams)
      .where(live),
    db
      .select({ total: sql<number>`coalesce(sum(${exams.printCount}), 0)::int`, month: sql<number>`count(*) filter (where ${exams.lastPrintedAt} >= ${monthStart})::int` })
      .from(exams)
      .where(live),
    db
      .select({ name: subjects.nameAr, n: sql<number>`count(*)::int` })
      .from(exams)
      .innerJoin(subjects, eq(subjects.id, exams.subjectId))
      .where(and(live, sql`${exams.status} <> 'ARCHIVED'`))
      .groupBy(subjects.nameAr)
      .orderBy(desc(sql`count(*)`))
      .limit(6),
    db
      .select({ kind: exams.kind, n: sql<number>`count(*)::int` })
      .from(exams)
      .where(and(live, sql`${exams.status} <> 'ARCHIVED'`))
      .groupBy(exams.kind)
      .orderBy(desc(sql`count(*)`)),
    db
      .select({ d: sql<number>`coalesce((${examItems.snapshot}->>'difficulty')::int, 2)`, n: sql<number>`count(*)::int` })
      .from(examItems)
      .innerJoin(exams, eq(exams.id, examItems.examId))
      .where(and(live, sql`${exams.status} <> 'ARCHIVED'`, inArray(examItems.kind, ['EXERCISE', 'QUESTION'])))
      .groupBy(sql`coalesce((${examItems.snapshot}->>'difficulty')::int, 2)`),
    db
      .select({ id: bankQuestions.id, title: bankQuestions.title, body: bankQuestions.body, usageCount: bankQuestions.usageCount })
      .from(bankQuestions)
      .where(and(eq(bankQuestions.workspaceId, workspaceId), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), sql`${bankQuestions.usageCount} > 0`))
      .orderBy(desc(bankQuestions.usageCount), desc(bankQuestions.lastUsedAt))
      .limit(5),
    db.select({ id: exams.id, title: exams.title, status: exams.status, updatedAt: exams.updatedAt }).from(exams).where(and(live, sql`${exams.status} <> 'ARCHIVED'`, eq(exams.isTemplate, false))).orderBy(desc(exams.updatedAt)).limit(5),
    db
      .select({ month: sql<string>`to_char(${auditLogs.createdAt}, 'YYYY-MM')`, n: sql<number>`count(*)::int` })
      .from(auditLogs)
      .where(and(eq(auditLogs.workspaceId, workspaceId), eq(auditLogs.action, 'exam.print'), sql`${auditLogs.createdAt} >= ${sixMonths}`))
      .groupBy(sql`to_char(${auditLogs.createdAt}, 'YYYY-MM')`)
      .orderBy(sql`to_char(${auditLogs.createdAt}, 'YYYY-MM')`)
  ])
  const c = counts[0]
  return {
    exams: { total: c?.total ?? 0, draft: c?.draft ?? 0, ready: c?.ready ?? 0, templates: c?.templates ?? 0, archived: c?.archived ?? 0 },
    prints: { total: prints[0]?.total ?? 0, month: prints[0]?.month ?? 0 },
    bySubject,
    byKind,
    difficulty: Object.fromEntries(diff.map((x) => [x.d, x.n])) as Record<number, number>,
    topQuestions: topQuestions.map((q) => ({ ...q, body: q.body.slice(0, 120) })),
    recent,
    printsByMonth
  }
}

export interface ExamView extends ExamRow {
  subjectName: string | null
  subjectCode: string | null
  levelName: string | null
  streamName: string | null
  items: ExamItemRow[]
  /** روابط موقّعة للصور المستعملة في الكتل والشعار (معرّف الملف ← رابط) */
  assets: Record<string, string>
  /** العنوان الظاهر لكل عنصر مرقّم (التمرين الأول…) */
  numbering: Record<string, string>
  heading: string
}

export function examHeading(ex: Pick<ExamRow, 'kind' | 'schoolTerm' | 'header'>): string {
  if (ex.header.heading?.trim()) return ex.header.heading.trim()
  const kind = EXAM_KIND_AR[ex.kind as ExamKind] ?? ex.kind
  return ex.schoolTerm ? `${kind} ${TERM_AR[ex.schoolTerm]}` : kind
}

export async function getExam(db: Db, actor: Actor, id: string): Promise<ExamView> {
  const ex = await getOwnExam(db, actor, id)
  return viewOfExam(db, ex)
}

/** عرض امتحان بلا فحص ملكية — للمسارات التي تحقّقت من الحقّ بنفسها (مشترٍ من السوق) */
export async function getExamUnchecked(db: Db, id: string): Promise<ExamView> {
  assertUuid(id, 'EXAM_NOT_FOUND')
  const [ex] = await db.select().from(exams).where(and(eq(exams.id, id), isNull(exams.deletedAt))).limit(1)
  if (!ex) throw new AppError('EXAM_NOT_FOUND')
  return viewOfExam(db, ex)
}

/**
 * نسخة من امتحان إلى مساحة أخرى (تسليم من السوق): مسودة باسم المشتري، العناصر بنسخها المجمّدة
 * بلا ربط ببنك البائع، والأصل مذكور في `source_exam_id`.
 */
export async function copyExamToWorkspace(db: Db, examId: string, target: { workspaceId: string; userId: string; fullName: string }, sourceLabel: string): Promise<ExamRow> {
  assertUuid(examId, 'EXAM_NOT_FOUND')
  const [ex] = await db.select().from(exams).where(and(eq(exams.id, examId), isNull(exams.deletedAt))).limit(1)
  if (!ex) throw new AppError('EXAM_NOT_FOUND')
  const items = await db.select().from(examItems).where(eq(examItems.examId, examId)).orderBy(asc(examItems.position))
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(exams)
      .values({ ...ex, id: undefined, workspaceId: target.workspaceId, createdByUserId: target.userId, status: 'DRAFT', isTemplate: false, groupId: null, printCount: 0, lastPrintedAt: null, sourceExamId: ex.id, pdfFileId: null, solutionPdfFileId: null, header: { ...ex.header, teacherName: target.fullName, school: undefined, wilaya: undefined }, createdAt: undefined, updatedAt: undefined, deletedAt: null })
      .returning()
    if (items.length) await tx.insert(examItems).values(items.map((it) => ({ examId: row!.id, position: it.position, kind: it.kind, bankQuestionId: null, title: it.title, points: it.points, snapshot: { ...it.snapshot, sourceLabel: it.snapshot.sourceLabel ?? sourceLabel } })))
    return row!
  })
}

async function viewOfExam(db: Db, ex: ExamRow): Promise<ExamView> {
  const id = ex.id
  const [names] = await db
    .select({ subjectName: subjects.nameAr, subjectCode: subjects.code, levelName: levels.nameAr, streamName: streams.nameAr })
    .from(exams)
    .leftJoin(subjects, eq(subjects.id, exams.subjectId))
    .leftJoin(levels, eq(levels.id, exams.levelId))
    .leftJoin(streams, eq(streams.id, exams.streamId))
    .where(eq(exams.id, id))
    .limit(1)
  const items = await db.select().from(examItems).where(eq(examItems.examId, id)).orderBy(asc(examItems.position), asc(examItems.createdAt))
  const numbering: Record<string, string> = {}
  let ex_n = 0
  let q_n = 0
  const style = ex.layout?.numbering ?? 'words'
  for (const it of items) {
    if (it.kind === 'EXERCISE') numbering[it.id] = it.title?.trim() || autoTitle('EXERCISE', ++ex_n, style)
    else if (it.kind === 'QUESTION') numbering[it.id] = it.title?.trim() || autoTitle('QUESTION', ++q_n, style)
  }
  const imageIds = imageIdsOf(items.flatMap((it) => [it.snapshot.block, ...(it.snapshot.figures ?? [])]))
  if (ex.layout?.logoFileId) imageIds.push(ex.layout.logoFileId)
  const assets: Record<string, string> = {}
  for (const id of imageIds) assets[id] = signFileUrl(id, 8 * 3600)
  return { ...ex, subjectName: names?.subjectName ?? null, subjectCode: names?.subjectCode ?? null, levelName: names?.levelName ?? null, streamName: names?.streamName ?? null, items, numbering, heading: examHeading(ex), assets }
}

/* ------------------------------- المراجعات ------------------------------- */

/** لقطة كاملة للورقة (إعدادات + عناصر بترتيبها) */
export async function snapshotExam(db: Db, ex: ExamRow): Promise<ExamRevisionSnapshot> {
  const items = await db.select().from(examItems).where(eq(examItems.examId, ex.id)).orderBy(asc(examItems.position), asc(examItems.createdAt))
  return {
    exam: { title: ex.title, kind: ex.kind, subjectId: ex.subjectId, levelId: ex.levelId, streamId: ex.streamId, schoolTerm: ex.schoolTerm, academicYear: ex.academicYear, durationMinutes: ex.durationMinutes, targetPoints: Number(ex.targetPoints), instructions: ex.instructions, header: ex.header, layout: ex.layout ?? {} },
    items: items.map((it) => ({ kind: it.kind, bankQuestionId: it.bankQuestionId, title: it.title, points: it.points == null ? null : Number(it.points), snapshot: it.snapshot }))
  }
}

export async function insertRevision(db: Db, ex: ExamRow, userId: string | null, reason: 'AUTO' | 'MANUAL' | 'RESTORE', label: string | null = null) {
  const snap = await snapshotExam(db, ex)
  const [n] = await db.select({ m: sql<number>`coalesce(max(${examRevisions.number}), 0)::int` }).from(examRevisions).where(eq(examRevisions.examId, ex.id))
  const [row] = await db
    .insert(examRevisions)
    .values({ examId: ex.id, number: (n?.m ?? 0) + 1, reason, label, snapshot: snap, itemsCount: snap.items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION').length, totalPoints: String(ex.totalPoints), createdByUserId: userId })
    .returning()
  if (reason === 'AUTO') {
    const old = await db.select({ id: examRevisions.id }).from(examRevisions).where(and(eq(examRevisions.examId, ex.id), eq(examRevisions.reason, 'AUTO'))).orderBy(desc(examRevisions.number)).offset(MAX_AUTO_REVISIONS)
    if (old.length) await db.delete(examRevisions).where(inArray(examRevisions.id, old.map((o) => o.id)))
  }
  return row!
}

/** قبل أول تغيير في نافذة AUTO_REVISION_MINUTES: لقطة تلقائية (حالة «قبل») */
async function autoRevision(db: Db, ex: ExamRow, userId: string): Promise<void> {
  const [last] = await db.select({ createdAt: examRevisions.createdAt }).from(examRevisions).where(eq(examRevisions.examId, ex.id)).orderBy(desc(examRevisions.number)).limit(1)
  if (last && Date.now() - last.createdAt.getTime() < AUTO_REVISION_MINUTES * 60 * 1000) return
  await insertRevision(db, ex, userId, 'AUTO')
}

/* ------------------------------- العناصر ------------------------------- */

async function nextPosition(db: Db, examId: string): Promise<number> {
  const [r] = await db.select({ m: sql<number>`coalesce(max(${examItems.position}), -1)::int` }).from(examItems).where(eq(examItems.examId, examId))
  return (r?.m ?? -1) + 1
}

async function countItems(db: Db, examId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(examItems).where(eq(examItems.examId, examId))
  return r?.n ?? 0
}

/** يُدرج العنصر في موضع (أو في الآخر) ويزيح ما بعده */
async function insertAt(db: Db, examId: string, position: number | null | undefined, values: Omit<typeof examItems.$inferInsert, 'examId' | 'position'>): Promise<ExamItemRow> {
  if (position == null) {
    const pos = await nextPosition(db, examId)
    const [row] = await db.insert(examItems).values({ ...values, examId, position: pos }).returning()
    return row!
  }
  const pos = Math.max(0, Math.floor(position))
  await db.update(examItems).set({ position: sql`${examItems.position} + 1` }).where(and(eq(examItems.examId, examId), sql`${examItems.position} >= ${pos}`))
  const [row] = await db.insert(examItems).values({ ...values, examId, position: pos }).returning()
  return row!
}

export function snapshotOf(q: BankQuestionRow, children: BankQuestionRow[] = []): ExamItemSnapshot {
  const one = (r: BankQuestionRow): ExamItemSnapshot => ({
    kind: r.kind,
    type: r.type,
    title: r.title,
    body: r.body,
    options: r.options,
    answerKey: r.answerKey ?? null,
    solution: r.solution,
    bareme: r.bareme,
    points: Number(r.points),
    difficulty: r.difficulty,
    estimatedMinutes: r.estimatedMinutes,
    sourceLabel: r.sourceLabel,
    sourceYear: r.sourceYear,
    keywords: r.keywords
  })
  return { ...one(q), children: children.map(one) }
}

/** سؤال من البنك إلى الورقة: نسخة مجمّدة (مع فرعياته)، ويُحتسب استعماله في البنك */
export async function addItemFromBank(db: Db, actor: Actor, examId: string, questionId: string, position?: number | null): Promise<ExamItemRow> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  assertUuid(questionId, 'BANK_QUESTION_NOT_FOUND')
  if ((await countItems(db, examId)) >= MAX_ITEMS) throw new AppError('VALIDATION', { field: 'items' })
  const [q] = await db
    .select()
    .from(bankQuestions)
    .where(and(eq(bankQuestions.id, questionId), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), sql`(${bankQuestions.workspaceId} = ${ex.workspaceId} or (${bankQuestions.visibility} = 'PUBLIC' and ${bankQuestions.status} = 'PUBLISHED'))`))
    .limit(1)
  if (!q) throw new AppError('BANK_QUESTION_NOT_FOUND')
  const children = await db.select().from(bankQuestions).where(and(eq(bankQuestions.parentId, q.id), isNull(bankQuestions.deletedAt), sql`${bankQuestions.status} <> 'ARCHIVED'`)).orderBy(asc(bankQuestions.sortOrder), asc(bankQuestions.createdAt))
  const kind: ExamItemKind = q.kind === 'QUESTION' && children.length === 0 ? 'QUESTION' : 'EXERCISE'
  const row = await insertAt(db, examId, position, { kind, bankQuestionId: q.id, title: null, points: null, snapshot: snapshotOf(q, children) })
  await db.update(bankQuestions).set({ usageCount: sql`${bankQuestions.usageCount} + 1`, lastUsedAt: new Date() }).where(inArray(bankQuestions.id, [q.id, ...children.map((c) => c.id)]))
  await recompute(db, examId)
  return row
}

/** تمرين حرّ يكتبه الأستاذ في الورقة (بلا بنك)، أو نصّ تعليمات، أو فاصل صفحة */
export async function addFreeItem(db: Db, actor: Actor, examId: string, input: { kind: ExamItemKind; body?: string; title?: string | null; points?: number | null; position?: number | null }): Promise<ExamItemRow> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  if (input.kind === 'BLOCK') throw new AppError('VALIDATION', { field: 'kind' })
  if ((await countItems(db, examId)) >= MAX_ITEMS) throw new AppError('VALIDATION', { field: 'items' })
  const body = (input.body ?? '').trim()
  if (input.kind !== 'PAGE_BREAK' && !body) throw new AppError('VALIDATION', { field: 'body' })
  const row = await insertAt(db, examId, input.position, {
    kind: input.kind,
    bankQuestionId: null,
    title: input.title?.trim() || null,
    points: input.kind === 'EXERCISE' || input.kind === 'QUESTION' ? String(input.points && input.points > 0 ? input.points : 1) : null,
    snapshot: input.kind === 'PAGE_BREAK' ? { body: '' } : { kind: input.kind === 'TEXT' ? 'DOCUMENT' : 'EXERCISE', type: 'OPEN', body, points: input.points ?? 1, difficulty: 2, options: [], children: [] }
  })
  await recompute(db, examId)
  return row
}

async function ownItem(db: Db, actor: Actor, itemId: string): Promise<{ item: ExamItemRow; exam: ExamRow }> {
  assertUuid(itemId, 'EXAM_ITEM_NOT_FOUND')
  const [item] = await db.select().from(examItems).where(eq(examItems.id, itemId)).limit(1)
  if (!item) throw new AppError('EXAM_ITEM_NOT_FOUND')
  const exam = await getOwnExam(db, actor, item.examId)
  await autoRevision(db, exam, actor.userId)
  return { item, exam }
}

/** الاستوديو: كتلة منظّمة (عنوان/فقرة/معادلة/منحنى/جدول…) في موضع من الورقة */
export async function addBlock(db: Db, actor: Actor, examId: string, block: unknown, position?: number | null): Promise<ExamItemRow> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  const b = parseBlock(block)
  if (!b) throw new AppError('VALIDATION', { field: 'block' })
  if ((await countItems(db, examId)) >= MAX_ITEMS) throw new AppError('VALIDATION', { field: 'items' })
  const row = await insertAt(db, examId, position, { kind: 'BLOCK', bankQuestionId: null, title: null, points: null, snapshot: { body: '', block: b } })
  await db.update(exams).set({ updatedAt: new Date() }).where(eq(exams.id, examId))
  return row
}

export interface ItemState {
  /** إن وُجد العنصر بهذا المعرّف يُستبدل، وإلا يُدرج بالمعرّف نفسه (للتراجع/الإعادة) */
  itemId?: string | null
  kind: ExamItemKind
  bankQuestionId?: string | null
  title?: string | null
  points?: number | null
  snapshot: ExamItemSnapshot
  position?: number | null
}

/** الاستوديو: استرجاع حالة عناصر (تراجع/إعادة): استبدال الموجود أو إعادة إدراج المحذوف في موضعه */
export async function restoreItems(db: Db, actor: Actor, examId: string, states: ItemState[]): Promise<ExamItemRow[]> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  const out: ExamItemRow[] = []
  for (const st of states) {
    const snapshot = sanitizeSnapshot(st.kind, st.snapshot)
    const values = { kind: st.kind, bankQuestionId: st.bankQuestionId ?? null, title: st.title?.trim() || null, points: st.points == null ? null : String(round2(st.points)), snapshot }
    const existing = st.itemId ? (await db.select({ id: examItems.id }).from(examItems).where(and(eq(examItems.id, st.itemId), eq(examItems.examId, examId))).limit(1))[0] : null
    if (existing) {
      const [row] = await db.update(examItems).set({ ...values, updatedAt: new Date() }).where(eq(examItems.id, existing.id)).returning()
      out.push(row!)
    } else {
      if ((await countItems(db, examId)) >= MAX_ITEMS) throw new AppError('VALIDATION', { field: 'items' })
      const row = await insertAt(db, examId, st.position, { ...values, ...(st.itemId ? { id: st.itemId } : {}) })
      out.push(row)
    }
  }
  await recompute(db, examId)
  return out
}

/** يتحقّق من النسخة المجمّدة القادمة من العميل (الكتل والأشكال بالمخطط، النصوص بحدود) */
function sanitizeSnapshot(kind: ExamItemKind, s: ExamItemSnapshot): ExamItemSnapshot {
  const out: ExamItemSnapshot = { ...s, body: String(s.body ?? '').slice(0, 8000) }
  if (kind === 'BLOCK') {
    const b = parseBlock(s.block)
    if (!b) throw new AppError('VALIDATION', { field: 'block' })
    return { body: '', block: b }
  }
  delete out.block
  if (s.figures !== undefined) {
    const f = figuresSchema.safeParse(s.figures)
    if (!f.success) throw new AppError('VALIDATION', { field: 'figures' })
    out.figures = f.data
  }
  if (s.children) out.children = s.children.slice(0, 40).map((c) => ({ ...c, body: String(c.body ?? '').slice(0, 8000) }))
  return out
}

export interface ItemPatch {
  title?: string | null
  points?: number | null
  body?: string
  solution?: string | null
  /** نقاط الأسئلة الفرعية بترتيبها */
  childPoints?: number[]
  options?: { label: string; isCorrect: boolean }[]
  /** الاستوديو */
  block?: StudioBlock
  figures?: StudioBlock[] | null
  /** استبدال الأسئلة الفرعية كاملة (إضافة/حذف/تعديل) */
  children?: { body: string; points?: number | null; solution?: string | null; options?: { label: string; isCorrect: boolean }[]; type?: string; title?: string | null }[]
  bareme?: BaremeItem[] | null
  optionsColumns?: 1 | 2 | 3 | 4 | null
  difficulty?: number | null
  estimatedMinutes?: number | null
  type?: string
}

/** تعديل العنصر داخل الورقة فقط (النسخة المجمّدة)؛ البنك لا يتغيّر */
export async function updateItem(db: Db, actor: Actor, itemId: string, patch: ItemPatch): Promise<ExamItemRow> {
  const { item } = await ownItem(db, actor, itemId)
  const snapshot: ExamItemSnapshot = { ...item.snapshot }
  if (patch.body !== undefined) {
    if (item.kind !== 'PAGE_BREAK' && !patch.body.trim()) throw new AppError('VALIDATION', { field: 'body' })
    snapshot.body = patch.body.trim()
  }
  if (patch.solution !== undefined) snapshot.solution = patch.solution?.trim() || null
  if (patch.options !== undefined) snapshot.options = patch.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), isCorrect: Boolean(o.isCorrect) }))
  if (patch.block !== undefined) {
    if (item.kind !== 'BLOCK') throw new AppError('VALIDATION', { field: 'block' })
    const b = parseBlock(patch.block)
    if (!b) throw new AppError('VALIDATION', { field: 'block' })
    snapshot.block = b
  }
  if (patch.figures !== undefined) {
    if (patch.figures == null || patch.figures.length === 0) delete snapshot.figures
    else {
      const f = figuresSchema.safeParse(patch.figures)
      if (!f.success) throw new AppError('VALIDATION', { field: 'figures' })
      snapshot.figures = f.data
    }
  }
  if (patch.children !== undefined) {
    const prev = snapshot.children ?? []
    snapshot.children = patch.children
      .filter((c) => c.body.trim())
      .slice(0, 40)
      .map((c, i) => ({
        ...(prev[i] ?? {}),
        kind: 'QUESTION',
        type: c.type ?? prev[i]?.type ?? 'OPEN',
        title: c.title?.trim() || null,
        body: c.body.trim().slice(0, 8000),
        points: c.points != null && c.points > 0 ? round2(c.points) : (prev[i]?.points ?? 1),
        solution: c.solution === undefined ? (prev[i]?.solution ?? null) : c.solution?.trim() || null,
        options: c.options === undefined ? (prev[i]?.options ?? []) : c.options.filter((o) => o.label.trim()).map((o) => ({ label: o.label.trim(), isCorrect: Boolean(o.isCorrect) }))
      }))
  }
  if (patch.bareme !== undefined) snapshot.bareme = patch.bareme ? patch.bareme.filter((b) => b.label.trim()).slice(0, 40).map((b) => ({ label: b.label.trim(), points: round2(Number(b.points) || 0) })) : []
  if (patch.optionsColumns !== undefined) {
    if (patch.optionsColumns == null) delete snapshot.optionsColumns
    else snapshot.optionsColumns = patch.optionsColumns
  }
  if (patch.difficulty !== undefined && patch.difficulty != null && patch.difficulty >= 1 && patch.difficulty <= 4) snapshot.difficulty = Math.round(patch.difficulty)
  if (patch.estimatedMinutes !== undefined) snapshot.estimatedMinutes = patch.estimatedMinutes != null && patch.estimatedMinutes > 0 ? Math.round(patch.estimatedMinutes) : null
  if (patch.type !== undefined && item.kind !== 'BLOCK' && item.kind !== 'TEXT') snapshot.type = patch.type
  if (patch.childPoints !== undefined && snapshot.children?.length) {
    snapshot.children = snapshot.children.map((c, i) => ({ ...c, points: patch.childPoints![i] != null && patch.childPoints![i]! > 0 ? round2(patch.childPoints![i]!) : c.points }))
  }
  const update: Partial<typeof examItems.$inferInsert> = { snapshot, updatedAt: new Date() }
  if (patch.title !== undefined) update.title = patch.title?.trim() || null
  if (patch.points !== undefined) {
    if (patch.points != null && (!(patch.points > 0) || patch.points > 200)) throw new AppError('VALIDATION', { field: 'points' })
    // تعديل نقاط الفرعيات يلغي التجاوز اليدوي للمجموع
    update.points = patch.childPoints !== undefined && patch.points == null ? null : patch.points == null ? null : String(round2(patch.points))
  } else if (patch.childPoints !== undefined || patch.children !== undefined) update.points = null
  const [row] = await db.update(examItems).set(update).where(eq(examItems.id, itemId)).returning()
  await recompute(db, item.examId)
  return row!
}

export async function removeItem(db: Db, actor: Actor, itemId: string): Promise<void> {
  const { item } = await ownItem(db, actor, itemId)
  await db.delete(examItems).where(eq(examItems.id, itemId))
  await db.update(examItems).set({ position: sql`${examItems.position} - 1` }).where(and(eq(examItems.examId, item.examId), sql`${examItems.position} > ${item.position}`))
  await recompute(db, item.examId)
}

export async function duplicateItem(db: Db, actor: Actor, itemId: string): Promise<ExamItemRow> {
  const { item } = await ownItem(db, actor, itemId)
  if ((await countItems(db, item.examId)) >= MAX_ITEMS) throw new AppError('VALIDATION', { field: 'items' })
  const row = await insertAt(db, item.examId, item.position + 1, { kind: item.kind, bankQuestionId: item.bankQuestionId, title: item.title, points: item.points, snapshot: item.snapshot })
  await recompute(db, item.examId)
  return row
}

/** ترتيب جديد كامل بمعرّفات العناصر (السحب والإفلات) */
export async function reorderItems(db: Db, actor: Actor, examId: string, orderedIds: string[]): Promise<void> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  const items = await db.select({ id: examItems.id }).from(examItems).where(eq(examItems.examId, examId))
  const known = new Set(items.map((i) => i.id))
  const order = orderedIds.filter((id) => known.has(id))
  if (order.length !== items.length || new Set(order).size !== order.length) throw new AppError('VALIDATION', { field: 'order' })
  await db.transaction(async (tx) => {
    for (const [i, id] of order.entries()) await tx.update(examItems).set({ position: i }).where(eq(examItems.id, id))
  })
  await db.update(exams).set({ updatedAt: new Date() }).where(eq(exams.id, examId))
}

/* ------------------------------- النقاط ------------------------------- */

/** توزيع يحقّق المجموع المستهدف: تدرّج نسبي مقرّب إلى 0.5 مع تصحيح الباقي على أكبر عنصر */
export function proposeDistribution(points: number[], target: number): number[] {
  const total = points.reduce((a, b) => a + b, 0)
  if (points.length === 0) return []
  const base = total > 0 ? points.map((p) => (p / total) * target) : points.map(() => target / points.length)
  const rounded = base.map((p) => Math.max(0.5, Math.round(p * 2) / 2))
  let diff = round2(target - rounded.reduce((a, b) => a + b, 0))
  // تصحيح الباقي بخطوات نصف نقطة على أكبر العناصر (ثم أصغرها عند الطرح)
  const order = rounded.map((p, i) => i).sort((a, b) => rounded[b]! - rounded[a]!)
  let guard = 0
  while (Math.abs(diff) >= 0.5 && guard++ < 200) {
    const idx = diff > 0 ? order[guard % order.length]! : [...order].reverse()[guard % order.length]!
    if (diff < 0 && rounded[idx]! <= 0.5) continue
    rounded[idx] = round2(rounded[idx]! + (diff > 0 ? 0.5 : -0.5))
    diff = round2(diff + (diff > 0 ? -0.5 : 0.5))
  }
  return rounded
}

/** يطبّق التوزيع المقترح على عناصر الورقة (التمارين والأسئلة الجذرية؛ الفرعيات تتدرّج داخل تمرينها) */
export async function rebalancePoints(db: Db, actor: Actor, examId: string): Promise<{ total: number; distribution: Record<string, number> }> {
  const ex = await getOwnExam(db, actor, examId)
  await autoRevision(db, ex, actor.userId)
  const items = (await db.select().from(examItems).where(eq(examItems.examId, examId)).orderBy(asc(examItems.position))).filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION')
  if (items.length === 0) throw new AppError('EXAM_EMPTY')
  const proposed = proposeDistribution(
    items.map((i) => itemPoints(i)),
    Number(ex.targetPoints)
  )
  const distribution: Record<string, number> = {}
  for (const [i, it] of items.entries()) {
    const p = proposed[i]!
    distribution[it.id] = p
    const snapshot = { ...it.snapshot }
    if (snapshot.children?.length) {
      const sub = proposeDistribution(
        snapshot.children.map((c) => c.points ?? 1),
        p
      )
      snapshot.children = snapshot.children.map((c, j) => ({ ...c, points: sub[j] }))
    }
    await db.update(examItems).set({ points: String(p), snapshot, updatedAt: new Date() }).where(eq(examItems.id, it.id))
  }
  const r = await recompute(db, examId)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.rebalance', entityType: 'exam', entityId: examId, newValue: { total: r.total } })
  return { total: r.total, distribution }
}
