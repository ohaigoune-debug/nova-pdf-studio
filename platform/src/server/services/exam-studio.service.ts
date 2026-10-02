/**
 * Teacher Exam Studio — ما يزيد على محرّر الامتحان: المراجعات (لقطات واسترجاع)، مكتبة الأستاذ
 * (كتل وترويسات قابلة لإعادة الاستعمال)، القوالب الرسمية، وملخّص سلّم التنقيط.
 * الورقة نفسها تُدار في `exams.service.ts`؛ هنا لا يُكرَّر شيء منها.
 */
import { and, desc, eq, getTableColumns, isNull, sql } from 'drizzle-orm'
import { blockSchema, layoutSchema, type ExamLayout, type StudioBlock } from '@/lib/exam-blocks'
import { STUDIO_TEMPLATES, type StudioTemplate } from '@/lib/studio-templates'
import type { Db } from '@/server/db/connect'
import { academicYears, examItems, examRevisions, exams, levels, streams, subjects, teacherLibraryItems, type ExamHeader, type ExamItemRow, type ExamRevisionRow, type ExamRow, type TeacherLibraryItemRow } from '@/server/db/schema'
import type { ExamRevisionReason, LibraryItemKind } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { itemPoints } from '@/lib/exam-points'
import { addBlock, getOwnExam, insertRevision } from './exams.service'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { CopilotOp, ExamCopilotOutput } from '@/server/ai/types'
import { withAiTask } from '@/server/ai/usage'
import { itemPoints as pointsOf } from '@/lib/exam-points'

const ws = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

/* ------------------------------- المراجعات ------------------------------- */

export type RevisionListItem = Omit<ExamRevisionRow, 'snapshot'>

export async function listRevisions(db: Db, actor: Actor, examId: string): Promise<RevisionListItem[]> {
  await getOwnExam(db, actor, examId)
  return db
    .select({ id: examRevisions.id, examId: examRevisions.examId, number: examRevisions.number, reason: examRevisions.reason, label: examRevisions.label, itemsCount: examRevisions.itemsCount, totalPoints: examRevisions.totalPoints, createdByUserId: examRevisions.createdByUserId, createdAt: examRevisions.createdAt })
    .from(examRevisions)
    .where(eq(examRevisions.examId, examId))
    .orderBy(desc(examRevisions.number))
    .limit(100)
}

/** نسخة يدوية بعنوان («قبل إرسالها للمدير») */
export async function createRevision(db: Db, actor: Actor, examId: string, label: string | null): Promise<ExamRevisionRow> {
  const ex = await getOwnExam(db, actor, examId)
  const row = await insertRevision(db, ex, actor.userId, 'MANUAL', label?.trim() || null)
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.revision', entityType: 'exam', entityId: examId, newValue: { number: row.number, label: row.label } })
  return row
}

/** استرجاع لقطة: الحالة الحالية تُحفظ أولاً (RESTORE) ثم تُستبدل الإعدادات والعناصر كلها */
export async function restoreRevision(db: Db, actor: Actor, examId: string, revisionId: string): Promise<{ restoredNumber: number }> {
  const ex = await getOwnExam(db, actor, examId)
  assertUuid(revisionId, 'EXAM_NOT_FOUND')
  const [rev] = await db.select().from(examRevisions).where(and(eq(examRevisions.id, revisionId), eq(examRevisions.examId, examId))).limit(1)
  if (!rev) throw new AppError('EXAM_NOT_FOUND')
  await insertRevision(db, ex, actor.userId, 'RESTORE', `قبل استرجاع المراجعة ${rev.number}`)
  const s = rev.snapshot
  await db.transaction(async (tx) => {
    await tx
      .update(exams)
      .set({ title: s.exam.title, kind: s.exam.kind, subjectId: s.exam.subjectId, levelId: s.exam.levelId, streamId: s.exam.streamId, schoolTerm: s.exam.schoolTerm, academicYear: s.exam.academicYear, durationMinutes: s.exam.durationMinutes, targetPoints: String(s.exam.targetPoints), instructions: s.exam.instructions, header: s.exam.header, layout: s.exam.layout ?? {}, updatedAt: new Date() })
      .where(eq(exams.id, examId))
    await tx.delete(examItems).where(eq(examItems.examId, examId))
    if (s.items.length) await tx.insert(examItems).values(s.items.map((it, i) => ({ examId, position: i, kind: it.kind, bankQuestionId: it.bankQuestionId, title: it.title, points: it.points == null ? null : String(it.points), snapshot: it.snapshot })))
  })
  // إعادة حساب المجموع والصعوبة بعد الاستبدال
  const items = await db.select().from(examItems).where(eq(examItems.examId, examId))
  const total = Math.round(items.reduce((a, i) => a + itemPoints(i), 0) * 100) / 100
  await db.update(exams).set({ totalPoints: String(total) }).where(eq(exams.id, examId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ex.workspaceId, action: 'exam.restore', entityType: 'exam', entityId: examId, newValue: { number: rev.number } })
  return { restoredNumber: rev.number }
}

/* ----------------------------- مكتبة الأستاذ ----------------------------- */

export interface LibraryItemInput {
  kind: LibraryItemKind
  title: string
  subjectId?: string | null
  levelId?: string | null
  tags?: string[]
  block?: StudioBlock
  header?: ExamHeader
  layout?: ExamLayout
}

export async function saveLibraryItem(db: Db, actor: Actor, input: LibraryItemInput): Promise<TeacherLibraryItemRow> {
  const workspaceId = ws(actor)
  const title = input.title.trim().slice(0, 200)
  if (!title) throw new AppError('VALIDATION', { field: 'title' })
  const payload: TeacherLibraryItemRow['payload'] = {}
  if (input.kind === 'BLOCK') {
    const b = blockSchema.safeParse(input.block)
    if (!b.success) throw new AppError('VALIDATION', { field: 'block' })
    payload.block = b.data
  } else {
    const l = layoutSchema.safeParse(input.layout ?? {})
    if (!l.success) throw new AppError('VALIDATION', { field: 'layout' })
    payload.header = input.header ?? {}
    payload.layout = l.data
  }
  const [n] = await db.select({ n: sql<number>`count(*)::int` }).from(teacherLibraryItems).where(and(eq(teacherLibraryItems.workspaceId, workspaceId), isNull(teacherLibraryItems.deletedAt)))
  if ((n?.n ?? 0) >= 500) throw new AppError('VALIDATION', { field: 'library' })
  const [row] = await db
    .insert(teacherLibraryItems)
    .values({ workspaceId, createdByUserId: actor.userId, kind: input.kind, title, subjectId: input.subjectId ?? null, levelId: input.levelId ?? null, tags: (input.tags ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 10), payload })
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'library.save', entityType: 'library_item', entityId: row!.id, newValue: { kind: input.kind, title } })
  return row!
}

export interface LibraryListItem extends TeacherLibraryItemRow {
  subjectName: string | null
  levelName: string | null
}

export async function listLibraryItems(db: Db, actor: Actor, f: { kind?: LibraryItemKind | null; subjectId?: string | null; favorites?: boolean; q?: string | null } = {}, limit = 100): Promise<LibraryListItem[]> {
  const workspaceId = ws(actor)
  const q = f.q?.trim()
  return db
    .select({ ...getTableColumns(teacherLibraryItems), subjectName: subjects.nameAr, levelName: levels.nameAr })
    .from(teacherLibraryItems)
    .leftJoin(subjects, eq(subjects.id, teacherLibraryItems.subjectId))
    .leftJoin(levels, eq(levels.id, teacherLibraryItems.levelId))
    .where(
      and(
        eq(teacherLibraryItems.workspaceId, workspaceId),
        isNull(teacherLibraryItems.deletedAt),
        f.kind ? eq(teacherLibraryItems.kind, f.kind) : undefined,
        f.subjectId ? sql`(${teacherLibraryItems.subjectId} = ${f.subjectId} or ${teacherLibraryItems.subjectId} is null)` : undefined,
        f.favorites ? eq(teacherLibraryItems.isFavorite, true) : undefined,
        q ? sql`${teacherLibraryItems.title} ilike ${'%' + q.replace(/[%_]/g, '') + '%'}` : undefined
      )
    )
    .orderBy(desc(teacherLibraryItems.isFavorite), desc(teacherLibraryItems.updatedAt))
    .limit(limit)
}

async function ownLibraryItem(db: Db, actor: Actor, id: string): Promise<TeacherLibraryItemRow> {
  const workspaceId = ws(actor)
  assertUuid(id, 'NOT_FOUND')
  const [row] = await db.select().from(teacherLibraryItems).where(and(eq(teacherLibraryItems.id, id), eq(teacherLibraryItems.workspaceId, workspaceId), isNull(teacherLibraryItems.deletedAt))).limit(1)
  if (!row) throw new AppError('NOT_FOUND')
  return row
}

export async function updateLibraryItem(db: Db, actor: Actor, id: string, patch: { title?: string; tags?: string[]; isFavorite?: boolean; block?: StudioBlock }): Promise<TeacherLibraryItemRow> {
  const row = await ownLibraryItem(db, actor, id)
  const update: Partial<typeof teacherLibraryItems.$inferInsert> = { updatedAt: new Date() }
  if (patch.title !== undefined) {
    const t = patch.title.trim().slice(0, 200)
    if (!t) throw new AppError('VALIDATION', { field: 'title' })
    update.title = t
  }
  if (patch.tags !== undefined) update.tags = patch.tags.map((t) => t.trim()).filter(Boolean).slice(0, 10)
  if (patch.isFavorite !== undefined) update.isFavorite = patch.isFavorite
  if (patch.block !== undefined) {
    if (row.kind !== 'BLOCK') throw new AppError('VALIDATION', { field: 'block' })
    const b = blockSchema.safeParse(patch.block)
    if (!b.success) throw new AppError('VALIDATION', { field: 'block' })
    update.payload = { block: b.data }
  }
  const [r] = await db.update(teacherLibraryItems).set(update).where(eq(teacherLibraryItems.id, id)).returning()
  return r!
}

export async function deleteLibraryItem(db: Db, actor: Actor, id: string): Promise<void> {
  const row = await ownLibraryItem(db, actor, id)
  await db.update(teacherLibraryItems).set({ deletedAt: new Date() }).where(eq(teacherLibraryItems.id, row.id))
}

/** إدراج كتلة محفوظة في الورقة (نسخة؛ تعديلها لاحقاً لا يمسّ المكتبة) */
export async function insertLibraryBlock(db: Db, actor: Actor, examId: string, libraryItemId: string, position?: number | null): Promise<ExamItemRow> {
  const row = await ownLibraryItem(db, actor, libraryItemId)
  if (row.kind !== 'BLOCK' || !row.payload.block) throw new AppError('VALIDATION', { field: 'kind' })
  const item = await addBlock(db, actor, examId, row.payload.block, position)
  await db.update(teacherLibraryItems).set({ usageCount: sql`${teacherLibraryItems.usageCount} + 1` }).where(eq(teacherLibraryItems.id, row.id))
  return item
}

/** تطبيق ترويسة محفوظة على امتحان */
export async function applyLibraryHeader(db: Db, actor: Actor, examId: string, libraryItemId: string): Promise<void> {
  const row = await ownLibraryItem(db, actor, libraryItemId)
  if (row.kind !== 'HEADER') throw new AppError('VALIDATION', { field: 'kind' })
  const ex = await getOwnExam(db, actor, examId)
  await db.update(exams).set({ header: { ...ex.header, ...(row.payload.header ?? {}) }, layout: { ...ex.layout, ...(row.payload.layout ?? {}) }, updatedAt: new Date() }).where(eq(exams.id, examId))
  await db.update(teacherLibraryItems).set({ usageCount: sql`${teacherLibraryItems.usageCount} + 1` }).where(eq(teacherLibraryItems.id, row.id))
}

/* ------------------------------ القوالب الرسمية ------------------------------ */

export interface TemplateCard {
  id: string
  title: string
  description: string
  subjectCode: string
  streamCodes: string[] | null
  levelCode: string
  kind: string
  durationMinutes: number
  blocks: number
  exercises: number
  /** هل تناسب مادة الأستاذ؟ */
  matches: boolean
}

/** قوالب Madrasadz المعرّفة في الكود، مع إبراز ما يناسب مادة الأستاذ */
export function listStudioTemplates(subjectCode: string | null | undefined): TemplateCard[] {
  return STUDIO_TEMPLATES.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    subjectCode: t.subjectCode,
    streamCodes: t.streamCodes,
    levelCode: t.levelCode,
    kind: t.kind,
    durationMinutes: t.durationMinutes,
    blocks: t.items.length,
    exercises: t.items.filter((i) => i.kind === 'EXERCISE' || i.kind === 'QUESTION').length,
    matches: !subjectCode || t.subjectCode === subjectCode
  }))
}

/** امتحان جديد من قالب Madrasadz: الترويسة والتخطيط والعناصر كلها، باسم الأستاذ وسنته الدراسية */
export async function createFromStudioTemplate(db: Db, actor: Actor, templateId: string): Promise<ExamRow> {
  const workspaceId = ws(actor)
  const t: StudioTemplate | undefined = STUDIO_TEMPLATES.find((x) => x.id === templateId)
  if (!t) throw new AppError('EXAM_NOT_FOUND')
  const [subject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, t.subjectCode)).limit(1)
  const [level] = await db.select({ id: levels.id }).from(levels).where(eq(levels.code, t.levelCode)).limit(1)
  const stream = t.streamCodes?.[0] ? (await db.select({ id: streams.id }).from(streams).where(eq(streams.code, t.streamCodes[0])).limit(1))[0] : null
  const [year] = await db.select({ label: academicYears.label }).from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1)
  const row = await db.transaction(async (tx) => {
    const [ex] = await tx
      .insert(exams)
      .values({
        workspaceId,
        createdByUserId: actor.userId,
        title: t.title,
        kind: t.kind,
        subjectId: subject?.id ?? null,
        levelId: level?.id ?? null,
        streamId: stream?.id ?? null,
        schoolTerm: t.schoolTerm ?? null,
        academicYear: year?.label ?? null,
        durationMinutes: t.durationMinutes,
        targetPoints: String(t.targetPoints ?? 20),
        instructions: t.instructions ?? null,
        header: { teacherName: actor.fullName, ...t.header },
        layout: t.layout ?? {}
      })
      .returning()
    if (t.items.length) await tx.insert(examItems).values(t.items.map((it, i) => ({ examId: ex!.id, position: i, kind: it.kind, bankQuestionId: null, title: it.title ?? null, points: it.points == null ? null : String(it.points), snapshot: it.snapshot })))
    return ex!
  })
  const items = await db.select().from(examItems).where(eq(examItems.examId, row.id))
  const total = Math.round(items.reduce((a, i) => a + itemPoints(i), 0) * 100) / 100
  await db.update(exams).set({ totalPoints: String(total) }).where(eq(exams.id, row.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'exam.from_studio_template', entityType: 'exam', entityId: row.id, newValue: { template: t.id, title: t.title } })
  return row
}

export { markingSummary, type MarkingRow, type MarkingSummary } from '@/lib/marking'

export type { ExamRevisionReason }

/* ------------------------------ AI Copilot ------------------------------ */


export const COPILOT_OPS: readonly CopilotOp[] = ['easier', 'harder', 'similar', 'rewrite', 'solution', 'marking', 'distractors', 'to_mcq', 'subquestions', 'points', 'time'] as const

/**
 * مقترح الذكاء الاصطناعي على عنصر واحد: لا يُكتب شيء في الورقة — الأستاذ يرى المعاينة ثم يقبل (فيُطبَّق بإجراءات التعديل العادية) أو يرفض.
 * المفتاح في الخادم فقط؛ الاستهلاك يُسجَّل في ai_usage_logs؛ لا بيانات شخصية تُرسل.
 */
export async function copilotPropose(db: Db, actor: Actor, examId: string, itemId: string, op: CopilotOp, instructions: string | null): Promise<ExamCopilotOutput> {
  const ex = await getOwnExam(db, actor, examId)
  assertUuid(itemId, 'EXAM_ITEM_NOT_FOUND')
  const [item] = await db.select().from(examItems).where(and(eq(examItems.id, itemId), eq(examItems.examId, examId))).limit(1)
  if (!item || (item.kind !== 'EXERCISE' && item.kind !== 'QUESTION')) throw new AppError('EXAM_ITEM_NOT_FOUND')
  const provider = getAiProvider()
  if (!aiProviderInfo().configured || !provider.examCopilot) throw new AppError('AI_UNAVAILABLE')
  const [names] = await db
    .select({ subject: subjects.nameAr, level: levels.nameAr, stream: streams.nameAr })
    .from(exams)
    .leftJoin(subjects, eq(subjects.id, exams.subjectId))
    .leftJoin(levels, eq(levels.id, exams.levelId))
    .leftJoin(streams, eq(streams.id, exams.streamId))
    .where(eq(exams.id, examId))
    .limit(1)
  const graded = await db.select({ n: sql<number>`count(*)::int` }).from(examItems).where(and(eq(examItems.examId, examId), sql`${examItems.kind} in ('EXERCISE','QUESTION')`))
  const s = item.snapshot
  return withAiTask({ task: 'exam_copilot', userId: actor.userId, workspaceId: actor.workspaceId ?? null, entityType: 'exam', entityId: examId }, () =>
    provider.examCopilot!({
      subject: names?.subject ?? null,
      levelName: names?.level ?? null,
      streamName: names?.stream ?? null,
      op,
      instructions,
      item: { title: item.title ?? s.title ?? null, body: s.body, type: s.type ?? null, points: pointsOf(item), solution: s.solution ?? null, options: (s.options ?? []).map((o) => ({ label: o.label, isCorrect: o.isCorrect })), children: (s.children ?? []).map((c) => ({ body: c.body, points: c.points ?? 0, solution: c.solution ?? null })) },
      exam: { targetPoints: Number(ex.targetPoints), totalPoints: Number(ex.totalPoints), durationMinutes: ex.durationMinutes, gradedItems: graded[0]?.n ?? 0 }
    })
  )
}
