/**
 * المكتبة الموحّدة: كل مورد — مهما كان مصدره — يُحفظ هنا مصنّفاً بمعرّفات المنهاج.
 * الإدراج idempotent بالبصمة: تشغيل أي مستورد مرّتين لا يضاعف شيئاً.
 */
import { createHash } from 'node:crypto'
import { and, count, desc, eq, inArray, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bacExams, contentSources, levels, resources, streams, subjects, type ResourceInsert } from '@/server/db/schema'
import type { AccessLevel, ResourceStatus, ResourceType } from '@/server/db/schema/enums'
import { normalizeArabic } from '@/server/lib/arabic'
import { AppError } from '@/server/lib/errors'

/* --------------------------------- البصمات --------------------------------- */

/** رابط موحّد: بلا وسوم تتبّع ولا شرطة أخيرة ولا مقطع (#)، والمضيف بحروف صغيرة */
export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim())
    u.hash = ''
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|ref$)/i.test(k)) u.searchParams.delete(k)
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, '')
    return u.toString().replace(/\/+$/, '').replace(/\/\?/, '?')
  } catch {
    return url.trim()
  }
}

/** بصمة مورد عند مصدره: الرمز + المرجع (معرّف خارجي أو رابط موحّد) */
export function fingerprintOf(sourceCode: string, ref: string, part?: string): string {
  const key = /^https?:\/\//i.test(ref) ? normalizeUrl(ref) : ref.trim()
  return `${sourceCode}:${key}${part ? `#${part}` : ''}`
}

/** بصمة المحتوى نفسه (نص مطبَّع): تكشف الملف نفسه منشوراً في مصدرين */
export function contentHashOf(text: string): string {
  return createHash('sha256').update(normalizeArabic(text)).digest('hex')
}

/* --------------------------------- الإدراج --------------------------------- */

export type ResourceInput = Omit<ResourceInsert, 'id' | 'sourceId' | 'fingerprint' | 'createdAt' | 'updatedAt' | 'deletedAt'> & {
  sourceCode: string
  /** مرجع ثابت عند المصدر (رابط الصفحة، معرّف الفيديو…) — منه تُشتقّ البصمة */
  ref: string
  /** جزء داخل المرجع نفسه (مثل «correction» لحلّ في صفحة الموضوع) */
  part?: string
}

/** معرّفات المصادر لكل قاعدة على حدة (قاعدتان في نفس العملية — كالاختبارات — لا تتشاركان معرّفات) */
const sourceCache = new WeakMap<Db, Map<string, string>>()
async function sourceIdOf(db: Db, code: string): Promise<string> {
  const cache = sourceCache.get(db) ?? new Map<string, string>()
  sourceCache.set(db, cache)
  const hit = cache.get(code)
  if (hit) return hit
  const [s] = await db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.code, code)).limit(1)
  if (!s) throw new AppError('NOT_FOUND', { source: code })
  cache.set(code, s.id)
  return s.id
}

/**
 * يُنشئ المورد أو يحدّث بيانات مصدره إن كان موجوداً (نفس البصمة).
 * لا يمسّ حالة مورد راجعه المشرف (ARCHIVED) ولا تصنيفاً صحّحه يدوياً (metadata.manual = true).
 */
export async function upsertResource(db: Db, input: ResourceInput): Promise<{ id: string; created: boolean }> {
  if (input.isOfficial && input.isAiGenerated) throw new AppError('VALIDATION', { field: 'isOfficial' })
  const { sourceCode, ref, part, ...fields } = input
  const fingerprint = fingerprintOf(sourceCode, ref, part)
  const sourceId = await sourceIdOf(db, sourceCode)
  const [existing] = await db.select({ id: resources.id, status: resources.status, metadata: resources.metadata }).from(resources).where(eq(resources.fingerprint, fingerprint)).limit(1)
  if (!existing) {
    const [row] = await db
      .insert(resources)
      .values({ ...fields, sourceId, fingerprint })
      .onConflictDoNothing({ target: resources.fingerprint })
      .returning({ id: resources.id })
    if (row) return { id: row.id, created: true }
    // سباق بين مستوردَين: الآخر أدرجه للتوّ
    const [again] = await db.select({ id: resources.id }).from(resources).where(eq(resources.fingerprint, fingerprint)).limit(1)
    return { id: again!.id, created: false }
  }
  const manual = (existing.metadata as { manual?: boolean }).manual === true
  const patch: Partial<ResourceInsert> = {
    title: fields.title,
    sourceUrl: fields.sourceUrl,
    fileUrl: fields.fileUrl,
    thumbnailUrl: fields.thumbnailUrl,
    hasSolution: fields.hasSolution,
    solutionResourceId: fields.solutionResourceId,
    lastCheckedAt: new Date(),
    metadata: { ...(existing.metadata as object), ...(fields.metadata ?? {}) }
  }
  if (!manual) Object.assign(patch, { levelId: fields.levelId, stageId: fields.stageId, streamId: fields.streamId, subjectId: fields.subjectId, examYear: fields.examYear, type: fields.type })
  if (existing.status === 'ARCHIVED') delete patch.title
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) if (patch[k] === undefined) delete patch[k]
  await db.update(resources).set(patch).where(eq(resources.id, existing.id))
  return { id: existing.id, created: false }
}

/* --------------------------------- القراءة --------------------------------- */

export interface ResourceFilter {
  stageId?: string | null
  levelId?: string | null
  streamId?: string | null
  subjectId?: string | null
  curriculumNodeId?: string | null
  types?: ResourceType[]
  examYear?: number | null
  sourceCode?: string | null
  isOfficial?: boolean
  statuses?: ResourceStatus[]
  /** ما يُسمح للزائر برؤيته (افتراضياً العموم فقط) */
  access?: AccessLevel[]
}

/** ترقيم بالمؤشّر (created_at, id): ثابت السرعة مهما كبرت المكتبة، بلا OFFSET */
export async function listResources(db: Db, f: ResourceFilter, page: { cursor?: string | null; limit?: number } = {}) {
  const limit = Math.max(1, Math.min(100, page.limit ?? 30))
  const where: (SQL | undefined)[] = [
    isNull(resources.deletedAt),
    inArray(resources.status, f.statuses ?? ['PUBLISHED']),
    inArray(resources.accessLevel, f.access ?? ['PUBLIC']),
    f.stageId ? eq(resources.stageId, f.stageId) : undefined,
    f.levelId ? eq(resources.levelId, f.levelId) : undefined,
    f.streamId ? or(eq(resources.streamId, f.streamId), isNull(resources.streamId)) : undefined,
    f.subjectId ? eq(resources.subjectId, f.subjectId) : undefined,
    f.curriculumNodeId ? eq(resources.curriculumNodeId, f.curriculumNodeId) : undefined,
    f.types?.length ? inArray(resources.type, f.types) : undefined,
    f.examYear ? eq(resources.examYear, f.examYear) : undefined,
    f.isOfficial !== undefined ? eq(resources.isOfficial, f.isOfficial) : undefined,
    f.sourceCode ? eq(contentSources.code, f.sourceCode) : undefined
  ]
  if (page.cursor) {
    const [at, id] = Buffer.from(page.cursor, 'base64url').toString().split('|')
    if (at && id) where.push(or(lt(resources.createdAt, new Date(at)), and(eq(resources.createdAt, new Date(at)), lt(resources.id, id))))
  }
  const rows = await db
    .select({ r: resources, source: { code: contentSources.code, name: contentSources.name, attribution: contentSources.attribution }, subjectName: subjects.nameAr, levelName: levels.nameAr, streamName: streams.nameAr })
    .from(resources)
    .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .leftJoin(streams, eq(streams.id, resources.streamId))
    .where(and(...where))
    .orderBy(desc(resources.createdAt), desc(resources.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit)
  const last = items[items.length - 1]
  const nextCursor = rows.length > limit && last ? Buffer.from(`${last.r.createdAt.toISOString()}|${last.r.id}`).toString('base64url') : null
  return { items, nextCursor }
}

/** أرقام لوحة الإدارة: حسب المصدر والنوع والحالة */
export async function resourceStats(db: Db) {
  const [bySource, byType, byStatus, flags] = await Promise.all([
    db.select({ code: contentSources.code, name: contentSources.name, n: count() }).from(resources).innerJoin(contentSources, eq(contentSources.id, resources.sourceId)).where(isNull(resources.deletedAt)).groupBy(contentSources.code, contentSources.name),
    db.select({ type: resources.type, n: count() }).from(resources).where(isNull(resources.deletedAt)).groupBy(resources.type),
    db.select({ status: resources.status, n: count() }).from(resources).where(isNull(resources.deletedAt)).groupBy(resources.status),
    db
      .select({ total: count(), official: sql<number>`count(*) filter (where ${resources.isOfficial})::int`, ai: sql<number>`count(*) filter (where ${resources.isAiGenerated})::int`, unclassified: sql<number>`count(*) filter (where ${resources.subjectId} is null)::int` })
      .from(resources)
      .where(isNull(resources.deletedAt))
  ])
  return { bySource, byType, byStatus, ...(flags[0] ?? { total: 0, official: 0, ai: 0, unclassified: 0 }) }
}

/* ---------------- نقل أرشيف البكالوريا القديم إلى النموذج الموحّد ---------------- */

/** رموز مواد DzExams ← رموز موادّنا */
export const DZEXAMS_SUBJECTS: Record<string, string> = {
  arabe: 'ARABIC',
  mathematiques: 'MATH',
  physique: 'PHYSICS',
  'sciences-naturelles': 'SCIENCES',
  francais: 'FRENCH',
  anglais: 'ENGLISH',
  'histoire-geographie': 'HISTGEO',
  philosophie: 'PHILO',
  'sciences-islamiques': 'ISLAMIC',
  islamique: 'ISLAMIC',
  comptabilite: 'ACCOUNTING',
  economie: 'ECONOMICS',
  droit: 'LAW',
  allemand: 'GERMAN',
  espagnol: 'SPANISH',
  italien: 'ITALIAN',
  amazigh: 'AMAZIGH',
  tamazight: 'AMAZIGH',
  'genie-civil': 'TECH_CIVIL',
  'genie-mecanique': 'TECH_MECA',
  'genie-electrique': 'TECH_ELEC',
  'genie-des-procedes': 'TECH_PROC'
}

/** الشعبة من رمز صفحتها عند DzExams أو من اسمها في العنوان */
export function streamCodeOf(slug: string | null, name: string | null): string | null {
  const bySlug: Record<string, string> = { se: 'SCI', m: 'MATH', mt: 'TM', tm: 'TM', ge: 'GE', lp: 'LIT', le: 'LANG' }
  if (slug && bySlug[slug.toLowerCase()]) return bySlug[slug.toLowerCase()]!
  const n = normalizeArabic(name ?? '')
  if (!n) return null
  if (/تجريبي|ع ت\b/.test(n)) return 'SCI'
  if (/تقني/.test(n)) return 'TM'
  if (/تسيير|اقتصاد/.test(n)) return 'GE'
  if (/لغات|ل ا\b/.test(n)) return 'LANG'
  if (/اداب|فلسف|ا ف\b/.test(n)) return 'LIT'
  if (/رياضي/.test(n)) return 'MATH'
  return null
}

/**
 * ينقل صفوف bac_exams إلى resources (الموضوع مورد EXAM رسمي، والتصحيح مورد SOLUTION مربوط به).
 * idempotent: البصمة هي رابط صفحة الموضوع. الجدول القديم يبقى ويبقى /past-bac يعمل.
 */
export async function backfillBacExams(db: Db): Promise<{ exams: number; solutions: number }> {
  const rows = await db.select().from(bacExams)
  if (rows.length === 0) return { exams: 0, solutions: 0 }
  // قاعدة لم يُزرع فيها المنهاج بعد (bootstrap يزرعه أولاً): لا نقل، والجدول القديم يبقى صالحاً
  const [src] = await db.select({ id: contentSources.id }).from(contentSources).where(eq(contentSources.code, 'dzexams')).limit(1)
  if (!src) return { exams: 0, solutions: 0 }
  const [secondary3] = await db.select({ id: levels.id, stageId: levels.stageId }).from(levels).where(eq(levels.code, '3AS')).limit(1)
  const subjectIds = new Map((await db.select({ id: subjects.id, code: subjects.code }).from(subjects)).map((s) => [s.code, s.id]))
  const streamIds = new Map((await db.select({ id: streams.id, code: streams.code }).from(streams)).map((s) => [s.code, s.id]))
  let exams = 0
  let solutions = 0
  for (const b of rows) {
    const subjectCode = DZEXAMS_SUBJECTS[b.subjectSlug]
    const streamCode = streamCodeOf(b.streamSlug, b.streamName ?? b.title)
    const common = {
      stageId: secondary3?.stageId ?? null,
      levelId: secondary3?.id ?? null,
      streamId: streamCode ? (streamIds.get(streamCode) ?? null) : null,
      subjectId: subjectCode ? (subjectIds.get(subjectCode) ?? null) : null,
      examYear: b.year,
      examSession: 'NORMAL',
      isOfficial: true,
      sourceCode: 'dzexams',
      ref: b.pageUrl,
      sourceUrl: b.pageUrl,
      originalAuthor: 'الديوان الوطني للامتحانات والمسابقات',
      accessLevel: 'PUBLIC' as const,
      // ما لم تُعرف مادته يُعرض على المراجعة بدل أن يضيع في المكتبة
      status: (subjectCode ? 'PUBLISHED' : 'NEEDS_REVIEW') as ResourceStatus
    }
    let solutionId: string | null = null
    if (b.correctionUrl) {
      const s = await upsertResource(db, { ...common, type: 'SOLUTION', part: 'correction', title: `تصحيح: ${b.title}`, fileUrl: b.correctionUrl, metadata: { bacExamId: b.id } })
      solutionId = s.id
      if (s.created) solutions++
    }
    const e = await upsertResource(db, { ...common, type: 'EXAM', title: b.title, fileUrl: b.examUrl, hasSolution: !!b.correctionUrl, solutionResourceId: solutionId, metadata: { bacExamId: b.id, dzexamsSubject: b.subjectSlug } })
    if (e.created) exams++
  }
  return { exams, solutions }
}
