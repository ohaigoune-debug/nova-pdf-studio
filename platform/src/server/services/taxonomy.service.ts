/**
 * تصنيف المنهاج: الأطوار ← الصفوف ← الشعب ← المواد المقرّرة ← شجرة الوحدات والدروس.
 * كل الشاشات والمستوردات تأخذ المعرّفات من هنا بدل النصوص الحرّة.
 */
import { and, asc, count, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { curriculumNodes, curriculumVersions, educationStages, gradeStreams, levels, resources, skills, streams, subjectOfferings, subjects } from '@/server/db/schema'
import type { CurriculumNodeKind } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'

/** الشجرة الأولى التي يختار منها التلميذ: ما مستواك؟ ما شعبتك؟ */
export async function getTaxonomy(db: Db) {
  const [stageRows, levelRows, streamRows, links, subjectRows] = await Promise.all([
    db.select().from(educationStages).orderBy(asc(educationStages.sortOrder)),
    db.select().from(levels).orderBy(asc(levels.sortOrder)),
    db.select().from(streams).orderBy(asc(streams.sortOrder)),
    db.select().from(gradeStreams),
    db.select().from(subjects).orderBy(asc(subjects.sortOrder))
  ])
  const streamsOf = (levelId: string) => links.filter((l) => l.levelId === levelId).map((l) => streamRows.find((s) => s.id === l.streamId)!).filter(Boolean)
  return {
    stages: stageRows.map((s) => ({
      ...s,
      levels: levelRows.filter((l) => l.stageId === s.id).map((l) => ({ ...l, streams: streamsOf(l.id) }))
    })),
    subjects: subjectRows
  }
}

/** المواد المقرّرة لصف (وشعبة): المشتركة للصف + الخاصة بالشعبة وبأمّها (خيارات تقني رياضي) */
export async function subjectsFor(db: Db, levelId: string, streamId?: string | null) {
  assertUuid(levelId, 'NOT_FOUND')
  const streamIds: string[] = []
  if (streamId) {
    assertUuid(streamId, 'NOT_FOUND')
    const [s] = await db.select({ id: streams.id, parentId: streams.parentId }).from(streams).where(eq(streams.id, streamId)).limit(1)
    if (!s) throw new AppError('NOT_FOUND')
    streamIds.push(s.id, ...(s.parentId ? [s.parentId] : []))
  }
  const rows = await db
    .select({ subject: subjects, isExamSubject: subjectOfferings.isExamSubject, coefficient: subjectOfferings.coefficient })
    .from(subjectOfferings)
    .innerJoin(subjects, eq(subjects.id, subjectOfferings.subjectId))
    .where(and(eq(subjectOfferings.levelId, levelId), streamIds.length ? or(isNull(subjectOfferings.streamId), inArray(subjectOfferings.streamId, streamIds)) : isNull(subjectOfferings.streamId)))
    .orderBy(asc(subjects.sortOrder))
  const seen = new Set<string>()
  return rows.filter((r) => (seen.has(r.subject.id) ? false : (seen.add(r.subject.id), true))).map((r) => ({ ...r.subject, isExamSubject: r.isExamSubject, coefficient: r.coefficient }))
}

/** رموز ← معرّفات، للمستوردات (DzExams، يوتيوب…) — null لما لا يُعرف بدل التخمين */
export async function resolveCodes(db: Db, codes: { level?: string | null; stream?: string | null; subject?: string | null }) {
  const [l] = codes.level ? await db.select().from(levels).where(eq(levels.code, codes.level)).limit(1) : []
  const [st] = codes.stream ? await db.select().from(streams).where(eq(streams.code, codes.stream)).limit(1) : []
  const [su] = codes.subject ? await db.select().from(subjects).where(eq(subjects.code, codes.subject)).limit(1) : []
  return { levelId: l?.id ?? null, stageId: l?.stageId ?? null, streamId: st?.id ?? null, subjectId: su?.id ?? null }
}

export async function currentCurriculumVersion(db: Db) {
  const [v] = await db.select().from(curriculumVersions).where(eq(curriculumVersions.isCurrent, true)).limit(1)
  return v ?? null
}

/* ------------------------------ شجرة المنهاج ------------------------------ */

export interface NodeScope {
  subjectId: string
  levelId: string
  streamId?: string | null
}

export interface CurriculumTreeNode {
  id: string
  kind: string
  title: string
  slug: string
  schoolTerm: number | null
  sortOrder: number
  resources: number
  children: CurriculumTreeNode[]
}

/** شجرة مادة في صف (وشعبة): العقد المشتركة للصف + الخاصة بالشعبة */
export async function listNodes(db: Db, scope: NodeScope): Promise<CurriculumTreeNode[]> {
  const rows = await db
    .select()
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.subjectId, scope.subjectId), eq(curriculumNodes.levelId, scope.levelId), scope.streamId ? or(isNull(curriculumNodes.streamId), eq(curriculumNodes.streamId, scope.streamId)) : isNull(curriculumNodes.streamId)))
    .orderBy(asc(curriculumNodes.sortOrder), asc(curriculumNodes.title))
  const ids = rows.map((r) => r.id)
  const usage = ids.length ? await db.select({ id: resources.curriculumNodeId, n: count() }).from(resources).where(inArray(resources.curriculumNodeId, ids)).groupBy(resources.curriculumNodeId) : []
  const used = new Map(usage.map((u) => [u.id, u.n]))
  const byParent = new Map<string | null, typeof rows>()
  for (const r of rows) byParent.set(r.parentId, [...(byParent.get(r.parentId) ?? []), r])
  const build = (parentId: string | null): CurriculumTreeNode[] =>
    (byParent.get(parentId) ?? []).map((r) => ({ id: r.id, kind: r.kind, title: r.title, slug: r.slug, schoolTerm: r.schoolTerm, sortOrder: r.sortOrder, resources: used.get(r.id) ?? 0, children: build(r.id) }))
  return build(null)
}

/** الترتيب المسموح: وحدة ← فصل/درس ← درس/موضوع ← موضوع */
const CHILD_KINDS: Record<string, CurriculumNodeKind[]> = { ROOT: ['UNIT'], UNIT: ['CHAPTER', 'LESSON'], CHAPTER: ['LESSON'], LESSON: ['TOPIC'], TOPIC: [] }

export function slugify(title: string): string {
  const s = title
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return s.slice(0, 80) || 'node'
}

export async function createNode(db: Db, actor: Actor, input: NodeScope & { parentId?: string | null; kind: CurriculumNodeKind; title: string; schoolTerm?: number | null }) {
  assertRole(actor, 'SUPER_ADMIN')
  const title = input.title.trim()
  if (title.length < 2 || title.length > 200) throw new AppError('VALIDATION', { field: 'title' })
  if (input.schoolTerm != null && (input.schoolTerm < 1 || input.schoolTerm > 3)) throw new AppError('VALIDATION', { field: 'schoolTerm' })
  let parentKind = 'ROOT'
  if (input.parentId) {
    assertUuid(input.parentId, 'NOT_FOUND')
    const [p] = await db.select().from(curriculumNodes).where(eq(curriculumNodes.id, input.parentId)).limit(1)
    if (!p || p.subjectId !== input.subjectId || p.levelId !== input.levelId) throw new AppError('NOT_FOUND')
    parentKind = p.kind
  }
  if (!CHILD_KINDS[parentKind]!.includes(input.kind)) throw new AppError('VALIDATION', { field: 'kind' })
  const version = await currentCurriculumVersion(db)
  const [siblings] = await db
    .select({ n: count() })
    .from(curriculumNodes)
    .where(and(eq(curriculumNodes.subjectId, input.subjectId), eq(curriculumNodes.levelId, input.levelId), input.parentId ? eq(curriculumNodes.parentId, input.parentId) : isNull(curriculumNodes.parentId)))
  const [row] = await db
    .insert(curriculumNodes)
    .values({
      curriculumVersionId: version?.id ?? null,
      subjectId: input.subjectId,
      levelId: input.levelId,
      streamId: input.streamId ?? null,
      parentId: input.parentId ?? null,
      kind: input.kind,
      title,
      slug: slugify(title),
      schoolTerm: input.schoolTerm ?? null,
      sortOrder: (siblings?.n ?? 0) + 1
    })
    .onConflictDoNothing()
    .returning()
  if (!row) throw new AppError('VALIDATION', { field: 'title', reason: 'duplicate' })
  await writeAudit(db, { actorUserId: actor.userId, action: 'curriculum.node_create', entityType: 'curriculum_node', entityId: row.id, newValue: { title, kind: input.kind } })
  return row
}

/** الحذف لعقدة لا يستعملها مورد ولا مهارة (تُحذف فروعها معها) */
export async function deleteNode(db: Db, actor: Actor, nodeId: string) {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(nodeId, 'NOT_FOUND')
  // العقدة وكل فروعها باستعلام واحد (شجرة قد تضمّ آلاف العقد)
  const tree = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE t AS (
      SELECT id FROM curriculum_nodes WHERE id = ${nodeId}
      UNION ALL SELECT c.id FROM curriculum_nodes c JOIN t ON c.parent_id = t.id
    ) SELECT id FROM t`)
  const list = (Array.isArray(tree) ? tree : (tree as { rows: { id: string }[] }).rows).map((r) => r.id)
  if (list.length === 0) throw new AppError('NOT_FOUND')
  const [r] = await db.select({ n: count() }).from(resources).where(inArray(resources.curriculumNodeId, list))
  const [s] = await db.select({ n: count() }).from(skills).where(inArray(skills.curriculumNodeId, list))
  if ((r?.n ?? 0) > 0 || (s?.n ?? 0) > 0) throw new AppError('NODE_IN_USE')
  await db.delete(curriculumNodes).where(eq(curriculumNodes.id, nodeId))
  await writeAudit(db, { actorUserId: actor.userId, action: 'curriculum.node_delete', entityType: 'curriculum_node', entityId: nodeId })
}
