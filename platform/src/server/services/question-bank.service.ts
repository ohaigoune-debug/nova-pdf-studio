/**
 * بنك الأسئلة (Exam Builder — المرحلة 1).
 * قاعدتان: الأستاذ يرى بنكه كاملاً (كل الحالات) + ما نُشر عامّاً من البنك المركزي وغيره؛
 * ولا شيء يدخل البنك من ملف أو ذكاء اصطناعي إلا عبر قائمة المراجعة (NEEDS_REVIEW) ثم موافقة صريحة.
 * المصدر والحقوق لا يُمسحان.
 */
import { createHash, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, gte, inArray, isNull, lt, lte, or, sql, type SQL } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { ExtractedQuestion } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { bankFavorites, bankQuestions, contentSources, curriculumNodes, files, levels, questionOptions, questions, quizzes, streams, subjects, type BankOption, type BankQuestionInsert, type BankQuestionRow, type BaremeItem } from '@/server/db/schema'
import type { BankExamKind, BankKind, BankQuestionType, BankStatus, BankVisibility, RightsStatus } from '@/server/db/schema/enums'
import { BANK_EXAM_KINDS, BANK_KINDS, BANK_QUESTION_TYPES, BANK_STATUSES, RIGHTS_STATUSES } from '@/server/db/schema/enums'
import { enqueueJob, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { extractDocText, isTextExtractable } from '@/server/lib/doc-text'
import { AppError, assertUuid, isPermanentJobError } from '@/server/lib/errors'
import { validateQuestion } from '@/server/lib/quiz-grading'
import { storage } from '@/server/lib/storage'
import { cachedText } from '@/server/lib/text-cache'
import { workspaceSubject } from './ai.service'
import { notify } from './notifications.service'
import { assertOwnFiles } from './sources.service'

export const BANK_PAGE = 30
/** نصّ الملف المرسل للاستخراج (الأطول يُقسَّم) */
const EXTRACT_CHUNK = 24_000

export interface BankQuestionInput {
  kind?: BankKind
  type: BankQuestionType
  title?: string | null
  body: string
  options?: BankOption[]
  answerKey?: Record<string, unknown> | null
  solution?: string | null
  bareme?: BaremeItem[]
  points?: number
  difficulty?: number
  estimatedMinutes?: number | null
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  curriculumNodeId?: string | null
  schoolTerm?: number | null
  examKind?: BankExamKind | null
  sourceLabel?: string | null
  sourceYear?: number | null
  sourceResourceId?: string | null
  rightsStatus?: RightsStatus
  language?: string
  keywords?: string[]
  imageFileId?: string | null
  visibility?: BankVisibility
  status?: BankStatus
  parentId?: string | null
  sortOrder?: number
}

/* ------------------------------- أدوات ------------------------------- */

const ws = (actor: Actor): string | null => (actor.role === 'TEACHER' ? actor.workspaceId : null)

/** نصّ البحث المطبَّع: العنوان + النصّ + الحلّ + الكلمات + وصف المصدر */
export const searchTextOf = (q: Pick<BankQuestionInput, 'title' | 'body' | 'solution' | 'keywords' | 'sourceLabel'>): string =>
  normalizeArabic([q.title ?? '', q.body, q.solution ?? '', (q.keywords ?? []).join(' '), q.sourceLabel ?? ''].join(' ')).replace(/\s+/g, ' ').trim()

export const contentHashOf = (body: string): string => createHash('sha256').update(normalizeArabic(body).replace(/\s+/g, ' ').trim()).digest('hex')

const cleanKeywords = (k?: string[]): string[] => [...new Set((k ?? []).map((x) => x.trim()).filter((x) => x.length >= 2 && x.length <= 40))].slice(0, 12)

/** صفّ محفوظ ← مدخل للفحص (عند النشر أو الاعتماد) */
const rowAsInput = (r: BankQuestionRow): BankQuestionInput => ({
  kind: r.kind as BankKind,
  type: r.type as BankQuestionType,
  body: r.body,
  points: Number(r.points),
  difficulty: r.difficulty,
  options: r.options,
  answerKey: r.answerKey ?? null,
  schoolTerm: r.schoolTerm,
  examKind: (r.examKind as BankExamKind | null) ?? null,
  rightsStatus: r.rightsStatus as RightsStatus
})

/** يفحص المدخل بنفس قواعد الاختبار الإلكتروني حيث تنطبق؛ OPEN/LONG_ANSWER/IMAGE بلا مفتاح يُقبل للورقة */
function validateInput(input: BankQuestionInput): void {
  if (!input.body?.trim()) throw new AppError('BANK_INVALID_QUESTION', { field: 'body' })
  if (!BANK_QUESTION_TYPES.includes(input.type)) throw new AppError('VALIDATION', { field: 'type' })
  if (input.kind && !BANK_KINDS.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  if (input.examKind && !BANK_EXAM_KINDS.includes(input.examKind)) throw new AppError('VALIDATION', { field: 'examKind' })
  if (input.rightsStatus && !RIGHTS_STATUSES.includes(input.rightsStatus)) throw new AppError('VALIDATION', { field: 'rightsStatus' })
  if (input.status && !BANK_STATUSES.includes(input.status)) throw new AppError('VALIDATION', { field: 'status' })
  const points = input.points ?? 1
  if (!(points > 0) || points > 100) throw new AppError('VALIDATION', { field: 'points' })
  const d = input.difficulty ?? 2
  if (!Number.isInteger(d) || d < 1 || d > 4) throw new AppError('VALIDATION', { field: 'difficulty' })
  if (input.schoolTerm != null && ![1, 2, 3].includes(input.schoolTerm)) throw new AppError('VALIDATION', { field: 'schoolTerm' })
  if (['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK', 'MATCHING'].includes(input.type)) {
    const err = validateQuestion({ type: input.type, prompt: input.body, points, answerKey: input.answerKey ?? null, options: input.options ?? [] })
    if (err) throw new AppError('BANK_INVALID_QUESTION', { reason: err })
  }
  for (const id of [input.subjectId, input.levelId, input.streamId, input.curriculumNodeId, input.imageFileId, input.sourceResourceId, input.parentId]) if (id) assertUuid(id, 'VALIDATION')
}

function toInsert(actor: Actor, input: BankQuestionInput): Omit<BankQuestionInsert, 'id'> {
  const points = input.points ?? 1
  return {
    workspaceId: ws(actor),
    authorUserId: actor.userId,
    parentId: input.parentId ?? null,
    kind: input.kind ?? 'QUESTION',
    type: input.type,
    title: input.title?.trim() || null,
    body: input.body.trim(),
    options: (input.options ?? []).map((o) => ({ label: o.label.trim(), isCorrect: Boolean(o.isCorrect) })),
    answerKey: input.answerKey ?? null,
    solution: input.solution?.trim() || null,
    bareme: (input.bareme ?? []).filter((b) => b.label?.trim() && b.points > 0).map((b) => ({ label: b.label.trim(), points: b.points })),
    points: String(points),
    difficulty: input.difficulty ?? 2,
    estimatedMinutes: input.estimatedMinutes ?? null,
    subjectId: input.subjectId ?? null,
    levelId: input.levelId ?? null,
    streamId: input.streamId ?? null,
    curriculumNodeId: input.curriculumNodeId ?? null,
    schoolTerm: input.schoolTerm ?? null,
    examKind: input.examKind ?? null,
    sourceLabel: input.sourceLabel?.trim() || null,
    sourceYear: input.sourceYear ?? null,
    sourceResourceId: input.sourceResourceId ?? null,
    rightsStatus: input.rightsStatus ?? 'OWN',
    language: input.language ?? 'ar',
    keywords: cleanKeywords(input.keywords),
    imageFileId: input.imageFileId ?? null,
    visibility: input.visibility ?? 'PRIVATE',
    status: input.status ?? 'PUBLISHED',
    contentHash: contentHashOf(input.body),
    searchText: searchTextOf(input),
    sortOrder: input.sortOrder ?? 0
  }
}

/* ------------------------------- CRUD ------------------------------- */

export async function createBankQuestion(db: Db, actor: Actor, input: BankQuestionInput): Promise<BankQuestionRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  if (actor.role === 'TEACHER' && !actor.workspaceId) throw new AppError('FORBIDDEN')
  validateInput(input)
  if (input.parentId) await getOwnQuestion(db, actor, input.parentId)
  const [row] = await db.insert(bankQuestions).values(toInsert(actor, input)).returning()
  if (!row) throw new AppError('INTERNAL')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ws(actor), action: 'bank.question.create', entityType: 'bank_question', entityId: row.id, newValue: { type: row.type, kind: row.kind, status: row.status } })
  return row
}

/** سؤال من مساحة الفاعل (أو المركزي للمشرف)؛ غيره NOT_FOUND لا FORBIDDEN كي لا يُكشف وجوده */
export async function getOwnQuestion(db: Db, actor: Actor, id: string): Promise<BankQuestionRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'BANK_QUESTION_NOT_FOUND')
  const scope = actor.role === 'SUPER_ADMIN' ? isNull(bankQuestions.workspaceId) : eq(bankQuestions.workspaceId, actor.workspaceId ?? '')
  const [row] = await db.select().from(bankQuestions).where(and(eq(bankQuestions.id, id), scope, isNull(bankQuestions.deletedAt))).limit(1)
  if (!row) throw new AppError('BANK_QUESTION_NOT_FOUND')
  return row
}

export async function updateBankQuestion(db: Db, actor: Actor, id: string, input: BankQuestionInput): Promise<BankQuestionRow> {
  const current = await getOwnQuestion(db, actor, id)
  validateInput(input)
  const next = toInsert(actor, input)
  // الهوية والمصدر الأصلي لا يتغيّران بالتعديل
  const [row] = await db
    .update(bankQuestions)
    .set({ ...next, workspaceId: current.workspaceId, authorUserId: current.authorUserId, parentId: input.parentId === undefined ? current.parentId : next.parentId, originalFileId: current.originalFileId, sourceId: current.sourceId, importBatchId: current.importBatchId, status: input.status ?? current.status, updatedAt: new Date() })
    .where(eq(bankQuestions.id, id))
    .returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ws(actor), action: 'bank.question.update', entityType: 'bank_question', entityId: id, oldValue: { title: current.title, type: current.type }, newValue: { title: row!.title, type: row!.type } })
  return row!
}

export async function setBankQuestionStatus(db: Db, actor: Actor, id: string, status: BankStatus): Promise<void> {
  const current = await getOwnQuestion(db, actor, id)
  if (!BANK_STATUSES.includes(status)) throw new AppError('VALIDATION', { field: 'status' })
  if (status === 'PUBLISHED') validateInput(rowAsInput(current))
  await db.update(bankQuestions).set({ status, updatedAt: new Date() }).where(or(eq(bankQuestions.id, id), eq(bankQuestions.parentId, id)))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: ws(actor), action: 'bank.question.status', entityType: 'bank_question', entityId: id, oldValue: { status: current.status }, newValue: { status } })
}

/** حذف ناعم (مع الأسئلة الفرعية) — المستعمل في امتحان يُؤرشف لاحقاً بدل الحذف */
export async function deleteBankQuestion(db: Db, actor: Actor, id: string): Promise<void> {
  await getOwnQuestion(db, actor, id)
  await db.update(bankQuestions).set({ deletedAt: new Date() }).where(or(eq(bankQuestions.id, id), eq(bankQuestions.parentId, id)))
}

export async function toggleFavorite(db: Db, actor: Actor, questionId: string): Promise<{ favorite: boolean }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(questionId, 'BANK_QUESTION_NOT_FOUND')
  const [ex] = await db.select({ id: bankFavorites.id }).from(bankFavorites).where(and(eq(bankFavorites.userId, actor.userId), eq(bankFavorites.questionId, questionId))).limit(1)
  if (ex) {
    await db.delete(bankFavorites).where(eq(bankFavorites.id, ex.id))
    return { favorite: false }
  }
  await db.insert(bankFavorites).values({ userId: actor.userId, questionId }).onConflictDoNothing()
  return { favorite: true }
}

/* ------------------------------- القراءة ------------------------------- */

export interface BankFilter {
  /** mine: بنكي كلّه · central: بنك Madrasadz · public: كل المنشور العام · all (افتراضي): بنكي + العام */
  scope?: 'mine' | 'central' | 'public' | 'all' | 'review' | 'favorites'
  q?: string | null
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  curriculumNodeId?: string | null
  schoolTerm?: number | null
  types?: BankQuestionType[]
  kinds?: BankKind[]
  difficulties?: number[]
  examKind?: BankExamKind | null
  sourceYear?: number | null
  hasSolution?: boolean | null
  minPoints?: number | null
  maxPoints?: number | null
  maxMinutes?: number | null
  statuses?: BankStatus[]
  importBatchId?: string | null
  /** الأسئلة الجذرية فقط (الفرعية تظهر تحت أمّها) */
  rootsOnly?: boolean
}

export interface BankListItem extends BankQuestionRow {
  subjectName: string | null
  levelName: string | null
  streamName: string | null
  nodeTitle: string | null
  sourceName: string | null
  favorite: boolean
  children: number
}

const esc = (s: string) => s.replace(/[%_\\]/g, '\\$&')

/** استعلام tsquery من نصّ حرّ: كل كلمة بادئة (AND) بعد التطبيع */
export function tsQueryOf(q: string): string | null {
  const words = normalizeArabic(q)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2)
    .slice(0, 8)
  // «ال» التعريف لا تمنع المطابقة: الاستعارة ⇔ استعارة
  const forms = (w: string) => (w.startsWith('ال') && w.length >= 5 ? `(${w}:* | ${w.slice(2)}:*)` : /^\p{Script=Arabic}/u.test(w) && w.length >= 3 ? `(${w}:* | ال${w}:*)` : `${w}:*`)
  return words.length ? words.map(forms).join(' & ') : null
}

export async function listBankQuestions(db: Db, actor: Actor, f: BankFilter = {}, page: { cursor?: string | null; limit?: number } = {}): Promise<{ items: BankListItem[]; nextCursor: string | null }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const mine = ws(actor)
  const limit = Math.max(1, Math.min(100, page.limit ?? BANK_PAGE))
  const own = mine ? eq(bankQuestions.workspaceId, mine) : isNull(bankQuestions.workspaceId)
  const publicVisible = and(eq(bankQuestions.visibility, 'PUBLIC'), eq(bankQuestions.status, 'PUBLISHED'))
  const scope = f.scope ?? 'all'
  const where: (SQL | undefined)[] = [
    isNull(bankQuestions.deletedAt),
    scope === 'mine' ? own : scope === 'central' ? and(isNull(bankQuestions.workspaceId), mine ? publicVisible : undefined) : scope === 'public' ? publicVisible : scope === 'review' ? and(own, eq(bankQuestions.status, 'NEEDS_REVIEW')) : scope === 'favorites' ? or(own, publicVisible) : or(own, publicVisible),
    // المستخرج غير المراجَع لا يظهر إلا في «للمراجعة»: لا شيء يدخل البنك قبل الموافقة
    scope === 'review' ? undefined : f.statuses?.length ? inArray(bankQuestions.status, f.statuses) : scope === 'mine' || scope === 'all' || scope === 'favorites' ? inArray(bankQuestions.status, ['PUBLISHED', 'DRAFT']) : undefined,
    f.rootsOnly === false ? undefined : isNull(bankQuestions.parentId),
    f.subjectId ? eq(bankQuestions.subjectId, f.subjectId) : undefined,
    f.levelId ? eq(bankQuestions.levelId, f.levelId) : undefined,
    f.streamId ? or(eq(bankQuestions.streamId, f.streamId), isNull(bankQuestions.streamId)) : undefined,
    f.curriculumNodeId ? eq(bankQuestions.curriculumNodeId, f.curriculumNodeId) : undefined,
    f.schoolTerm ? eq(bankQuestions.schoolTerm, f.schoolTerm) : undefined,
    f.types?.length ? inArray(bankQuestions.type, f.types) : undefined,
    f.kinds?.length ? inArray(bankQuestions.kind, f.kinds) : undefined,
    f.difficulties?.length ? inArray(bankQuestions.difficulty, f.difficulties) : undefined,
    f.examKind ? eq(bankQuestions.examKind, f.examKind) : undefined,
    f.sourceYear ? eq(bankQuestions.sourceYear, f.sourceYear) : undefined,
    f.hasSolution === true ? sql`${bankQuestions.solution} is not null` : f.hasSolution === false ? isNull(bankQuestions.solution) : undefined,
    f.minPoints != null ? gte(bankQuestions.points, String(f.minPoints)) : undefined,
    f.maxPoints != null ? lte(bankQuestions.points, String(f.maxPoints)) : undefined,
    f.maxMinutes != null ? lte(bankQuestions.estimatedMinutes, f.maxMinutes) : undefined,
    f.importBatchId ? eq(bankQuestions.importBatchId, f.importBatchId) : undefined,
    scope === 'favorites' ? sql`exists (select 1 from ${bankFavorites} bf where bf.question_id = ${bankQuestions.id} and bf.user_id = ${actor.userId})` : undefined
  ]
  const q = f.q?.trim()
  if (q) {
    const ts = tsQueryOf(q)
    // البحث النصّي المفهرس، ومعه ILIKE للعبارات القصيرة جداً أو الرموز
    where.push(ts ? or(sql`${bankQuestions}."search" @@ to_tsquery('simple', ${ts})`, sql`${bankQuestions.searchText} ilike ${`%${esc(normalizeArabic(q))}%`}`) : sql`${bankQuestions.searchText} ilike ${`%${esc(normalizeArabic(q))}%`}`)
  }
  if (page.cursor) {
    const [at, id] = Buffer.from(page.cursor, 'base64url').toString().split('|')
    if (at && id) where.push(or(lt(bankQuestions.createdAt, new Date(at)), and(eq(bankQuestions.createdAt, new Date(at)), lt(bankQuestions.id, id))))
  }
  const rows = await db
    .select({
      r: bankQuestions,
      subjectName: subjects.nameAr,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      nodeTitle: curriculumNodes.title,
      sourceName: contentSources.name,
      favorite: sql<boolean>`exists (select 1 from ${bankFavorites} bf where bf.question_id = ${bankQuestions.id} and bf.user_id = ${actor.userId})`,
      children: sql<number>`(select count(*)::int from ${bankQuestions} c where c.parent_id = ${bankQuestions.id} and c.deleted_at is null)`
    })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(levels, eq(levels.id, bankQuestions.levelId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .leftJoin(contentSources, eq(contentSources.id, bankQuestions.sourceId))
    .where(and(...where))
    .orderBy(desc(bankQuestions.createdAt), desc(bankQuestions.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit).map((x) => ({ ...x.r, subjectName: x.subjectName, levelName: x.levelName, streamName: x.streamName, nodeTitle: x.nodeTitle, sourceName: x.sourceName, favorite: x.favorite, children: x.children }))
  const last = items[items.length - 1]
  return { items, nextCursor: rows.length > limit && last ? Buffer.from(`${last.createdAt.toISOString()}|${last.id}`).toString('base64url') : null }
}

/** سؤال واحد بأسئلته الفرعية (للعرض والتعديل) — من بنكي أو عامّ منشور */
export async function getBankQuestion(db: Db, actor: Actor, id: string): Promise<BankListItem & { subs: BankQuestionRow[] }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'BANK_QUESTION_NOT_FOUND')
  const mine = ws(actor)
  const [x] = await db
    .select({ r: bankQuestions, subjectName: subjects.nameAr, levelName: levels.nameAr, streamName: streams.nameAr, nodeTitle: curriculumNodes.title, sourceName: contentSources.name, favorite: sql<boolean>`exists (select 1 from ${bankFavorites} bf where bf.question_id = ${bankQuestions.id} and bf.user_id = ${actor.userId})` })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(levels, eq(levels.id, bankQuestions.levelId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .leftJoin(contentSources, eq(contentSources.id, bankQuestions.sourceId))
    .where(and(eq(bankQuestions.id, id), isNull(bankQuestions.deletedAt), or(mine ? eq(bankQuestions.workspaceId, mine) : isNull(bankQuestions.workspaceId), and(eq(bankQuestions.visibility, 'PUBLIC'), eq(bankQuestions.status, 'PUBLISHED')))))
    .limit(1)
  if (!x) throw new AppError('BANK_QUESTION_NOT_FOUND')
  const subs = await db.select().from(bankQuestions).where(and(eq(bankQuestions.parentId, id), isNull(bankQuestions.deletedAt))).orderBy(asc(bankQuestions.sortOrder), asc(bankQuestions.createdAt))
  return { ...x.r, subjectName: x.subjectName, levelName: x.levelName, streamName: x.streamName, nodeTitle: x.nodeTitle, sourceName: x.sourceName, favorite: x.favorite, children: subs.length, subs }
}

export async function bankStats(db: Db, actor: Actor) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const mine = ws(actor)
  const own = and(isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), mine ? eq(bankQuestions.workspaceId, mine) : isNull(bankQuestions.workspaceId))
  const [byStatus, [central], [favs], byDifficulty] = await Promise.all([
    db.select({ status: bankQuestions.status, n: sql<number>`count(*)::int` }).from(bankQuestions).where(own).groupBy(bankQuestions.status),
    db.select({ n: sql<number>`count(*)::int` }).from(bankQuestions).where(and(isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), isNull(bankQuestions.workspaceId), eq(bankQuestions.visibility, 'PUBLIC'), eq(bankQuestions.status, 'PUBLISHED'))),
    db.select({ n: sql<number>`count(*)::int` }).from(bankFavorites).where(eq(bankFavorites.userId, actor.userId)),
    db.select({ d: bankQuestions.difficulty, n: sql<number>`count(*)::int` }).from(bankQuestions).where(and(own, sql`${bankQuestions.status} <> 'ARCHIVED'`)).groupBy(bankQuestions.difficulty)
  ])
  const s = Object.fromEntries(byStatus.map((x) => [x.status, x.n])) as Partial<Record<BankStatus, number>>
  return { mine: (s.PUBLISHED ?? 0) + (s.DRAFT ?? 0), review: s.NEEDS_REVIEW ?? 0, archived: s.ARCHIVED ?? 0, central: central?.n ?? 0, favorites: favs?.n ?? 0, byDifficulty: Object.fromEntries(byDifficulty.map((x) => [x.d, x.n])) as Record<number, number> }
}

/* ------------------------- من اختبار إلكتروني موجود ------------------------- */

/** ينسخ أسئلة اختبار (quizzes) إلى بنك الأستاذ بنفس المفاتيح؛ المكرّر (نفس النصّ) لا يُنسخ */
export async function importQuizToBank(db: Db, actor: Actor, quizId: string, meta: Pick<BankQuestionInput, 'subjectId' | 'levelId' | 'streamId' | 'curriculumNodeId' | 'schoolTerm' | 'difficulty'> = {}): Promise<{ imported: number; skipped: number }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(quizId, 'QUIZ_NOT_FOUND')
  const mine = ws(actor)
  const [quiz] = await db.select().from(quizzes).where(and(eq(quizzes.id, quizId), mine ? eq(quizzes.workspaceId, mine) : isNull(quizzes.workspaceId), isNull(quizzes.deletedAt))).limit(1)
  if (!quiz) throw new AppError('QUIZ_NOT_FOUND')
  const qs = await db.select().from(questions).where(eq(questions.quizId, quizId)).orderBy(asc(questions.sortOrder))
  if (qs.length === 0) throw new AppError('BANK_NOTHING_TO_IMPORT')
  const opts = qs.length ? await db.select().from(questionOptions).where(inArray(questionOptions.questionId, qs.map((q) => q.id))).orderBy(asc(questionOptions.sortOrder)) : []
  const existing = new Set((await db.select({ h: bankQuestions.contentHash }).from(bankQuestions).where(and(mine ? eq(bankQuestions.workspaceId, mine) : isNull(bankQuestions.workspaceId), isNull(bankQuestions.deletedAt)))).map((x) => x.h))
  let imported = 0
  let skipped = 0
  for (const q of qs) {
    const hash = contentHashOf(q.prompt)
    if (existing.has(hash)) {
      skipped++
      continue
    }
    const input: BankQuestionInput = {
      type: q.type as BankQuestionType,
      body: q.prompt,
      options: opts.filter((o) => o.questionId === q.id).map((o) => ({ label: o.label, isCorrect: o.isCorrect })),
      answerKey: q.answerKey ?? null,
      points: Number(q.points),
      imageFileId: q.imageFileId,
      sourceLabel: `اختبار: ${quiz.title}`,
      examKind: 'QUIZ',
      keywords: quiz.topic ? [quiz.topic] : [],
      status: 'PUBLISHED',
      ...meta
    }
    await db.insert(bankQuestions).values(toInsert(actor, input))
    existing.add(hash)
    imported++
  }
  if (imported === 0) throw new AppError('BANK_NOTHING_TO_IMPORT')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: mine, action: 'bank.import.quiz', entityType: 'quiz', entityId: quizId, newValue: { imported, skipped } })
  return { imported, skipped }
}

/* ------------------------- استخراج من ملف (مراجعة أولاً) ------------------------- */

export async function requestQuestionExtraction(db: Db, actor: Actor, input: { fileIds: string[]; subjectId?: string | null; levelId?: string | null; streamId?: string | null; schoolTerm?: number | null; examKind?: BankExamKind | null; sourceLabel?: string | null; sourceYear?: number | null; rightsStatus?: RightsStatus }): Promise<{ jobId: string; files: number }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  if (!aiProviderInfo().configured) throw new AppError('AI_UNAVAILABLE')
  const ids = [...new Set(input.fileIds)].slice(0, 10)
  if (ids.length === 0) throw new AppError('VALIDATION', { field: 'fileIds' })
  ids.forEach((id) => assertUuid(id, 'FILE_NOT_FOUND'))
  const rows = await assertOwnFiles(db, actor.workspaceId, ids)
  const usable = rows.filter((f) => isTextExtractable(f.mimeType))
  if (usable.length === 0) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  const job = await enqueueJob(db, {
    type: 'AI_EXTRACT_QUESTIONS',
    payload: { workspaceId: actor.workspaceId, userId: actor.userId, fileIds: usable.map((f) => f.id), subjectId: input.subjectId ?? null, levelId: input.levelId ?? null, streamId: input.streamId ?? null, schoolTerm: input.schoolTerm ?? null, examKind: input.examKind ?? null, sourceLabel: input.sourceLabel ?? null, sourceYear: input.sourceYear ?? null, rightsStatus: input.rightsStatus ?? 'OWN' },
    workspaceId: actor.workspaceId,
    maxAttempts: 2
  })
  await updateJobProgress(db, job.id, { totalItems: usable.length })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'bank.extract.request', entityType: 'job', entityId: job.id, newValue: { files: usable.length } })
  return { jobId: job.id, files: usable.length }
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** يستخرج الأسئلة من كل ملف ويحفظها NEEDS_REVIEW تحت دفعة واحدة لكل ملف؛ لا شيء يُنشر */
export async function runExtractQuestionsJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const p = job.payload
  const workspaceId = String(p.workspaceId ?? '')
  const userId = String(p.userId ?? '')
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const fileIds = Array.isArray(p.fileIds) ? p.fileIds.map(String) : []
  const actor: Actor = { userId, role: 'TEACHER', fullName: '', email: '', workspaceId, teacherId: null, studentId: null }
  const provider = getAiProvider()
  if (!provider.extractQuestions) throw new AppError('AI_UNAVAILABLE')
  const subject = await workspaceSubject(db, workspaceId)
  const [level] = p.levelId ? await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, String(p.levelId))).limit(1) : []
  const rows = await db.select().from(files).where(and(inArray(files.id, fileIds), eq(files.workspaceId, workspaceId), isNull(files.deletedAt)))
  const lastAttempt = job.attempts >= job.maxAttempts
  let total = 0
  let done = 0
  const batches: { fileId: string; name: string; batchId: string; n: number; note: string | null }[] = []
  for (const f of rows) {
    const text = await cachedText(`file:${f.id}:${f.checksum ?? f.sizeBytes}`, async () => extractDocText(new Uint8Array(await storage().get(f.storageKey)), f.mimeType))
    const batchId = randomUUID()
    let n = 0
    let note: string | null = text.length < 40 ? 'الملف بلا نصّ قابل للقراءة (مصوّر؟): لم يُستخرج شيء.' : null
    if (!note) {
      // النصّ الطويل يُقسَّم على دفعات متتالية
      for (let i = 0; i < text.length && i < EXTRACT_CHUNK * 6; i += EXTRACT_CHUNK) {
        let out
        try {
          out = await provider.extractQuestions({ subject, levelName: level?.n ?? null, fileTitle: f.originalName, text: text.slice(i, i + EXTRACT_CHUNK) })
        } catch (e) {
          if (isPermanentJobError(e) || lastAttempt) await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `تعذّر استخراج الأسئلة من «${f.originalName}»`, body: aiFailureReason(e), link: '/teacher/bank/import' })
          throw e
        }
        if (out.note && out.questions.length === 0) note = out.note
        n += await saveExtracted(db, actor, out.questions, { fileId: f.id, batchId, subjectId: str(p.subjectId), levelId: str(p.levelId), streamId: str(p.streamId), schoolTerm: typeof p.schoolTerm === 'number' ? p.schoolTerm : null, examKind: str(p.examKind) as BankExamKind | null, sourceLabel: str(p.sourceLabel) ?? f.originalName, sourceYear: typeof p.sourceYear === 'number' ? p.sourceYear : null, rightsStatus: (str(p.rightsStatus) as RightsStatus | null) ?? 'OWN' })
      }
    }
    total += n
    done++
    batches.push({ fileId: f.id, name: f.originalName, batchId, n, note })
    await updateJobProgress(db, job.id, { totalItems: rows.length, processedItems: done, progress: { lastFile: f.originalName, extracted: total } })
  }
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: total ? `${total} سؤالاً مستخرجاً بانتظار مراجعتك` : 'لم يُستخرج أي سؤال', body: batches.map((b) => `${b.name}: ${b.n}${b.note ? ` — ${b.note}` : ''}`).join(' · '), link: '/teacher/bank?scope=review' })
  return { extracted: total, files: batches }
}

async function saveExtracted(db: Db, actor: Actor, items: ExtractedQuestion[], ctx: { fileId: string; batchId: string; subjectId: string | null; levelId: string | null; streamId: string | null; schoolTerm: number | null; examKind: BankExamKind | null; sourceLabel: string | null; sourceYear: number | null; rightsStatus: RightsStatus }): Promise<number> {
  let n = 0
  const common = (q: Omit<ExtractedQuestion, 'children'>, parentId: string | null, order: number): Omit<BankQuestionInsert, 'id'> => ({
    ...toInsert(actor, {
      kind: q.kind,
      type: q.type,
      title: q.title,
      body: q.body,
      options: q.options,
      answerKey: q.answerKey,
      solution: q.solution,
      points: q.points ?? 1,
      difficulty: q.difficulty,
      estimatedMinutes: q.estimatedMinutes,
      subjectId: ctx.subjectId,
      levelId: ctx.levelId,
      streamId: ctx.streamId,
      schoolTerm: ctx.schoolTerm,
      examKind: ctx.examKind,
      sourceLabel: ctx.sourceLabel,
      sourceYear: ctx.sourceYear,
      rightsStatus: ctx.rightsStatus,
      keywords: [...q.keywords, ...(q.topic ? [q.topic] : [])],
      status: 'NEEDS_REVIEW',
      parentId,
      sortOrder: order
    }),
    originalFileId: ctx.fileId,
    importBatchId: ctx.batchId
  })
  for (const [i, q] of items.entries()) {
    const [root] = await db.insert(bankQuestions).values(common(q, null, i)).returning({ id: bankQuestions.id })
    n++
    for (const [j, c] of q.children.entries()) {
      await db.insert(bankQuestions).values(common(c, root!.id, j))
      n++
    }
  }
  return n
}

/** اعتماد دفعة مراجعة (أو أسئلة محدّدة منها): NEEDS_REVIEW ← PUBLISHED؛ غير المحدّد يبقى للمراجعة */
export async function approveReviewed(db: Db, actor: Actor, ids: string[]): Promise<{ approved: number }> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const mine = ws(actor)
  ids.forEach((id) => assertUuid(id, 'BANK_QUESTION_NOT_FOUND'))
  if (ids.length === 0) return { approved: 0 }
  const rows = await db
    .select()
    .from(bankQuestions)
    .where(and(inArray(bankQuestions.id, ids), mine ? eq(bankQuestions.workspaceId, mine) : isNull(bankQuestions.workspaceId), eq(bankQuestions.status, 'NEEDS_REVIEW'), isNull(bankQuestions.deletedAt)))
  let approved = 0
  for (const r of rows) {
    // لا يُنشر ما لا يصلح: MCQ بلا إجابة صحيحة مثلاً يبقى للمراجعة
    try {
      validateInput(rowAsInput(r))
    } catch {
      continue
    }
    await db.update(bankQuestions).set({ status: 'PUBLISHED', updatedAt: new Date() }).where(eq(bankQuestions.id, r.id))
    approved++
    // الفرعية تُفحص كلّ على حدة: المعطوب منها يبقى للمراجعة تحت أمّه المنشورة
    const subs = await db.select().from(bankQuestions).where(and(eq(bankQuestions.parentId, r.id), eq(bankQuestions.status, 'NEEDS_REVIEW'), isNull(bankQuestions.deletedAt)))
    for (const c of subs) {
      try {
        validateInput(rowAsInput(c))
      } catch {
        continue
      }
      await db.update(bankQuestions).set({ status: 'PUBLISHED', updatedAt: new Date() }).where(eq(bankQuestions.id, c.id))
    }
  }
  if (approved) await writeAudit(db, { actorUserId: actor.userId, workspaceId: mine, action: 'bank.review.approve', entityType: 'bank_question', entityId: null, newValue: { approved } })
  return { approved }
}

/** حالة آخر استخراج (للصفحة) */
export async function extractionStatus(db: Db, actor: Actor) {
  assertRole(actor, 'TEACHER')
  const pending = actor.workspaceId ? await pendingJobOfType(db, 'AI_EXTRACT_QUESTIONS', actor.workspaceId) : null
  return { running: Boolean(pending), jobId: pending?.id ?? null, processed: pending?.processedItems ?? 0, total: pending?.totalItems ?? 0, aiConfigured: aiProviderInfo().configured }
}

/* ------------------------- نسخ من السوق إلى بنك المشتري ------------------------- */

/**
 * ينسخ أسئلة (وفرعياتها) إلى مساحة أخرى: منشورة خاصة، حقوق «مرخَّص»، المصدر مذكور، بلا عدّاد استعمال.
 * يُستدعى عند تسليم عرض من السوق؛ لا يفحص الملكية (المسار المستدعي تحقّق من الشراء).
 */
export async function copyQuestionsToWorkspace(db: Db, ids: string[], target: { workspaceId: string; userId: string }, sourceLabel: string): Promise<{ copied: number }> {
  if (ids.length === 0) return { copied: 0 }
  const parents = await db.select().from(bankQuestions).where(and(inArray(bankQuestions.id, ids), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId)))
  const children = parents.length ? await db.select().from(bankQuestions).where(and(inArray(bankQuestions.parentId, parents.map((p) => p.id)), isNull(bankQuestions.deletedAt))).orderBy(asc(bankQuestions.sortOrder)) : []
  let copied = 0
  await db.transaction(async (tx) => {
    for (const p of parents) {
      const [np] = await tx
        .insert(bankQuestions)
        .values({ ...p, id: undefined, workspaceId: target.workspaceId, authorUserId: target.userId, parentId: null, visibility: 'PRIVATE', status: 'PUBLISHED', rightsStatus: 'LICENSED', sourceLabel: p.sourceLabel ?? sourceLabel, usageCount: 0, lastUsedAt: null, importBatchId: null, createdAt: undefined, updatedAt: undefined, deletedAt: null })
        .returning()
      copied++
      for (const c of children.filter((x) => x.parentId === p.id)) {
        await tx.insert(bankQuestions).values({ ...c, id: undefined, workspaceId: target.workspaceId, authorUserId: target.userId, parentId: np!.id, visibility: 'PRIVATE', status: 'PUBLISHED', rightsStatus: 'LICENSED', sourceLabel: c.sourceLabel ?? sourceLabel, usageCount: 0, lastUsedAt: null, importBatchId: null, createdAt: undefined, updatedAt: undefined, deletedAt: null })
      }
    }
  })
  return { copied }
}
