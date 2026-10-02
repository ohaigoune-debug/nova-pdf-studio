/**
 * MADRASADZ EXAM ENGINE — المرحلة 1 (PoC رياضيات 3AS بكالوريا).
 * الخطّ: وثيقة في الأرشيف (مورد EXAM رسمي) ← سجلّ `exam_documents` ← مهمة خلفية (المسار البطيء):
 *   تنزيل ← تخزين محلي ← نصّ (unpdf) ← [مصوّر؟ ⇒ فشل «scanned» حتى يأتي OCR] ← تقسيم تمارين بالذكاء الاصطناعي
 *   ← ربط بالمنهاج (كلمات المحاور) بثقة ← ربط الحلّ من التصحيح ← كشف التكرار ← البنك المركزي بانتظار المراجعة.
 * لا شيء يُنشر آلياً؛ المشرف يعتمد الوثيقة فتصبح تمارينها عامة. الأصل (SOURCED) والمصدر لا يُمسحان أبداً.
 * القاعدة: Bank Retrieval First — الذكاء الاصطناعي هنا يُهيكل ويُصنّف فقط، ولا يؤلّف.
 */
import { createHash, randomUUID } from 'node:crypto'
import { and, asc, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { AIProvider, ExtractedQuestion } from '@/server/ai/types'
import { recentAiUsage, withAiTask } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { CURRICULUM_TREES } from '@/server/db/curriculum-nodes-data'
import { bankQuestions, contentSources, curriculumNodes, examDocuments, files, levels, resources, streams, subjects, teacherProgress, type ExamDocumentRow } from '@/server/db/schema'
import { DOC_TYPE_AR } from '@/lib/exam-engine-labels'
import type { ExamDocStatus, ExamDocType } from '@/server/db/schema/enums'
import { enqueueJob, failStaleJob, latestJobOfType, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { extractDocText } from '@/server/lib/doc-text'
import { AppError, assertUuid } from '@/server/lib/errors'
import { newStorageKey, signFileUrl, storage } from '@/server/lib/storage'
import { cachedText } from '@/server/lib/text-cache'
import { aiUsageSummary } from './ai-usage.service'
import { notify } from './notifications.service'
import { approveReviewed, contentHashOf, searchTextOf } from './question-bank.service'

/** حجم أقصى لملف يُنزَّل من المصدر */
const MAX_REMOTE_BYTES = 25 * 1024 * 1024
/** نصّ الوثيقة المرسل للنموذج دفعة واحدة (الأطول يُقسَّم) */
const EXTRACT_CHUNK = 24_000
/** أقلّ طول نصّ يُعدّ قابلاً للقراءة (ما دونه مصوّر غالباً) */
const MIN_TEXT_CHARS = 200
const STALE_AFTER_MS = 2 * 60 * 60_000

export { DOC_STATUS_AR, DOC_TYPE_AR, ORIGIN_AR } from '@/lib/exam-engine-labels'

/** خطأ معالجة وثيقة: رمز قصير يظهر في اللوحة + تفصيل */
class DocError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

/* ───────────────────────────── تسجيل الوثائق ───────────────────────────── */

export interface RegisterInput {
  subjectCode?: string
  levelCode?: string
  streamCode?: string | null
  limit?: number
}

/**
 * يسجّل مواضيع الامتحانات الرسمية الموجودة في المكتبة (مورد EXAM رسمي منشور) في سجلّ المعالجة PENDING.
 * الافتراضي: الرياضيات 3AS (مجال المرحلة 1). idempotent: المورد المسجَّل لا يُكرَّر.
 */
export async function registerBacDocuments(db: Db, actor: Actor, input: RegisterInput = {}): Promise<{ registered: number; candidates: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  const [subject] = await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, input.subjectCode ?? 'MATH')).limit(1)
  const [level] = await db.select({ id: levels.id }).from(levels).where(eq(levels.code, input.levelCode ?? '3AS')).limit(1)
  if (!subject || !level) throw new AppError('NOT_FOUND')
  const [stream] = input.streamCode ? await db.select({ id: streams.id }).from(streams).where(eq(streams.code, input.streamCode)).limit(1) : []
  const limit = Math.max(1, Math.min(2000, input.limit ?? 500))
  const rows = await db
    .select()
    .from(resources)
    .where(
      and(
        isNull(resources.deletedAt),
        eq(resources.type, 'EXAM'),
        eq(resources.isOfficial, true),
        eq(resources.status, 'PUBLISHED'),
        eq(resources.subjectId, subject.id),
        eq(resources.levelId, level.id),
        stream ? eq(resources.streamId, stream.id) : undefined,
        sql`not exists (select 1 from exam_documents d where d.resource_id = ${resources.id})`
      )
    )
    .orderBy(desc(resources.examYear), asc(resources.createdAt))
    .limit(limit)
  let registered = 0
  for (const r of rows) {
    const [row] = await db
      .insert(examDocuments)
      .values({ resourceId: r.id, solutionResourceId: r.solutionResourceId, title: r.title, docType: 'BAC', subjectId: r.subjectId, levelId: r.levelId, streamId: r.streamId, examYear: r.examYear, examSession: r.examSession, sourceId: r.sourceId, sourceUrl: r.sourceUrl, status: 'PENDING', metadata: { fileUrl: r.fileUrl, importedAt: new Date().toISOString(), originalAuthor: r.originalAuthor } })
      .onConflictDoNothing()
      .returning({ id: examDocuments.id })
    if (row) registered++
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.documents.register', entityType: 'exam_document', entityId: null, newValue: { registered, candidates: rows.length } })
  return { registered, candidates: rows.length }
}

/* ───────────────────────────── طلب المعالجة ───────────────────────────── */

export async function requestProcessing(db: Db, actor: Actor, input: { documentIds?: string[]; limit?: number } = {}): Promise<{ jobId: string; count: number; reused: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!aiProviderInfo().configured) throw new AppError('AI_UNAVAILABLE')
  const pending = await pendingJobOfType(db, 'EXAM_DOC_PROCESS', null)
  if (pending && !(await failStaleJob(db, pending, STALE_AFTER_MS))) return { jobId: pending.id, count: pending.totalItems ?? 0, reused: true }
  let ids: string[]
  if (input.documentIds?.length) {
    input.documentIds.forEach((id) => assertUuid(id, 'NOT_FOUND'))
    ids = (await db.select({ id: examDocuments.id }).from(examDocuments).where(inArray(examDocuments.id, input.documentIds))).map((d) => d.id)
  } else {
    const limit = Math.max(1, Math.min(200, input.limit ?? 20))
    ids = (await db.select({ id: examDocuments.id }).from(examDocuments).where(eq(examDocuments.status, 'PENDING')).orderBy(desc(examDocuments.examYear), asc(examDocuments.createdAt)).limit(limit)).map((d) => d.id)
  }
  if (ids.length === 0) throw new AppError('VALIDATION', { field: 'documents', reason: 'nothing_pending' })
  await db.update(examDocuments).set({ status: 'PENDING', error: null, updatedAt: new Date() }).where(and(inArray(examDocuments.id, ids), sql`${examDocuments.status} <> 'PROCESSING'`))
  const job = await enqueueJob(db, { type: 'EXAM_DOC_PROCESS', payload: { documentIds: ids, userId: actor.userId }, workspaceId: null, maxAttempts: 1 })
  await updateJobProgress(db, job.id, { totalItems: ids.length })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.documents.process', entityType: 'job', entityId: job.id, newValue: { count: ids.length } })
  return { jobId: job.id, count: ids.length, reused: false }
}

export interface ProcessOpts {
  userId: string
  fetch?: typeof fetch
  provider?: AIProvider
}

/** المهمة الخلفية: وثيقة تلو الأخرى؛ فشل واحدة لا يوقف البقية */
export async function runProcessDocumentsJob(db: Db, job: JobRow, opts: { fetch?: typeof fetch } = {}): Promise<Record<string, unknown>> {
  const ids = Array.isArray(job.payload.documentIds) ? job.payload.documentIds.map(String) : []
  const userId = String(job.payload.userId ?? '')
  assertUuid(userId, 'NOT_FOUND')
  const summary = { processed: 0, needsReview: 0, failed: 0, exercises: 0 }
  const logs: string[] = []
  for (const id of ids) {
    const r = await processDocument(db, id, { userId, fetch: opts.fetch })
    summary.processed++
    if (r.status === 'NEEDS_REVIEW') {
      summary.needsReview++
      summary.exercises += r.exercises
    } else summary.failed++
    logs.push(`${r.title}: ${r.status === 'NEEDS_REVIEW' ? `${r.exercises} تمريناً` : `فشل — ${r.error ?? ''}`}`)
    await updateJobProgress(db, job.id, { totalItems: ids.length, processedItems: summary.processed, failedItems: summary.failed, logs, progress: { last: r.title } })
  }
  await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title: 'انتهت معالجة وثائق محرّك الامتحانات', body: `${summary.needsReview} وثيقة بانتظار المراجعة (${summary.exercises} تمريناً)${summary.failed ? `، ${summary.failed} فشلت` : ''}.`, link: '/admin/exam-engine' })
  return summary
}

/* ───────────────────────────── المعالجة ───────────────────────────── */

const MIME_BY_HEADER = (ct: string | null, url: string): string => {
  const c = (ct ?? '').toLowerCase()
  if (c.includes('pdf') || /\.pdf(\?|$)/i.test(url)) return 'application/pdf'
  if (c.startsWith('text/plain')) return 'text/plain'
  if (c.includes('wordprocessingml')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  return c.split(';')[0] || 'application/octet-stream'
}

/** ينزّل ملف الوثيقة من مصدره ويخزّنه محلياً (مرة واحدة) ويعيد معرّفه */
async function storeRemote(db: Db, input: { url: string; name: string; userId: string; fetch?: typeof fetch }): Promise<{ id: string; mimeType: string }> {
  const doFetch = input.fetch ?? fetch
  const res = await doFetch(input.url, { headers: { 'user-agent': 'MadrasadzExamEngine/1.0 (+https://madrasadz.com)', accept: 'application/pdf,*/*' }, redirect: 'follow' }).catch((e: unknown) => {
    throw new DocError('download_failed', `تعذّر التنزيل: ${e instanceof Error ? e.message : String(e)}`)
  })
  if (!res.ok) throw new DocError('download_failed', `المصدر ردّ ${res.status}`)
  const mime = MIME_BY_HEADER(res.headers.get('content-type'), input.url)
  if (mime.startsWith('text/html')) throw new DocError('not_a_file', 'الرابط صفحة ويب لا ملفاً')
  const bytes = Buffer.from(await res.arrayBuffer())
  if (bytes.length === 0) throw new DocError('download_failed', 'ملف فارغ')
  if (bytes.length > MAX_REMOTE_BYTES) throw new DocError('too_large', 'الملف أكبر من الحدّ المسموح')
  const ext = mime === 'application/pdf' ? 'pdf' : mime === 'text/plain' ? 'txt' : 'bin'
  const key = newStorageKey(null, ext)
  await storage().put(key, bytes)
  const [row] = await db
    .insert(files)
    .values({ workspaceId: null, ownerUserId: input.userId, bucket: 'private', storageKey: key, originalName: `${input.name.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 180)}.${ext}`, mimeType: mime, sizeBytes: bytes.length, checksum: createHash('sha256').update(bytes).digest('hex') })
    .returning({ id: files.id, mimeType: files.mimeType })
  return row!
}

async function textOfFile(db: Db, fileId: string): Promise<string> {
  const [f] = await db.select().from(files).where(eq(files.id, fileId)).limit(1)
  if (!f) throw new DocError('file_missing', 'الملف المخزَّن غير موجود')
  return cachedText(`engine:${f.id}:${f.checksum ?? f.sizeBytes}`, async () => extractDocText(new Uint8Array(await storage().get(f.storageKey)), f.mimeType))
}

const ORDINALS: Record<string, number> = { الاول: 1, الثاني: 2, الثالث: 3, الرابع: 4, الخامس: 5, السادس: 6 }
const toLatinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

/** يقسّم نصّ التصحيح عند عناوين التمارين بترتيب ظهورها: التمرين i ← الجزء i */
export function splitSolutions(text: string): string[] {
  const t = toLatinDigits(text)
  const re = /(?:^|\n)\s*(?:حل\s+)?(?:التمرين|تمرين|Exercice|EXERCICE|Exercise)\s*(?:رقم\s*)?(?:ال[أا]ول|الثاني|الثالث|الرابع|الخامس|السادس|\d{1,2})\s*[:：.\-–)]?/gu
  const idx: number[] = []
  for (const m of t.matchAll(re)) idx.push(m.index!)
  if (idx.length === 0) return []
  const parts: string[] = []
  for (let i = 0; i < idx.length; i++) parts.push(t.slice(idx[i], idx[i + 1] ?? t.length).trim())
  return parts.filter((p) => p.length >= 10)
}

/** رقم الموضوع (الأول/الثاني) الذي ينتمي إليه مقطع في نصّ بكالوريا بموضوعين */
export function topicNoOf(fullText: string, body: string, title: string | null): number | null {
  const n = normalizeArabic(`${title ?? ''} ${body.slice(0, 200)}`)
  const m = /الموضوع (الاول|الثاني)/.exec(n)
  if (m) return ORDINALS[m[1]!] ?? null
  const full = normalizeArabic(fullText)
  const second = full.indexOf('الموضوع الثاني')
  if (second < 0) return null
  const probe = normalizeArabic(body).slice(0, 60)
  const at = probe.length >= 20 ? full.indexOf(probe) : -1
  if (at < 0) return null
  return at > second ? 2 : 1
}

/* ───────────────────────────── الربط بالمنهاج ───────────────────────────── */

interface NodeRef {
  id: string
  parentId: string | null
  kind: string
  title: string
  slug: string
  /** كلمة مطبَّعة ووزنها (الكلمات العامة الموسومة بـ ~ وزنها منخفض) */
  keywords: { text: string; weight: number }[]
}

/** عقد المادة/الصف/الشعبة مع كلمات مفاتيحها (من بيانات الزرع بالرمز؛ وإلا من العنوان) */
export async function nodesForMapping(db: Db, scope: { subjectId: string | null; levelId: string | null; streamId: string | null }): Promise<NodeRef[]> {
  if (!scope.subjectId || !scope.levelId) return []
  const rows = await db
    .select({ id: curriculumNodes.id, parentId: curriculumNodes.parentId, kind: curriculumNodes.kind, title: curriculumNodes.title, slug: curriculumNodes.slug })
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.subjectId, scope.subjectId), eq(curriculumNodes.levelId, scope.levelId), scope.streamId ? or(isNull(curriculumNodes.streamId), eq(curriculumNodes.streamId, scope.streamId)) : isNull(curriculumNodes.streamId)))
    .orderBy(asc(curriculumNodes.sortOrder))
  const kw = new Map<string, string[]>()
  for (const tree of CURRICULUM_TREES) for (const u of tree.units) {
    kw.set(u.slug, u.keywords)
    for (const l of u.lessons ?? []) kw.set(l.slug, l.keywords ?? [])
  }
  return rows.map((r) => {
    const seen = new Set<string>()
    const keywords: NodeRef['keywords'] = []
    for (const raw of [...(kw.get(r.slug) ?? []), r.title]) {
      const weak = raw.startsWith('~')
      const text = normalizeArabic(weak ? raw.slice(1) : raw)
      if (!text || seen.has(text)) continue
      seen.add(text)
      keywords.push({ text, weight: weak ? 0.3 : text.length >= 6 ? 2 : 1 })
    }
    return { ...r, keywords }
  })
}

const count = (hay: string, needle: string): number => {
  if (!needle) return 0
  // الكلمات اللاتينية القصيرة (ln, exp) تُطابَق ككلمات كاملة فقط
  const short = /^[a-z0-9_^'()]{1,4}$/i.test(needle)
  if (short) return (hay.match(new RegExp(`(?:^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s|$)`, 'g')) ?? []).length
  return hay.split(needle).length - 1
}

/** يختار المحور ثم الدرس الأقرب للتمرين بكلمات المحاور؛ الثقة = حصة الأفضل من مجموع النقاط */
export function classifyExercise(q: Pick<ExtractedQuestion, 'title' | 'body' | 'topic' | 'keywords'> & { children?: { body: string }[] }, nodes: NodeRef[]): { nodeId: string | null; confidence: number | null } {
  if (nodes.length === 0) return { nodeId: null, confidence: null }
  const hay = normalizeArabic([q.title ?? '', q.body, q.topic ?? '', ...q.keywords, ...(q.children ?? []).map((c) => c.body)].join(' '))
  const topic = normalizeArabic(q.topic ?? '')
  const score = (n: NodeRef) => n.keywords.reduce((a, k) => a + count(hay, k.text) * k.weight, 0) + (topic && normalizeArabic(n.title).includes(topic) ? 8 : 0)
  const scores = new Map(nodes.map((n) => [n.id, score(n)]))
  const units = nodes.filter((n) => !n.parentId)
  const unitTotal = (u: NodeRef) => (scores.get(u.id) ?? 0) + nodes.filter((n) => n.parentId === u.id).reduce((a, n) => a + (scores.get(n.id) ?? 0), 0)
  const ranked = units.map((u) => ({ u, s: unitTotal(u) })).sort((a, b) => b.s - a.s)
  const best = ranked[0]
  if (!best || best.s <= 0) return { nodeId: null, confidence: null }
  const total = ranked.reduce((a, x) => a + x.s, 0)
  const confidence = Math.round(Math.min(0.99, Math.max(0.2, best.s / total) * (best.s >= 3 ? 1 : 0.7)) * 1000) / 1000
  const lessons = nodes.filter((n) => n.parentId === best.u.id).map((l) => ({ l, s: scores.get(l.id) ?? 0 })).sort((a, b) => b.s - a.s)
  const lesson = lessons[0]
  return { nodeId: lesson && lesson.s > 0 ? lesson.l.id : best.u.id, confidence }
}

/* ───────────────────────────── معالجة وثيقة واحدة ───────────────────────────── */

export interface ProcessResult {
  id: string
  title: string
  status: ExamDocStatus
  exercises: number
  duplicates: number
  error: string | null
}

export async function processDocument(db: Db, documentId: string, opts: ProcessOpts): Promise<ProcessResult> {
  const [doc] = await db.select().from(examDocuments).where(eq(examDocuments.id, documentId)).limit(1)
  if (!doc) return { id: documentId, title: '?', status: 'FAILED', exercises: 0, duplicates: 0, error: 'missing' }
  await db.update(examDocuments).set({ status: 'PROCESSING', error: null, attempts: doc.attempts + 1, updatedAt: new Date() }).where(eq(examDocuments.id, doc.id))
  try {
    const [resource] = doc.resourceId ? await db.select().from(resources).where(eq(resources.id, doc.resourceId)).limit(1) : []
    const fileUrl = resource?.fileUrl ?? (typeof doc.metadata.fileUrl === 'string' ? doc.metadata.fileUrl : null)
    if (!doc.fileId && !fileUrl) throw new DocError('no_file', 'لا رابط ملف للموضوع عند المصدر')
    let fileId = doc.fileId
    if (!fileId) {
      fileId = (await storeRemote(db, { url: fileUrl!, name: doc.title, userId: opts.userId, fetch: opts.fetch })).id
      await db.update(examDocuments).set({ fileId }).where(eq(examDocuments.id, doc.id))
    }
    const text = await textOfFile(db, fileId)
    if (text.length < MIN_TEXT_CHARS) throw new DocError('scanned', 'الملف مصوّر أو بلا نصّ قابل للقراءة (OCR في مرحلة لاحقة)')

    // التصحيح (إن وُجد): فشله لا يوقف الموضوع
    let solutionText = ''
    const [sol] = doc.solutionResourceId ? await db.select().from(resources).where(eq(resources.id, doc.solutionResourceId)).limit(1) : []
    if (doc.solutionFileId || sol?.fileUrl) {
      try {
        let solId = doc.solutionFileId
        if (!solId) {
          solId = (await storeRemote(db, { url: sol!.fileUrl!, name: `${doc.title} — التصحيح`, userId: opts.userId, fetch: opts.fetch })).id
          await db.update(examDocuments).set({ solutionFileId: solId }).where(eq(examDocuments.id, doc.id))
        }
        solutionText = await textOfFile(db, solId)
      } catch (e) {
        solutionText = ''
        await db.update(examDocuments).set({ metadata: { ...doc.metadata, solutionError: e instanceof Error ? e.message : String(e) } }).where(eq(examDocuments.id, doc.id))
      }
    }

    const provider = opts.provider ?? getAiProvider()
    if (!provider.extractQuestions) throw new DocError('ai_unavailable', 'الذكاء الاصطناعي غير مضبوط')
    const [subject] = doc.subjectId ? await db.select({ n: subjects.nameAr }).from(subjects).where(eq(subjects.id, doc.subjectId)).limit(1) : []
    const [level] = doc.levelId ? await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, doc.levelId)).limit(1) : []
    const [stream] = doc.streamId ? await db.select({ n: streams.nameAr }).from(streams).where(eq(streams.id, doc.streamId)).limit(1) : []
    const extracted: ExtractedQuestion[] = []
    await withAiTask({ task: 'exam_doc_extract', userId: opts.userId, entityType: 'exam_document', entityId: doc.id }, async () => {
      for (let i = 0; i < text.length && i < EXTRACT_CHUNK * 6; i += EXTRACT_CHUNK) {
        const out = await provider.extractQuestions!({ subject: subject?.n ?? null, levelName: level?.n ?? null, fileTitle: doc.title, text: text.slice(i, i + EXTRACT_CHUNK) })
        extracted.push(...out.questions)
      }
    })
    if (extracted.length === 0) throw new DocError('no_exercises', 'لم يُستخرج أي تمرين من النصّ')

    const solutions = splitSolutions(solutionText)
    const nodes = await nodesForMapping(db, { subjectId: doc.subjectId, levelId: doc.levelId, streamId: doc.streamId })
    // إعادة المعالجة: ما لم يُراجَع بعد من المرة السابقة يُستبدل؛ المنشور يبقى
    await db.update(bankQuestions).set({ deletedAt: new Date() }).where(and(eq(bankQuestions.documentId, doc.id), eq(bankQuestions.status, 'NEEDS_REVIEW'), isNull(bankQuestions.deletedAt)))
    const existing = new Set((await db.select({ h: bankQuestions.contentHash }).from(bankQuestions).where(and(isNull(bankQuestions.workspaceId), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId)))).map((x) => x.h).filter((h): h is string => Boolean(h)))
    const sourceLabel = [DOC_TYPE_AR[doc.docType as ExamDocType] ?? doc.docType, doc.examYear ? String(doc.examYear) : null, stream?.n ? `شعبة ${stream.n}` : null, doc.examSession === 'MAKEUP' ? 'الدورة الاستدراكية' : null].filter(Boolean).join(' — ')
    const batchId = randomUUID()
    let inserted = 0
    let duplicates = 0
    for (const [i, q] of extracted.entries()) {
      const hash = contentHashOf(q.body)
      if (existing.has(hash)) {
        duplicates++
        continue
      }
      existing.add(hash)
      const cls = classifyExercise(q, nodes)
      const solution = q.solution ?? solutions[i] ?? null
      const common = (x: Omit<ExtractedQuestion, 'children'>, parentId: string | null, order: number, sol: string | null) => ({
        workspaceId: null,
        authorUserId: opts.userId,
        parentId,
        kind: parentId ? x.kind : x.kind === 'QUESTION' && q.children.length ? 'EXERCISE' : x.kind,
        type: x.type,
        title: x.title,
        body: x.body,
        options: x.options,
        answerKey: x.answerKey,
        solution: sol,
        points: String(x.points && x.points > 0 ? x.points : parentId ? 1 : 4),
        difficulty: x.difficulty,
        estimatedMinutes: x.estimatedMinutes,
        subjectId: doc.subjectId,
        levelId: doc.levelId,
        streamId: doc.streamId,
        curriculumNodeId: parentId ? null : cls.nodeId,
        schoolTerm: doc.schoolTerm,
        examKind: doc.docType === 'BAC' || doc.docType === 'BEM' || doc.docType === 'TEST' || doc.docType === 'HOMEWORK' ? doc.docType : 'OTHER',
        sourceId: doc.sourceId,
        sourceResourceId: doc.resourceId,
        sourceYear: doc.examYear,
        sourceLabel,
        originalFileId: fileId,
        rightsStatus: 'LICENSED' as const,
        origin: 'SOURCED' as const,
        documentId: doc.id,
        sourceExerciseNo: i + 1,
        sourceTopicNo: topicNoOf(text, q.body, q.title),
        aiConfidence: parentId || cls.confidence == null ? null : String(cls.confidence),
        keywords: [...new Set([...x.keywords, ...(x.topic ? [x.topic] : [])])].slice(0, 12),
        visibility: 'PUBLIC' as const,
        status: 'NEEDS_REVIEW' as const,
        importBatchId: batchId,
        contentHash: contentHashOf(x.body),
        searchText: searchTextOf({ title: x.title, body: x.body, solution: sol, keywords: x.keywords, sourceLabel }),
        sortOrder: order
      })
      const [root] = await db.insert(bankQuestions).values(common(q, null, i, solution)).returning({ id: bankQuestions.id })
      inserted++
      for (const [j, c] of q.children.entries()) await db.insert(bankQuestions).values(common(c, root!.id, j, c.solution))
    }
    const cost = recentAiUsage().filter((u) => u.entityId === doc.id).reduce((a, u) => a + u.costUsd, 0)
    await db
      .update(examDocuments)
      .set({ status: 'NEEDS_REVIEW', error: null, textChars: text.length, exercisesCount: inserted, duplicatesCount: duplicates, aiCostUsd: String(Number(doc.aiCostUsd) + cost), processedAt: new Date(), updatedAt: new Date(), metadata: { ...doc.metadata, solutionChars: solutionText.length, solutionParts: solutions.length, batchId } })
      .where(eq(examDocuments.id, doc.id))
    return { id: doc.id, title: doc.title, status: 'NEEDS_REVIEW', exercises: inserted, duplicates, error: null }
  } catch (e) {
    const code = e instanceof DocError ? e.code : 'error'
    const message = e instanceof DocError ? e.message : aiFailureReason(e)
    await db.update(examDocuments).set({ status: 'FAILED', error: `${code}: ${message}`.slice(0, 500), processedAt: new Date(), updatedAt: new Date() }).where(eq(examDocuments.id, doc.id))
    return { id: doc.id, title: doc.title, status: 'FAILED', exercises: 0, duplicates: 0, error: `${code}: ${message}` }
  }
}

/* ───────────────────────────── المراجعة ───────────────────────────── */

async function ownDoc(db: Db, actor: Actor, id: string): Promise<ExamDocumentRow> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'NOT_FOUND')
  const [doc] = await db.select().from(examDocuments).where(eq(examDocuments.id, id)).limit(1)
  if (!doc) throw new AppError('NOT_FOUND')
  return doc
}

/** اعتماد الوثيقة: كل تمارينها الصالحة بانتظار المراجعة تُنشر عامة في البنك المركزي */
export async function approveDocument(db: Db, actor: Actor, id: string): Promise<{ approved: number }> {
  const doc = await ownDoc(db, actor, id)
  const ids = (await db.select({ id: bankQuestions.id }).from(bankQuestions).where(and(eq(bankQuestions.documentId, doc.id), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'NEEDS_REVIEW'), isNull(bankQuestions.deletedAt)))).map((x) => x.id)
  const r = await approveReviewed(db, actor, ids)
  await db.update(examDocuments).set({ status: 'PUBLISHED', reviewedByUserId: actor.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(examDocuments.id, doc.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.document.approve', entityType: 'exam_document', entityId: doc.id, newValue: { approved: r.approved } })
  return r
}

/** رفض: ما لم يُنشر بعد يُحذف (ناعماً) وتُعلَّم الوثيقة فاشلة بسبب الرفض؛ يمكن إعادة معالجتها */
export async function rejectDocument(db: Db, actor: Actor, id: string, reason?: string | null): Promise<void> {
  const doc = await ownDoc(db, actor, id)
  await db.update(bankQuestions).set({ deletedAt: new Date() }).where(and(eq(bankQuestions.documentId, doc.id), eq(bankQuestions.status, 'NEEDS_REVIEW'), isNull(bankQuestions.deletedAt)))
  await db.update(examDocuments).set({ status: 'FAILED', error: `rejected: ${reason?.trim() || 'رفضها المشرف'}`.slice(0, 500), exercisesCount: 0, reviewedByUserId: actor.userId, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(examDocuments.id, doc.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.document.reject', entityType: 'exam_document', entityId: doc.id, newValue: { reason: reason ?? null } })
}

export async function reprocessDocument(db: Db, actor: Actor, id: string): Promise<{ jobId: string; reused: boolean }> {
  const doc = await ownDoc(db, actor, id)
  if (doc.status === 'PROCESSING') throw new AppError('VALIDATION', { field: 'status' })
  await db.update(examDocuments).set({ status: 'PENDING', error: null, updatedAt: new Date() }).where(eq(examDocuments.id, doc.id))
  const r = await requestProcessing(db, actor, { documentIds: [doc.id] })
  return { jobId: r.jobId, reused: r.reused }
}

/* ───────────────────────────── لوحة الإدارة ───────────────────────────── */

export interface EngineStats {
  docs: Record<ExamDocStatus, number>
  questions: { total: number; byOrigin: Record<string, number>; review: number; unclassified: number; lowConfidence: number; published: number }
  queue: { pending: boolean; jobId: string | null; processed: number; total: number; lastError: string | null; lastFinishedAt: Date | null }
  ai: { configured: boolean; calls: number; failed: number; costUsd: number; inputTokens: number; outputTokens: number }
  archive: { registered: number; candidates: number }
}

export async function engineStats(db: Db, actor: Actor): Promise<EngineStats> {
  assertRole(actor, 'SUPER_ADMIN')
  const central = and(isNull(bankQuestions.workspaceId), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId))
  const [byStatus, byOrigin, [flags], pending, last, usage, [cands], [reg]] = await Promise.all([
    db.select({ s: examDocuments.status, n: sql<number>`count(*)::int` }).from(examDocuments).groupBy(examDocuments.status),
    db.select({ o: bankQuestions.origin, n: sql<number>`count(*)::int` }).from(bankQuestions).where(central).groupBy(bankQuestions.origin),
    db
      .select({
        total: sql<number>`count(*)::int`,
        review: sql<number>`count(*) filter (where ${bankQuestions.status} = 'NEEDS_REVIEW')::int`,
        published: sql<number>`count(*) filter (where ${bankQuestions.status} = 'PUBLISHED')::int`,
        unclassified: sql<number>`count(*) filter (where ${bankQuestions.documentId} is not null and ${bankQuestions.curriculumNodeId} is null and ${bankQuestions.status} <> 'ARCHIVED')::int`,
        lowConfidence: sql<number>`count(*) filter (where ${bankQuestions.aiConfidence} is not null and ${bankQuestions.aiConfidence} < 0.5 and ${bankQuestions.status} <> 'ARCHIVED')::int`
      })
      .from(bankQuestions)
      .where(central),
    pendingJobOfType(db, 'EXAM_DOC_PROCESS', null),
    latestJobOfType(db, 'EXAM_DOC_PROCESS', null),
    aiUsageSummary(db, actor, 30),
    db.select({ n: sql<number>`count(*)::int` }).from(resources).where(and(isNull(resources.deletedAt), eq(resources.type, 'EXAM'), eq(resources.isOfficial, true), eq(resources.status, 'PUBLISHED'), sql`not exists (select 1 from exam_documents d where d.resource_id = ${resources.id})`)),
    db.select({ n: sql<number>`count(*)::int` }).from(examDocuments)
  ])
  const docs = { PENDING: 0, PROCESSING: 0, NEEDS_REVIEW: 0, PUBLISHED: 0, FAILED: 0 } as Record<ExamDocStatus, number>
  for (const x of byStatus) docs[x.s as ExamDocStatus] = x.n
  return {
    docs,
    questions: { total: flags?.total ?? 0, byOrigin: Object.fromEntries(byOrigin.map((x) => [x.o, x.n])), review: flags?.review ?? 0, unclassified: flags?.unclassified ?? 0, lowConfidence: flags?.lowConfidence ?? 0, published: flags?.published ?? 0 },
    queue: { pending: Boolean(pending), jobId: pending?.id ?? last?.id ?? null, processed: (pending ?? last)?.processedItems ?? 0, total: (pending ?? last)?.totalItems ?? 0, lastError: last?.error ?? null, lastFinishedAt: last?.finishedAt ?? null },
    ai: { configured: aiProviderInfo().configured, calls: usage.calls, failed: usage.failed, costUsd: usage.costUsd, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens },
    archive: { registered: reg?.n ?? 0, candidates: cands?.n ?? 0 }
  }
}

export interface DocumentListItem extends ExamDocumentRow {
  subjectName: string | null
  levelName: string | null
  streamName: string | null
  sourceName: string | null
  review: number
  published: number
}

export async function listDocuments(db: Db, actor: Actor, f: { status?: ExamDocStatus | null; subjectId?: string | null; q?: string | null } = {}, limit = 100): Promise<DocumentListItem[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({
      d: examDocuments,
      subjectName: subjects.nameAr,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      sourceName: contentSources.name,
      review: sql<number>`(select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.status = 'NEEDS_REVIEW')`,
      published: sql<number>`(select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.status = 'PUBLISHED')`
    })
    .from(examDocuments)
    .leftJoin(subjects, eq(subjects.id, examDocuments.subjectId))
    .leftJoin(levels, eq(levels.id, examDocuments.levelId))
    .leftJoin(streams, eq(streams.id, examDocuments.streamId))
    .leftJoin(contentSources, eq(contentSources.id, examDocuments.sourceId))
    .where(and(f.status ? eq(examDocuments.status, f.status) : undefined, f.subjectId ? eq(examDocuments.subjectId, f.subjectId) : undefined, f.q?.trim() ? sql`${examDocuments.title} ilike ${`%${f.q.trim().replace(/[%_\\]/g, '\\$&')}%`}` : undefined))
    .orderBy(desc(examDocuments.updatedAt))
    .limit(Math.max(1, Math.min(500, limit)))
  return rows.map((x) => ({ ...x.d, subjectName: x.subjectName, levelName: x.levelName, streamName: x.streamName, sourceName: x.sourceName, review: x.review, published: x.published }))
}

/* ───────────────────────────── تدرّج الأستاذ ───────────────────────────── */

export interface ProgressScope {
  subjectId: string
  levelId: string
  streamId?: string | null
}

const teacherWs = (actor: Actor): string => {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

/** «حدّد أين وصلت في البرنامج»: فارغ = بلا قيد */
export async function setTeacherProgress(db: Db, actor: Actor, scope: ProgressScope, nodeId: string | null): Promise<void> {
  const workspaceId = teacherWs(actor)
  assertUuid(scope.subjectId, 'VALIDATION')
  assertUuid(scope.levelId, 'VALIDATION')
  if (scope.streamId) assertUuid(scope.streamId, 'VALIDATION')
  if (nodeId) {
    assertUuid(nodeId, 'NOT_FOUND')
    const [n] = await db.select({ id: curriculumNodes.id }).from(curriculumNodes).where(and(eq(curriculumNodes.id, nodeId), eq(curriculumNodes.subjectId, scope.subjectId), eq(curriculumNodes.levelId, scope.levelId))).limit(1)
    if (!n) throw new AppError('NOT_FOUND')
  }
  await db
    .insert(teacherProgress)
    .values({ workspaceId, subjectId: scope.subjectId, levelId: scope.levelId, streamId: scope.streamId ?? null, nodeId, updatedByUserId: actor.userId })
    .onConflictDoUpdate({ target: [teacherProgress.workspaceId, teacherProgress.subjectId, teacherProgress.levelId, teacherProgress.streamId], set: { nodeId, updatedByUserId: actor.userId, updatedAt: new Date() } })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'exam.progress_set', entityType: 'teacher_progress', entityId: null, newValue: { subjectId: scope.subjectId, levelId: scope.levelId, streamId: scope.streamId ?? null, nodeId } })
}

export async function getTeacherProgress(db: Db, actor: Actor, scope: ProgressScope): Promise<{ nodeId: string | null; nodeTitle: string | null }> {
  const workspaceId = teacherWs(actor)
  const [row] = await db
    .select({ nodeId: teacherProgress.nodeId, title: curriculumNodes.title })
    .from(teacherProgress)
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, teacherProgress.nodeId))
    .where(and(eq(teacherProgress.workspaceId, workspaceId), eq(teacherProgress.subjectId, scope.subjectId), eq(teacherProgress.levelId, scope.levelId), scope.streamId ? eq(teacherProgress.streamId, scope.streamId) : isNull(teacherProgress.streamId)))
    .limit(1)
  return { nodeId: row?.nodeId ?? null, nodeTitle: row?.title ?? null }
}

/**
 * العقد المسموح بها حتى موضع التدرّج: كل المحاور السابقة (بفروعها) + المحور الحالي حتى الدرس المبلوغ.
 * null = لا قيد (لا تدرّج محدّد).
 */
export async function allowedNodeIds(db: Db, scope: ProgressScope, progressNodeId: string | null): Promise<Set<string> | null> {
  if (!progressNodeId) return null
  const rows = await db
    .select({ id: curriculumNodes.id, parentId: curriculumNodes.parentId, sortOrder: curriculumNodes.sortOrder })
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.subjectId, scope.subjectId), eq(curriculumNodes.levelId, scope.levelId), scope.streamId ? or(isNull(curriculumNodes.streamId), eq(curriculumNodes.streamId, scope.streamId)) : isNull(curriculumNodes.streamId)))
  const byId = new Map(rows.map((r) => [r.id, r]))
  const target = byId.get(progressNodeId)
  if (!target) return null
  // سلسلة الأسلاف من الهدف إلى الجذر
  const chain: typeof rows = []
  for (let cur: (typeof rows)[number] | undefined = target; cur; cur = cur.parentId ? byId.get(cur.parentId) : undefined) chain.unshift(cur)
  const allowed = new Set<string>()
  const addSubtree = (id: string) => {
    allowed.add(id)
    for (const r of rows) if (r.parentId === id) addSubtree(r.id)
  }
  // على كل مستوى من السلسلة: الإخوة السابقون كاملين، والأخ الحالي يُفتح إلى المستوى التالي
  for (const [depth, node] of chain.entries()) {
    const siblings = rows.filter((r) => r.parentId === node.parentId)
    for (const s of siblings) if (s.sortOrder < node.sortOrder || (s.sortOrder === node.sortOrder && s.id !== node.id && s.id < node.id)) addSubtree(s.id)
    allowed.add(node.id)
    if (depth === chain.length - 1) addSubtree(node.id)
  }
  return allowed
}

/* ───────────────────────────── الأرشيف العام ───────────────────────────── */

export interface ArchiveFilter {
  levelId?: string | null
  streamId?: string | null
  subjectId?: string | null
  year?: number | null
  type?: 'EXAM' | 'TEST' | 'HOMEWORK' | null
  session?: string | null
  q?: string | null
}

export interface ArchiveItem {
  id: string
  title: string
  type: string
  year: number | null
  session: string | null
  subjectName: string | null
  levelName: string | null
  streamName: string | null
  source: string | null
  sourceUrl: string | null
  fileUrl: string | null
  hasSolution: boolean
  solutionUrl: string | null
  official: boolean
  /** تمارين منشورة مستخرجة منها */
  exercises: number
  /** نسخة محلية قابلة للمعاينة داخل الموقع */
  localPreview: boolean
}

const ARCHIVE_TYPES = ['EXAM', 'TEST', 'HOMEWORK'] as const

/** «بنك البكالوريا والاختبارات»: المواضيع الرسمية المنشورة بمرشّحات الطور/السنة/الصف/الشعبة/المادة/النوع */
export async function listArchive(db: Db, f: ArchiveFilter = {}, page: { cursor?: string | null; limit?: number } = {}): Promise<{ items: ArchiveItem[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(60, page.limit ?? 24))
  const sol = db.$with('sol').as(db.select({ id: resources.id, url: resources.fileUrl }).from(resources).where(isNull(resources.deletedAt)))
  const where = [
    isNull(resources.deletedAt),
    eq(resources.status, 'PUBLISHED'),
    eq(resources.accessLevel, 'PUBLIC'),
    f.type ? eq(resources.type, f.type) : inArray(resources.type, [...ARCHIVE_TYPES]),
    f.levelId ? eq(resources.levelId, f.levelId) : undefined,
    f.streamId ? or(eq(resources.streamId, f.streamId), isNull(resources.streamId)) : undefined,
    f.subjectId ? eq(resources.subjectId, f.subjectId) : undefined,
    f.year ? eq(resources.examYear, f.year) : undefined,
    f.session ? eq(resources.examSession, f.session) : undefined,
    f.q?.trim() ? sql`${resources.title} ilike ${`%${f.q.trim().replace(/[%_\\]/g, '\\$&')}%`}` : undefined
  ]
  if (page.cursor) {
    const [y, id] = Buffer.from(page.cursor, 'base64url').toString().split('|')
    if (y && id) where.push(or(sql`coalesce(${resources.examYear}, 0) < ${Number(y)}`, and(sql`coalesce(${resources.examYear}, 0) = ${Number(y)}`, sql`${resources.id} < ${id}`)))
  }
  const rows = await db
    .with(sol)
    .select({
      r: resources,
      subjectName: subjects.nameAr,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      source: contentSources.name,
      solutionUrl: sol.url,
      docFileId: examDocuments.fileId,
      docId: examDocuments.id,
      exercises: sql<number>`coalesce((select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.status = 'PUBLISHED'), 0)`
    })
    .from(resources)
    .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .leftJoin(streams, eq(streams.id, resources.streamId))
    .leftJoin(sol, eq(sol.id, resources.solutionResourceId))
    .leftJoin(examDocuments, eq(examDocuments.resourceId, resources.id))
    .where(and(...where))
    .orderBy(desc(sql`coalesce(${resources.examYear}, 0)`), desc(resources.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit).map((x) => ({ id: x.r.id, title: x.r.title, type: x.r.type, year: x.r.examYear, session: x.r.examSession, subjectName: x.subjectName, levelName: x.levelName, streamName: x.streamName, source: x.source, sourceUrl: x.r.sourceUrl, fileUrl: x.r.fileUrl, hasSolution: x.r.hasSolution, solutionUrl: x.solutionUrl ?? null, official: x.r.isOfficial, exercises: x.exercises, localPreview: Boolean(x.docFileId) }))
  const last = rows[limit - 1]
  return { items, nextCursor: rows.length > limit && last ? Buffer.from(`${last.r.examYear ?? 0}|${last.r.id}`).toString('base64url') : null }
}

export interface ArchiveFacets {
  levels: { id: string; name: string; count: number }[]
  streams: { id: string; name: string; count: number }[]
  subjects: { id: string; name: string; count: number }[]
  years: { year: number; count: number }[]
  total: number
}

/** أعداد المرشّحات (ضمن ما اختير من المرشّحات الأخرى) */
export async function archiveFacets(db: Db, f: ArchiveFilter = {}): Promise<ArchiveFacets> {
  const base = (skip: keyof ArchiveFilter) =>
    and(
      isNull(resources.deletedAt),
      eq(resources.status, 'PUBLISHED'),
      eq(resources.accessLevel, 'PUBLIC'),
      f.type ? eq(resources.type, f.type) : inArray(resources.type, [...ARCHIVE_TYPES]),
      skip !== 'levelId' && f.levelId ? eq(resources.levelId, f.levelId) : undefined,
      skip !== 'streamId' && f.streamId ? or(eq(resources.streamId, f.streamId), isNull(resources.streamId)) : undefined,
      skip !== 'subjectId' && f.subjectId ? eq(resources.subjectId, f.subjectId) : undefined,
      skip !== 'year' && f.year ? eq(resources.examYear, f.year) : undefined
    )
  const [lv, st, su, yr, [tot]] = await Promise.all([
    db.select({ id: levels.id, name: levels.nameAr, count: sql<number>`count(*)::int` }).from(resources).innerJoin(levels, eq(levels.id, resources.levelId)).where(base('levelId')).groupBy(levels.id, levels.nameAr, levels.sortOrder).orderBy(asc(levels.sortOrder)),
    db.select({ id: streams.id, name: streams.nameAr, count: sql<number>`count(*)::int` }).from(resources).innerJoin(streams, eq(streams.id, resources.streamId)).where(base('streamId')).groupBy(streams.id, streams.nameAr, streams.sortOrder).orderBy(asc(streams.sortOrder)),
    db.select({ id: subjects.id, name: subjects.nameAr, count: sql<number>`count(*)::int` }).from(resources).innerJoin(subjects, eq(subjects.id, resources.subjectId)).where(base('subjectId')).groupBy(subjects.id, subjects.nameAr, subjects.sortOrder).orderBy(asc(subjects.sortOrder)),
    db.select({ year: resources.examYear, count: sql<number>`count(*)::int` }).from(resources).where(and(base('year'), sql`${resources.examYear} is not null`)).groupBy(resources.examYear).orderBy(desc(resources.examYear)),
    db.select({ n: sql<number>`count(*)::int` }).from(resources).where(base('q'))
  ])
  return { levels: lv, streams: st, subjects: su, years: yr.map((y) => ({ year: y.year!, count: y.count })), total: tot?.n ?? 0 }
}

export interface ArchiveDocument {
  resource: { id: string; title: string; type: string; year: number | null; session: string | null; sourceUrl: string | null; fileUrl: string | null; official: boolean; originalAuthor: string | null; createdAt: Date }
  subjectName: string | null
  levelName: string | null
  streamName: string | null
  source: { name: string; attribution: string; baseUrl: string | null } | null
  solution: { id: string; fileUrl: string | null; previewUrl: string | null } | null
  /** معاينة داخل الموقع (رابط موقّع للنسخة المحلية) */
  previewUrl: string | null
  document: { id: string; status: string; exercisesCount: number; processedAt: Date | null; review: number } | null
  exercises: { id: string; title: string | null; body: string; difficulty: number; points: number; nodeTitle: string | null; exerciseNo: number | null; topicNo: number | null; hasSolution: boolean; children: number; status: string }[]
}

/** صفحة وثيقة في الأرشيف: الموضوع، الحلّ، المعاينة، والتمارين المستخرجة منها (المنشورة؛ وللمشرف ما ينتظر المراجعة) */
export async function archiveDocument(db: Db, resourceId: string, viewer: { admin: boolean } = { admin: false }): Promise<ArchiveDocument> {
  assertUuid(resourceId, 'NOT_FOUND')
  const [x] = await db
    .select({ r: resources, subjectName: subjects.nameAr, levelName: levels.nameAr, streamName: streams.nameAr, source: { name: contentSources.name, attribution: contentSources.attribution, baseUrl: contentSources.baseUrl } })
    .from(resources)
    .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .leftJoin(streams, eq(streams.id, resources.streamId))
    .where(and(eq(resources.id, resourceId), isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.accessLevel, 'PUBLIC')))
    .limit(1)
  if (!x) throw new AppError('NOT_FOUND')
  const [doc] = await db.select().from(examDocuments).where(eq(examDocuments.resourceId, x.r.id)).limit(1)
  const [sol] = x.r.solutionResourceId ? await db.select({ id: resources.id, fileUrl: resources.fileUrl }).from(resources).where(eq(resources.id, x.r.solutionResourceId)).limit(1) : []
  const sign = (fileId: string | null) => {
    if (!fileId) return null
    try {
      return signFileUrl(fileId, 3600)
    } catch {
      return null
    }
  }
  const exRows = doc
    ? await db
        .select({ q: bankQuestions, nodeTitle: curriculumNodes.title, children: sql<number>`(select count(*)::int from bank_questions c where c.parent_id = ${bankQuestions.id} and c.deleted_at is null)` })
        .from(bankQuestions)
        .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
        .where(and(eq(bankQuestions.documentId, doc.id), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt), viewer.admin ? inArray(bankQuestions.status, ['PUBLISHED', 'NEEDS_REVIEW']) : and(eq(bankQuestions.status, 'PUBLISHED'), eq(bankQuestions.visibility, 'PUBLIC'))))
        .orderBy(asc(bankQuestions.sourceTopicNo), asc(bankQuestions.sourceExerciseNo), asc(bankQuestions.sortOrder))
    : []
  return {
    resource: { id: x.r.id, title: x.r.title, type: x.r.type, year: x.r.examYear, session: x.r.examSession, sourceUrl: x.r.sourceUrl, fileUrl: x.r.fileUrl, official: x.r.isOfficial, originalAuthor: x.r.originalAuthor, createdAt: x.r.createdAt },
    subjectName: x.subjectName,
    levelName: x.levelName,
    streamName: x.streamName,
    source: x.source,
    solution: sol ? { id: sol.id, fileUrl: sol.fileUrl, previewUrl: sign(doc?.solutionFileId ?? null) } : null,
    previewUrl: sign(doc?.fileId ?? null),
    document: doc ? { id: doc.id, status: doc.status, exercisesCount: doc.exercisesCount, processedAt: doc.processedAt, review: exRows.filter((e) => e.q.status === 'NEEDS_REVIEW').length } : null,
    exercises: exRows.map((e) => ({ id: e.q.id, title: e.q.title, body: e.q.body, difficulty: e.q.difficulty, points: Number(e.q.points), nodeTitle: e.nodeTitle, exerciseNo: e.q.sourceExerciseNo, topicNo: e.q.sourceTopicNo, hasSolution: Boolean(e.q.solution), children: e.children, status: e.q.status }))
  }
}

/** معرّف مورد الوثيقة الأصلية لسؤال (لزرّ «عرض الامتحان الأصلي») */
export async function originalResourceOf(db: Db, documentId: string | null): Promise<string | null> {
  if (!documentId) return null
  const [d] = await db.select({ resourceId: examDocuments.resourceId }).from(examDocuments).where(eq(examDocuments.id, documentId)).limit(1)
  return d?.resourceId ?? null
}
