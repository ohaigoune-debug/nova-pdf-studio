import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  academicYears,
  assignmentTargets,
  assignments,
  attendanceRecords,
  classSessions,
  enrollmentCodes,
  grades,
  groupStudents,
  groups,
  levels,
  profiles,
  schools,
  streams,
  students,
  teachers,
  users,
  wilayas
} from '@/server/db/schema'
import type { GroupStatus } from '@/server/db/schema/enums'
import { assertRole, workspaceOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export interface GroupInput {
  name: string
  wilayaId?: string | null
  schoolId?: string | null
  levelId?: string | null
  streamId?: string | null
  academicYearId?: string | null
  dayOfWeek?: number | null
  startTime?: string | null
  durationMinutes?: number
  room?: string | null
  capacity?: number | null
  startsOn?: string | null
  endsOn?: string | null
  status?: GroupStatus
  lateAfterMinutes?: number
  maxUnexcusedAbsences?: number
  notes?: string | null
}

export type GroupRow = typeof groups.$inferSelect

/** يرجع الفوج إذا كان ضمن نطاق الفاعل، وإلا NOT_FOUND (لا نكشف وجوده). */
export async function assertGroupAccess(db: Db, actor: Actor, groupId: string): Promise<GroupRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const rows = await db
    .select()
    .from(groups)
    .where(and(eq(groups.id, groupId), isNull(groups.deletedAt)))
    .limit(1)
  const g = rows[0]
  if (!g) throw new AppError('NOT_FOUND')
  if (actor.role === 'TEACHER' && g.workspaceId !== actor.workspaceId) throw new AppError('NOT_FOUND')
  return g
}

export async function createGroup(db: Db, actor: Actor, input: GroupInput, explicitWorkspaceId?: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = workspaceOf(actor, explicitWorkspaceId)
  const name = input.name.trim()
  if (!name) throw new AppError('VALIDATION', { field: 'name' })

  let teacherId = actor.teacherId
  if (!teacherId) {
    const [t] = await db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId)).limit(1)
    teacherId = t?.id ?? null
  }
  if (!teacherId) throw new AppError('FORBIDDEN')

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(groups)
      .values({
        workspaceId,
        teacherId,
        name,
        wilayaId: input.wilayaId ?? null,
        schoolId: input.schoolId ?? null,
        levelId: input.levelId ?? null,
        streamId: input.streamId ?? null,
        academicYearId: input.academicYearId ?? null,
        dayOfWeek: input.dayOfWeek ?? null,
        startTime: input.startTime ?? null,
        durationMinutes: input.durationMinutes ?? 90,
        room: input.room ?? null,
        capacity: input.capacity ?? null,
        startsOn: input.startsOn ?? null,
        endsOn: input.endsOn ?? null,
        status: input.status ?? 'ACTIVE',
        lateAfterMinutes: input.lateAfterMinutes ?? 10,
        maxUnexcusedAbsences: input.maxUnexcusedAbsences ?? 4,
        notes: input.notes ?? null
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId,
      action: 'group.create',
      entityType: 'group',
      entityId: row.id,
      newValue: { name }
    })
    return row
  })
}

export async function updateGroup(db: Db, actor: Actor, groupId: string, input: Partial<GroupInput>) {
  const g = await assertGroupAccess(db, actor, groupId)
  const patch: Partial<typeof groups.$inferInsert> = {}
  if (input.name !== undefined) patch.name = input.name.trim()
  if (input.wilayaId !== undefined) patch.wilayaId = input.wilayaId
  if (input.schoolId !== undefined) patch.schoolId = input.schoolId
  if (input.levelId !== undefined) patch.levelId = input.levelId
  if (input.streamId !== undefined) patch.streamId = input.streamId
  if (input.academicYearId !== undefined) patch.academicYearId = input.academicYearId
  if (input.dayOfWeek !== undefined) patch.dayOfWeek = input.dayOfWeek
  if (input.startTime !== undefined) patch.startTime = input.startTime
  if (input.durationMinutes !== undefined) patch.durationMinutes = input.durationMinutes
  if (input.room !== undefined) patch.room = input.room
  if (input.capacity !== undefined) patch.capacity = input.capacity
  if (input.startsOn !== undefined) patch.startsOn = input.startsOn
  if (input.endsOn !== undefined) patch.endsOn = input.endsOn
  if (input.status !== undefined) patch.status = input.status
  if (input.lateAfterMinutes !== undefined) patch.lateAfterMinutes = input.lateAfterMinutes
  if (input.maxUnexcusedAbsences !== undefined) patch.maxUnexcusedAbsences = input.maxUnexcusedAbsences
  if (input.notes !== undefined) patch.notes = input.notes

  return db.transaction(async (tx) => {
    const [row] = await tx.update(groups).set(patch).where(eq(groups.id, g.id)).returning()
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: g.workspaceId,
      action: 'group.update',
      entityType: 'group',
      entityId: g.id,
      oldValue: { name: g.name, status: g.status },
      newValue: patch as Record<string, unknown>
    })
    return row
  })
}

export async function archiveGroup(db: Db, actor: Actor, groupId: string) {
  const g = await assertGroupAccess(db, actor, groupId)
  await db.transaction(async (tx) => {
    await tx.update(groups).set({ status: 'ARCHIVED', deletedAt: new Date() }).where(eq(groups.id, g.id))
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: g.workspaceId,
      action: 'group.archive',
      entityType: 'group',
      entityId: g.id,
      oldValue: { status: g.status },
      newValue: { status: 'ARCHIVED' }
    })
  })
}

export interface GroupListItem {
  id: string
  name: string
  status: string
  dayOfWeek: number | null
  startTime: string | null
  room: string | null
  capacity: number | null
  levelName: string | null
  streamName: string | null
  schoolName: string | null
  wilayaName: string | null
  yearLabel: string | null
  activeStudents: number
  totalStudents: number
  suspendedStudents: number
  hasOpenSession: boolean
}

export async function listGroups(db: Db, actor: Actor, opts: { workspaceId?: string; includeArchived?: boolean } = {}): Promise<GroupListItem[]> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : (opts.workspaceId ?? null)
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      status: groups.status,
      dayOfWeek: groups.dayOfWeek,
      startTime: groups.startTime,
      room: groups.room,
      capacity: groups.capacity,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      schoolName: schools.name,
      wilayaName: wilayas.nameAr,
      yearLabel: academicYears.label,
      activeStudents: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${groups.id} and gs.status = 'ACTIVE')`,
      totalStudents: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${groups.id} and gs.status <> 'LEFT_GROUP')`,
      suspendedStudents: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${groups.id} and gs.status in ('SUSPENDED','SUSPENDED_DUE_TO_ABSENCE'))`,
      hasOpenSession: sql<boolean>`exists(select 1 from ${classSessions} cs where cs.group_id = ${groups.id} and cs.status = 'OPEN')`
    })
    .from(groups)
    .leftJoin(levels, eq(levels.id, groups.levelId))
    .leftJoin(streams, eq(streams.id, groups.streamId))
    .leftJoin(schools, eq(schools.id, groups.schoolId))
    .leftJoin(wilayas, eq(wilayas.id, groups.wilayaId))
    .leftJoin(academicYears, eq(academicYears.id, groups.academicYearId))
    .where(
      and(
        workspaceId ? eq(groups.workspaceId, workspaceId) : undefined,
        isNull(groups.deletedAt),
        opts.includeArchived ? undefined : inArray(groups.status, ['ACTIVE', 'PAUSED', 'COMPLETED'])
      )
    )
    .orderBy(asc(groups.dayOfWeek), asc(groups.startTime), asc(groups.name))
  return rows
}

export async function getGroupDetail(db: Db, actor: Actor, groupId: string) {
  const g = await assertGroupAccess(db, actor, groupId)
  const [meta] = await db
    .select({
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      schoolName: schools.name,
      wilayaName: wilayas.nameAr,
      yearLabel: academicYears.label
    })
    .from(groups)
    .leftJoin(levels, eq(levels.id, groups.levelId))
    .leftJoin(streams, eq(streams.id, groups.streamId))
    .leftJoin(schools, eq(schools.id, groups.schoolId))
    .leftJoin(wilayas, eq(wilayas.id, groups.wilayaId))
    .leftJoin(academicYears, eq(academicYears.id, groups.academicYearId))
    .where(eq(groups.id, g.id))
  return { ...g, ...meta }
}

export interface GroupMember {
  groupStudentId: string
  studentId: string
  userId: string
  fullName: string
  email: string
  phone: string | null
  studentType: string
  status: string
  enrolledAt: Date
  unexcusedAbsences: number
  presentCount: number
  lateCount: number
  absentCount: number
  attendanceRate: number | null
}

export async function listGroupMembers(db: Db, actor: Actor, groupId: string): Promise<GroupMember[]> {
  const g = await assertGroupAccess(db, actor, groupId)
  const rows = await db
    .select({
      groupStudentId: groupStudents.id,
      studentId: students.id,
      userId: users.id,
      fullName: profiles.fullName,
      email: users.email,
      phone: profiles.phone,
      studentType: students.studentType,
      status: groupStudents.status,
      enrolledAt: groupStudents.enrolledAt,
      unexcusedAbsences: groupStudents.unexcusedAbsencesCount,
      presentCount: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.group_student_id = ${groupStudents.id} and a.status = 'PRESENT')`,
      lateCount: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.group_student_id = ${groupStudents.id} and a.status = 'LATE')`,
      absentCount: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.group_student_id = ${groupStudents.id} and a.status in ('ABSENT','UNEXCUSED','EXCUSED'))`
    })
    .from(groupStudents)
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(groupStudents.groupId, g.id))
    .orderBy(asc(profiles.fullName))
  return rows.map((r) => {
    const total = r.presentCount + r.lateCount + r.absentCount
    return {
      ...r,
      fullName: r.fullName ?? r.email,
      attendanceRate: total > 0 ? Math.round(((r.presentCount + r.lateCount) / total) * 100) : null
    }
  })
}

export interface GroupDashboard {
  enrolled: number
  active: number
  suspended: number
  left: number
  sessionsTotal: number
  sessionsClosed: number
  openSession: { id: string; startedAt: Date | null; title: string | null } | null
  presentTotal: number
  lateTotal: number
  absentTotal: number
  attendanceRate: number | null
  averageScore: number | null
  assignmentsCount: number
  completionRate: number | null
  activeCodes: number
  usedCodes: number
  frequentlyLate: { studentId: string; fullName: string; lateCount: number }[]
  atRisk: { studentId: string; fullName: string; unexcused: number; attendanceRate: number | null; status: string }[]
  recentSessions: { id: string; scheduledAt: Date; status: string; title: string | null; present: number; late: number; absent: number }[]
}

export async function getGroupDashboard(db: Db, actor: Actor, groupId: string): Promise<GroupDashboard> {
  const g = await assertGroupAccess(db, actor, groupId)
  const members = await listGroupMembers(db, actor, g.id)

  const [sess] = await db
    .select({
      total: sql<number>`count(*)::int`,
      closed: sql<number>`sum(case when ${classSessions.status} = 'CLOSED' then 1 else 0 end)::int`
    })
    .from(classSessions)
    .where(eq(classSessions.groupId, g.id))

  const [open] = await db
    .select({ id: classSessions.id, startedAt: classSessions.startedAt, title: classSessions.title })
    .from(classSessions)
    .where(and(eq(classSessions.groupId, g.id), eq(classSessions.status, 'OPEN')))
    .limit(1)

  const [avg] = await db
    .select({ avg: sql<number | null>`avg(${grades.score} / nullif(${grades.maxScore}, 0) * 20)` })
    .from(grades)
    .innerJoin(groupStudents, and(eq(groupStudents.studentId, grades.studentId), eq(groupStudents.groupId, g.id)))
    .where(eq(grades.visibleToStudent, true))

  const [asg] = await db
    .select({ n: sql<number>`count(distinct ${assignments.id})::int` })
    .from(assignments)
    .innerJoin(assignmentTargets, eq(assignmentTargets.assignmentId, assignments.id))
    .where(and(eq(assignmentTargets.groupId, g.id), isNull(assignments.deletedAt)))

  const [codes] = await db
    .select({
      active: sql<number>`sum(case when ${enrollmentCodes.status} = 'ACTIVE' then 1 else 0 end)::int`,
      used: sql<number>`sum(case when ${enrollmentCodes.status} = 'USED' then 1 else 0 end)::int`
    })
    .from(enrollmentCodes)
    .where(eq(enrollmentCodes.groupId, g.id))

  const recent = await db
    .select({
      id: classSessions.id,
      scheduledAt: classSessions.scheduledAt,
      status: classSessions.status,
      title: classSessions.title,
      present: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status = 'PRESENT')`,
      late: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status = 'LATE')`,
      absent: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status in ('ABSENT','UNEXCUSED','EXCUSED'))`
    })
    .from(classSessions)
    .where(eq(classSessions.groupId, g.id))
    .orderBy(desc(classSessions.scheduledAt))
    .limit(8)

  const presentTotal = members.reduce((s, m) => s + m.presentCount, 0)
  const lateTotal = members.reduce((s, m) => s + m.lateCount, 0)
  const absentTotal = members.reduce((s, m) => s + m.absentCount, 0)
  const attTotal = presentTotal + lateTotal + absentTotal

  return {
    enrolled: members.filter((m) => m.status !== 'LEFT_GROUP').length,
    active: members.filter((m) => m.status === 'ACTIVE').length,
    suspended: members.filter((m) => m.status === 'SUSPENDED' || m.status === 'SUSPENDED_DUE_TO_ABSENCE').length,
    left: members.filter((m) => m.status === 'LEFT_GROUP').length,
    sessionsTotal: sess?.total ?? 0,
    sessionsClosed: sess?.closed ?? 0,
    openSession: open ?? null,
    presentTotal,
    lateTotal,
    absentTotal,
    attendanceRate: attTotal > 0 ? Math.round(((presentTotal + lateTotal) / attTotal) * 100) : null,
    averageScore: avg?.avg != null ? Math.round(Number(avg.avg) * 10) / 10 : null,
    assignmentsCount: asg?.n ?? 0,
    completionRate: null,
    activeCodes: codes?.active ?? 0,
    usedCodes: codes?.used ?? 0,
    frequentlyLate: members
      .filter((m) => m.lateCount >= 2)
      .sort((a, b) => b.lateCount - a.lateCount)
      .slice(0, 5)
      .map((m) => ({ studentId: m.studentId, fullName: m.fullName, lateCount: m.lateCount })),
    atRisk: members
      .filter(
        (m) =>
          m.status === 'SUSPENDED_DUE_TO_ABSENCE' ||
          (m.status === 'ACTIVE' && (m.unexcusedAbsences >= g.maxUnexcusedAbsences - 1 || (m.attendanceRate !== null && m.attendanceRate < 70)))
      )
      .slice(0, 8)
      .map((m) => ({
        studentId: m.studentId,
        fullName: m.fullName,
        unexcused: m.unexcusedAbsences,
        attendanceRate: m.attendanceRate,
        status: m.status
      })),
    recentSessions: recent
  }
}
