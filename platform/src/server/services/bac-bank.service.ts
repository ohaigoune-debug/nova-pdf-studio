/**
 * بنك البكالوريا الجزائري الكامل — فوق محرّك الامتحانات:
 * الجرد (ما الموجود وما الناقص)، التسجيل الشامل لكل المواد والشعب، مراقبة الجودة والتوثيق قبل النشر،
 * الحلول المفصّلة (تُبنى مرة بالذكاء الاصطناعي وتُراجَع ثم تُقرأ من القاعدة)، البحث الذكي، وواجهة getExercises لمولّد الاختبارات.
 * القاعدة: AI BUILDS THE DATABASE ONCE. THE PLATFORM READS FROM THE DATABASE FOREVER.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { SCIENTIFIC_SUBJECTS, languageOfSubject, topicNumberOf } from '@/lib/bac-bank'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { DetailSolutionOutput } from '@/server/ai/types'
import { withAiTask } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { bankQuestions, curriculumNodes, examDocuments, levels, resources, streams, subjects, type BankQuestionRow, type DetailedSolution, type ExamDocumentRow, type QualityChecklist } from '@/server/db/schema'
import { enqueueJob, failStaleJob, latestJobOfType, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { normalizeArabic } from '@/server/lib/arabic'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { notify } from './notifications.service'
import { tsQueryOf } from './question-bank.service'

const STALE_AFTER_MS = 3 * 60 * 60_000

/* ───────────────────────────── المرحلة 1: الجرد ───────────────────────────── */

export interface InventoryCell {
  year: number
  streamCode: string | null
  streamName: string | null
  subjectCode: string | null
  subjectName: string | null
  topic: number | null
  session: string | null
  /** عدد المواضيع في المكتبة بهذا المفتاح (>1 = مكرّر محتمل) */
  resources: number
  hasPdf: boolean
  hasLocalPdf: boolean
  hasSolution: boolean
  analyzed: boolean
  classified: number
  exercises: number
  detailed: number
  status: string | null
  needsProcessing: boolean
  resourceId: string
  documentId: string | null
}

export interface BacInventory {
  totals: { exams: number; withSolution: number; registered: number; processed: number; verified: number; published: number; failed: number; scanned: number; exercises: number; classified: number; detailed: number; detailedVerified: number; pendingReview: number; duplicates: number; missingSolutions: number }
  /** نسبة الإنجاز: (موثَّقة+منشورة) / كل المواضيع */
  progress: number
  cells: InventoryCell[]
  /** السنة × المادة: عدد المواضيع */
  coverage: { subjectCode: string; subjectName: string; years: Record<number, number> }[]
  years: number[]
  /** سنوات غائبة لكل مادة (بين أقدم وأحدث سنة في البنك) */
  missingYears: { subjectCode: string; subjectName: string; years: number[] }[]
  duplicates: { key: string; count: number; ids: string[] }[]
  pdfDuplicates: { hash: string; ids: string[] }[]
  ocrErrors: { id: string; title: string; error: string | null }[]
}

/** جرد كامل لما في المكتبة: سنة × شعبة × مادة × موضوع، وما عُولج وما صُنّف وما ينقص */
export async function bacInventory(db: Db, actor: Actor): Promise<BacInventory> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({
      r: { id: resources.id, title: resources.title, examYear: resources.examYear, examSession: resources.examSession, fileUrl: resources.fileUrl, hasSolution: resources.hasSolution },
      subjectCode: subjects.code,
      subjectName: subjects.nameAr,
      streamCode: streams.code,
      streamName: streams.nameAr,
      d: { id: examDocuments.id, status: examDocuments.status, fileId: examDocuments.fileId, topicNumber: examDocuments.topicNumber, pdfHash: examDocuments.pdfHash, error: examDocuments.error, metadata: examDocuments.metadata },
      exercises: sql<number>`coalesce((select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.status in ('PUBLISHED','NEEDS_REVIEW')), 0)`,
      classified: sql<number>`coalesce((select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.curriculum_node_id is not null), 0)`,
      detailed: sql<number>`coalesce((select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and q.solution_detail is not null), 0)`,
      detailedVerified: sql<number>`coalesce((select count(*)::int from bank_questions q where q.document_id = ${examDocuments.id} and q.parent_id is null and q.deleted_at is null and (q.solution_detail->>'verified') = 'true'), 0)`
    })
    .from(resources)
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(streams, eq(streams.id, resources.streamId))
    .leftJoin(examDocuments, eq(examDocuments.resourceId, resources.id))
    .where(and(isNull(resources.deletedAt), eq(resources.type, 'EXAM'), eq(resources.isOfficial, true), inArray(resources.status, ['PUBLISHED', 'NEEDS_REVIEW'])))
    .orderBy(desc(resources.examYear), asc(subjects.sortOrder), asc(streams.sortOrder))
  const cells: InventoryCell[] = []
  const keyCount = new Map<string, string[]>()
  const hashIds = new Map<string, string[]>()
  const totals = { exams: 0, withSolution: 0, registered: 0, processed: 0, verified: 0, published: 0, failed: 0, scanned: 0, exercises: 0, classified: 0, detailed: 0, detailedVerified: 0, pendingReview: 0, duplicates: 0, missingSolutions: 0 }
  const ocrErrors: BacInventory['ocrErrors'] = []
  for (const x of rows) {
    const d = x.d ?? { id: null, status: null, fileId: null, topicNumber: null, pdfHash: null, error: null, metadata: {} as Record<string, unknown> }
    const topic = d.topicNumber ?? topicNumberOf(x.r.title)
    const key = [x.r.examYear ?? '?', x.r.examSession ?? 'NORMAL', x.streamCode ?? '?', x.subjectCode ?? '?', topic ?? '-'].join('|')
    keyCount.set(key, [...(keyCount.get(key) ?? []), x.r.id])
    if (d.pdfHash) hashIds.set(d.pdfHash, [...(hashIds.get(d.pdfHash) ?? []), x.r.id])
    const status = d.status ?? null
    totals.exams++
    if (x.r.hasSolution) totals.withSolution++
    else totals.missingSolutions++
    if (d.id) totals.registered++
    if (status === 'NEEDS_REVIEW' || status === 'VERIFIED' || status === 'PUBLISHED') totals.processed++
    if (status === 'VERIFIED') totals.verified++
    if (status === 'PUBLISHED') totals.published++
    if (status === 'NEEDS_REVIEW') totals.pendingReview++
    if (status === 'FAILED') {
      totals.failed++
      if (/scanned/.test(d.error ?? '') || d.metadata?.scanned === true) {
        totals.scanned++
        ocrErrors.push({ id: d.id!, title: x.r.title, error: d.error })
      }
    }
    totals.exercises += x.exercises
    totals.classified += x.classified
    totals.detailed += x.detailed
    totals.detailedVerified += x.detailedVerified
    cells.push({
      year: x.r.examYear ?? 0,
      streamCode: x.streamCode,
      streamName: x.streamName,
      subjectCode: x.subjectCode,
      subjectName: x.subjectName,
      topic,
      session: x.r.examSession,
      resources: 0,
      hasPdf: Boolean(x.r.fileUrl),
      hasLocalPdf: Boolean(d.fileId),
      hasSolution: x.r.hasSolution,
      analyzed: status === 'NEEDS_REVIEW' || status === 'VERIFIED' || status === 'PUBLISHED',
      classified: x.classified,
      exercises: x.exercises,
      detailed: x.detailed,
      status,
      needsProcessing: !d.id || status === 'PENDING' || status === 'FAILED',
      resourceId: x.r.id,
      documentId: d.id
    })
  }
  for (const c of cells) c.resources = keyCount.get([c.year || '?', c.session ?? 'NORMAL', c.streamCode ?? '?', c.subjectCode ?? '?', c.topic ?? '-'].join('|'))?.length ?? 1
  const duplicates = [...keyCount.entries()].filter(([, ids]) => ids.length > 1).map(([key, ids]) => ({ key, count: ids.length, ids }))
  const pdfDuplicates = [...hashIds.entries()].filter(([, ids]) => ids.length > 1).map(([hash, ids]) => ({ hash, ids }))
  totals.duplicates = duplicates.reduce((a, d) => a + d.count - 1, 0) + pdfDuplicates.reduce((a, d) => a + d.ids.length - 1, 0)
  // التغطية: المادة × السنة
  const bySubject = new Map<string, { subjectCode: string; subjectName: string; years: Record<number, number> }>()
  const yearSet = new Set<number>()
  for (const c of cells) {
    if (!c.subjectCode || !c.year) continue
    yearSet.add(c.year)
    const s = bySubject.get(c.subjectCode) ?? { subjectCode: c.subjectCode, subjectName: c.subjectName ?? c.subjectCode, years: {} }
    s.years[c.year] = (s.years[c.year] ?? 0) + 1
    bySubject.set(c.subjectCode, s)
  }
  const years = [...yearSet].sort((a, b) => b - a)
  const missingYears = [...bySubject.values()]
    .map((s) => {
      const ys = Object.keys(s.years).map(Number)
      const min = Math.min(...ys)
      const max = Math.max(...ys)
      const missing: number[] = []
      for (let y = min; y <= max; y++) if (!s.years[y]) missing.push(y)
      return { subjectCode: s.subjectCode, subjectName: s.subjectName, years: missing }
    })
    .filter((m) => m.years.length)
  const done = totals.verified + totals.published
  return { totals, progress: totals.exams ? Math.round((done / totals.exams) * 100) : 0, cells, coverage: [...bySubject.values()], years, missingYears, duplicates, pdfDuplicates, ocrErrors }
}

/** تقرير CSV للجرد (سنة، شعبة، مادة، موضوع، PDF، حلّ، محلَّل، مصنَّف، يحتاج معالجة) */
export function inventoryCsv(inv: BacInventory): string {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['السنة', 'الدورة', 'الشعبة', 'المادة', 'الموضوع', 'PDF', 'نسخة محلية', 'الحلّ', 'محلَّل', 'تمارين', 'مصنَّفة', 'حلول مفصّلة', 'الحالة', 'يحتاج معالجة', 'مكرّر', 'المورد']
  const lines = inv.cells.map((c) => [c.year || '', c.session ?? '', c.streamName ?? '', c.subjectName ?? '', c.topic ?? '', c.hasPdf ? 'نعم' : 'لا', c.hasLocalPdf ? 'نعم' : 'لا', c.hasSolution ? 'نعم' : 'لا', c.analyzed ? 'نعم' : 'لا', c.exercises, c.classified, c.detailed, c.status ?? 'غير مسجَّل', c.needsProcessing ? 'نعم' : 'لا', c.resources > 1 ? 'نعم' : '', c.resourceId].map(esc).join(','))
  return '﻿' + [head.map(esc).join(','), ...lines].join('\n')
}

/* ───────────────────────────── المرحلة 3: التسجيل الشامل ───────────────────────────── */

/** يسجّل كل مواضيع البكالوريا الرسمية في المكتبة (كل المواد والشعب) دفعةً دفعة؛ لا يكرّر المسجَّل */
export async function registerAllBacDocuments(db: Db, actor: Actor, input: { limit?: number; subjectCode?: string | null } = {}): Promise<{ registered: number; candidates: number; bySubject: Record<string, number> }> {
  assertRole(actor, 'SUPER_ADMIN')
  const limit = Math.max(1, Math.min(5000, input.limit ?? 1000))
  const rows = await db
    .select({ r: resources, subjectCode: subjects.code })
    .from(resources)
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .where(and(isNull(resources.deletedAt), eq(resources.type, 'EXAM'), eq(resources.isOfficial, true), eq(resources.status, 'PUBLISHED'), isNotNull(resources.subjectId), input.subjectCode ? eq(subjects.code, input.subjectCode) : undefined, sql`not exists (select 1 from exam_documents d where d.resource_id = ${resources.id})`))
    .orderBy(desc(resources.examYear), asc(resources.createdAt))
    .limit(limit)
  let registered = 0
  const bySubject: Record<string, number> = {}
  for (const { r, subjectCode } of rows) {
    const [row] = await db
      .insert(examDocuments)
      .values({ resourceId: r.id, solutionResourceId: r.solutionResourceId, title: r.title, docType: 'BAC', subjectId: r.subjectId, levelId: r.levelId, streamId: r.streamId, examYear: r.examYear, examSession: r.examSession, topicNumber: topicNumberOf(r.title), language: languageOfSubject(subjectCode), sourceId: r.sourceId, sourceUrl: r.sourceUrl, status: 'PENDING', metadata: { fileUrl: r.fileUrl, importedAt: new Date().toISOString(), originalAuthor: r.originalAuthor } })
      .onConflictDoNothing()
      .returning({ id: examDocuments.id })
    if (row) {
      registered++
      bySubject[subjectCode ?? '?'] = (bySubject[subjectCode ?? '?'] ?? 0) + 1
    }
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.documents.register', entityType: 'exam_document', entityId: null, newValue: { registered, candidates: rows.length, all: true } })
  return { registered, candidates: rows.length, bySubject }
}

/* ───────────────────────────── مراقبة الجودة والتوثيق ───────────────────────────── */

const QC_KEYS: (keyof QualityChecklist)[] = ['year', 'subject', 'stream', 'topic', 'pages', 'questions', 'numbers', 'equations', 'figures', 'bareme', 'solution', 'complete', 'notDuplicate']

/** ما يمكن استنتاجه آلياً من قائمة الفحص (السنة/المادة/الشعبة/الصفحات/التمارين/الحلّ/التكرار) */
export async function autoQuality(db: Db, doc: ExamDocumentRow): Promise<QualityChecklist> {
  const [ex] = await db.select({ n: sql<number>`count(*)::int`, sol: sql<number>`count(*) filter (where ${bankQuestions.solution} is not null)::int` }).from(bankQuestions).where(and(eq(bankQuestions.documentId, doc.id), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt), sql`${bankQuestions.status} <> 'ARCHIVED'`))
  const dup = doc.pdfHash ? await db.select({ id: examDocuments.id }).from(examDocuments).where(and(eq(examDocuments.pdfHash, doc.pdfHash), sql`${examDocuments.id} <> ${doc.id}`)).limit(1) : []
  return {
    year: Boolean(doc.examYear),
    subject: Boolean(doc.subjectId),
    stream: Boolean(doc.streamId),
    pages: Boolean(doc.pagesCount && doc.pagesCount > 0),
    questions: (ex?.n ?? 0) > 0,
    solution: (ex?.sol ?? 0) > 0 && (ex?.sol ?? 0) >= (ex?.n ?? 0),
    notDuplicate: dup.length === 0
  }
}

/** توثيق وثيقة بعد الفحص (الآلي + ما يؤكّده المشرف): NEEDS_REVIEW → VERIFIED؛ لا تُنشر للطلاب قبل الاعتماد */
export async function verifyDocument(db: Db, actor: Actor, id: string, checklist: QualityChecklist): Promise<{ quality: QualityChecklist; missing: string[] }> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(id, 'NOT_FOUND')
  const [doc] = await db.select().from(examDocuments).where(eq(examDocuments.id, id)).limit(1)
  if (!doc) throw new AppError('NOT_FOUND')
  if (doc.status !== 'NEEDS_REVIEW' && doc.status !== 'VERIFIED' && doc.status !== 'PUBLISHED') throw new AppError('VALIDATION', { field: 'status' })
  const auto = await autoQuality(db, doc)
  // البنود الآلية التي ثبتت صحّتها من البيانات لا يلغيها المشرف سهواً (خانة غير مُفعَّلة)؛ أما ما لم يثبت آلياً فيؤكّده بنفسه
  const manual = Object.fromEntries(Object.entries(checklist).filter(([k, v]) => (QC_KEYS as string[]).includes(k) && typeof v === 'boolean'))
  const autoTrue = Object.fromEntries(Object.entries(auto).filter(([, v]) => v === true))
  const quality: QualityChecklist = { ...auto, ...manual, ...autoTrue, note: checklist.note?.slice(0, 500) }
  const missing = QC_KEYS.filter((k) => quality[k] !== true)
  await db.update(examDocuments).set({ quality, status: doc.status === 'PUBLISHED' ? 'PUBLISHED' : 'VERIFIED', verifiedByUserId: actor.userId, verifiedAt: new Date(), updatedAt: new Date() }).where(eq(examDocuments.id, id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'engine.document.verify', entityType: 'exam_document', entityId: id, newValue: { missing } })
  return { quality, missing: missing as string[] }
}

/* ───────────────────────────── المرحلة 5: الحلول المفصّلة ───────────────────────────── */

/** يطلب توليد حلول مفصّلة للتمارين المنشورة من وثائق البكالوريا التي لا حلّ مفصّلاً لها (دفعة) */
export async function requestSolutionDetails(db: Db, actor: Actor, input: { limit?: number; documentId?: string | null; questionIds?: string[] } = {}): Promise<{ jobId: string; count: number; reused: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!aiProviderInfo().configured) throw new AppError('AI_UNAVAILABLE')
  const pending = await pendingJobOfType(db, 'BAC_SOLUTION_DETAIL', null)
  if (pending && !(await failStaleJob(db, pending, STALE_AFTER_MS))) return { jobId: pending.id, count: pending.totalItems ?? 0, reused: true }
  let ids: string[]
  if (input.questionIds?.length) {
    input.questionIds.forEach((q) => assertUuid(q, 'NOT_FOUND'))
    ids = (await db.select({ id: bankQuestions.id }).from(bankQuestions).where(and(inArray(bankQuestions.id, input.questionIds), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt)))).map((x) => x.id)
  } else {
    const limit = Math.max(1, Math.min(300, input.limit ?? 25))
    ids = (
      await db
        .select({ id: bankQuestions.id })
        .from(bankQuestions)
        .where(and(isNull(bankQuestions.workspaceId), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt), isNotNull(bankQuestions.documentId), eq(bankQuestions.status, 'PUBLISHED'), isNull(bankQuestions.solutionDetail), input.documentId ? eq(bankQuestions.documentId, input.documentId) : undefined))
        .orderBy(desc(bankQuestions.sourceYear), asc(bankQuestions.sourceExerciseNo))
        .limit(limit)
    ).map((x) => x.id)
  }
  if (ids.length === 0) throw new AppError('VALIDATION', { field: 'questions', reason: 'nothing_pending' })
  const job = await enqueueJob(db, { type: 'BAC_SOLUTION_DETAIL', payload: { questionIds: ids, userId: actor.userId }, workspaceId: null, maxAttempts: 1 })
  await updateJobProgress(db, job.id, { totalItems: ids.length })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'bac.solutions.request', entityType: 'job', entityId: job.id, newValue: { count: ids.length } })
  return { jobId: job.id, count: ids.length, reused: false }
}

/** حلّ مفصّل لتمرين واحد: يُبنى مرة ويُخزَّن (غير موثَّق حتى يراجعه المشرف) */
export async function detailOne(db: Db, questionId: string, userId: string | null): Promise<{ ok: boolean; title: string; error?: string }> {
  const [q] = await db.select().from(bankQuestions).where(eq(bankQuestions.id, questionId)).limit(1)
  if (!q) return { ok: false, title: '?', error: 'missing' }
  const children = await db.select().from(bankQuestions).where(and(eq(bankQuestions.parentId, q.id), isNull(bankQuestions.deletedAt))).orderBy(asc(bankQuestions.sortOrder))
  const [names] = await db
    .select({ subject: subjects.nameAr, subjectCode: subjects.code, level: levels.nameAr, stream: streams.nameAr })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(levels, eq(levels.id, bankQuestions.levelId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .where(eq(bankQuestions.id, q.id))
    .limit(1)
  const provider = getAiProvider()
  if (!provider.detailSolution) return { ok: false, title: q.title ?? q.body.slice(0, 40), error: 'ai_unavailable' }
  try {
    const out: DetailSolutionOutput = await withAiTask({ task: 'bac_solution_detail', userId, entityType: 'bank_question', entityId: q.id }, () =>
      provider.detailSolution!({
        subject: names?.subject ?? null,
        levelName: names?.level ?? null,
        streamName: names?.stream ?? null,
        scientific: SCIENTIFIC_SUBJECTS.has(names?.subjectCode ?? ''),
        source: q.sourceLabel,
        exercise: { title: q.title, body: q.body, points: Number(q.points), officialSolution: q.solution, children: children.map((c) => ({ body: c.body, points: Number(c.points), officialSolution: c.solution })) }
      })
    )
    const detail: DetailedSolution = {
      source: 'madrasadz',
      shortAnswer: out.shortAnswer,
      steps: out.steps,
      rule: out.rule,
      why: out.why,
      commonMistakes: out.commonMistakes,
      faster: out.faster,
      teacherNotes: out.uncertainties.length ? [out.teacherNotes, `يحتاج تأكيداً: ${out.uncertainties.join(' · ')}`].filter(Boolean).join('\n') : out.teacherNotes,
      bareme: out.bareme,
      children: out.children,
      selfChecked: out.selfChecked,
      verified: false,
      generatedAt: new Date().toISOString(),
      model: provider.model
    }
    await db.update(bankQuestions).set({ solutionDetail: detail, updatedAt: new Date() }).where(eq(bankQuestions.id, q.id))
    return { ok: true, title: q.title ?? q.body.slice(0, 40) }
  } catch (e) {
    return { ok: false, title: q.title ?? q.body.slice(0, 40), error: e instanceof Error ? e.message : String(e) }
  }
}

/** المهمة الخلفية: تمرين تلو الآخر مع نقطة تحقّق (checkpoint) بعد كل واحد؛ فشل واحد لا يوقف البقية */
export async function runSolutionDetailJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const ids = Array.isArray(job.payload.questionIds) ? job.payload.questionIds.map(String) : []
  const userId = typeof job.payload.userId === 'string' ? job.payload.userId : null
  const summary = { processed: 0, ok: 0, failed: 0 }
  const logs: string[] = []
  for (const id of ids) {
    const r = await detailOne(db, id, userId)
    summary.processed++
    if (r.ok) summary.ok++
    else summary.failed++
    logs.push(`${r.title}: ${r.ok ? 'تمّ' : `فشل — ${r.error ?? ''}`}`)
    if (logs.length > 200) logs.splice(0, logs.length - 200)
    await updateJobProgress(db, job.id, { totalItems: ids.length, processedItems: summary.processed, failedItems: summary.failed, logs, progress: { last: r.title } })
  }
  if (userId) await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title: 'انتهى توليد الحلول المفصّلة', body: `${summary.ok} حلاً بانتظار مراجعتك${summary.failed ? `، ${summary.failed} فشلت` : ''}.`, link: '/admin/bac-bank' })
  return summary
}

/** اعتماد/رفض حلّ مفصّل (الرفض يحذفه ليُعاد توليده) */
export async function reviewSolutionDetail(db: Db, actor: Actor, questionId: string, decision: 'approve' | 'reject', patch?: Partial<Pick<DetailedSolution, 'shortAnswer' | 'steps' | 'teacherNotes'>>): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(questionId, 'NOT_FOUND')
  const [q] = await db.select({ id: bankQuestions.id, detail: bankQuestions.solutionDetail }).from(bankQuestions).where(eq(bankQuestions.id, questionId)).limit(1)
  if (!q) throw new AppError('NOT_FOUND')
  if (decision === 'reject') {
    await db.update(bankQuestions).set({ solutionDetail: null, updatedAt: new Date() }).where(eq(bankQuestions.id, questionId))
  } else {
    if (!q.detail) throw new AppError('VALIDATION', { field: 'detail' })
    await db.update(bankQuestions).set({ solutionDetail: { ...q.detail, ...(patch ?? {}), verified: true, verifiedAt: new Date().toISOString() }, updatedAt: new Date() }).where(eq(bankQuestions.id, questionId))
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'bac.solution.review', entityType: 'bank_question', entityId: questionId, newValue: { decision } })
}

export interface DetailQueueItem {
  id: string
  title: string | null
  body: string
  sourceLabel: string | null
  subjectName: string | null
  detail: DetailedSolution
}

/** الحلول المفصّلة بانتظار المراجعة */
export async function solutionDetailQueue(db: Db, actor: Actor, limit = 50): Promise<DetailQueueItem[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: bankQuestions.id, title: bankQuestions.title, body: bankQuestions.body, sourceLabel: bankQuestions.sourceLabel, subjectName: subjects.nameAr, detail: bankQuestions.solutionDetail })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .where(and(isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), isNotNull(bankQuestions.solutionDetail), sql`(${bankQuestions.solutionDetail}->>'verified') <> 'true'`))
    .orderBy(desc(bankQuestions.updatedAt))
    .limit(limit)
  return rows.filter((r): r is typeof r & { detail: DetailedSolution } => Boolean(r.detail))
}

/* ───────────────────────────── المرحلة 9: البحث الذكي ───────────────────────────── */

export interface BacSearchHit {
  id: string
  label: string
  title: string | null
  body: string
  year: number | null
  subjectName: string | null
  streamName: string | null
  exerciseNo: number | null
  topicNo: number | null
  nodeTitle: string | null
  resourceId: string | null
  hasDetail: boolean
}

/** «الدالة الأسية» ← BAC 2025 علوم — تمرين 2 … (عناوين الدروس أولاً ثم النصّ الكامل) */
export async function searchBacExercises(db: Db, query: string, f: { subjectId?: string | null; streamId?: string | null; year?: number | null } = {}, limit = 30): Promise<BacSearchHit[]> {
  const q = query.trim().slice(0, 100)
  if (q.length < 2) return []
  const n = normalizeArabic(q)
  const nodeIds = (await db.select({ id: curriculumNodes.id }).from(curriculumNodes).where(sql`${curriculumNodes.title} ilike ${'%' + q.replace(/[%_]/g, '') + '%'}`)).map((x) => x.id)
  const ts = tsQueryOf(q)
  const rows = await db
    .select({ q: bankQuestions, subjectName: subjects.nameAr, streamName: streams.nameAr, nodeTitle: curriculumNodes.title, resourceId: examDocuments.resourceId })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .leftJoin(examDocuments, eq(examDocuments.id, bankQuestions.documentId))
    .where(
      and(
        isNull(bankQuestions.workspaceId),
        isNull(bankQuestions.parentId),
        isNull(bankQuestions.deletedAt),
        isNotNull(bankQuestions.documentId),
        eq(bankQuestions.status, 'PUBLISHED'),
        eq(bankQuestions.visibility, 'PUBLIC'),
        f.subjectId ? eq(bankQuestions.subjectId, f.subjectId) : undefined,
        f.streamId ? eq(bankQuestions.streamId, f.streamId) : undefined,
        f.year ? eq(bankQuestions.sourceYear, f.year) : undefined,
        or(nodeIds.length ? inArray(bankQuestions.curriculumNodeId, nodeIds) : sql`false`, ts ? sql`${bankQuestions.searchText} ilike ${'%' + n.replace(/[%_]/g, '') + '%'}` : sql`false`, sql`${bankQuestions.keywords}::text ilike ${'%' + q.replace(/[%_]/g, '') + '%'}`)
      )
    )
    .orderBy(sql`case when ${bankQuestions.curriculumNodeId} in (${nodeIds.length ? sql.join(nodeIds.map((id) => sql`${id}`), sql`, `) : sql`null`}) then 0 else 1 end`, desc(bankQuestions.sourceYear), asc(bankQuestions.sourceExerciseNo))
    .limit(limit)
  return rows.map((x) => ({
    id: x.q.id,
    label: `BAC ${x.q.sourceYear ?? '—'} ${x.streamName ?? ''} — ${x.subjectName ?? ''} — ${x.q.sourceTopicNo ? `الموضوع ${x.q.sourceTopicNo} ` : ''}تمرين ${x.q.sourceExerciseNo ?? '?'}`.replace(/\s+/g, ' ').trim(),
    title: x.q.title,
    body: x.q.body,
    year: x.q.sourceYear,
    subjectName: x.subjectName,
    streamName: x.streamName,
    exerciseNo: x.q.sourceExerciseNo,
    topicNo: x.q.sourceTopicNo,
    nodeTitle: x.nodeTitle,
    resourceId: x.resourceId,
    hasDetail: Boolean(x.q.solutionDetail)
  }))
}

/* ───────────────────────────── المرحلة 10: getExercises ───────────────────────────── */

export interface GetExercisesParams {
  /** رمز المادة (MATH) أو معرّفها */
  subject: string
  /** رمز الشعبة (SCI) أو معرّفها */
  stream?: string | null
  /** رمز المحور (slug) أو عنوانه أو معرّفه */
  chapter?: string | null
  /** رمز الدرس أو عنوانه أو معرّفه */
  lesson?: string | null
  /** 1 سهل · 2 متوسط · 3 صعب · 4 صعب جداً */
  difficulty?: number | number[] | null
  /** BAC | BEM | TEST | HOMEWORK (الافتراضي BAC) */
  source?: string | null
  year?: number | null
  limit?: number
  /** استبعاد معرّفات (لتفادي التكرار في ورقة واحدة) */
  exclude?: string[]
}

export interface ExerciseHit extends BankQuestionRow {
  subjectName: string | null
  streamName: string | null
  nodeTitle: string | null
  children: BankQuestionRow[]
}

const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

/** واجهة مولّد الاختبارات: تمارين منشورة من البنك المركزي بالمادة/الشعبة/المحور/الدرس/الصعوبة/المصدر/السنة */
export async function getExercises(db: Db, p: GetExercisesParams): Promise<ExerciseHit[]> {
  const [subject] = await db.select({ id: subjects.id }).from(subjects).where(isUuid(p.subject) ? eq(subjects.id, p.subject) : eq(subjects.code, p.subject)).limit(1)
  if (!subject) return []
  const [stream] = p.stream ? await db.select({ id: streams.id }).from(streams).where(isUuid(p.stream) ? eq(streams.id, p.stream) : eq(streams.code, p.stream)).limit(1) : []
  // المحور/الدرس: بالرمز أو العنوان أو المعرّف؛ المحور يشمل دروسه
  const nodeMatch = async (v: string) => db.select({ id: curriculumNodes.id, parentId: curriculumNodes.parentId }).from(curriculumNodes).where(and(eq(curriculumNodes.subjectId, subject.id), isUuid(v) ? eq(curriculumNodes.id, v) : or(eq(curriculumNodes.slug, v), sql`${curriculumNodes.title} ilike ${'%' + v.replace(/[%_]/g, '') + '%'}`)))
  let nodeIds: string[] | null = null
  if (p.lesson) nodeIds = (await nodeMatch(p.lesson)).map((n) => n.id)
  else if (p.chapter) {
    const units = await nodeMatch(p.chapter)
    const unitIds = units.map((u) => u.id)
    const lessons = unitIds.length ? await db.select({ id: curriculumNodes.id }).from(curriculumNodes).where(inArray(curriculumNodes.parentId, unitIds)) : []
    nodeIds = [...unitIds, ...lessons.map((l) => l.id)]
  }
  if (nodeIds && nodeIds.length === 0) return []
  const difficulties = p.difficulty == null ? null : Array.isArray(p.difficulty) ? p.difficulty : [p.difficulty]
  const rows = await db
    .select({ q: bankQuestions, subjectName: subjects.nameAr, streamName: streams.nameAr, nodeTitle: curriculumNodes.title })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .where(
      and(
        isNull(bankQuestions.workspaceId),
        isNull(bankQuestions.parentId),
        isNull(bankQuestions.deletedAt),
        eq(bankQuestions.status, 'PUBLISHED'),
        eq(bankQuestions.subjectId, subject.id),
        stream ? or(eq(bankQuestions.streamId, stream.id), isNull(bankQuestions.streamId)) : undefined,
        nodeIds ? inArray(bankQuestions.curriculumNodeId, nodeIds) : undefined,
        difficulties?.length ? inArray(bankQuestions.difficulty, difficulties) : undefined,
        eq(bankQuestions.examKind, p.source ?? 'BAC'),
        p.year ? eq(bankQuestions.sourceYear, p.year) : undefined,
        p.exclude?.length ? sql`${bankQuestions.id} not in (${sql.join(p.exclude.map((id) => sql`${id}`), sql`, `)})` : undefined
      )
    )
    .orderBy(desc(bankQuestions.sourceYear), asc(bankQuestions.sourceExerciseNo))
    .limit(Math.max(1, Math.min(200, p.limit ?? 20)))
  const ids = rows.map((r) => r.q.id)
  const children = ids.length ? await db.select().from(bankQuestions).where(and(inArray(bankQuestions.parentId, ids), isNull(bankQuestions.deletedAt))).orderBy(asc(bankQuestions.sortOrder)) : []
  return rows.map((r) => ({ ...r.q, subjectName: r.subjectName, streamName: r.streamName, nodeTitle: r.nodeTitle, children: children.filter((c) => c.parentId === r.q.id) }))
}

/* ───────────────────────────── صفحة الامتحان: الحلول للعرض ───────────────────────────── */

export interface ExamExerciseView {
  id: string
  title: string | null
  body: string
  points: number
  difficulty: number
  exerciseNo: number | null
  topicNo: number | null
  nodeTitle: string | null
  options: { label: string; isCorrect: boolean }[]
  solution: string | null
  bareme: { label: string; points: number }[]
  detail: DetailedSolution | null
  children: { id: string; body: string; points: number; solution: string | null; options: { label: string; isCorrect: boolean }[] }[]
}

/** التمارين المنشورة لوثيقة مع حلولها الرسمية والمفصّلة (الموثَّقة فقط للجمهور) */
export async function examExercises(db: Db, documentId: string, viewer: { admin: boolean }): Promise<ExamExerciseView[]> {
  const rows = await db
    .select({ q: bankQuestions, nodeTitle: curriculumNodes.title })
    .from(bankQuestions)
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .where(and(eq(bankQuestions.documentId, documentId), isNull(bankQuestions.parentId), isNull(bankQuestions.deletedAt), eq(bankQuestions.status, 'PUBLISHED'), eq(bankQuestions.visibility, 'PUBLIC')))
    .orderBy(asc(bankQuestions.sourceTopicNo), asc(bankQuestions.sourceExerciseNo), asc(bankQuestions.sortOrder))
  const ids = rows.map((r) => r.q.id)
  const children = ids.length ? await db.select().from(bankQuestions).where(and(inArray(bankQuestions.parentId, ids), isNull(bankQuestions.deletedAt))).orderBy(asc(bankQuestions.sortOrder)) : []
  return rows.map((r) => ({
    id: r.q.id,
    title: r.q.title,
    body: r.q.body,
    points: Number(r.q.points),
    difficulty: r.q.difficulty,
    exerciseNo: r.q.sourceExerciseNo,
    topicNo: r.q.sourceTopicNo,
    nodeTitle: r.nodeTitle,
    options: r.q.options,
    solution: r.q.solution,
    bareme: r.q.bareme,
    detail: r.q.solutionDetail && (r.q.solutionDetail.verified || viewer.admin) ? r.q.solutionDetail : null,
    children: children.filter((c) => c.parentId === r.q.id).map((c) => ({ id: c.id, body: c.body, points: Number(c.points), solution: c.solution, options: c.options }))
  }))
}

/** حالة مهمة الحلول المفصّلة (للوحة) */
export async function solutionDetailJobStatus(db: Db): Promise<{ pending: boolean; processed: number; total: number; failed: number; lastError: string | null; finishedAt: Date | null }> {
  const pending = await pendingJobOfType(db, 'BAC_SOLUTION_DETAIL', null)
  const last = await latestJobOfType(db, 'BAC_SOLUTION_DETAIL', null)
  const j = pending ?? last
  return { pending: Boolean(pending), processed: j?.processedItems ?? 0, total: j?.totalItems ?? 0, failed: j?.failedItems ?? 0, lastError: last?.error ?? null, finishedAt: last?.finishedAt ?? null }
}
