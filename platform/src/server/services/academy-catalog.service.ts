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
  groupStudents,
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
import { AppError } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { visibleResources } from './library.service'
import { subjectsFor } from './taxonomy.service'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuidOrNull = (v: string | null | undefined) => (v && UUID.test(v) ? v : null)

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
    db.select({ id: levels.id, code: levels.code, name: levels.nameAr }).from(levels).orderBy(asc(levels.sortOrder)),
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
  const where: (SQL | undefined)[] = [
    isNull(courses.deletedAt),
    eq(courses.status, 'PUBLISHED'),
    scope.levelId ? or(isNull(courses.levelId), eq(courses.levelId, scope.levelId)) : undefined,
    scope.streamId ? sql`(cardinality(${courses.streamIds}) = 0 or ${scope.streamId}::uuid = any(${courses.streamIds}))` : undefined,
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
      priceDzd: courses.priceDzd,
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
  const gids = (
    await db
      .select({ groupId: groupStudents.groupId })
      .from(groupStudents)
      .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
  ).map((r) => r.groupId)
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
      nodeId: content.curriculumNodeId,
      nodeTitle: curriculumNodes.title,
      nodeKind: curriculumNodes.kind,
      nodeTerm: curriculumNodes.schoolTerm,
      nodeOrder: curriculumNodes.sortOrder,
      parentId: curriculumNodes.parentId
    })
    .from(content)
    .leftJoin(curriculumNodes, eq(curriculumNodes.id, content.curriculumNodeId))
    .where(
      and(
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        inArray(content.type, types),
        or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted)),
        // المستوى: المحتوى بلا مستوى (قديم) يبقى ظاهراً
        scope.levelId ? or(isNull(content.levelId), eq(content.levelId, scope.levelId)) : undefined,
        scope.streamId ? or(isNull(content.streamId), eq(content.streamId, scope.streamId)) : undefined,
        scope.subjectId ? or(isNull(content.subjectId), eq(content.subjectId, scope.subjectId)) : undefined
      )
    )
    .orderBy(asc(curriculumNodes.sortOrder), asc(content.title), desc(content.publishedAt))
    .limit(400)

  // عقدة الدرس → وحدته (الجذر) لتجميع الأقسام بترتيب الوحدات
  const parentIds = Array.from(new Set(rows.map((r) => r.parentId).filter((x): x is string => Boolean(x))))
  const parents = parentIds.length ? await db.select({ id: curriculumNodes.id, title: curriculumNodes.title, kind: curriculumNodes.kind, term: curriculumNodes.schoolTerm, order: curriculumNodes.sortOrder, parentId: curriculumNodes.parentId }).from(curriculumNodes).where(inArray(curriculumNodes.id, parentIds)) : []
  const parentOf = new Map(parents.map((p) => [p.id, p]))

  const sections = new Map<string, LessonSection & { order: number }>()
  const unclassified: OrganizedLesson[] = []
  const toLesson = (r: (typeof rows)[number]): OrganizedLesson => ({ id: r.id, slug: r.slug, title: r.title, type: r.type, summary: r.summary, publishedAt: r.publishedAt, href: `/student/lessons/${r.slug}` })
  for (const r of rows) {
    if (!r.nodeId) {
      unclassified.push(toLesson(r))
      continue
    }
    // القسم = الوحدة الأم إن وُجدت، وإلا العقدة نفسها
    const unit = r.parentId ? parentOf.get(r.parentId) : null
    const key = unit?.id ?? r.nodeId
    let sec = sections.get(key)
    if (!sec) {
      sec = { nodeId: key, title: unit?.title ?? r.nodeTitle ?? '', kind: unit?.kind ?? r.nodeKind ?? null, term: unit?.term ?? r.nodeTerm ?? null, order: unit?.order ?? r.nodeOrder ?? 0, lessons: [] }
      sections.set(key, sec)
    }
    sec.lessons.push(toLesson(r))
  }
  const ordered = Array.from(sections.values())
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'ar'))
    .map(({ order: _o, ...s }) => s)
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
  const types: ResourceType[] = ['HOMEWORK', 'TEST']
  const rows = await db
    .select({ type: resources.type, term: resources.schoolTerm, n: sql<number>`count(*)::int` })
    .from(resources)
    .where(
      and(
        visibleResources(viewer.studentId ?? null),
        inArray(resources.type, types),
        isNotNull(resources.schoolTerm),
        scope.levelId ? eq(resources.levelId, scope.levelId) : undefined,
        scope.streamId ? or(eq(resources.streamId, scope.streamId), isNull(resources.streamId)) : undefined,
        scope.subjectId ? eq(resources.subjectId, scope.subjectId) : undefined
      )
    )
    .groupBy(resources.type, resources.schoolTerm)
  const n = new Map(rows.map((r) => [`${r.type}:${r.term}`, r.n]))
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
