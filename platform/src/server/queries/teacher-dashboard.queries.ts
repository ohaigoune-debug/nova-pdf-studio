import { and, count, desc, eq, gte, inArray, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { activityLogs, assignmentSubmissions, attendanceRecords, auditLogs, classSessions, groupStudents, groups, profiles, users } from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'

export interface TeacherDashboardData {
  todaySessions: { id: string; groupId: string; groupName: string; title: string | null; scheduledAt: Date; status: string }[]
  scheduledToday: { id: string; name: string; startTime: string | null; room: string | null; hasOpenSession: boolean; openSessionId: string | null }[]
  groupsCount: number
  studentsCount: number
  suspendedCount: number
  attendanceToday: number
  absencesToday: number
  pendingCorrections: number
  openSessions: { id: string; groupName: string; startedAt: Date | null; title: string | null }[]
  weeklyAttendanceRate: number | null
  recentActivity: { id: string; action: string; entityType: string; createdAt: Date; actorName: string | null; newValue: Record<string, unknown> | null }[]
  atRisk: { studentId: string; fullName: string; groupName: string; unexcused: number; max: number; status: string }[]
}

export async function teacherDashboard(db: Db, actor: Actor): Promise<TeacherDashboardData> {
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  const ws = actor.workspaceId
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start.getTime() + 24 * 3600_000)
  const weekAgo = new Date(start.getTime() - 7 * 24 * 3600_000)
  const todayDow = new Date().getDay()

  const todaySessions = await db
    .select({ id: classSessions.id, groupId: classSessions.groupId, groupName: groups.name, title: classSessions.title, scheduledAt: classSessions.scheduledAt, status: classSessions.status })
    .from(classSessions)
    .innerJoin(groups, eq(groups.id, classSessions.groupId))
    .where(and(eq(classSessions.workspaceId, ws), gte(classSessions.scheduledAt, start), lt(classSessions.scheduledAt, end)))
    .orderBy(classSessions.scheduledAt)

  const scheduledToday = await db
    .select({
      id: groups.id,
      name: groups.name,
      startTime: groups.startTime,
      room: groups.room,
      hasOpenSession: sql<boolean>`exists(select 1 from ${classSessions} cs where cs.group_id = ${qcol(groups.id)} and cs.status = 'OPEN')`,
      openSessionId: sql<string | null>`(select cs.id from ${classSessions} cs where cs.group_id = ${qcol(groups.id)} and cs.status = 'OPEN' limit 1)`
    })
    .from(groups)
    .where(and(eq(groups.workspaceId, ws), eq(groups.status, 'ACTIVE'), eq(groups.dayOfWeek, todayDow)))
    .orderBy(groups.startTime)

  const [g] = await db.select({ n: count() }).from(groups).where(and(eq(groups.workspaceId, ws), eq(groups.status, 'ACTIVE')))
  const [s] = await db
    .select({ n: sql<number>`count(distinct ${groupStudents.studentId})::int` })
    .from(groupStudents)
    .where(and(eq(groupStudents.workspaceId, ws), eq(groupStudents.status, 'ACTIVE')))
  const [susp] = await db
    .select({ n: count() })
    .from(groupStudents)
    .where(and(eq(groupStudents.workspaceId, ws), inArray(groupStudents.status, ['SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
  const [attToday] = await db
    .select({
      present: sql<number>`sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end)::int`,
      absent: sql<number>`sum(case when ${attendanceRecords.status} in ('ABSENT','UNEXCUSED','EXCUSED') then 1 else 0 end)::int`
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, ws), gte(attendanceRecords.recordedAt, start)))
  const [week] = await db
    .select({
      total: count(),
      present: sql<number>`sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end)::int`
    })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.workspaceId, ws), gte(attendanceRecords.recordedAt, weekAgo)))
  const [pending] = await db
    .select({ n: count() })
    .from(assignmentSubmissions)
    .where(and(eq(assignmentSubmissions.workspaceId, ws), inArray(assignmentSubmissions.status, ['SUBMITTED', 'AI_EVALUATED'])))

  const openSessions = await db
    .select({ id: classSessions.id, groupName: groups.name, startedAt: classSessions.startedAt, title: classSessions.title })
    .from(classSessions)
    .innerJoin(groups, eq(groups.id, classSessions.groupId))
    .where(and(eq(classSessions.workspaceId, ws), eq(classSessions.status, 'OPEN')))

  const recentActivity = await db
    .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt, actorName: profiles.fullName, newValue: auditLogs.newValue })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(auditLogs.workspaceId, ws))
    .orderBy(desc(auditLogs.createdAt))
    .limit(8)

  const atRisk = await db
    .select({
      studentId: groupStudents.studentId,
      fullName: profiles.fullName,
      groupName: groups.name,
      unexcused: groupStudents.unexcusedAbsencesCount,
      max: groups.maxUnexcusedAbsences,
      status: groupStudents.status
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .innerJoin(users, sql`${users.id} = (select user_id from students st where st.id = ${groupStudents.studentId})`)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(groupStudents.workspaceId, ws),
        sql`(${groupStudents.status} = 'SUSPENDED_DUE_TO_ABSENCE' or (${groupStudents.status} = 'ACTIVE' and ${groupStudents.unexcusedAbsencesCount} >= ${groups.maxUnexcusedAbsences} - 1))`
      )
    )
    .orderBy(desc(groupStudents.unexcusedAbsencesCount))
    .limit(8)

  // نشاط الطلاب (اختياري للعرض)
  void activityLogs

  const weekTotal = week?.total ?? 0
  return {
    todaySessions,
    scheduledToday,
    groupsCount: g?.n ?? 0,
    studentsCount: s?.n ?? 0,
    suspendedCount: susp?.n ?? 0,
    attendanceToday: attToday?.present ?? 0,
    absencesToday: attToday?.absent ?? 0,
    pendingCorrections: pending?.n ?? 0,
    openSessions,
    weeklyAttendanceRate: weekTotal > 0 ? Math.round(((week?.present ?? 0) / weekTotal) * 100) : null,
    recentActivity,
    atRisk: atRisk.map((r) => ({ ...r, fullName: r.fullName ?? '—' }))
  }
}
