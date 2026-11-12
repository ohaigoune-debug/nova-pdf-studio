/**
 * صفحة «نشر» للأستاذ والمشرف: درس / ملخّص / تمارين / فرض / اختبار / حلّ — عامّ أو لأفواج بعينها،
 * و«من إنشاء: …» تحت كل مورد. الملفات مفردة أو مجلد أو ZIP (يُفكّ)، وسلسلة PDF مجمَّعة تُقسَّم.
 *
 * المسار: ملفات ← دفعة (اقتراح: الذكاء الاصطناعي يقسّم ويصنّف ويربط الحلول، أو «كما رفعتها») ← مراجعة صاحبها ← نشر.
 * الفروض والاختبارات والتمارين والحلول تظهر في «الفروض والاختبارات»، والدروس والملخّصات في «الدروس والموارد».
 */
import { createHash } from 'node:crypto'
import path from 'node:path'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { aiFailureReason } from '@/server/ai/failure'
import { getAiProvider } from '@/server/ai/provider'
import { heuristicOrganize } from '@/server/ai/shared'
import type { OrganizeUploadInput, OrganizeUploadOutput } from '@/server/ai/types'
import { withAiTask } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { content, files, groups, levels, profiles, resourceGroups, resources, streams, subjects, uploadBatches, users } from '@/server/db/schema'
import { PUBLISH_TYPES, type BatchDefaults, type BatchItem, type PublishType } from '@/server/db/schema/publish'
import { enqueueJob, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { extractDocText, pdfPagesText, TEXT_MIME } from '@/server/lib/doc-text'
import { AppError } from '@/server/lib/errors'
import { newStorageKey, storage } from '@/server/lib/storage'
import { guessDocType, guessTerm, solutionBaseName } from '@/lib/publish-guess'
import { notify } from './notifications.service'
import { upsertResource } from './resources.service'

export type { BatchDefaults, BatchItem, PublishType }

export const PUBLISH_TYPE_AR: Record<PublishType, string> = { LESSON: 'درس', SUMMARY: 'ملخّص', EXERCISE: 'سلسلة تمارين', HOMEWORK: 'فرض', TEST: 'اختبار', SOLUTION: 'حلّ' }
/** أين يظهر كل نوع */
export const SECTION_OF: Record<PublishType, 'exams' | 'lessons'> = { LESSON: 'lessons', SUMMARY: 'lessons', EXERCISE: 'exams', HOMEWORK: 'exams', TEST: 'exams', SOLUTION: 'exams' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_FILES = 200
/** صفحات تُقرأ من كل ملف للاقتراح، وحروف من كل صفحة */
const PAGE_CAP = 220
const PAGE_CHARS = 260
const ZIP_MIME = 'application/zip'
const INNER_MIME: Record<string, string> = { '.pdf': TEXT_MIME.pdf, '.docx': TEXT_MIME.docx, '.doc': 'application/msword', '.pptx': TEXT_MIME.pptx, '.ppt': 'application/vnd.ms-powerpoint', '.txt': 'text/plain', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' }

function staff(actor: Actor) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  return { admin: actor.role === 'SUPER_ADMIN', workspaceId: actor.role === 'TEACHER' ? actor.workspaceId : null }
}

/** الملفات التي يملكها صاحب الطلب (الأستاذ: مساحته؛ المشرف: كل ملف) */
async function ownedFiles(db: Db, actor: Actor, ids: string[]) {
  const { admin, workspaceId } = staff(actor)
  const clean = [...new Set(ids.filter((i) => UUID.test(i)))].slice(0, MAX_FILES)
  if (!clean.length) throw new AppError('VALIDATION', { field: 'fileIds' })
  const rows = await db.select().from(files).where(and(inArray(files.id, clean), isNull(files.deletedAt)))
  const ok = rows.filter((f) => admin || f.ownerUserId === actor.userId || (workspaceId && f.workspaceId === workspaceId))
  if (!ok.length) throw new AppError('FILE_NOT_FOUND')
  return clean.map((id) => ok.find((f) => f.id === id)).filter((f): f is (typeof ok)[number] => Boolean(f))
}

async function storeNew(db: Db, actor: Actor, workspaceId: string | null, name: string, mime: string, bytes: Uint8Array): Promise<string> {
  const ext = path.extname(name).slice(1).toLowerCase() || 'bin'
  const key = newStorageKey(workspaceId, ext)
  await storage().put(key, Buffer.from(bytes))
  const [row] = await db
    .insert(files)
    .values({ workspaceId, ownerUserId: actor.userId, bucket: 'private', storageKey: key, originalName: name.replace(/[\\:*?"<>|]/g, ' ').slice(-200), mimeType: mime, sizeBytes: bytes.byteLength, checksum: createHash('sha256').update(bytes).digest('hex') })
    .returning({ id: files.id })
  return row!.id
}

/** يفكّ ZIP: كل وثيقة في الأرشيف ملف مستقل باسم مساره («الفصل 1 / الفرض 1.pdf») */
async function expandZips(db: Db, actor: Actor, list: { id: string; originalName: string; mimeType: string; storageKey: string; workspaceId: string | null }[]) {
  const out: { id: string; name: string; mime: string }[] = []
  for (const f of list) {
    const isZip = f.mimeType === ZIP_MIME || /\.zip$/i.test(f.originalName)
    if (!isZip) {
      out.push({ id: f.id, name: f.originalName, mime: f.mimeType })
      continue
    }
    const JSZip = (await import('jszip')).default
    const zip = await JSZip.loadAsync(await storage().get(f.storageKey))
    const base = f.originalName.replace(/\.zip$/i, '')
    const entries = Object.values(zip.files)
      .filter((e) => !e.dir && !/(^|\/)(__MACOSX|\.)/.test(e.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'))
    for (const e of entries) {
      const mime = INNER_MIME[path.extname(e.name).toLowerCase()]
      if (!mime || out.length >= MAX_FILES) continue
      const bytes = await e.async('uint8array')
      if (!bytes.byteLength) continue
      const name = `${base} / ${e.name.split('/').join(' / ')}`
      out.push({ id: await storeNew(db, actor, f.workspaceId, name, mime, bytes), name, mime })
    }
  }
  return out
}

async function lists(db: Db) {
  const [subj, lvl, str] = await Promise.all([
    db.select({ id: subjects.id, code: subjects.code, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder)),
    db.select({ id: levels.id, code: levels.code, name: levels.nameAr }).from(levels).orderBy(asc(levels.sortOrder)),
    db.select({ id: streams.id, code: streams.code, name: streams.nameAr }).from(streams).where(isNull(streams.parentId)).orderBy(asc(streams.sortOrder))
  ])
  return { subjects: subj, levels: lvl, streams: str }
}

/** «كما رفعتها»: ملف = عنصر، النوع من النموذج أو من الاسم، والحلّ يُربط بالاسم */
export function manualItems(fileList: { id: string; name: string }[], d: BatchDefaults): BatchItem[] {
  const items: BatchItem[] = fileList.map((f, i) => {
    const guessed = guessDocType(f.name)
    const type: PublishType = guessed === 'SOLUTION' ? 'SOLUTION' : d.type === 'AUTO' ? guessed : d.type
    return { key: `i${i + 1}`, fileId: f.id, fileName: f.name, fromPage: null, toPage: null, type, title: f.name.replace(/\.[a-z0-9]{2,5}$/i, '').split(' / ').pop()!.trim(), subjectId: d.subjectId, levelId: d.levelId, streamId: d.streamId, term: d.term ?? guessTerm(f.name), year: d.year, solutionFor: null, include: true }
  })
  for (const it of items) {
    if (it.type !== 'SOLUTION') continue
    const k = solutionBaseName(it.title)
    it.solutionFor = items.find((x) => x.type !== 'SOLUTION' && solutionBaseName(x.title) === k)?.key ?? null
  }
  return items
}

export interface CreateBatchInput {
  fileIds: string[]
  mode: 'ai' | 'manual'
  defaults: BatchDefaults
}

function cleanDefaults(d: BatchDefaults, actor: Actor): BatchDefaults {
  const uuid = (v: string | null | undefined) => (v && UUID.test(v) ? v : null)
  return {
    type: d.type === 'AUTO' || (PUBLISH_TYPES as readonly string[]).includes(d.type) ? d.type : 'AUTO',
    subjectId: uuid(d.subjectId),
    levelId: uuid(d.levelId),
    streamId: uuid(d.streamId),
    term: d.term && d.term >= 1 && d.term <= 3 ? Math.floor(d.term) : null,
    year: d.year && d.year >= 1990 && d.year <= 2100 ? Math.floor(d.year) : null,
    audience: d.audience === 'GROUPS' ? 'GROUPS' : 'PUBLIC',
    groupIds: (d.groupIds ?? []).filter((g) => UUID.test(g)).slice(0, 50),
    author: (d.author ?? '').trim().slice(0, 120) || actor.fullName
  }
}

async function assertGroups(db: Db, actor: Actor, d: BatchDefaults) {
  if (d.audience !== 'GROUPS') return
  if (!d.groupIds.length) throw new AppError('VALIDATION', { field: 'groupIds' })
  const { admin, workspaceId } = staff(actor)
  const rows = await db.select({ id: groups.id, ws: groups.workspaceId }).from(groups).where(inArray(groups.id, d.groupIds))
  if (rows.length !== d.groupIds.length || (!admin && rows.some((g) => g.ws !== workspaceId))) throw new AppError('FORBIDDEN')
}

export async function createBatch(db: Db, actor: Actor, input: CreateBatchInput & { sourceContentId?: string | null }): Promise<{ id: string; status: string }> {
  const { workspaceId } = staff(actor)
  const d = cleanDefaults(input.defaults, actor)
  await assertGroups(db, actor, d)
  const expanded = await expandZips(db, actor, await ownedFiles(db, actor, input.fileIds))
  if (!expanded.length) throw new AppError('DRIVE_EMPTY')
  const ai = input.mode === 'ai'
  const [row] = await db
    .insert(uploadBatches)
    .values({ ownerUserId: actor.userId, workspaceId, status: ai ? 'ANALYZING' : 'READY', mode: input.mode, defaults: d, items: ai ? expanded.map((f, i) => ({ key: `f${i + 1}`, fileId: f.id, fileName: f.name, fromPage: null, toPage: null, type: 'EXERCISE', title: f.name, subjectId: null, levelId: null, streamId: null, term: null, year: null, solutionFor: null, include: true })) : manualItems(expanded, d), sourceContentId: input.sourceContentId ?? null })
    .returning({ id: uploadBatches.id, status: uploadBatches.status })
  if (ai) await enqueueJob(db, { type: 'AI_ORGANIZE_UPLOAD', payload: { batchId: row!.id, userId: actor.userId }, workspaceId, maxAttempts: 2 })
  return row!
}

/** المهمة الخلفية: قراءة الصفحات ← اقتراح الذكاء الاصطناعي (أو البديل الحتمي) ← عناصر جاهزة للمراجعة */
export async function runOrganizeUploadJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const batchId = String(job.payload.batchId ?? '')
  const [b] = await db.select().from(uploadBatches).where(eq(uploadBatches.id, batchId)).limit(1)
  if (!b || b.status !== 'ANALYZING') return { skipped: true }
  const ref = await lists(db)
  const codeOf = <T extends { id: string; code: string }>(l: T[], id: string | null) => (id ? (l.find((x) => x.id === id)?.code ?? null) : null)
  const d = b.defaults
  const fileRows = await db.select().from(files).where(inArray(files.id, b.items.map((i) => i.fileId)))
  const input: OrganizeUploadInput = {
    subjects: ref.subjects.map(({ code, name }) => ({ code, name })),
    levels: ref.levels.map(({ code, name }) => ({ code, name })),
    streams: ref.streams.map(({ code, name }) => ({ code, name })),
    hints: { type: d.type === 'AUTO' ? null : d.type, subjectCode: codeOf(ref.subjects, d.subjectId), levelCode: codeOf(ref.levels, d.levelId), streamCode: codeOf(ref.streams, d.streamId), term: d.term },
    files: []
  }
  const pageCounts = new Map<string, number | null>()
  for (const [n, it] of b.items.entries()) {
    const f = fileRows.find((x) => x.id === it.fileId)
    if (!f) continue
    const bytes = new Uint8Array(await storage().get(f.storageKey))
    const pages = f.mimeType === TEXT_MIME.pdf ? await pdfPagesText(bytes) : []
    pageCounts.set(it.key, pages.length || null)
    input.files.push({
      key: it.key,
      name: it.fileName,
      pageCount: pages.length || null,
      pages: pages.slice(0, PAGE_CAP).map((t, i) => ({ n: i + 1, text: t.replace(/\s+/g, ' ').slice(0, PAGE_CHARS) })),
      excerpt: pages.length ? null : (await extractDocText(bytes, f.mimeType).catch(() => '')).slice(0, 1500) || null
    })
    await updateJobProgress(db, job.id, { totalItems: b.items.length, processedItems: n + 1, progress: { phase: 'read' } })
  }
  const provider = getAiProvider()
  let out: OrganizeUploadOutput
  let note: string | null = null
  try {
    out = provider.organizeUpload ? await withAiTask({ task: 'publish_organize', userId: b.ownerUserId, entityType: 'upload_batch', entityId: b.id }, () => provider.organizeUpload!(input)) : heuristicOrganize(input)
  } catch (err) {
    note = `تعذّر اقتراح الذكاء الاصطناعي (${aiFailureReason(err)}) — اقتراح مبدئي من أسماء الملفات وعناوين الصفحات.`
    out = heuristicOrganize(input)
  }
  const idOf = <T extends { id: string; code: string }>(l: T[], code: string | null, fallback: string | null) => (code ? (l.find((x) => x.code === code)?.id ?? fallback) : fallback)
  const byKey = new Map(b.items.map((i) => [i.key, i]))
  const items: BatchItem[] = out.documents.map((doc, n) => {
    const src = byKey.get(doc.fileKey)!
    return {
      key: `d${n + 1}`,
      fileId: src.fileId,
      fileName: src.fileName,
      fromPage: doc.fromPage,
      toPage: doc.toPage,
      type: doc.type,
      title: doc.title,
      subjectId: idOf(ref.subjects, doc.subjectCode, d.subjectId),
      levelId: idOf(ref.levels, doc.levelCode, d.levelId),
      streamId: idOf(ref.streams, doc.streamCode, d.streamId),
      term: doc.term ?? d.term,
      year: doc.year ?? d.year,
      solutionFor: doc.solutionOf !== null ? `d${doc.solutionOf + 1}` : null,
      include: true
    }
  })
  await db.update(uploadBatches).set({ status: 'READY', items, note, updatedAt: new Date() }).where(eq(uploadBatches.id, b.id))
  await notify(db, { userId: b.ownerUserId, workspaceId: b.workspaceId, type: 'SYSTEM', title: 'اقتراح التنظيم جاهز للمراجعة', body: `${items.length} وثيقة مقترحة من ${b.items.length} ملفاً.${note ? ` ${note}` : ''}`, link: b.workspaceId ? `/teacher/publish/${b.id}` : `/admin/publish/${b.id}` }).catch(() => undefined)
  return { documents: items.length, note }
}

async function ownBatch(db: Db, actor: Actor, id: string) {
  const { admin } = staff(actor)
  if (!UUID.test(id)) throw new AppError('NOT_FOUND')
  const [b] = await db.select().from(uploadBatches).where(eq(uploadBatches.id, id)).limit(1)
  if (!b || (!admin && b.ownerUserId !== actor.userId)) throw new AppError('NOT_FOUND')
  return b
}

export async function getBatch(db: Db, actor: Actor, id: string) {
  const b = await ownBatch(db, actor, id)
  const ref = await lists(db)
  const groupRows = staff(actor).workspaceId ? await db.select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.workspaceId, staff(actor).workspaceId!)) : []
  return { batch: b, subjects: ref.subjects, levels: ref.levels, streams: ref.streams, groups: groupRows }
}

export async function listBatches(db: Db, actor: Actor, limit = 20) {
  staff(actor)
  return db.select({ id: uploadBatches.id, status: uploadBatches.status, mode: uploadBatches.mode, createdAt: uploadBatches.createdAt, publishedAt: uploadBatches.publishedAt, count: sql<number>`jsonb_array_length(${uploadBatches.items})` }).from(uploadBatches).where(eq(uploadBatches.ownerUserId, actor.userId)).orderBy(desc(uploadBatches.createdAt)).limit(limit)
}

/** يحفظ تعديلات المراجعة (النوع، العنوان، المادة، المستوى، الحلّ لِـ، تضمين) */
export async function saveBatchItems(db: Db, actor: Actor, id: string, edits: Partial<BatchItem>[], defaults?: Partial<BatchDefaults>) {
  const b = await ownBatch(db, actor, id)
  if (b.status !== 'READY') throw new AppError('VALIDATION', { field: 'status' })
  const uuid = (v: unknown, fallback: string | null) => (v === null || v === '' ? null : typeof v === 'string' && UUID.test(v) ? v : fallback)
  const keys = new Set(b.items.map((i) => i.key))
  const items = b.items.map((it) => {
    const e = edits.find((x) => x.key === it.key)
    if (!e) return it
    const type = (PUBLISH_TYPES as readonly string[]).includes(String(e.type)) ? (e.type as PublishType) : it.type
    return {
      ...it,
      type,
      title: typeof e.title === 'string' && e.title.trim() ? e.title.trim().slice(0, 200) : it.title,
      subjectId: e.subjectId !== undefined ? uuid(e.subjectId, it.subjectId) : it.subjectId,
      levelId: e.levelId !== undefined ? uuid(e.levelId, it.levelId) : it.levelId,
      streamId: e.streamId !== undefined ? uuid(e.streamId, it.streamId) : it.streamId,
      term: e.term === null ? null : typeof e.term === 'number' && e.term >= 1 && e.term <= 3 ? e.term : it.term,
      year: e.year === null ? null : typeof e.year === 'number' && e.year >= 1990 && e.year <= 2100 ? e.year : it.year,
      solutionFor: type === 'SOLUTION' ? (e.solutionFor === null || e.solutionFor === '' ? null : typeof e.solutionFor === 'string' && keys.has(e.solutionFor) && e.solutionFor !== it.key ? e.solutionFor : it.solutionFor) : null,
      include: e.include === undefined ? it.include : Boolean(e.include)
    }
  })
  const d = defaults ? cleanDefaults({ ...b.defaults, ...defaults } as BatchDefaults, actor) : b.defaults
  if (defaults) await assertGroups(db, actor, d)
  await db.update(uploadBatches).set({ items, defaults: d, updatedAt: new Date() }).where(eq(uploadBatches.id, b.id))
}

/** صفحات من ملف PDF ← ملف جديد */
async function slicePdf(bytes: Uint8Array, from: number, to: number): Promise<Uint8Array> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const out = await PDFDocument.create()
  const idx = Array.from({ length: to - from + 1 }, (_, i) => from - 1 + i).filter((i) => i < src.getPageCount())
  for (const p of await out.copyPages(src, idx)) out.addPage(p)
  return out.save()
}

/** النشر: لكل عنصر مضمَّن مورد في المكتبة (عامّ أو لأفواج)، ثم ربط كل حلّ بموضوعه */
export async function publishBatch(db: Db, actor: Actor, id: string): Promise<{ published: number; sections: Record<'exams' | 'lessons', number> }> {
  const b = await ownBatch(db, actor, id)
  if (b.status !== 'READY') throw new AppError('VALIDATION', { field: 'status' })
  const d = b.defaults
  await assertGroups(db, actor, d)
  const chosen = b.items.filter((i) => i.include)
  if (!chosen.length) throw new AppError('VALIDATION', { field: 'items' })
  // تفكيك كتاب سلسلة: كل عنصر يجب أن يكون موضوعاً محدّداً (صفحاته + مادته + فصله) وإلا لا يظهر في بطاقته الصحيحة.
  // حادثة 2026-10-23: نُشرت دفعات ناقصة التقسيم فاختلطت المواضيع؛ الآن يُرفض النشر ويُشار إلى العنصر الناقص.
  if (b.sourceContentId) {
    const bad = chosen.find((i) => !i.fromPage || !i.toPage || !i.subjectId || !i.levelId || (i.type !== 'SOLUTION' && !i.term) || (i.type === 'SOLUTION' && !i.solutionFor))
    if (bad) throw new AppError('VALIDATION', { field: 'items', item: bad.key, title: bad.title, reason: 'series_item_incomplete' })
  }
  const lvlRows = await db.select({ id: levels.id, stageId: levels.stageId }).from(levels)
  const stageOf = new Map(lvlRows.map((l) => [l.id, l.stageId]))
  const fileRows = await db.select().from(files).where(inArray(files.id, [...new Set(chosen.map((i) => i.fileId))]))
  const cache = new Map<string, Uint8Array>()
  const bytesOf = async (fileId: string) => {
    if (!cache.has(fileId)) cache.set(fileId, new Uint8Array(await storage().get(fileRows.find((f) => f.id === fileId)!.storageKey)))
    return cache.get(fileId)!
  }
  const resourceOf = new Map<string, string>()
  const sections = { exams: 0, lessons: 0 }
  for (const it of chosen) {
    const src = fileRows.find((f) => f.id === it.fileId)
    if (!src) continue
    let fileId = src.id
    if (it.fromPage && it.toPage && src.mimeType === TEXT_MIME.pdf) fileId = await storeNew(db, actor, b.workspaceId, `${it.title}.pdf`, TEXT_MIME.pdf, await slicePdf(await bytesOf(src.id), it.fromPage, it.toPage))
    const r = await upsertResource(db, {
      sourceCode: 'madrasadz',
      ref: `upload:${b.id}:${it.key}`,
      type: it.type,
      title: it.title,
      fileId,
      levelId: it.levelId,
      stageId: it.levelId ? (stageOf.get(it.levelId) ?? null) : null,
      subjectId: it.subjectId,
      streamId: it.streamId,
      schoolTerm: it.term,
      academicYear: it.year,
      originalAuthor: d.author,
      workspaceId: b.workspaceId,
      accessLevel: d.audience === 'GROUPS' ? 'GROUP' : 'PUBLIC',
      status: 'PUBLISHED',
      language: 'ar',
      metadata: { batchId: b.id, uploadedBy: actor.userId, fileName: it.fileName, pages: it.fromPage ? [it.fromPage, it.toPage] : null }
    })
    resourceOf.set(it.key, r.id)
    sections[SECTION_OF[it.type]]++
    if (d.audience === 'GROUPS') {
      await db.delete(resourceGroups).where(eq(resourceGroups.resourceId, r.id))
      await db.insert(resourceGroups).values(d.groupIds.map((groupId) => ({ resourceId: r.id, groupId }))).onConflictDoNothing()
    }
  }
  for (const it of chosen) {
    if (it.type !== 'SOLUTION' || !it.solutionFor) continue
    const sol = resourceOf.get(it.key)
    const target = resourceOf.get(it.solutionFor)
    if (sol && target) await db.update(resources).set({ hasSolution: true, solutionResourceId: sol, updatedAt: new Date() }).where(eq(resources.id, target))
  }
  const items = b.items.map((i) => ({ ...i, resourceId: resourceOf.get(i.key) ?? null }))
  await db.update(uploadBatches).set({ status: 'PUBLISHED', items, publishedAt: new Date(), updatedAt: new Date() }).where(eq(uploadBatches.id, b.id))
  // الكتاب الكامل يبقى منشوراً في «الدروس والموارد» (قرار المالك): التفكيك يضيف المواضيع ولا يسحب الكتاب
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: b.workspaceId, action: 'resources.publish', entityType: 'upload_batch', entityId: b.id, newValue: { published: resourceOf.size, audience: d.audience } })
  return { published: resourceOf.size, sections }
}

export interface PublishedRow {
  id: string
  title: string
  type: PublishType
  subjectName: string | null
  levelName: string | null
  access: string
  createdAt: Date
  hasSolution: boolean
}

/** ما نشره صاحب الحساب (المشرف: كل ما نُشر من صفحة «نشر») */
export async function listPublished(db: Db, actor: Actor, limit = 100): Promise<PublishedRow[]> {
  const { admin } = staff(actor)
  const rows = await db
    .select({ r: resources, subjectName: subjects.nameAr, levelName: levels.nameAr })
    .from(resources)
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .where(and(isNull(resources.deletedAt), sql`${resources.metadata} ? 'batchId'`, admin ? undefined : sql`${resources.metadata}->>'uploadedBy' = ${actor.userId}`))
    .orderBy(desc(resources.createdAt))
    .limit(limit)
  return rows.map((x) => ({ id: x.r.id, title: x.r.title, type: x.r.type as PublishType, subjectName: x.subjectName, levelName: x.levelName, access: x.r.accessLevel, createdAt: x.r.createdAt, hasSolution: x.r.hasSolution }))
}

export async function unpublishResource(db: Db, actor: Actor, resourceId: string): Promise<void> {
  const { admin } = staff(actor)
  if (!UUID.test(resourceId)) throw new AppError('NOT_FOUND')
  const [r] = await db.select().from(resources).where(and(eq(resources.id, resourceId), isNull(resources.deletedAt))).limit(1)
  const meta = (r?.metadata ?? {}) as { uploadedBy?: string; batchId?: string }
  if (!r || !meta.batchId || (!admin && meta.uploadedBy !== actor.userId)) throw new AppError('NOT_FOUND')
  await db.update(resources).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(resources.id, r.id))
  await db.update(resources).set({ hasSolution: false, solutionResourceId: null }).where(eq(resources.solutionResourceId, r.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: r.workspaceId, action: 'resources.unpublish', entityType: 'resource', entityId: r.id, oldValue: { title: r.title } })
}

/* ───────────── نقل السلاسل المجمَّعة من «الدروس والموارد» ───────────── */

export interface SeriesCandidate {
  id: string
  title: string
  levelName: string | null
  published: boolean
  batchId: string | null
}

/** محتوى PDF منشور في «الدروس» عنوانه سلسلة فروض/اختبارات/تمارين — يُقترح تفكيكه */
export async function listSeriesCandidates(db: Db, actor: Actor): Promise<SeriesCandidate[]> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({ id: content.id, title: content.title, publishedAt: content.publishedAt, levelName: levels.nameAr })
    .from(content)
    .leftJoin(levels, eq(levels.id, content.levelId))
    .where(and(isNull(content.deletedAt), eq(content.type, 'PDF'), sql`${content.fileId} is not null`, sql`(${content.title} ilike '%فروض%' or ${content.title} ilike '%اختبار%' or ${content.title} ilike '%تمارين%' or ${content.title} ilike '%سلسلة%')`))
    .orderBy(asc(content.title))
  const batches = await db.select({ id: uploadBatches.id, src: uploadBatches.sourceContentId }).from(uploadBatches).where(sql`${uploadBatches.sourceContentId} is not null`).orderBy(desc(uploadBatches.createdAt))
  return rows.map((r) => ({ id: r.id, title: r.title, levelName: r.levelName, published: Boolean(r.publishedAt), batchId: batches.find((b) => b.src === r.id)?.id ?? null }))
}

/** يفكّ سلسلة منشورة في «الدروس» إلى مواضيع منفصلة (اقتراح يُراجَع)؛ الكتاب الكامل يبقى في «الدروس» */
export async function createBatchFromContent(db: Db, actor: Actor, contentId: string): Promise<{ id: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!UUID.test(contentId)) throw new AppError('NOT_FOUND')
  const [c] = await db
    .select({ id: content.id, title: content.title, fileId: content.fileId, levelId: content.levelId, streamId: content.streamId, authorName: profiles.fullName })
    .from(content)
    .leftJoin(users, eq(users.id, content.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(content.id, contentId), isNull(content.deletedAt)))
    .limit(1)
  if (!c?.fileId) throw new AppError('NOT_FOUND')
  const term = guessTerm(c.title)
  return createBatch(db, actor, { fileIds: [c.fileId], mode: 'ai', sourceContentId: c.id, defaults: { type: 'AUTO', subjectId: null, levelId: c.levelId, streamId: c.streamId, term, year: null, audience: 'PUBLIC', groupIds: [], author: c.authorName ?? actor.fullName } })
}

/** خيارات النموذج: المواد والمستويات والشعب، وأفواج الأستاذ النشطة */
export async function publishFormOptions(db: Db, actor: Actor) {
  const { workspaceId } = staff(actor)
  const ref = await lists(db)
  const groupRows = workspaceId ? await db.select({ id: groups.id, name: groups.name }).from(groups).where(and(eq(groups.workspaceId, workspaceId), eq(groups.status, 'ACTIVE'))).orderBy(asc(groups.name)) : []
  return { subjects: ref.subjects.map(({ id, name }) => ({ id, name })), levels: ref.levels.map(({ id, name }) => ({ id, name })), streams: ref.streams.map(({ id, name }) => ({ id, name })), groups: groupRows }
}
