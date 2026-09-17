import { and, asc, eq, isNull, or } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { academicYears, levels, schools, streams, wilayas } from '@/server/db/schema'
import type { SchoolType } from '@/server/db/schema/enums'
import { assertRole, workspaceOf, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'

export async function listWilayas(db: Db) {
  return db.select().from(wilayas).orderBy(asc(wilayas.code))
}

export async function listLevels(db: Db) {
  return db.select().from(levels).orderBy(asc(levels.sortOrder))
}

export async function listStreams(db: Db) {
  return db.select().from(streams).orderBy(asc(streams.sortOrder))
}

export async function listAcademicYears(db: Db) {
  return db.select().from(academicYears).orderBy(asc(academicYears.startsOn))
}

export async function currentAcademicYear(db: Db) {
  const rows = await db.select().from(academicYears).where(eq(academicYears.isCurrent, true)).limit(1)
  return rows[0] ?? null
}

/** المدارس العامة + الخاصة بمساحة الأستاذ */
export async function listSchools(db: Db, actor: Actor | null, wilayaId?: string) {
  const ws = actor?.role === 'TEACHER' ? actor.workspaceId : null
  return db
    .select({
      id: schools.id,
      name: schools.name,
      type: schools.type,
      wilayaId: schools.wilayaId,
      wilayaName: wilayas.nameAr,
      workspaceId: schools.workspaceId
    })
    .from(schools)
    .innerJoin(wilayas, eq(wilayas.id, schools.wilayaId))
    .where(
      and(
        wilayaId ? eq(schools.wilayaId, wilayaId) : undefined,
        ws ? or(isNull(schools.workspaceId), eq(schools.workspaceId, ws)) : isNull(schools.workspaceId)
      )
    )
    .orderBy(asc(wilayas.code), asc(schools.name))
}

export async function createSchool(
  db: Db,
  actor: Actor,
  input: { name: string; wilayaId: string; type?: SchoolType; address?: string | null; isPublic?: boolean }
) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const name = input.name.trim()
  if (!name) throw new AppError('VALIDATION', { field: 'name' })
  const workspaceId = actor.role === 'SUPER_ADMIN' && input.isPublic ? null : workspaceOf(actor, actor.workspaceId)
  const [row] = await db
    .insert(schools)
    .values({ name, wilayaId: input.wilayaId, type: input.type ?? 'LYCEE', address: input.address ?? null, workspaceId })
    .returning()
  return row
}
