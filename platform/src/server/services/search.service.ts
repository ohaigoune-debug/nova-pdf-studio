import { and, eq, ilike, isNull, or } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { assignments, content, groupStudents, groups, profiles, students, users } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'

export interface SearchResults {
  students: { id: string; fullName: string; email: string }[]
  groups: { id: string; name: string }[]
  content: { id: string; title: string; type: string }[]
  assignments: { id: string; title: string }[]
}

/** بحث شامل داخل مساحة الأستاذ فقط */
export async function searchWorkspace(db: Db, actor: Actor, q: string): Promise<SearchResults> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const ws = actor.workspaceId
  if (actor.role === 'TEACHER' && !ws) throw new AppError('FORBIDDEN')
  const term = `%${q.trim()}%`
  if (q.trim().length < 2) return { students: [], groups: [], content: [], assignments: [] }

  const studentRows = await db
    .selectDistinct({ id: students.id, fullName: profiles.fullName, email: users.email })
    .from(groupStudents)
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(ws ? eq(groupStudents.workspaceId, ws) : undefined, or(ilike(profiles.fullName, term), ilike(users.email, term), ilike(profiles.phone, term))))
    .limit(10)
  const groupRows = await db
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(and(ws ? eq(groups.workspaceId, ws) : undefined, isNull(groups.deletedAt), ilike(groups.name, term)))
    .limit(10)
  const contentRows = await db
    .select({ id: content.id, title: content.title, type: content.type })
    .from(content)
    .where(and(ws ? eq(content.workspaceId, ws) : undefined, isNull(content.deletedAt), or(ilike(content.title, term), ilike(content.topic, term), ilike(content.summary, term))))
    .limit(10)
  const assignmentRows = await db
    .select({ id: assignments.id, title: assignments.title })
    .from(assignments)
    .where(and(ws ? eq(assignments.workspaceId, ws) : undefined, isNull(assignments.deletedAt), or(ilike(assignments.title, term), ilike(assignments.topic, term))))
    .limit(10)
  return {
    students: studentRows.map((s) => ({ id: s.id, fullName: s.fullName ?? s.email, email: s.email })),
    groups: groupRows,
    content: contentRows,
    assignments: assignmentRows
  }
}
