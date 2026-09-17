import { and, asc, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  attendanceRecords,
  classSessions,
  groupStudents,
  groups,
  levels,
  profiles,
  schools,
  streams,
  students,
  users,
  wilayas
} from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import { assertRole, type Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { listStudentAttendance, summarizeAttendance, type AttendanceStats } from './attendance.service'
import { listStatusHistory } from './enrollment.service'
import { listTimeline } from './timeline.service'

export interface TeacherStudentRow {
  studentId: string
  userId: string
  fullName: string
  email: string
  phone: string | null
  studentType: string
  levelName: string | null
  streamName: string | null
  groups: { groupId: string; groupName: string; status: string; groupStudentId: string; unexcused: number }[]
}

/** طلاب الأستاذ (كل من له تسجيل في أحد أفواج مساحته). */
export async function listTeacherStudents(
  db: Db,
  actor: Actor,
  opts: { search?: string; groupId?: string; status?: string; workspaceId?: string } = {}
): Promise<TeacherStudentRow[]> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : (opts.workspaceId ?? null)
  const rows = await db
    .select({
      studentId: students.id,
      userId: users.id,
      fullName: profiles.fullName,
      email: users.email,
      phone: profiles.phone,
      studentType: students.studentType,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      groupId: groups.id,
      groupName: groups.name,
      status: groupStudents.status,
      groupStudentId: groupStudents.id,
      unexcused: groupStudents.unexcusedAbsencesCount
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .where(
      and(
        workspaceId ? eq(groupStudents.workspaceId, workspaceId) : undefined,
        opts.groupId ? eq(groupStudents.groupId, opts.groupId) : undefined,
        opts.status ? eq(groupStudents.status, opts.status) : undefined,
        opts.search ? or(ilike(profiles.fullName, `%${opts.search}%`), ilike(users.email, `%${opts.search}%`), ilike(profiles.phone, `%${opts.search}%`)) : undefined
      )
    )
    .orderBy(asc(profiles.fullName))

  const map = new Map<string, TeacherStudentRow>()
  for (const r of rows) {
    let item = map.get(r.studentId)
    if (!item) {
      item = {
        studentId: r.studentId,
        userId: r.userId,
        fullName: r.fullName ?? r.email,
        email: r.email,
        phone: r.phone,
        studentType: r.studentType,
        levelName: r.levelName,
        streamName: r.streamName,
        groups: []
      }
      map.set(r.studentId, item)
    }
    item.groups.push({ groupId: r.groupId, groupName: r.groupName, status: r.status, groupStudentId: r.groupStudentId, unexcused: r.unexcused })
  }
  return [...map.values()]
}

export interface StudentProfile {
  studentId: string
  userId: string
  fullName: string
  email: string
  phone: string | null
  guardianPhone: string | null
  studentType: string
  wilayaName: string | null
  schoolName: string | null
  levelName: string | null
  streamName: string | null
  registeredAt: Date
  enrollments: {
    groupStudentId: string
    groupId: string
    groupName: string
    status: string
    enrolledAt: Date
    unexcused: number
    maxUnexcused: number
    suspensionReason: string | null
    history: Awaited<ReturnType<typeof listStatusHistory>>
  }[]
  attendance: AttendanceStats
  recentAttendance: Awaited<ReturnType<typeof listStudentAttendance>>
  timeline: Awaited<ReturnType<typeof listTimeline>>
}

/**
 * الملف الشامل للطالب. الأستاذ يرى فقط طلاباً مسجّلين في أفواجه؛
 * الطالب يرى نفسه فقط.
 */
export async function getStudentProfile(db: Db, actor: Actor, studentId: string): Promise<StudentProfile> {
  if (actor.role === 'STUDENT' && actor.studentId !== studentId) throw new AppError('FORBIDDEN')
  if (actor.role !== 'STUDENT') assertRole(actor, 'TEACHER', 'SUPER_ADMIN')

  const [base] = await db
    .select({
      studentId: students.id,
      userId: users.id,
      fullName: profiles.fullName,
      email: users.email,
      phone: profiles.phone,
      guardianPhone: students.guardianPhone,
      studentType: students.studentType,
      wilayaName: wilayas.nameAr,
      schoolName: schools.name,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      registeredAt: users.createdAt
    })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(wilayas, eq(wilayas.id, students.wilayaId))
    .leftJoin(schools, eq(schools.id, students.schoolId))
    .leftJoin(levels, eq(levels.id, students.levelId))
    .leftJoin(streams, eq(streams.id, students.streamId))
    .where(eq(students.id, studentId))
    .limit(1)
  if (!base) throw new AppError('NOT_FOUND')

  const enrollmentRows = await db
    .select({
      groupStudentId: groupStudents.id,
      groupId: groups.id,
      groupName: groups.name,
      status: groupStudents.status,
      enrolledAt: groupStudents.enrolledAt,
      unexcused: groupStudents.unexcusedAbsencesCount,
      maxUnexcused: groups.maxUnexcusedAbsences,
      suspensionReason: groupStudents.suspensionReason,
      workspaceId: groupStudents.workspaceId
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(
      and(
        eq(groupStudents.studentId, studentId),
        actor.role === 'TEACHER' ? eq(groupStudents.workspaceId, actor.workspaceId ?? '') : undefined
      )
    )
    .orderBy(desc(groupStudents.enrolledAt))

  // الأستاذ لا يرى طالباً ليس في أي فوج من أفواجه
  if (actor.role === 'TEACHER' && enrollmentRows.length === 0) throw new AppError('NOT_FOUND')

  const enrollments = await Promise.all(
    enrollmentRows.map(async (e) => ({ ...e, history: await listStatusHistory(db, e.groupStudentId) }))
  )
  const recentAttendance = await listStudentAttendance(db, actor, studentId, { limit: 200 })
  const timelineRows = await listTimeline(db, studentId, 40)
  const timeline =
    actor.role === 'TEACHER'
      ? timelineRows.filter((t) => t.workspaceId === null || t.workspaceId === actor.workspaceId)
      : timelineRows

  return {
    ...base,
    fullName: base.fullName ?? base.email,
    enrollments,
    attendance: summarizeAttendance(recentAttendance),
    recentAttendance: recentAttendance.slice(0, 30),
    timeline
  }
}

/** الصفحة الرئيسية للطالب */
export async function studentHome(db: Db, actor: Actor) {
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  const studentId = actor.studentId
  const myGroups = await db
    .select({
      groupStudentId: groupStudents.id,
      groupId: groups.id,
      name: groups.name,
      status: groupStudents.status,
      dayOfWeek: groups.dayOfWeek,
      startTime: groups.startTime,
      room: groups.room,
      levelName: levels.nameAr,
      streamName: streams.nameAr,
      unexcused: groupStudents.unexcusedAbsencesCount,
      maxUnexcused: groups.maxUnexcusedAbsences,
      hasOpenSession: sql<boolean>`exists(select 1 from ${classSessions} cs where cs.group_id = ${qcol(groups.id)} and cs.status = 'OPEN')`
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .leftJoin(levels, eq(levels.id, groups.levelId))
    .leftJoin(streams, eq(streams.id, groups.streamId))
    .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
    .orderBy(asc(groups.dayOfWeek))

  const attendance = await listStudentAttendance(db, actor, studentId, { limit: 200 })
  const stats = summarizeAttendance(attendance)
  const [absCount] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.studentId, studentId), eq(attendanceRecords.status, 'UNEXCUSED')))

  return { groups: myGroups, attendance: stats, unexcusedTotal: absCount?.n ?? 0, recent: attendance.slice(0, 5) }
}
