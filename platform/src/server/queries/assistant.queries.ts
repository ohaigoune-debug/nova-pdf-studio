import { and, count, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { attendanceRecords, groupStudents, groups, profiles, students, users } from '@/server/db/schema'
import { assertAttendanceStaff, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { listSessions, type SessionListItem } from '@/server/services/class-sessions.service'

export interface AssistantDashboardData {
  studentsCount: number
  suspendedCount: number
  attendanceToday: number
  absencesToday: number
  weeklyAttendanceRate: number | null
  openSessions: SessionListItem[]
  recentSessions: SessionListItem[]
  atRisk: { studentId: string; fullName: string; groupName: string; unexcused: number; max: number; status: string }[]
}

/** لوحة المساعد: أرقام الحضور فقط (لا تصحيح ولا محتوى). */
export async function assistantDashboard(db: Db, actor: Actor): Promise<AssistantDashboardData> {
  assertAttendanceStaff(actor)
  if (!actor.workspaceId) throw new AppError('ASSISTANT_NO_WORKSPACE')
  const ws = actor.workspaceId
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 3600_000)
  const weekAgo = new Date(start.getTime() - 7 * 24 * 3600_000)

  const [studentsRow] = await db
    .select({ n: sql<number>`count(distinct ${groupStudents.studentId})::int` })
    .from(groupStudents)
    .where(and(eq(groupStudents.workspaceId, ws), eq(groupStudents.status, 'ACTIVE')))
  const [suspendedRow] = await db
    .select({ n: count() })
    .from(groupStudents)
    .where(and(eq(groupStudents.workspaceId, ws), eq(groupStudents.status, 'SUSPENDED_DUE_TO_ABSENCE')))
  const [today] = await db
    .select({
      present: sql<number>`coalesce(sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end), 0)::int`,
      absent: sql<number>`coalesce(sum(case when ${attendanceRecords.status} in ('ABSENT','UNEXCUSED') then 1 else 0 end), 0)::int`
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, ws), gte(attendanceRecords.recordedAt, start), lt(attendanceRecords.recordedAt, end)))
  const [week] = await db
    .select({
      total: count(),
      present: sql<number>`coalesce(sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end), 0)::int`
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, ws), gte(attendanceRecords.recordedAt, weekAgo)))

  const [openSessions, recentSessions] = await Promise.all([
    listSessions(db, actor, { status: ['OPEN'], limit: 10 }),
    listSessions(db, actor, { status: ['CLOSED', 'OPEN'], limit: 8 })
  ])

  const atRisk = await db
    .select({
      studentId: groupStudents.studentId,
      fullName: profiles.fullName,
      email: users.email,
      groupName: groups.name,
      unexcused: groupStudents.unexcusedAbsencesCount,
      max: groups.maxUnexcusedAbsences,
      status: groupStudents.status
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(groupStudents.workspaceId, ws),
        inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED_DUE_TO_ABSENCE']),
        sql`${groupStudents.unexcusedAbsencesCount} >= ${groups.maxUnexcusedAbsences} - 1`
      )
    )
    .orderBy(sql`${groupStudents.unexcusedAbsencesCount} desc`)
    .limit(15)

  return {
    studentsCount: studentsRow?.n ?? 0,
    suspendedCount: suspendedRow?.n ?? 0,
    attendanceToday: today?.present ?? 0,
    absencesToday: today?.absent ?? 0,
    weeklyAttendanceRate: week && week.total > 0 ? Math.round(((week.present ?? 0) / week.total) * 100) : null,
    openSessions,
    recentSessions,
    atRisk: atRisk.map((r) => ({ ...r, fullName: r.fullName ?? r.email }))
  }
}
