/**
 * المكتبة الموحّدة (Exam Builder — المرحلة 9).
 * بحث واحد على: الموارد (`resources`: دروس، ملخّصات، تمارين، فروض، امتحانات، فيديوهات…)،
 * وبنك الأسئلة العام، ومحتوى الأكاديمية المنشور. أقسام بالأعداد، ومركز لكل مادة.
 * للزائر: المنشور العام فقط. المصدر يُذكر دائماً تحت كل مورد.
 */
import { and, asc, desc, eq, inArray, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { bankQuestions, content, contentSources, curriculumNodes, examDocuments, levels, resources, streams, subjects } from '@/server/db/schema'
import type { ResourceType } from '@/server/db/schema/enums'
import { normalizeArabic } from '@/server/lib/arabic'
import { AppError } from '@/server/lib/errors'
import { tsQueryOf } from './question-bank.service'

/** أقسام المكتبة: مجموعات أنواع الموارد كما يراها التلميذ */
export const LIBRARY_SECTIONS = [
  { key: 'lessons', label: 'دروس وملخّصات', types: ['LESSON', 'SUMMARY'] as ResourceType[] },
  { key: 'exercises', label: 'تمارين وفروض', types: ['EXERCISE', 'HOMEWORK'] as ResourceType[] },
  { key: 'exams', label: 'اختبارات وامتحانات', types: ['TEST', 'EXAM', 'SOLUTION'] as ResourceType[] },
  { key: 'videos', label: 'فيديوهات', types: ['VIDEO'] as ResourceType[] },
  { key: 'other', label: 'وثائق أخرى', types: ['PEDAGOGICAL', 'OTHER'] as ResourceType[] }
] as const
export type LibrarySectionKey = (typeof LIBRARY_SECTIONS)[number]['key']

export const RESOURCE_TYPE_AR: Record<ResourceType, string> = { LESSON: 'درس', SUMMARY: 'ملخّص', EXERCISE: 'تمرين', HOMEWORK: 'فرض', TEST: 'اختبار', EXAM: 'امتحان', SOLUTION: 'تصحيح', VIDEO: 'فيديو', PEDAGOGICAL: 'وثيقة تربوية', OTHER: 'أخرى' }

export type LibraryHitKind = 'RESOURCE' | 'QUESTION' | 'CONTENT'

export interface LibraryHit {
  kind: LibraryHitKind
  id: string
  title: string
  snippet: string | null
  typeLabel: string
  subjectName: string | null
  levelName: string | null
  /** رابط داخلي أو خارجي (المصدر) */
  href: string
  external: boolean
  source: string | null
  official: boolean
  year: number | null
  rank: number
}

export interface LibrarySearchFilter {
  q: string
  subjectId?: string | null
  levelId?: string | null
  streamId?: string | null
  section?: LibrarySectionKey | null
  kinds?: LibraryHitKind[]
  limit?: number
}

const esc = (s: string) => s.replace(/[%_\\]/g, (c) => `\\${c}`)

/** شرط الموارد المنشورة العامة (ما يراه الزائر) */
const publicResources = () => and(isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.accessLevel, 'PUBLIC'))

/** رابط المورد: فيديو الدليل داخلياً، وإلا الملف أو صفحة المصدر */
export function resourceHref(r: { id: string; type: string; educatorId: string | null; fileUrl: string | null; sourceUrl: string | null; youtubeVideoId: string | null }): { href: string; external: boolean } {
  if (r.type === 'VIDEO' && r.educatorId) return { href: `/videos/${r.id}`, external: false }
  if (r.fileUrl) return { href: r.fileUrl, external: true }
  if (r.sourceUrl) return { href: r.sourceUrl, external: true }
  if (r.youtubeVideoId) return { href: `https://www.youtube.com/watch?v=${r.youtubeVideoId}`, external: true }
  return { href: '#', external: false }
}

/** بحث موحّد: tsquery على الفهرس ثم ILIKE احتياطاً؛ النتائج مرتّبة بالصلة ثم الأحدث */
export async function librarySearch(db: Db, f: LibrarySearchFilter): Promise<{ hits: LibraryHit[]; total: number }> {
  const q = f.q.trim()
  if (q.length < 2) return { hits: [], total: 0 }
  const limit = Math.max(1, Math.min(60, f.limit ?? 30))
  const kinds = f.kinds?.length ? f.kinds : (['RESOURCE', 'QUESTION', 'CONTENT'] as LibraryHitKind[])
  const ts = tsQueryOf(q)
  const like = `%${esc(normalizeArabic(q))}%`
  const likeRaw = `%${esc(q)}%`
  const section = f.section ? LIBRARY_SECTIONS.find((s) => s.key === f.section) : null
  const hits: LibraryHit[] = []

  if (kinds.includes('RESOURCE')) {
    const match: SQL = ts ? or(sql`${resources}."search" @@ to_tsquery('simple', ${ts})`, sql`${resources.title} ilike ${likeRaw}`)! : sql`${resources.title} ilike ${likeRaw}`
    const rank = ts ? sql<number>`ts_rank(${resources}."search", to_tsquery('simple', ${ts}))` : sql<number>`0`
    const rows = await db
      .select({ r: resources, rank, subjectName: subjects.nameAr, levelName: levels.nameAr, source: contentSources.name })
      .from(resources)
      .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
      .leftJoin(subjects, eq(subjects.id, resources.subjectId))
      .leftJoin(levels, eq(levels.id, resources.levelId))
      .where(
        and(
          publicResources(),
          match,
          f.subjectId ? eq(resources.subjectId, f.subjectId) : undefined,
          f.levelId ? eq(resources.levelId, f.levelId) : undefined,
          f.streamId ? or(eq(resources.streamId, f.streamId), isNull(resources.streamId)) : undefined,
          section ? inArray(resources.type, [...section.types]) : undefined
        )
      )
      .orderBy(desc(rank), desc(resources.isOfficial), desc(resources.createdAt))
      .limit(limit)
    for (const x of rows) {
      const link = resourceHref(x.r)
      hits.push({ kind: 'RESOURCE', id: x.r.id, title: x.r.title, snippet: x.r.description?.slice(0, 160) ?? null, typeLabel: RESOURCE_TYPE_AR[x.r.type as ResourceType] ?? x.r.type, subjectName: x.subjectName, levelName: x.levelName, href: link.href, external: link.external, source: x.source, official: x.r.isOfficial, year: x.r.examYear, rank: Number(x.rank) + (x.r.isOfficial ? 0.1 : 0) })
    }
  }

  if (kinds.includes('QUESTION') && (!section || section.key === 'exercises')) {
    const match: SQL = ts ? or(sql`${bankQuestions}."search" @@ to_tsquery('simple', ${ts})`, sql`${bankQuestions.searchText} ilike ${like}`)! : sql`${bankQuestions.searchText} ilike ${like}`
    const rank = ts ? sql<number>`ts_rank(${bankQuestions}."search", to_tsquery('simple', ${ts}))` : sql<number>`0`
    const rows = await db
      .select({ q: bankQuestions, rank, subjectName: subjects.nameAr, levelName: levels.nameAr })
      .from(bankQuestions)
      .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
      .leftJoin(levels, eq(levels.id, bankQuestions.levelId))
      .where(
        and(
          isNull(bankQuestions.deletedAt),
          isNull(bankQuestions.parentId),
          eq(bankQuestions.status, 'PUBLISHED'),
          eq(bankQuestions.visibility, 'PUBLIC'),
          match,
          f.subjectId ? eq(bankQuestions.subjectId, f.subjectId) : undefined,
          f.levelId ? eq(bankQuestions.levelId, f.levelId) : undefined,
          f.streamId ? or(eq(bankQuestions.streamId, f.streamId), isNull(bankQuestions.streamId)) : undefined
        )
      )
      .orderBy(desc(rank), desc(bankQuestions.usageCount))
      .limit(limit)
    for (const x of rows) hits.push({ kind: 'QUESTION', id: x.q.id, title: x.q.title ?? x.q.body.slice(0, 80), snippet: x.q.body.slice(0, 160), typeLabel: x.q.kind === 'EXERCISE' ? 'تمرين من البنك' : 'سؤال من البنك', subjectName: x.subjectName, levelName: x.levelName, href: `/library/q/${x.q.id}`, external: false, source: x.q.sourceLabel, official: false, year: x.q.sourceYear, rank: Number(x.rank) })
  }

  if (kinds.includes('CONTENT') && (!section || section.key === 'lessons' || section.key === 'videos')) {
    const rows = await db
      .select({ id: content.id, slug: content.slug, title: content.title, summary: content.summary, type: content.type, levelName: levels.nameAr })
      .from(content)
      .leftJoin(levels, eq(levels.id, content.levelId))
      .where(and(isNull(content.deletedAt), eq(content.visibility, 'PUBLIC'), sql`${content.publishedAt} is not null`, or(sql`${content.title} ilike ${likeRaw}`, sql`${content.topic} ilike ${likeRaw}`, sql`${content.summary} ilike ${likeRaw}`), section?.key === 'videos' ? eq(content.type, 'VIDEO') : undefined, f.levelId ? eq(content.levelId, f.levelId) : undefined))
      .orderBy(desc(content.publishedAt))
      .limit(limit)
    for (const x of rows) hits.push({ kind: 'CONTENT', id: x.id, title: x.title, snippet: x.summary?.slice(0, 160) ?? null, typeLabel: x.type === 'VIDEO' ? 'درس مرئي' : 'درس من الأكاديمية', subjectName: null, levelName: x.levelName, href: `/lessons/${x.slug ?? x.id}`, external: false, source: 'منصة مدرسة', official: false, year: null, rank: 0.05 })
  }

  hits.sort((a, b) => b.rank - a.rank)
  return { hits: hits.slice(0, limit), total: hits.length }
}

export interface LibrarySection {
  key: LibrarySectionKey
  label: string
  count: number
}

/** أقسام المكتبة بأعدادها (+ بنك الأسئلة العام والبكالوريات الرسمية) */
export async function librarySections(db: Db, scope: { subjectId?: string | null; levelId?: string | null } = {}): Promise<{ sections: LibrarySection[]; questions: number; officialExams: number; total: number }> {
  const where = and(publicResources(), scope.subjectId ? eq(resources.subjectId, scope.subjectId) : undefined, scope.levelId ? eq(resources.levelId, scope.levelId) : undefined)
  const [byType, [q], [official]] = await Promise.all([
    db.select({ type: resources.type, n: sql<number>`count(*)::int` }).from(resources).where(where).groupBy(resources.type),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bankQuestions)
      .where(and(isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'PUBLISHED'), eq(bankQuestions.visibility, 'PUBLIC'), scope.subjectId ? eq(bankQuestions.subjectId, scope.subjectId) : undefined, scope.levelId ? eq(bankQuestions.levelId, scope.levelId) : undefined)),
    db.select({ n: sql<number>`count(*)::int` }).from(resources).where(and(where, eq(resources.isOfficial, true), eq(resources.type, 'EXAM')))
  ])
  const n = new Map(byType.map((x) => [x.type, x.n]))
  const sections = LIBRARY_SECTIONS.map((s) => ({ key: s.key, label: s.label, count: s.types.reduce((a, t) => a + (n.get(t) ?? 0), 0) }))
  return { sections, questions: q?.n ?? 0, officialExams: official?.n ?? 0, total: byType.reduce((a, x) => a + x.n, 0) }
}

export interface SubjectOverview {
  id: string
  slug: string
  name: string
  resources: number
  questions: number
  videos: number
}

/** المواد بأعدادها — واجهة المكتبة */
export async function subjectsOverview(db: Db): Promise<SubjectOverview[]> {
  const [rows, bank, vids] = await Promise.all([
    db.select({ id: subjects.id, slug: subjects.slug, name: subjects.nameAr, n: sql<number>`count(${resources.id})::int` }).from(subjects).leftJoin(resources, and(eq(resources.subjectId, subjects.id), publicResources())).groupBy(subjects.id, subjects.slug, subjects.nameAr, subjects.sortOrder).orderBy(asc(subjects.sortOrder)),
    db.select({ subjectId: bankQuestions.subjectId, n: sql<number>`count(*)::int` }).from(bankQuestions).where(and(isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'PUBLISHED'), eq(bankQuestions.visibility, 'PUBLIC'))).groupBy(bankQuestions.subjectId),
    db.select({ subjectId: resources.subjectId, n: sql<number>`count(*)::int` }).from(resources).where(and(publicResources(), eq(resources.type, 'VIDEO'))).groupBy(resources.subjectId)
  ])
  const b = new Map(bank.map((x) => [x.subjectId, x.n]))
  const v = new Map(vids.map((x) => [x.subjectId, x.n]))
  return rows.map((r) => ({ id: r.id, slug: r.slug, name: r.name, resources: r.n, questions: b.get(r.id) ?? 0, videos: v.get(r.id) ?? 0 })).filter((r) => r.resources + r.questions > 0 || true)
}

export interface SubjectHub {
  subject: { id: string; slug: string; name: string }
  levels: { id: string; name: string; count: number }[]
  sections: LibrarySection[]
  questions: number
  officialExams: number
  /** الوحدات/الدروس بعدد مواردها (للصف المختار) */
  lessons: { id: string; title: string; kind: string; parentId: string | null; count: number }[]
  /** أحدث الموارد لكل قسم */
  latest: Record<LibrarySectionKey, LibraryHit[]>
  /** السنوات المتاحة للامتحانات الرسمية */
  examYears: number[]
}

/** مركز المادة: صفوفها، أقسامها، دروسها بالأعداد، وأحدث مواردها */
export async function subjectHub(db: Db, slug: string, scope: { levelId?: string | null } = {}): Promise<SubjectHub> {
  const [s] = await db.select({ id: subjects.id, slug: subjects.slug, name: subjects.nameAr }).from(subjects).where(eq(subjects.slug, slug)).limit(1)
  if (!s) throw new AppError('NOT_FOUND')
  const base = and(publicResources(), eq(resources.subjectId, s.id))
  const [levelRows, secs, lessonRows, years] = await Promise.all([
    db.select({ id: levels.id, name: levels.nameAr, count: sql<number>`count(${resources.id})::int` }).from(levels).leftJoin(resources, and(eq(resources.levelId, levels.id), base)).groupBy(levels.id, levels.nameAr, levels.sortOrder).orderBy(asc(levels.sortOrder)),
    librarySections(db, { subjectId: s.id, levelId: scope.levelId ?? null }),
    scope.levelId
      ? db
          .select({ id: curriculumNodes.id, title: curriculumNodes.title, kind: curriculumNodes.kind, parentId: curriculumNodes.parentId, count: sql<number>`count(${resources.id})::int` })
          .from(curriculumNodes)
          .leftJoin(resources, and(eq(resources.curriculumNodeId, curriculumNodes.id), publicResources()))
          .where(and(eq(curriculumNodes.subjectId, s.id), eq(curriculumNodes.levelId, scope.levelId)))
          .groupBy(curriculumNodes.id, curriculumNodes.title, curriculumNodes.kind, curriculumNodes.parentId, curriculumNodes.sortOrder)
          .orderBy(asc(curriculumNodes.sortOrder), asc(curriculumNodes.title))
      : Promise.resolve([]),
    db
      .select({ y: resources.examYear })
      .from(resources)
      .where(and(base, eq(resources.isOfficial, true), sql`${resources.examYear} is not null`))
      .groupBy(resources.examYear)
      .orderBy(desc(resources.examYear))
  ])
  const latest = {} as Record<LibrarySectionKey, LibraryHit[]>
  for (const sec of LIBRARY_SECTIONS) {
    const rows = await db
      .select({ r: resources, levelName: levels.nameAr, source: contentSources.name })
      .from(resources)
      .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
      .leftJoin(levels, eq(levels.id, resources.levelId))
      .where(and(base, inArray(resources.type, [...sec.types]), scope.levelId ? eq(resources.levelId, scope.levelId) : undefined))
      .orderBy(desc(resources.isOfficial), desc(resources.examYear), desc(resources.createdAt))
      .limit(6)
    latest[sec.key] = rows.map((x) => {
      const link = resourceHref(x.r)
      return { kind: 'RESOURCE' as const, id: x.r.id, title: x.r.title, snippet: x.r.description?.slice(0, 120) ?? null, typeLabel: RESOURCE_TYPE_AR[x.r.type as ResourceType] ?? x.r.type, subjectName: s.name, levelName: x.levelName, href: link.href, external: link.external, source: x.source, official: x.r.isOfficial, year: x.r.examYear, rank: 0 }
    })
  }
  return { subject: s, levels: levelRows.filter((l) => l.count > 0), sections: secs.sections, questions: secs.questions, officialExams: secs.officialExams, lessons: lessonRows, latest, examYears: years.map((y) => y.y!).filter(Boolean) }
}

/** سؤال عام من البنك للعرض في المكتبة (بلا مفتاح الإجابة؛ الحلّ يُعرض لأنه مادة تعلّم) */
export async function publicQuestion(db: Db, id: string) {
  const [row] = await db
    .select({ q: bankQuestions, subjectName: subjects.nameAr, levelName: levels.nameAr, streamName: streams.nameAr, nodeTitle: curriculumNodes.title, originalResourceId: examDocuments.resourceId })
    .from(bankQuestions)
    .leftJoin(subjects, eq(subjects.id, bankQuestions.subjectId))
    .leftJoin(levels, eq(levels.id, bankQuestions.levelId))
    .leftJoin(streams, eq(streams.id, bankQuestions.streamId))
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, bankQuestions.curriculumNodeId))
    .leftJoin(examDocuments, eq(examDocuments.id, bankQuestions.documentId))
    .where(and(eq(bankQuestions.id, id), isNull(bankQuestions.deletedAt), isNull(bankQuestions.parentId), eq(bankQuestions.status, 'PUBLISHED'), eq(bankQuestions.visibility, 'PUBLIC')))
    .limit(1)
  if (!row) throw new AppError('NOT_FOUND')
  const children = await db.select().from(bankQuestions).where(and(eq(bankQuestions.parentId, id), isNull(bankQuestions.deletedAt), eq(bankQuestions.status, 'PUBLISHED'))).orderBy(asc(bankQuestions.sortOrder))
  return { ...row, children }
}
