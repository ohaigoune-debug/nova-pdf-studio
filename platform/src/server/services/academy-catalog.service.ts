/**
 * أكاديمية 2027 — اكتشاف الدورات والمحتوى المجاني بمعزل عن حقّ الوصول.
 *
 * المبدأ: «أرى الدورة» ≠ «أدخل الدورة». الكتالوج يعرض كل دورة منشورة غير محذوفة لأي تلميذ
 * ببيانات العرض فقط (اسم، وصف، أستاذ، موسم، مستوى، شعب، مادة، سعر)، ولا يُرجع أبداً أجسام الدروس
 * أو معرّفات الملفات أو روابط الفيديو/الحصص. الدخول إلى المحتوى يبقى في courseHome (اشتراك ساري + شروط).
 *
 * الأفواج تبقى كما هي: الدورة = فوج خلفي، والتفعيل = عضوية فيه (courses.service). هنا قراءة فقط.
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  content,
  contentTargets,
  courseEnrollments,
  courseProducts,
  courses,
  curriculumNodes,
  groups,
  levels,
  products,
  resources,
  streams,
  students,
  subjects,
  teachers
} from '@/server/db/schema'
import type { ResourceType } from '@/server/db/schema/enums'
import { studentIdOf, type Actor } from '@/server/lib/actor'
import { reachableGroupIds } from '@/server/lib/course-access'
import { AppError } from '@/server/lib/errors'
import { PICKER_LEVELS } from '@/lib/levels'
import { signFileUrl } from '@/server/lib/storage'
import { bacExclusionClauses, notAttachedSolution, PRACTICE_KINDS, visibleResources } from './library.service'
import { subjectsFor } from './taxonomy.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidOrNull = (v: string | null | undefined) => (v && UUID.test(v) ? v : null)

/**
 * عائلة الشعبة: الشعبة نفسها وأمّها (وجدّتها إن وُجدت). «تقني رياضي — هندسة مدنية» يرى أيضًا ما صُنّف
 * للشعبة الأم «تقني رياضي». يعود [] إن لم تُحدَّد شعبة (= كل الشعب).
 */
export async function streamFamily(db: Db, streamId: string | null | undefined): Promise<string[]> {
  if (!streamId) return []
  const out: string[] = []
  let cur: string | null = streamId
  for (let i = 0; cur && i < 4; i++) {
    const [row] = await db.select({ id: streams.id, parentId: streams.parentId }).from(streams).where(eq(streams.id, cur)).limit(1)
    if (!row) break
    out.push(row.id)
    cur = row.parentId
  }
  return out
}

/* ------------------------------- نطاق التلميذ ------------------------------- */

export interface BrowseScope {
  levelId: string | null
  streamId: string | null
  subjectId: string | null
}

/**
 * نطاق التصفّح: ما في الرابط أولاً (level/stream/subject)، وإلا مستوى التلميذ وشعبته من ملفه.
 * لا يُعدَّل ملف التلميذ أبداً بمجرّد التصفّح.
 */
export async function browseScope(db: Db, actor: Actor, fromUrl: Partial<Record<'level' | 'stream' | 'subject', string | undefined>> = {}): Promise<BrowseScope & { fromProfile: boolean }> {
  const studentId = studentIdOf(actor)
  const [me] = await db.select({ levelId: students.levelId, streamId: students.streamId }).from(students).where(eq(students.id, studentId)).limit(1)
  const explicit = fromUrl.level !== undefined || fromUrl.stream !== undefined
  const levelId = fromUrl.level === 'all' ? null : (uuidOrNull(fromUrl.level) ?? (explicit ? null : (me?.levelId ?? null)))
  const streamId = fromUrl.stream === 'all' || !levelId ? null : (uuidOrNull(fromUrl.stream) ?? (explicit ? null : (me?.streamId ?? null)))
  return { levelId, streamId, subjectId: uuidOrNull(fromUrl.subject), fromProfile: !explicit && Boolean(me?.levelId) }
}

/** خيارات المرشّحات من البيانات المرجعية والمنهاج القائم (لا تُخترع مواد) */
export async function browseOptions(db: Db, scope: BrowseScope) {
  const [levelRows, streamRows] = await Promise.all([
    // المتوسط والثانوي فقط (PICKER_LEVELS) — لا الابتدائي — لتخفيف الضجيج البصري
    db.select({ id: levels.id, code: levels.code, name: levels.nameAr }).from(levels).where(inArray(levels.code, PICKER_LEVELS.map((l) => l.code))).orderBy(asc(levels.sortOrder)),
    scope.levelId
      ? db
          .select({ id: streams.id, code: streams.code, name: streams.nameAr })
          .from(streams)
          .where(sql`exists (select 1 from grade_streams gs where gs.stream_id = ${streams.id} and gs.level_id = ${scope.levelId})`)
          .orderBy(asc(streams.sortOrder))
      : Promise.resolve([] as { id: string; code: string; name: string }[])
  ])
  let subjectRows: { id: string; name: string }[]
  if (scope.levelId) {
    const offered = await subjectsFor(db, scope.levelId, scope.streamId).catch(() => [])
    subjectRows = offered.map((s) => ({ id: s.id, name: s.nameAr }))
    if (!subjectRows.length) subjectRows = await db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder))
  } else {
    subjectRows = await db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder))
  }
  return { levels: levelRows, streams: streamRows, subjects: subjectRows }
}

/* ----------------------- خيارات تصنيف الدرس (نموذج الأستاذ) ----------------------- */

export async function listSubjectOptions(db: Db): Promise<{ id: string; name: string }[]> {
  return db.select({ id: subjects.id, name: subjects.nameAr }).from(subjects).orderBy(asc(subjects.sortOrder))
}

export interface CurriculumNodeOption {
  id: string
  subjectId: string
  levelId: string
  streamId: string | null
  kind: string
  /** المسار الكامل «الوحدة › الفصل › الدرس» بترتيب الشجرة */
  label: string
  /** مفتاح الترتيب (sort_order على طول المسار) لعرض القائمة بترتيب المنهاج */
  sortKey: number[]
}

/** كل عقد المنهاج مع مسارها الكامل، لاختيار «وحدة/درس» في نموذج نشر الدرس. تُرشَّح في الواجهة بالمستوى والمادة. */
export async function curriculumNodeOptions(db: Db): Promise<CurriculumNodeOption[]> {
  const rows = await db.select({ id: curriculumNodes.id, subjectId: curriculumNodes.subjectId, levelId: curriculumNodes.levelId, streamId: curriculumNodes.streamId, parentId: curriculumNodes.parentId, kind: curriculumNodes.kind, title: curriculumNodes.title, sortOrder: curriculumNodes.sortOrder }).from(curriculumNodes)
  const byId = new Map(rows.map((r) => [r.id, r]))
  const out: CurriculumNodeOption[] = []
  for (const r of rows) {
    const titles: string[] = []
    const key: number[] = []
    let cur: typeof r | undefined = r
    for (let i = 0; cur && i < 10; i++) {
      titles.unshift(cur.title)
      key.unshift(cur.sortOrder)
      cur = cur.parentId ? byId.get(cur.parentId) : undefined
    }
    out.push({ id: r.id, subjectId: r.subjectId, levelId: r.levelId, streamId: r.streamId, kind: r.kind, label: titles.join(' › '), sortKey: key })
  }
  const cmp = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? -1) - (b[i] ?? -1)
      if (d !== 0) return d
    }
    return 0
  }
  return out.sort((a, b) => cmp(a.sortKey, b.sortKey) || a.label.localeCompare(b.label, 'ar'))
}

/* --------------------------------- الكتالوج --------------------------------- */

/** بطاقة دورة في الكتالوج: بيانات العرض فقط — لا محتوى، لا ملفات، لا روابط وصول */
export interface CatalogCourse {
  id: string
  slug: string
  title: string
  description: string | null
  teacherName: string
  season: string
  plan: string
  levelName: string | null
  streamNames: string[]
  subjectName: string | null
  priceDzd: number
  accessEndsOn: string | null
  coverUrl: string | null
  /** حالة التلميذ المتصفّح تجاه الدورة (لا تمنح شيئاً؛ للعرض فقط) */
  enrollment: 'ACTIVE' | 'EXPIRED' | 'REVOKED' | null
  href: string
}

/** الحقول التي لا يجوز أن يحملها كائن الكتالوج (اختبار الانحدار يفحصها) */
export const CATALOG_FORBIDDEN_KEYS = ['groupId', 'termsText', 'fileId', 'coverFileId', 'body', 'externalUrl', 'youtubeId', 'bunnyVideoId', 'videoProvider', 'joinUrl', 'embedUrl', 'storageKey'] as const

function enrollmentState(status: string | null, expiresAt: Date | null, now: Date): CatalogCourse['enrollment'] {
  if (!status) return null
  if (status === 'REVOKED') return 'REVOKED'
  if (status === 'ACTIVE' && (!expiresAt || expiresAt.getTime() > now.getTime())) return 'ACTIVE'
  return 'EXPIRED'
}

async function streamNamesOf(db: Db, ids: string[][]): Promise<Map<string, string>> {
  const all = Array.from(new Set(ids.flat()))
  if (!all.length) return new Map()
  const rows = await db.select({ id: streams.id, name: streams.nameAr }).from(streams).where(inArray(streams.id, all))
  return new Map(rows.map((r) => [r.id, r.name]))
}

/**
 * كل الدورات المنشورة (status = PUBLISHED، غير محذوفة) لأي تلميذ، مع أو بدون اشتراك.
 * المسودات والمؤرشفة والمحذوفة لا تظهر. المرشّحات: مستوى (الدورة بلا مستوى تظهر دائماً)،
 * شعبة (stream_ids فارغ = كل الشعب)، مادة.
 */
export async function listCourseCatalog(db: Db, actor: Actor | null, scope: Partial<BrowseScope> = {}): Promise<CatalogCourse[]> {
  const studentId = actor?.role === 'STUDENT' ? actor.studentId : null
  const now = new Date()
  const family = await streamFamily(db, scope.streamId)
  const where: (SQL | undefined)[] = [
    isNull(courses.deletedAt),
    eq(courses.status, 'PUBLISHED'),
    scope.levelId ? or(isNull(courses.levelId), eq(courses.levelId, scope.levelId)) : undefined,
    // الشعبة أو أمّها، أو دورة لكل الشعب (stream_ids فارغ)
    family.length ? sql`(cardinality(${courses.streamIds}) = 0 or ${courses.streamIds} && array[${sql.join(family.map((id) => sql`${id}::uuid`), sql`, `)}]::uuid[])` : undefined,
    scope.subjectId ? eq(courses.subjectId, scope.subjectId) : undefined
  ]
  const rows = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      description: courses.description,
      season: courses.season,
      plan: courses.plan,
      // سعر الدورة هو سعر الكتاب المرتبط (أرخص كتاب منشور)؛ سعر الدورة نفسها احتياط حين لا كتاب
      priceDzd: sql<number>`coalesce((select min(p.price_dzd) from course_products cp join products p on p.id = cp.product_id where cp.course_id = ${courses.id} and p.status = 'PUBLISHED' and p.deleted_at is null), ${courses.priceDzd})::int`,
      accessEndsOn: courses.accessEndsOn,
      coverFileId: courses.coverFileId,
      streamIds: courses.streamIds,
      teacherName: teachers.displayName,
      levelName: levels.nameAr,
      subjectName: subjects.nameAr,
      enrollStatus: courseEnrollments.status,
      enrollExpires: courseEnrollments.expiresAt
    })
    .from(courses)
    .innerJoin(groups, eq(groups.id, courses.groupId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .leftJoin(levels, eq(levels.id, courses.levelId))
    .leftJoin(subjects, eq(subjects.id, courses.subjectId))
    .leftJoin(courseEnrollments, and(eq(courseEnrollments.courseId, courses.id), studentId ? eq(courseEnrollments.studentId, studentId) : sql`false`))
    .where(and(...where))
    .orderBy(desc(courses.createdAt))
  const names = await streamNamesOf(
    db,
    rows.map((r) => r.streamIds)
  )
  return rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    title: r.title,
    description: r.description,
    teacherName: r.teacherName,
    season: r.season,
    plan: r.plan,
    levelName: r.levelName,
    streamNames: r.streamIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n)),
    subjectName: r.subjectName,
    priceDzd: r.priceDzd,
    accessEndsOn: r.accessEndsOn,
    coverUrl: r.coverFileId ? signFileUrl(r.coverFileId, 3600) : null,
    enrollment: enrollmentState(r.enrollStatus, r.enrollExpires, now),
    href: `/student/courses/${r.slug}`
  }))
}

/** صفحة تعريف الدورة لغير المشترك: نفس بيانات الكتالوج + المنتجات (الكتب) التي تمنحها */
export interface CourseLanding {
  course: CatalogCourse
  /** منتجات المتجر المنشورة المرتبطة بالدورة — شراؤها يفعّل الاشتراك عند التسليم */
  products: { id: string; slug: string; title: string; priceDzd: number; href: string }[]
}

export async function courseLanding(db: Db, actor: Actor | null, slug: string): Promise<CourseLanding> {
  const [course] = (await listCourseCatalog(db, actor)).filter((c) => c.slug === slug)
  if (!course) throw new AppError('COURSE_NOT_FOUND')
  const prods = await db
    .select({ id: products.id, slug: products.slug, title: products.title, priceDzd: products.priceDzd })
    .from(courseProducts)
    .innerJoin(products, eq(products.id, courseProducts.productId))
    .where(and(eq(courseProducts.courseId, course.id), eq(products.status, 'PUBLISHED'), isNull(products.deletedAt)))
    .orderBy(asc(products.priceDzd))
  return { course, products: prods.map((p) => ({ ...p, href: `/store/${p.slug}` })) }
}

/* ------------------------------ الدروس المجانية ------------------------------ */

export interface OrganizedLesson {
  id: string
  slug: string
  title: string
  type: string
  summary: string | null
  publishedAt: Date | null
  href: string
}

export interface LessonSection {
  /** معرّف عقدة المنهاج أو null للمحتوى القديم غير المصنّف */
  nodeId: string | null
  title: string
  kind: string | null
  term: number | null
  lessons: OrganizedLesson[]
}

/**
 * دروس التلميذ (عام + للتلاميذ + الموجّه له) مرتّبة بترتيب المنهاج الفعلي:
 * الوحدات بـ sort_order ثم الدروس داخلها بـ sort_order؛ وما لا عقدة له في قسم «غير مصنّف» أخيراً.
 * لا يُخترع ترتيب من العناوين أو تواريخ النشر داخل الوحدة.
 * المرشّحات لا تتجاوز الصلاحيات: نفس شرط الرؤية الذي في listStudentContent.
 */
export async function listStudentLessonsOrganized(db: Db, actor: Actor, scope: Partial<BrowseScope> = {}, types: string[] = ['LESSON', 'ARTICLE', 'EXERCISE', 'VIDEO', 'PDF', 'AUDIO', 'IMAGE']): Promise<LessonSection[]> {
  const studentId = studentIdOf(actor)
  const gids = await reachableGroupIds(db, studentId)
  const family = await streamFamily(db, scope.streamId)
  const targeted = db
    .select({ id: contentTargets.contentId })
    .from(contentTargets)
    .where(or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId)))
  const rows = await db
    .select({
      id: content.id,
      slug: content.slug,
      title: content.title,
      type: content.type,
      summary: content.summary,
      publishedAt: content.publishedAt,
      nodeId: content.curriculumNodeId
    })
    .from(content)
    .where(
      and(
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        inArray(content.type, types),
        or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted)),
        // المستوى/الشعبة/المادة: المحتوى غير المصنّف (قديم) يبقى ظاهراً؛ الشعبة تشمل أمّها
        scope.levelId ? or(isNull(content.levelId), eq(content.levelId, scope.levelId)) : undefined,
        family.length ? or(isNull(content.streamId), inArray(content.streamId, family)) : undefined,
        scope.subjectId ? or(isNull(content.subjectId), eq(content.subjectId, scope.subjectId)) : undefined
      )
    )
    .orderBy(asc(content.title), desc(content.publishedAt))
    .limit(400)

  // المسار الكامل لكل عقدة (جذر ← … ← العقدة) بترتيب sort_order في كل مستوى: الترتيب يتبع
  // الشجرة كاملة «وحدة ← فصل ← درس» لا الأب المباشر فقط.
  const nodeIds = Array.from(new Set(rows.map((r) => r.nodeId).filter((x): x is string => Boolean(x))))
  const paths = new Map<string, { rootId: string; key: number[] }>()
  const rootMeta = new Map<string, { title: string; kind: string; term: number | null }>()
  if (nodeIds.length) {
    type PathRow = { id: string; root_id: string; key: number[] | string; root_title: string; root_kind: string; root_term: number | null }
    const raw = await db.execute<PathRow>(sql`
      with recursive up as (
        select n.id as start_id, n.id, n.parent_id, n.sort_order, n.title, n.kind, n.school_term, 1 as depth, array[n.sort_order] as key
        from curriculum_nodes n where n.id in (${sql.join(nodeIds.map((id) => sql`${id}::uuid`), sql`, `)})
        union all
        select up.start_id, p.id, p.parent_id, p.sort_order, p.title, p.kind, p.school_term, up.depth + 1, array[p.sort_order] || up.key
        from up join curriculum_nodes p on p.id = up.parent_id where up.depth < 10
      )
      select distinct on (start_id) start_id as id, id as root_id, key, title as root_title, kind as root_kind, school_term as root_term
      from up order by start_id, depth desc
    `)
    const list = Array.isArray(raw) ? (raw as PathRow[]) : (raw as { rows: PathRow[] }).rows
    for (const r of list) {
      // pglite/pg قد يعيدان المصفوفة نصاً «{1,2}»
      const key = Array.isArray(r.key) ? r.key.map(Number) : String(r.key).replace(/[{}]/g, '').split(',').filter(Boolean).map(Number)
      paths.set(r.id, { rootId: r.root_id, key })
      if (!rootMeta.has(r.root_id)) rootMeta.set(r.root_id, { title: r.root_title, kind: r.root_kind, term: r.root_term })
    }
  }

  const cmpKey = (a: number[], b: number[]) => {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const d = (a[i] ?? -1) - (b[i] ?? -1)
      if (d !== 0) return d
    }
    return 0
  }
  const toLesson = (r: (typeof rows)[number]): OrganizedLesson => ({ id: r.id, slug: r.slug, title: r.title, type: r.type, summary: r.summary, publishedAt: r.publishedAt, href: `/student/lessons/${r.slug}` })
  const sections = new Map<string, LessonSection & { key: number[]; items: { key: number[]; title: string; lesson: OrganizedLesson }[] }>()
  const unclassified: OrganizedLesson[] = []
  for (const r of rows) {
    const path = r.nodeId ? paths.get(r.nodeId) : null
    if (!path) {
      unclassified.push(toLesson(r))
      continue
    }
    const meta = rootMeta.get(path.rootId)!
    let sec = sections.get(path.rootId)
    if (!sec) {
      sec = { nodeId: path.rootId, title: meta.title, kind: meta.kind, term: meta.term, key: [path.key[0] ?? 0], lessons: [], items: [] }
      sections.set(path.rootId, sec)
    }
    sec.items.push({ key: path.key, title: r.title, lesson: toLesson(r) })
  }
  const ordered: LessonSection[] = Array.from(sections.values())
    .sort((a, b) => cmpKey(a.key, b.key) || a.title.localeCompare(b.title, 'ar'))
    .map((s) => ({ nodeId: s.nodeId, title: s.title, kind: s.kind, term: s.term, lessons: s.items.sort((x, y) => cmpKey(x.key, y.key) || x.title.localeCompare(y.title, 'ar')).map((x) => x.lesson) }))
  if (unclassified.length) ordered.push({ nodeId: null, title: 'دروس أخرى (غير مصنّفة بعد)', kind: null, term: null, lessons: unclassified.sort((a, b) => (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)) })
  return ordered
}

/* ---------------------------- الفروض والاختبارات ---------------------------- */

export interface AssessmentCard {
  key: string
  kind: 'HOMEWORK' | 'TEST'
  term: 1 | 2 | 3
  label: string
  count: number
  /** صفحة الفروض والاختبارات بالمرشّحات نفسها (المستوى والمادة والنوع والفصل) */
  href: string
}

const TERM_AR: Record<1 | 2 | 3, string> = { 1: 'الفصل الأول', 2: 'الفصل الثاني', 3: 'الفصل الثالث' }
const KIND_AR: Record<'HOMEWORK' | 'TEST', string> = { HOMEWORK: 'فرض', TEST: 'اختبار' }

/**
 * البطاقات الست الثابتة: فرض/اختبار × الفصول الثلاثة، بأعداد الموارد المنشورة المرئية للتلميذ
 * (resources.type ∈ HOMEWORK/TEST و school_term الحقيقي؛ لا تخمين من العنوان). نفس شرط الرؤية
 * الذي في المكتبة: عام، أو خاصّ بفوج التلميذ النشط. لا يُكشف أي ملف هنا.
 */
export async function assessmentCards(db: Db, scope: Partial<BrowseScope>, viewer: { studentId?: string | null; levelCode?: string | null } = {}): Promise<AssessmentCard[]> {
  // نفس أنواع شرائح /exams (PRACTICE_KINDS): «فروض» = HOMEWORK، «اختبارات» = TEST + EXAM — العدّ والعرض بشرط واحد
  const kindTypes = Object.fromEntries(PRACTICE_KINDS.map((k) => [k.key, k.types])) as Record<string, readonly ResourceType[]>
  const types: ResourceType[] = [...kindTypes.homework!, ...kindTypes.tests!]
  const family = await streamFamily(db, scope.streamId)
  const rows = await db
    .select({ type: resources.type, term: resources.schoolTerm, n: sql<number>`count(*)::int` })
    .from(resources)
    .where(
      and(
        // شروط الوجهة /exams كاملة: الرؤية، لا بطاقة ثانية للحلّ المرفق، واستثناء البكالوريا الرسمية
        visibleResources(viewer.studentId ?? null),
        notAttachedSolution(),
        ...bacExclusionClauses(),
        inArray(resources.type, types),
        isNotNull(resources.schoolTerm),
        scope.levelId ? eq(resources.levelId, scope.levelId) : undefined,
        family.length ? or(inArray(resources.streamId, family), isNull(resources.streamId)) : undefined,
        scope.subjectId ? eq(resources.subjectId, scope.subjectId) : undefined
      )
    )
    .groupBy(resources.type, resources.schoolTerm)
  const n = new Map<string, number>()
  for (const r of rows) {
    const kind = kindTypes.homework!.includes(r.type as ResourceType) ? 'HOMEWORK' : 'TEST'
    n.set(`${kind}:${r.term}`, (n.get(`${kind}:${r.term}`) ?? 0) + r.n)
  }
  const cards: AssessmentCard[] = []
  for (const term of [1, 2, 3] as const) {
    for (const kind of ['HOMEWORK', 'TEST'] as const) {
      const p = new URLSearchParams()
      p.set('level', viewer.levelCode ?? (scope.levelId ? scope.levelId : 'all'))
      if (scope.subjectId) p.set('subject', scope.subjectId)
      if (scope.streamId) p.set('stream', scope.streamId)
      p.set('kind', kind === 'HOMEWORK' ? 'homework' : 'tests')
      p.set('term', String(term))
      cards.push({ key: `${kind}-${term}`, kind, term, label: `${KIND_AR[kind]} ${TERM_AR[term]}`, count: n.get(`${kind}:${term}`) ?? 0, href: `/exams?${p.toString()}` })
    }
  }
  return cards
}
