/**
 * بنك البكالوريا — استيراد ملفات المواضيع والتصحيحات من مجلد Google Drive أو مجلد على الخادم،
 * عندما يتعذّر الجلب من DzExams (حجب 403) أو لإدخال ملفات Madrasadz النظيفة.
 *
 * لكل ملف: بايتات ← بصمة SHA-256 (لا تكرار) ← تخزين محلي ← نصّ أول صفحتين ← تصنيف حتمي من الاسم
 * ← الذكاء الاصطناعي يكمل الناقص فقط ← مورد رسمي في المكتبة + وثيقة PENDING في محرّك الامتحانات.
 * التصحيح يُربط بموضوعه (سنة+دورة+شعبة+مادة+رقم الموضوع). ما لم يُصنَّف يُعرض على المشرف ولا يُخمَّن.
 */
import { createHash } from 'node:crypto'
import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { guessBacFile, languageOfSubject, TOPIC_AR, type BacFileGuess } from '@/lib/bac-bank'
import { getAiProvider } from '@/server/ai/provider'
import { withAiTask } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { contentSources, examDocuments, files, jobs, levels, resources, streams, subjects } from '@/server/db/schema'
import { enqueueJob, failIdleJob, failStaleJob, latestJobOfType, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { extractDocText, pdfPageCount, TEXT_MIME } from '@/server/lib/doc-text'
import { AppError } from '@/server/lib/errors'
import { downloadDriveFile, type DriveFile, type DriveOptions, listDriveFolder, listPublicFolderNoKey, parseDriveFolderId } from '@/server/lib/google-drive'
import { HARVEST_UA, harvestSite } from '@/server/bac/harvest'
import { newStorageKey, storage } from '@/server/lib/storage'
import { errorMessage } from '@/i18n'
import { notify } from './notifications.service'
import { upsertResource } from './resources.service'

const STALE_AFTER_MS = 3 * 60 * 60_000
/** بلا أي تقدّم هذه المدة ⇒ المهمة متوقّفة (كل ملف يحدّث التقدّم، وأبطؤها دقيقتان) */
const IDLE_AFTER_MS = 10 * 60_000
/** ملف واحد (تنزيل + قراءة + تصنيف) لا يتجاوز هذا وإلا تُخطّى */
// يشمل إعادة المحاولة بتمهّل عند الحدّ المؤقت (3 + 15 + 60 ث) فوق التنزيل نفسه
const FILE_TIMEOUT_MS = 240_000

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined
  return Promise.race([p.finally(() => clearTimeout(t)), new Promise<T>((_, reject) => (t = setTimeout(() => reject(new Error(label)), ms)))])
}
const MAX_BYTES = 40 * 1024 * 1024
const EXCERPT_CHARS = 2500
/** أقل ثقة يُقبل بها تصنيف الذكاء الاصطناعي لحقل لم يُستنتج من الاسم */
const MIN_AI_CONFIDENCE = 0.6
const ONEC = 'الديوان الوطني للامتحانات والمسابقات'

export type ImportSource = { kind: 'drive'; folderUrl: string } | { kind: 'dir'; dir: string } | { kind: 'web'; seedUrl: string }

export interface ImportedFile {
  name: string
  outcome: 'exam' | 'correction' | 'duplicate' | 'unclassified' | 'error' | 'repaired'
  /** لماذا لم يُصنَّف أو ما الخطأ */
  reason?: string
  title?: string
  documentId?: string
  /** حقول أكملها الذكاء الاصطناعي (للمراجعة) */
  aiFilled?: string[]
}

export interface ImportReport {
  source: string
  files: number
  exams: number
  corrections: number
  duplicates: number
  unclassified: number
  errors: number
  scanned: number
  /** ملفات حُفظت فارغة في جولة سابقة (0 بايت) وأُعيد حفظها */
  repaired: number
  items: ImportedFile[]
}

interface Classified {
  name: string
  pageUrl?: string
  bytes: Uint8Array
  mimeType: string
  checksum: string
  text: string
  guess: BacFileGuess
  aiFilled: string[]
}

const EXT_MIME: Record<string, string> = { '.pdf': TEXT_MIME.pdf, '.txt': 'text/plain', '.docx': TEXT_MIME.docx }

/** يسرد ملفات مجلد على الخادم (حتى خمسة مستويات: مادة / شعبة / سنة / دورة / ملف) — PDF وWord ونص */
async function listDir(dir: string): Promise<{ name: string; path: string }[]> {
  const out: { name: string; path: string }[] = []
  const walk = async (d: string, depth: number, prefix: string) => {
    const entries = await readdir(d, { withFileTypes: true }).catch(() => [])
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) {
        if (depth < 5) await walk(p, depth + 1, `${prefix}${e.name} / `)
      } else if (EXT_MIME[path.extname(e.name).toLowerCase()]) out.push({ name: `${prefix}${e.name}`, path: p })
    }
  }
  await walk(dir, 0, '')
  return out
}

/** يخزّن البايتات ملفاً خاصاً باسم المشرف ويعيد معرّفه (أو المعرّف القائم لنفس البصمة) */
async function storeBytes(db: Db, input: { bytes: Uint8Array; mimeType: string; name: string; checksum: string; userId: string }): Promise<string> {
  const [existing] = await db.select({ id: files.id }).from(files).where(and(eq(files.checksum, input.checksum), isNull(files.deletedAt))).limit(1)
  if (existing) return existing.id
  const ext = input.mimeType === TEXT_MIME.pdf ? 'pdf' : input.mimeType === TEXT_MIME.docx ? 'docx' : 'txt'
  const key = newStorageKey(null, ext)
  await storage().put(key, Buffer.from(input.bytes))
  const [row] = await db
    .insert(files)
    .values({ workspaceId: null, ownerUserId: input.userId, bucket: 'private', storageKey: key, originalName: path.basename(input.name).replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 180), mimeType: input.mimeType, sizeBytes: input.bytes.byteLength, checksum: input.checksum })
    .returning({ id: files.id })
  return row!.id
}

function keyOf(g: BacFileGuess): string {
  return [g.year, g.session ?? 'NORMAL', g.streamCode, g.subjectCode, g.topicNumber ?? 0].join('|')
}

function titleOf(g: BacFileGuess, subjectName: string, streamName: string | null): string {
  return [`بكالوريا ${g.year}`, g.session === 'MAKEUP' ? 'الدورة الاستدراكية' : null, subjectName, streamName ? `شعبة ${streamName}` : null, TOPIC_AR(g.topicNumber) || null].filter(Boolean).join(' — ')
}

/** يصنّف ملفاً: الاسم أولاً (حتمي)، ثم الذكاء الاصطناعي للحقول الناقصة فقط وبثقة كافية */
async function classify(name: string, text: string, lists: { subjects: { code: string; name: string }[]; streams: { code: string; name: string }[] }, useAi: boolean): Promise<{ guess: BacFileGuess; aiFilled: string[] }> {
  const guess = guessBacFile(name, text)
  const aiFilled: string[] = []
  const missing = (['year', 'streamCode', 'subjectCode'] as const).filter((k) => !guess[k])
  const provider = getAiProvider()
  if (useAi && provider.classifyBacFile && (missing.length || guess.topicNumber === null)) {
    try {
      const ai = await withAiTask({ task: 'bac_classify_file', userId: null, entityType: 'file', entityId: null }, () => provider.classifyBacFile!({ fileName: name, excerpt: text.slice(0, EXCERPT_CHARS), subjects: lists.subjects, streams: lists.streams, guess }))
      if (ai.confidence >= MIN_AI_CONFIDENCE) {
        const fill = <K extends 'year' | 'session' | 'streamCode' | 'subjectCode' | 'topicNumber'>(k: K) => {
          if (guess[k] === null && ai[k] !== null && ai[k] !== undefined) {
            guess[k] = ai[k] as BacFileGuess[K]
            aiFilled.push(k)
          }
        }
        fill('year')
        fill('session')
        fill('streamCode')
        fill('subjectCode')
        fill('topicNumber')
        if (!guess.correction && ai.correction) {
          guess.correction = true
          aiFilled.push('correction')
        }
      }
    } catch (e) {
      console.error('[bac-import] classify failed', name, e instanceof Error ? e.message : e)
    }
  }
  if (guess.year && !guess.session) guess.session = 'NORMAL'
  return { guess, aiFilled }
}

/** حدود أرشيف Drive الكامل (مادة / شعبة / سنة / دورة / ملف): ~1500 ملف على خمسة مستويات */
const DRIVE_ARCHIVE_LIMITS = { maxFiles: 6000, maxDepth: 5 }

interface ImportEntry {
  name: string
  pageUrl?: string
  /** معرّف الملف في Drive: يتيح تخطّي ما استُورد سابقاً بلا تنزيل (استئناف آمن) */
  driveId?: string
  read: () => Promise<{ bytes: Uint8Array; mimeType: string }>
}

/** مجلد الملف داخل المصدر («المادة / الشعبة / السنة / الدورة»): وحدة المعالجة — الموضوع وحلّه معاً، والذاكرة لا تحمل إلا ملفات مجلد واحد */
function folderOf(name: string): string {
  const i = name.lastIndexOf(' / ')
  return i >= 0 ? name.slice(0, i) : ''
}

/**
 * الاستيراد الفعلي (يُستدعى من المهمة الخلفية أو من سطر الأوامر). كل ملف يُحفظ فور إتمامه.
 * `onProgress` لتحديث تقدّم المهمة.
 */
export async function importBacFiles(db: Db, actor: Actor, source: ImportSource, opts: { drive?: DriveOptions; fetch?: typeof fetch; useAi?: boolean; log?: (line: string) => void; onProgress?: (done: number, total: number, last: string) => Promise<void> | void; drivePaceMs?: number } = {}): Promise<ImportReport> {
  assertRole(actor, 'SUPER_ADMIN')
  const useAi = opts.useAi ?? true
  const [l3] = await db.select({ id: levels.id, stageId: levels.stageId }).from(levels).where(eq(levels.code, '3AS')).limit(1)
  const subjectRows = await db.select({ id: subjects.id, code: subjects.code, name: subjects.nameAr }).from(subjects)
  const streamRows = await db.select({ id: streams.id, code: streams.code, name: streams.nameAr }).from(streams)
  const lists = { subjects: subjectRows.map((s) => ({ code: s.code, name: s.name })), streams: streamRows.map((s) => ({ code: s.code, name: s.name })) }
  const subjectById = new Map(subjectRows.map((s) => [s.code, s]))
  const streamById = new Map(streamRows.map((s) => [s.code, s]))
  const [src] = await db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.code, 'onec')).limit(1)
  if (!src) throw new AppError('NOT_FOUND', { source: 'onec' })

  // 1) القائمة
  let entries: ImportEntry[]
  let label: string
  if (source.kind === 'web') {
    // موقع عامّ (ency-education، eddirassa…): روابط PDF مع نصّ الرابط وعنوان الصفحة؛ الملف يُنزَّل هنا
    let seed: URL
    try {
      seed = new URL(source.seedUrl)
    } catch {
      throw new AppError('VALIDATION', { field: 'seedUrl' })
    }
    if (!/^https?:$/.test(seed.protocol)) throw new AppError('VALIDATION', { field: 'seedUrl' })
    const h = await harvestSite(source.seedUrl, { fetch: opts.fetch, log: opts.log })
    label = `موقع: ${seed.hostname}`
    const doFetch = opts.fetch ?? fetch
    entries = h.pdfs.map((p) => ({
      name: `${[p.text, p.pageTitle].filter(Boolean).join(' — ')} (${decodeURIComponent(path.basename(new URL(p.url).pathname) || 'file')})`,
      pageUrl: p.pageUrl,
      read: async () => {
        const res = await doFetch(p.url, { headers: { 'user-agent': HARVEST_UA, accept: 'application/pdf,*/*' }, redirect: 'follow', signal: AbortSignal.timeout(60_000) })
        if (!res.ok) throw new Error(`المصدر ردّ ${res.status}`)
        const ct = (res.headers.get('content-type') ?? '').toLowerCase()
        if (ct.includes('html')) throw new Error('الرابط صفحة ويب لا ملفاً')
        const mimeType = ct.includes('pdf') || /\.pdf(?:$|\?)/i.test(p.url) ? TEXT_MIME.pdf : ct.startsWith('text/plain') ? 'text/plain' : ct.includes('wordprocessingml') ? TEXT_MIME.docx : TEXT_MIME.pdf
        return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType }
      }
    }))
  } else if (source.kind === 'drive') {
    const folderId = parseDriveFolderId(source.folderUrl)
    if (!folderId) throw new AppError('INVALID_DRIVE_URL')
    const driveOpts: DriveOptions = { ...DRIVE_ARCHIVE_LIMITS, ...opts.drive }
    let listing: { name: string; files: DriveFile[] }
    let read: (f: DriveFile) => Promise<{ bytes: Uint8Array; mimeType: string }>
    // تمهّل بين التنزيلات حتى لا يحجب Google عنوان الخادم (حجبه 1432 ملفاً من 1527 في جولة 2026-10)
    const paceMs = opts.drivePaceMs ?? 700
    const paced = async (f: DriveFile, o: DriveOptions) => {
      if (paceMs > 0) await new Promise((r) => setTimeout(r, paceMs))
      return downloadDriveFile(f, o)
    }
    try {
      listing = await listDriveFolder(folderId, driveOpts)
      read = (f) => paced(f, driveOpts)
    } catch (err) {
      // بلا مفتاح Google (أو Drive API غير مفعّلة في مشروعه): المجلد العامّ يُقرأ ويُنزَّل بلا مفتاح
      if (!(err instanceof AppError) || err.code !== 'DRIVE_API_DISABLED') throw err
      opts.log?.('لا مفتاح Drive API صالح — قراءة المجلد العامّ بلا مفتاح')
      listing = await listPublicFolderNoKey(folderId, driveOpts)
      read = (f) => paced(f, { ...driveOpts, apiKey: '' })
    }
    label = `Drive: ${listing.name}`
    entries = listing.files.map((f) => ({ name: f.name, driveId: f.id, read: () => read(f) }))
  } else {
    const dir = path.resolve(source.dir)
    const st = await stat(dir).catch(() => null)
    if (!st?.isDirectory()) throw new AppError('VALIDATION', { field: 'dir' })
    label = `مجلد: ${dir}`
    entries = (await listDir(dir)).map((f) => ({ name: f.name, read: async () => ({ bytes: new Uint8Array(await readFile(f.path)), mimeType: EXT_MIME[path.extname(f.path).toLowerCase()]! }) }))
  }
  if (entries.length === 0) throw new AppError(source.kind === 'web' ? 'HARVEST_EMPTY' : 'DRIVE_EMPTY')
  opts.log?.(`${entries.length} ملفاً في ${label}`)

  const report: ImportReport = { source: label, files: entries.length, exams: 0, corrections: 0, duplicates: 0, unclassified: 0, errors: 0, scanned: 0, repaired: 0, items: [] }
  const known = new Set((await db.select({ h: examDocuments.pdfHash }).from(examDocuments)).map((d) => d.h).filter((h): h is string => Boolean(h)))
  const knownSol = new Set((await db.select({ h: examDocuments.solutionPdfHash }).from(examDocuments)).map((d) => d.h).filter((h): h is string => Boolean(h)))
  // ملفات حُفظت فارغة (0 بايت) في نسخة سابقة من المستورد: تُنزَّل من جديد ويُعاد حفظها في مكانها
  const broken = new Map((await db.select({ checksum: files.checksum, id: files.id, key: files.storageKey }).from(files).where(and(eq(files.sizeBytes, 0), isNull(files.deletedAt)))).filter((f) => f.checksum).map((f) => [f.checksum!, f]))
  for (const c of broken.keys()) {
    known.delete(c)
    knownSol.delete(c)
  }
  // ملفات Drive استُوردت في جولة سابقة بملف سليم (موضوعاً أو تصحيحاً): لا تُنزَّل مرة أخرى
  const knownDrive = new Set(
    (
      await db
        .select({ id: sql<string | null>`${resources.metadata}->>'driveFileId'` })
        .from(resources)
        .innerJoin(files, eq(files.id, resources.fileId))
        .where(and(sql`${resources.metadata} ? 'driveFileId'`, sql`${files.sizeBytes} > 0`))
    )
      .map((r) => r.id)
      .filter((x): x is string => Boolean(x))
  )

  // المواضيع الموجودة في البنك بمفتاحها (سنة+دورة+شعبة+مادة+رقم الموضوع)
  const byKey = new Map<string, { documentId: string; resourceId: string; hasFile: boolean; hasSolution: boolean }>()
  const existingDocs = await db
    .select({ id: examDocuments.id, resourceId: examDocuments.resourceId, fileId: examDocuments.fileId, solutionFileId: examDocuments.solutionFileId, year: examDocuments.examYear, session: examDocuments.examSession, streamId: examDocuments.streamId, subjectId: examDocuments.subjectId, topic: examDocuments.topicNumber })
    .from(examDocuments)
    .where(eq(examDocuments.docType, 'BAC'))
  const streamCodeById = new Map(streamRows.map((s) => [s.id, s.code]))
  const subjectCodeById = new Map(subjectRows.map((s) => [s.id, s.code]))
  // ملف محفوظ فارغاً يُعدّ غائباً: أي نسخة جديدة منه تحلّ محلّه
  const emptyIds = new Set([...broken.values()].map((f) => f.id))
  for (const d of existingDocs) {
    if (!d.resourceId || !d.year || !d.subjectId) continue
    byKey.set([d.year, d.session ?? 'NORMAL', d.streamId ? streamCodeById.get(d.streamId) : null, subjectCodeById.get(d.subjectId), d.topic ?? 0].join('|'), { documentId: d.id, resourceId: d.resourceId, hasFile: Boolean(d.fileId && !emptyIds.has(d.fileId)), hasSolution: Boolean(d.solutionFileId && !emptyIds.has(d.solutionFileId)) })
  }

  const common = (g: BacFileGuess) => {
    const subject = subjectById.get(g.subjectCode!)!
    const stream = g.streamCode ? streamById.get(g.streamCode) : undefined
    return {
      subject,
      stream,
      base: {
        stageId: l3?.stageId ?? null,
        levelId: l3?.id ?? null,
        streamId: stream?.id ?? null,
        subjectId: subject.id,
        examYear: g.year,
        examSession: g.session ?? 'NORMAL',
        isOfficial: true,
        sourceCode: 'onec',
        originalAuthor: ONEC,
        accessLevel: 'PUBLIC' as const,
        status: 'PUBLISHED' as const
      }
    }
  }
  const meta = (c: Classified & { driveId?: string }) => ({ importedFrom: source.kind, fileName: c.name, aiFilled: c.aiFilled, ...(c.driveId ? { driveFileId: c.driveId } : {}) })

  const storeExam = async (c: Classified & { driveId?: string }) => {
    const { subject, stream, base } = common(c.guess)
    const title = titleOf(c.guess, subject.name, stream?.name ?? null)
    const existing = byKey.get(keyOf(c.guess))
    const pages = c.mimeType === TEXT_MIME.pdf ? await pdfPageCount(c.bytes).catch(() => null) : null
    const scanned = c.text.length < 200
    if (existing) {
      // الموضوع نفسه مسجّل سلفاً: يُرفق به الملف إن كان بلا ملف، وإلا فهو مكرّر — لا بطاقة ثانية لنفس الامتحان
      if (existing.hasFile) {
        report.duplicates++
        report.items.push({ name: c.name, outcome: 'duplicate', reason: 'الموضوع نفسه موجود في البنك بملفه', documentId: existing.documentId })
        return
      }
      const fileId = await storeBytes(db, { bytes: c.bytes, mimeType: c.mimeType, name: c.name, checksum: c.checksum, userId: actor.userId })
      await db.update(examDocuments).set({ fileId, pdfHash: c.checksum, pagesCount: pages, updatedAt: new Date() }).where(eq(examDocuments.id, existing.documentId))
      await db
        .update(resources)
        .set({ fileId, metadata: sql`${resources.metadata} || ${JSON.stringify(meta(c))}::jsonb`, updatedAt: new Date() })
        .where(eq(resources.id, existing.resourceId))
      existing.hasFile = true
      if (scanned) report.scanned++
      report.exams++
      report.items.push({ name: c.name, outcome: 'exam', title: `${title} (أُرفق الملف بالموضوع الموجود)`, documentId: existing.documentId, aiFilled: c.aiFilled })
      return
    }
    const fileId = await storeBytes(db, { bytes: c.bytes, mimeType: c.mimeType, name: c.name, checksum: c.checksum, userId: actor.userId })
    const r = await upsertResource(db, { ...base, ref: `import:${c.checksum}`, type: 'EXAM', title, fileId, sourceUrl: c.pageUrl ?? null, metadata: meta(c) })
    if (scanned) report.scanned++
    const [doc] = await db
      .insert(examDocuments)
      .values({ resourceId: r.id, title, docType: 'BAC', subjectId: subject.id, levelId: l3?.id ?? null, streamId: stream?.id ?? null, examYear: c.guess.year, examSession: c.guess.session ?? 'NORMAL', topicNumber: c.guess.topicNumber, language: languageOfSubject(subject.code), sourceId: src.id, sourceUrl: c.pageUrl ?? null, fileId, pdfHash: c.checksum, pagesCount: pages, status: 'PENDING', metadata: { ...meta(c), scanned, importedAt: new Date().toISOString(), originalAuthor: ONEC } })
      .onConflictDoNothing()
      .returning({ id: examDocuments.id })
    const documentId = doc?.id ?? (await db.select({ id: examDocuments.id }).from(examDocuments).where(eq(examDocuments.resourceId, r.id)).limit(1))[0]?.id
    if (documentId) byKey.set(keyOf(c.guess), { documentId, resourceId: r.id, hasFile: true, hasSolution: false })
    report.exams++
    report.items.push({ name: c.name, outcome: 'exam', title, documentId, aiFilled: c.aiFilled })
  }

  /** التصحيح المحفوظ يُربط بموضوعه؛ إن لم يُعرف الموضوع بعد (في مجلد لاحق) يُعاد ربطه في النهاية */
  type Pending = { name: string; guess: BacFileGuess; solId: string; fileId: string; checksum: string; title: string; aiFilled: string[] }
  const pendingCorrections: Pending[] = []
  const targetOf = (g: BacFileGuess) => byKey.get(keyOf(g)) ?? (g.topicNumber === null ? (byKey.get(keyOf({ ...g, topicNumber: 1 })) ?? byKey.get(keyOf({ ...g, topicNumber: 2 }))) : undefined)
  const linkCorrection = async (p: Pending): Promise<boolean> => {
    const target = targetOf(p.guess)
    if (!target) return false
    await db.update(resources).set({ hasSolution: true, solutionResourceId: p.solId, updatedAt: new Date() }).where(eq(resources.id, target.resourceId))
    await db.update(examDocuments).set({ solutionResourceId: p.solId, solutionFileId: p.fileId, solutionPdfHash: p.checksum, updatedAt: new Date() }).where(eq(examDocuments.id, target.documentId))
    target.hasSolution = true
    report.corrections++
    report.items.push({ name: p.name, outcome: 'correction', title: p.title, documentId: target.documentId, aiFilled: p.aiFilled })
    return true
  }
  const storeCorrection = async (c: Classified & { driveId?: string }) => {
    // للموضوع حلّه سلفاً: نسخة ثانية من الحلّ لا تُخزَّن ولا تستبدل الأولى
    const existing = targetOf(c.guess)
    if (existing?.hasSolution) {
      report.duplicates++
      report.items.push({ name: c.name, outcome: 'duplicate', reason: 'للموضوع حلّه في البنك', documentId: existing.documentId })
      return
    }
    const { subject, stream, base } = common(c.guess)
    const title = `تصحيح: ${titleOf(c.guess, subject.name, stream?.name ?? null)}`
    const fileId = await storeBytes(db, { bytes: c.bytes, mimeType: c.mimeType, name: c.name, checksum: c.checksum, userId: actor.userId })
    // تصحيح من موقع عامّ ليس رسمياً: يُنسب إلى الموقع ويُراجَع كأي حلّ
    const webHost = source.kind === 'web' && c.pageUrl ? new URL(c.pageUrl).hostname.replace(/^www\./, '') : null
    const sol = await upsertResource(db, { ...base, ...(webHost ? { isOfficial: false, originalAuthor: webHost, status: 'NEEDS_REVIEW' as const } : {}), ref: `import:${c.checksum}`, type: 'SOLUTION', part: 'correction', title, fileId, sourceUrl: c.pageUrl ?? null, metadata: meta(c) })
    const p: Pending = { name: c.name, guess: c.guess, solId: sol.id, fileId, checksum: c.checksum, title, aiFilled: c.aiFilled }
    if (!(await linkCorrection(p))) pendingCorrections.push(p)
  }

  // 2) مجلداً مجلداً: تنزيل وتصنيف، ثم المواضيع قبل تصحيحاتها (فشل ملف لا يوقف البقية)
  const groups = new Map<string, ImportEntry[]>()
  for (const e of entries) groups.set(folderOf(e.name), [...(groups.get(folderOf(e.name)) ?? []), e])
  let done = 0
  for (const group of groups.values()) {
    const classified: (Classified & { driveId?: string })[] = []
    for (const e of group) {
      try {
        if (e.driveId && knownDrive.has(e.driveId)) {
          report.duplicates++
          report.items.push({ name: e.name, outcome: 'duplicate', reason: 'استُورد في جولة سابقة' })
          continue
        }
        const { bytes, mimeType } = await withTimeout(e.read(), FILE_TIMEOUT_MS, 'انتهت مهلة تنزيل الملف — تُخطّي، أعد الاستيراد لاحقاً')
        if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) throw new Error('ملف فارغ أو أكبر من الحدّ')
        const checksum = createHash('sha256').update(bytes).digest('hex')
        const empty = broken.get(checksum)
        if (empty) {
          await storage().put(empty.key, Buffer.from(bytes))
          await db.update(files).set({ sizeBytes: bytes.byteLength }).where(eq(files.id, empty.id))
          broken.delete(checksum)
          report.repaired++
          report.items.push({ name: e.name, outcome: 'repaired', reason: 'كان محفوظاً فارغاً — أُعيد حفظه' })
          continue
        }
        if (known.has(checksum) || knownSol.has(checksum)) {
          report.duplicates++
          report.items.push({ name: e.name, outcome: 'duplicate', reason: 'نفس الملف موجود في البنك' })
          continue
        }
        const text = await withTimeout(extractDocText(bytes, mimeType), 60_000, 'read').catch(() => '')
        const { guess, aiFilled } = await withTimeout(classify(e.name, text, lists, useAi), 90_000, 'انتهت مهلة التصنيف — تُخطّي')
        if (!guess.year || !guess.subjectCode || !subjectById.has(guess.subjectCode)) {
          report.unclassified++
          report.items.push({ name: e.name, outcome: 'unclassified', reason: `لم تُعرف ${!guess.year ? 'السنة' : 'المادة'} — أعد تسمية الملف (مثال: bac-2023-math-se-sujet1.pdf) أو ضع العنوان الرسمي في أول صفحة` })
          continue
        }
        classified.push({ name: e.name, pageUrl: e.pageUrl, driveId: e.driveId, bytes, mimeType, checksum, text, guess, aiFilled })
        known.add(checksum)
      } catch (err) {
        report.errors++
        report.items.push({ name: e.name, outcome: 'error', reason: err instanceof Error ? err.message : String(err) })
      } finally {
        done++
        await opts.onProgress?.(done, entries.length, e.name)
      }
    }
    for (const c of [...classified.filter((x) => !x.guess.correction), ...classified.filter((x) => x.guess.correction)]) {
      try {
        if (c.guess.correction) await storeCorrection(c)
        else await storeExam(c)
      } catch (err) {
        report.errors++
        report.items.push({ name: c.name, outcome: 'error', reason: err instanceof Error ? err.message : String(err) })
      }
    }
  }

  // 3) تصحيحات سبقت مواضيعها: محاولة أخيرة بعد اكتمال كل المجلدات
  for (const p of pendingCorrections) {
    if (await linkCorrection(p)) continue
    report.unclassified++
    report.items.push({ name: p.name, outcome: 'unclassified', reason: 'تصحيح بلا موضوع مطابق في البنك (حُفظ في المكتبة؛ استورد الموضوع ثم أعد المحاولة)', title: p.title })
  }

  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'bac.import', entityType: 'exam_document', entityId: null, newValue: { source: label, files: report.files, exams: report.exams, corrections: report.corrections, duplicates: report.duplicates, unclassified: report.unclassified, errors: report.errors } })
  return report
}

/** من اللوحة: استيراد مجلد Drive في الخلفية (مهمة واحدة في كل مرة) */
export async function requestBacImport(db: Db, actor: Actor, input: { folderUrl?: string | null; seedUrl?: string | null }): Promise<{ jobId: string; reused: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  let payload: Record<string, unknown>
  if (input.folderUrl) {
    if (!parseDriveFolderId(input.folderUrl)) throw new AppError('INVALID_DRIVE_URL')
    payload = { folderUrl: input.folderUrl }
  } else if (input.seedUrl) {
    let u: URL
    try {
      u = new URL(input.seedUrl)
    } catch {
      throw new AppError('VALIDATION', { field: 'seedUrl' })
    }
    if (!/^https?:$/.test(u.protocol) || parseDriveFolderId(input.seedUrl)) throw new AppError('VALIDATION', { field: 'seedUrl' })
    payload = { seedUrl: u.toString() }
  } else throw new AppError('VALIDATION', { field: 'url' })
  const pending = await pendingJobOfType(db, 'BAC_IMPORT_FILES', null)
  if (pending && !(await failStaleJob(db, pending, STALE_AFTER_MS)) && !(await failIdleJob(db, pending, IDLE_AFTER_MS))) return { jobId: pending.id, reused: true }
  const job = await enqueueJob(db, { type: 'BAC_IMPORT_FILES', payload: { ...payload, userId: actor.userId }, workspaceId: null, maxAttempts: 1 })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'bac.import', entityType: 'job', entityId: job.id, newValue: payload })
  return { jobId: job.id, reused: false }
}

export async function runBacImportJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  // نبضة كل دقيقة: المهمة الحيّة لا تُعدّ متوقّفة (التعليق مستحيل بفضل مهلة كل ملف؛ والميّتة بإعادة التشغيل تتوقّف نبضتها)
  const beat = setInterval(() => void db.update(jobs).set({ updatedAt: new Date() }).where(eq(jobs.id, job.id)).catch(() => undefined), 60_000)
  beat.unref?.()
  try {
    return await runImport(db, job)
  } finally {
    clearInterval(beat)
  }
}

async function runImport(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const userId = String(job.payload.userId ?? '')
  const folderUrl = typeof job.payload.folderUrl === 'string' ? job.payload.folderUrl : ''
  const seedUrl = typeof job.payload.seedUrl === 'string' ? job.payload.seedUrl : ''
  const actor: Actor = { userId, role: 'SUPER_ADMIN', fullName: '', email: '', workspaceId: null, teacherId: null, studentId: null }
  const crawlLogs: string[] = []
  let lastFlush = 0
  const report = await importBacFiles(db, actor, seedUrl ? { kind: 'web', seedUrl } : { kind: 'drive', folderUrl }, {
    log: async (line) => {
      crawlLogs.push(line)
      if (crawlLogs.length > 60) crawlLogs.splice(0, crawlLogs.length - 60)
      if (Date.now() - lastFlush > 4000) {
        lastFlush = Date.now()
        await updateJobProgress(db, job.id, { logs: [...crawlLogs], progress: { phase: 'harvest', last: line } })
      }
    },
    onProgress: (done, total, last) => updateJobProgress(db, job.id, { totalItems: total, processedItems: done, progress: { phase: 'import', last } })
  })
  const logs = report.items.map((i) => `${i.outcome === 'exam' ? '✔' : i.outcome === 'correction' ? '✔ تصحيح' : i.outcome === 'duplicate' ? '=' : i.outcome === 'repaired' ? '↻ أُصلح' : '✖'} ${i.name}${i.title ? ` → ${i.title}` : ''}${i.reason ? ` — ${i.reason}` : ''}${i.aiFilled?.length ? ` (أكمل الذكاء الاصطناعي: ${i.aiFilled.join('، ')})` : ''}`)
  await updateJobProgress(db, job.id, { totalItems: report.files, processedItems: report.files, failedItems: report.errors + report.unclassified, logs: logs.slice(0, 200) })
  await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title: 'انتهى استيراد ملفات البكالوريا', body: `${report.exams} موضوعاً و${report.corrections} تصحيحاً${report.repaired ? `، أُصلح ${report.repaired} ملفاً كان فارغاً` : ''}${report.duplicates ? `، ${report.duplicates} مكرّر` : ''}${report.unclassified ? `، ${report.unclassified} بلا تصنيف` : ''}${report.errors ? `، ${report.errors} خطأ` : ''}. الخطوة التالية: معالجة دفعة.`, link: '/admin/bac-bank' })
  const { items: _items, ...summary } = report
  return summary
}

/** آخر تقرير استيراد (للوحة): يُقرأ من سجلّ المهمة */
export async function lastImportSummary(db: Db): Promise<{ at: Date; logs: string[]; running: boolean; processed: number; total: number; error: string | null } | null> {
  let row = await latestJobOfType(db, 'BAC_IMPORT_FILES', null)
  if (!row) return null
  // متوقّفة بلا تقدّم: تُغلق فيُفتح زرّ الاستيراد (الجولة الجديدة تتخطّى ما استُورد)
  if (await failIdleJob(db, row, IDLE_AFTER_MS)) row = (await latestJobOfType(db, 'BAC_IMPORT_FILES', null))!
  return { at: row.finishedAt ?? row.createdAt, logs: Array.isArray(row.logs) ? row.logs.map(String) : [], running: row.status === 'QUEUED' || row.status === 'PROCESSING', processed: row.processedItems ?? 0, total: row.totalItems ?? 0, error: row.error ? (/^[A-Z_]{3,40}$/.test(row.error) ? errorMessage(row.error) : row.error) : null }
}
