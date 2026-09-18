import { and, asc, desc, eq, isNull, or } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { rubricItems, rubrics, skills } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'

export interface RubricItemInput {
  id?: string
  label: string
  description?: string | null
  maxPoints: number
  skillId?: string | null
}

export interface RubricInput {
  name: string
  description?: string | null
  items: RubricItemInput[]
}

export type RubricRow = typeof rubrics.$inferSelect

/** الأستاذ يرى شبكاته + القوالب العامة (workspace_id NULL) التي ينشئها المشرف */
export async function listRubrics(db: Db, actor: Actor) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const scope = actor.role === 'TEACHER' ? or(eq(rubrics.workspaceId, actor.workspaceId ?? ''), isNull(rubrics.workspaceId)) : undefined
  const rows = await db
    .select()
    .from(rubrics)
    .where(and(isNull(rubrics.deletedAt), scope))
    .orderBy(desc(rubrics.createdAt))
  const items = rows.length ? await db.select().from(rubricItems).where(or(...rows.map((r) => eq(rubricItems.rubricId, r.id)))).orderBy(asc(rubricItems.sortOrder)) : []
  return rows.map((r) => ({ ...r, isGlobal: r.workspaceId === null, items: items.filter((i) => i.rubricId === r.id) }))
}

export async function getRubric(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'RUBRIC_NOT_FOUND')
  const [r] = await db.select().from(rubrics).where(and(eq(rubrics.id, id), isNull(rubrics.deletedAt))).limit(1)
  if (!r) throw new AppError('RUBRIC_NOT_FOUND')
  if (actor.role === 'TEACHER' && r.workspaceId !== null && r.workspaceId !== actor.workspaceId) throw new AppError('RUBRIC_NOT_FOUND')
  const items = await db
    .select({ id: rubricItems.id, label: rubricItems.label, description: rubricItems.description, maxPoints: rubricItems.maxPoints, skillId: rubricItems.skillId, skillName: skills.nameAr, sortOrder: rubricItems.sortOrder })
    .from(rubricItems)
    .leftJoin(skills, eq(skills.id, rubricItems.skillId))
    .where(eq(rubricItems.rubricId, r.id))
    .orderBy(asc(rubricItems.sortOrder))
  return { ...r, isGlobal: r.workspaceId === null, items }
}

function validate(input: RubricInput) {
  if (!input.name.trim()) throw new AppError('VALIDATION', { field: 'name' })
  if (input.items.length === 0) throw new AppError('VALIDATION', { field: 'items' })
  for (const it of input.items) {
    if (!it.label.trim()) throw new AppError('VALIDATION', { field: 'items.label' })
    if (!(it.maxPoints > 0)) throw new AppError('VALIDATION', { field: 'items.maxPoints' })
  }
}

export async function createRubric(db: Db, actor: Actor, input: RubricInput, opts: { global?: boolean } = {}) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  validate(input)
  const workspaceId = actor.role === 'SUPER_ADMIN' && opts.global ? null : actor.workspaceId
  if (actor.role === 'TEACHER' && !workspaceId) throw new AppError('FORBIDDEN')
  const maxScore = input.items.reduce((s, i) => s + i.maxPoints, 0)
  return db.transaction(async (tx) => {
    const [r] = await tx
      .insert(rubrics)
      .values({ workspaceId, name: input.name.trim(), description: input.description?.trim() || null, maxScore: String(maxScore), createdByUserId: actor.userId })
      .returning()
    if (!r) throw new AppError('INTERNAL')
    await tx.insert(rubricItems).values(input.items.map((it, i) => ({ rubricId: r.id, label: it.label.trim(), description: it.description?.trim() || null, maxPoints: String(it.maxPoints), skillId: it.skillId ?? null, sortOrder: i })))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'rubric.create', entityType: 'rubric', entityId: r.id, newValue: { name: r.name, maxScore } })
    return r
  })
}

export async function updateRubric(db: Db, actor: Actor, id: string, input: RubricInput) {
  const r = await getRubric(db, actor, id)
  if (r.isGlobal && actor.role !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN')
  validate(input)
  const maxScore = input.items.reduce((s, i) => s + i.maxPoints, 0)
  return db.transaction(async (tx) => {
    await tx.update(rubrics).set({ name: input.name.trim(), description: input.description?.trim() || null, maxScore: String(maxScore) }).where(eq(rubrics.id, r.id))
    // نُبقي البنود القديمة إن كانت مرجعاً لعلامات (rubricBreakdown يخزّن id)؛ نستبدل الكل فقط بحذف غير المستعملة
    await tx.delete(rubricItems).where(eq(rubricItems.rubricId, r.id))
    await tx.insert(rubricItems).values(input.items.map((it, i) => ({ id: it.id, rubricId: r.id, label: it.label.trim(), description: it.description?.trim() || null, maxPoints: String(it.maxPoints), skillId: it.skillId ?? null, sortOrder: i })))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: r.workspaceId, action: 'rubric.update', entityType: 'rubric', entityId: r.id, oldValue: { name: r.name, maxScore: r.maxScore }, newValue: { name: input.name, maxScore } })
  })
}

export async function deleteRubric(db: Db, actor: Actor, id: string) {
  const r = await getRubric(db, actor, id)
  if (r.isGlobal && actor.role !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN')
  await db.transaction(async (tx) => {
    await tx.update(rubrics).set({ deletedAt: new Date() }).where(eq(rubrics.id, r.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: r.workspaceId, action: 'rubric.delete', entityType: 'rubric', entityId: r.id, oldValue: { name: r.name } })
  })
}

/** يتحقق من توزيع النقاط على بنود الشبكة ويعيد المجموع */
export function validateBreakdown(items: { id: string; maxPoints: string }[], breakdown: Record<string, number>): number {
  let total = 0
  for (const it of items) {
    const v = breakdown[it.id]
    if (v === undefined || !Number.isFinite(v) || v < 0 || v > Number(it.maxPoints)) throw new AppError('RUBRIC_MISMATCH')
    total += v
  }
  return Math.round(total * 100) / 100
}
