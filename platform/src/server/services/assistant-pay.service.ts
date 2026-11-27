import { createHash } from 'node:crypto'
import { and, asc, count, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, assistantContent, assistantPayouts, assistantReplyMarks, classComments, content, courses, files, profiles, teacherAssistants } from '@/server/db/schema'
import { publishFileToGroup } from '@/server/services/content.service'
import { assertRole, isClassroomAssistant, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { newStorageKey, storage } from '@/server/lib/storage'
import { ttlDelete, ttlMemo } from '@/server/lib/ttl-cache'
import {
  CONTENT_KINDS,
  TERM_LIMITED_KINDS,
  cleanPayConfig,
  computeStatement,
  markOverLimit,
  monthRange,
  termOf,
  replyKindOf,
  type AssistantPayConfig,
  type ContentKind,
  type ReplyKind,
  type Statement
} from '@/lib/assistant-pay'

const KEY = 'assistant.pay'
/** المحتوى: PDF فقط (يُعرض للتلميذ داخل المنصّة بختم مائيّ)، 9 ميغابايت (حدّ أفعال الخادم 10 ميغابايت للطّلب كلّه) */
const CONTENT_MIME = new Set(['application/pdf'])
export const CONTENT_MAX_BYTES = 9 * 1024 * 1024

export async function getAssistantPayConfig(db: Db): Promise<AssistantPayConfig> {
  return ttlMemo(KEY, 15_000, async () => {
    const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
    return cleanPayConfig(row?.value)
  })
}

export async function setAssistantPayConfig(db: Db, actor: Actor, input: unknown): Promise<AssistantPayConfig> {
  assertRole(actor, 'SUPER_ADMIN')
  const before = await getAssistantPayConfig(db)
  const next = cleanPayConfig(input)
  await db
    .insert(appSettings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date() }
    })
  ttlDelete(KEY)
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'settings.assistant_pay',
    entityType: 'settings',
    entityId: null,
    oldValue: { ...before },
    newValue: { ...next }
  })
  return next
}

/** «الأساتذة المساعدون» (نطاق المنتدى) النّشطون، لصفحة الأجور */
export async function listPaidAssistants(db: Db, actor: Actor): Promise<{ userId: string; fullName: string }[]> {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({ userId: teacherAssistants.userId, fullName: profiles.fullName })
    .from(teacherAssistants)
    .innerJoin(profiles, eq(profiles.userId, teacherAssistants.userId))
    .where(and(eq(teacherAssistants.status, 'ACTIVE'), eq(teacherAssistants.scope, 'CLASSROOM')))
    .orderBy(asc(profiles.fullName))
}

export interface StatementReply {
  id: string
  createdAt: Date
  excerpt: string
  chars: number
  kind: ReplyKind
  correction: boolean
  included: boolean
}
export interface StatementContent {
  id: string
  createdAt: Date
  kind: ContentKind
  title: string
  pages: number
  fileId: string
  fileName: string
  note: string | null
  /** اختبار أو مقترح فوق حدّ الفصل: لا يُحسب */
  overLimit: boolean
}
export interface AssistantMonth {
  month: string
  fullName: string
  config: AssistantPayConfig
  statement: Statement
  replies: StatementReply[]
  content: StatementContent[]
  /** الاختبارات والمقترحات في الفصل حتى نهاية هذا الشّهر */
  term: { label: string; used: number; limit: number }
  payout: { amount: number; paidAt: Date } | null
}

function ownerOf(actor: Actor, assistantUserId?: string | null): string {
  if (actor.role === 'ASSISTANT') {
    if (!isClassroomAssistant(actor) || (assistantUserId && assistantUserId !== actor.userId)) throw new AppError('FORBIDDEN')
    return actor.userId
  }
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(assistantUserId ?? null)
  return assistantUserId as string
}

/** كشف شهر لمساعد: المساعد يرى كشفه وحده، والمشرف يرى كلّ الكشوف */
export async function assistantMonth(db: Db, actor: Actor, input: { assistantUserId?: string | null; month: string }): Promise<AssistantMonth> {
  const userId = ownerOf(actor, input.assistantUserId)
  const range = monthRange(input.month)
  if (!range) throw new AppError('VALIDATION', { field: 'month' })
  const term = termOf(input.month)
  const termStart = monthRange(term.firstMonth)!.start
  const [cfg, [prof], comments, rows, [payout], [prior]] = await Promise.all([
    getAssistantPayConfig(db),
    db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, userId)).limit(1),
    db
      .select({
        id: classComments.id,
        body: classComments.body,
        createdAt: classComments.createdAt
      })
      .from(classComments)
      .where(and(eq(classComments.authorUserId, userId), isNull(classComments.deletedAt), gte(classComments.createdAt, range.start), lt(classComments.createdAt, range.end)))
      .orderBy(asc(classComments.createdAt)),
    db
      .select({
        id: assistantContent.id,
        createdAt: assistantContent.createdAt,
        kind: assistantContent.kind,
        title: assistantContent.title,
        pages: assistantContent.pages,
        fileId: assistantContent.fileId,
        fileName: files.originalName,
        note: assistantContent.note
      })
      .from(assistantContent)
      .innerJoin(files, eq(files.id, assistantContent.fileId))
      .where(and(eq(assistantContent.assistantUserId, userId), isNull(assistantContent.removedAt), gte(assistantContent.createdAt, range.start), lt(assistantContent.createdAt, range.end)))
      .orderBy(asc(assistantContent.createdAt)),
    db
      .select({
        amount: assistantPayouts.amount,
        paidAt: assistantPayouts.paidAt
      })
      .from(assistantPayouts)
      .where(and(eq(assistantPayouts.assistantUserId, userId), eq(assistantPayouts.month, input.month)))
      .limit(1),
    // الاختبارات والمقترحات المرفوعة في الفصل نفسه قبل هذا الشّهر
    db
      .select({ n: count() })
      .from(assistantContent)
      .where(
        and(
          eq(assistantContent.assistantUserId, userId),
          isNull(assistantContent.removedAt),
          inArray(assistantContent.kind, [...TERM_LIMITED_KINDS]),
          gte(assistantContent.createdAt, termStart),
          lt(assistantContent.createdAt, range.start)
        )
      )
  ])
  const marks = comments.length
    ? new Set(
        (
          await db
            .select({ id: assistantReplyMarks.commentId })
            .from(assistantReplyMarks)
            .where(
              inArray(
                assistantReplyMarks.commentId,
                comments.map((c) => c.id)
              )
            )
        ).map((m) => m.id)
      )
    : new Set<string>()
  const replies: StatementReply[] = comments.map((c, i) => {
    const chars = [...c.body.trim()].length
    const correction = marks.has(c.id)
    return {
      id: c.id,
      createdAt: c.createdAt,
      excerpt: c.body.trim().slice(0, 140),
      chars,
      correction,
      kind: replyKindOf(chars, correction, cfg),
      included: i < cfg.includedReplies
    }
  })
  const before = Number(prior?.n ?? 0)
  const content = markOverLimit(
    rows.map((r) => ({ ...r, kind: r.kind as ContentKind })),
    before,
    cfg
  )
  const statement = computeStatement(
    {
      replies: replies.map((r) => ({
        chars: r.chars,
        correction: r.correction
      })),
      content: content.map((c) => ({
        kind: c.kind,
        pages: c.pages,
        overLimit: c.overLimit
      }))
    },
    cfg
  )
  const used = before + content.filter((c) => TERM_LIMITED_KINDS.includes(c.kind)).length
  return {
    month: input.month,
    fullName: prof?.fullName ?? '',
    config: cfg,
    statement,
    replies,
    content: content.reverse(),
    term: { label: term.label, used, limit: cfg.termLimit },
    payout: payout ?? null
  }
}

/** المساعد يسم ردّه «تصحيح تعبير» (أو يلغي الوسم)؛ والمشرف كذلك */
export async function setReplyCorrection(db: Db, actor: Actor, commentId: string, on: boolean): Promise<void> {
  assertRole(actor, 'ASSISTANT', 'SUPER_ADMIN')
  assertUuid(commentId)
  const [c] = await db
    .select({ id: classComments.id, authorUserId: classComments.authorUserId })
    .from(classComments)
    .where(and(eq(classComments.id, commentId), isNull(classComments.deletedAt)))
    .limit(1)
  if (!c || (actor.role === 'ASSISTANT' && c.authorUserId !== actor.userId)) throw new AppError('NOT_FOUND')
  if (on)
    await db
      .insert(assistantReplyMarks)
      .values({
        commentId: c.id,
        kind: 'CORRECTION',
        markedByUserId: actor.userId
      })
      .onConflictDoNothing()
  else await db.delete(assistantReplyMarks).where(eq(assistantReplyMarks.commentId, c.id))
}

/** الدورات التي ينشر فيها المساعد (دورات مساحة أستاذه) */
export async function assistantCourses(db: Db, actor: Actor): Promise<{ id: string; title: string }[]> {
  assertRole(actor, 'ASSISTANT')
  if (!isClassroomAssistant(actor) || !actor.workspaceId) return []
  return db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(and(eq(courses.workspaceId, actor.workspaceId), isNull(courses.deletedAt), sql`${courses.groupId} is not null`))
    .orderBy(asc(courses.title))
}

export interface ContentInput {
  kind: string
  /** الدورة التي يُنشر فيها للتلاميذ فورًا (قرار المالك 27 نوفمبر 2026: بلا مراجعة) */
  courseId: string
  title: string
  pages: unknown
  note?: string | null
  file: { name: string; type: string; bytes: Buffer }
}

/** المساعد يرفع محتوى: يُحفظ الملف (خاصّ) ويُحسب بالصّفحة فورًا */
export async function submitAssistantContent(db: Db, actor: Actor, input: ContentInput) {
  assertRole(actor, 'ASSISTANT')
  if (!isClassroomAssistant(actor)) throw new AppError('FORBIDDEN')
  const kind = input.kind as ContentKind
  if (!CONTENT_KINDS.includes(kind)) throw new AppError('VALIDATION', { field: 'kind' })
  const title = input.title.trim().slice(0, 200)
  if (title.length < 3) throw new AppError('VALIDATION', { field: 'title' })
  const pages = Number(input.pages)
  if (!Number.isInteger(pages) || pages < 1 || pages > 500) throw new AppError('VALIDATION', { field: 'pages' })
  assertUuid(input.courseId, 'VALIDATION')
  const [course] = await db
    .select({ id: courses.id, title: courses.title, workspaceId: courses.workspaceId, groupId: courses.groupId, levelId: courses.levelId, subjectId: courses.subjectId, streamIds: courses.streamIds })
    .from(courses)
    .where(and(eq(courses.id, input.courseId), isNull(courses.deletedAt)))
    .limit(1)
  if (!course || !course.groupId || course.workspaceId !== actor.workspaceId) throw new AppError('VALIDATION', { field: 'courseId' })
  const mime = (input.file.type || '').toLowerCase()
  if (input.file.bytes.length === 0) throw new AppError('VALIDATION', { field: 'file' })
  if (input.file.bytes.length > CONTENT_MAX_BYTES) throw new AppError('FILE_TOO_LARGE')
  if (!CONTENT_MIME.has(mime)) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  const ext = input.file.name.includes('.') ? (input.file.name.split('.').pop() ?? '') : ''
  const key = newStorageKey(actor.workspaceId ?? null, ext)
  await storage().put(key, input.file.bytes)
  const saved = await db.transaction(async (tx) => {
    const [f] = await tx
      .insert(files)
      .values({
        workspaceId: actor.workspaceId ?? null,
        ownerUserId: actor.userId,
        bucket: 'private',
        storageKey: key,
        originalName: input.file.name.slice(0, 200),
        mimeType: mime,
        sizeBytes: input.file.bytes.length,
        checksum: createHash('sha256').update(input.file.bytes).digest('hex')
      })
      .returning({ id: files.id })
    if (!f) throw new AppError('INTERNAL')
    const [row] = await tx
      .insert(assistantContent)
      .values({
        assistantUserId: actor.userId,
        workspaceId: actor.workspaceId ?? null,
        kind,
        title,
        pages,
        fileId: f.id,
        note: input.note?.trim().slice(0, 500) || null
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: actor.workspaceId ?? null,
      action: 'assistant.content',
      entityType: 'assistant_content',
      entityId: row.id,
      newValue: { kind, title, pages, courseId: course.id }
    })
    return row
  })
  // يُنشر للتلاميذ فورًا في «الملفات» داخل الدورة
  const pub = await publishFileToGroup(db, {
    workspaceId: course.workspaceId,
    authorUserId: actor.userId,
    title,
    fileId: saved.fileId,
    groupId: course.groupId,
    levelId: course.levelId,
    subjectId: course.subjectId,
    streamId: course.streamIds.length === 1 ? course.streamIds[0]! : null
  })
  return { ...saved, contentId: pub.id, courseTitle: course.title }
}

/** المشرف يحذف محتوى من الحساب (لا يُحسب بعدها) */
export async function removeAssistantContent(db: Db, actor: Actor, id: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id)
  const [row] = await db
    .update(assistantContent)
    .set({ removedAt: new Date(), removedByUserId: actor.userId })
    .where(and(eq(assistantContent.id, id), isNull(assistantContent.removedAt)))
    .returning({ id: assistantContent.id })
  if (!row) throw new AppError('NOT_FOUND')
  // ويُسحب من عند التلاميذ (ملف الدورة المنشور من الملف نفسه)
  const [ac] = await db.select({ fileId: assistantContent.fileId, userId: assistantContent.assistantUserId }).from(assistantContent).where(eq(assistantContent.id, id)).limit(1)
  if (ac) await db.update(content).set({ deletedAt: new Date(), updatedAt: new Date() }).where(and(eq(content.fileId, ac.fileId), eq(content.authorUserId, ac.userId), isNull(content.deletedAt)))
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'assistant.content_removed',
    entityType: 'assistant_content',
    entityId: id
  })
}

/** المشرف يسجّل أنّه دفع كشف الشّهر: يُحفظ المبلغ وتفصيله كما هو يوم الدّفع */
export async function markMonthPaid(db: Db, actor: Actor, assistantUserId: string, month: string) {
  assertRole(actor, 'SUPER_ADMIN')
  const m = await assistantMonth(db, actor, { assistantUserId, month })
  if (m.payout) throw new AppError('PAYOUT_ALREADY_RECORDED')
  const [row] = await db
    .insert(assistantPayouts)
    .values({
      assistantUserId,
      month,
      amount: m.statement.total,
      breakdown: { statement: m.statement, config: m.config },
      paidByUserId: actor.userId
    })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new AppError('PAYOUT_ALREADY_RECORDED')
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'assistant.payout',
    entityType: 'assistant_payout',
    entityId: row.id,
    newValue: { assistantUserId, month, amount: row.amount }
  })
  return row
}

/** إلغاء تسجيل الدّفع (خطأ في الإدخال) */
export async function cancelPayout(db: Db, actor: Actor, assistantUserId: string, month: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(assistantUserId)
  const [row] = await db
    .delete(assistantPayouts)
    .where(and(eq(assistantPayouts.assistantUserId, assistantUserId), eq(assistantPayouts.month, month)))
    .returning({ id: assistantPayouts.id, amount: assistantPayouts.amount })
  if (!row) throw new AppError('NOT_FOUND')
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'assistant.payout_cancelled',
    entityType: 'assistant_payout',
    entityId: row.id,
    oldValue: { assistantUserId, month, amount: row.amount }
  })
}
