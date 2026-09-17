import { and, count, desc, eq, gte, ilike, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  activityLogs,
  attendanceRecords,
  auditLogs,
  classSessions,
  groupStudents,
  groups,
  jobs,
  profiles,
  students,
  teacherWorkspaces,
  teachers,
  users
} from '@/server/db/schema'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export interface CreateTeacherInput {
  email: string
  password: string
  fullName: string
  phone?: string | null
  workspaceName?: string | null
  subject?: string | null
}

function slugify(value: string): string {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return (base || 'teacher') + '-' + Math.random().toString(36).slice(2, 7)
}

/** المشرف ينشئ أستاذاً: مستخدم + ملف + مساحة عمل (Tenant) + سجل أستاذ. */
export async function createTeacher(db: Db, actor: Actor, input: CreateTeacherInput) {
  assertRole(actor, 'SUPER_ADMIN')
  const email = input.email.trim().toLowerCase()
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) throw new AppError('EMAIL_TAKEN')

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash: hashPassword(input.password), role: 'TEACHER' })
      .returning({ id: users.id })
    if (!user) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: user.id, fullName: input.fullName.trim(), phone: input.phone ?? null })
    const wsName = input.workspaceName?.trim() || `مساحة ${input.fullName.trim()}`
    const [ws] = await tx
      .insert(teacherWorkspaces)
      .values({ ownerUserId: user.id, name: wsName, slug: slugify(wsName) })
      .returning({ id: teacherWorkspaces.id })
    if (!ws) throw new AppError('INTERNAL')
    const [teacher] = await tx
      .insert(teachers)
      .values({
        userId: user.id,
        workspaceId: ws.id,
        displayName: input.fullName.trim(),
        subject: input.subject?.trim() || 'اللغة العربية وآدابها'
      })
      .returning({ id: teachers.id })
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: ws.id,
      action: 'teacher.create',
      entityType: 'teacher',
      entityId: teacher?.id,
      newValue: { email, fullName: input.fullName }
    })
    return { userId: user.id, workspaceId: ws.id, teacherId: teacher?.id ?? null }
  })
}

export async function setUserStatus(db: Db, actor: Actor, userId: string, status: 'ACTIVE' | 'DISABLED') {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db.select({ status: users.status, role: users.role }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row) throw new AppError('NOT_FOUND')
  if (row.role === 'SUPER_ADMIN' && status === 'DISABLED') throw new AppError('FORBIDDEN')
  await db.transaction(async (tx) => {
    await tx.update(users).set({ status }).where(eq(users.id, userId))
    if (status === 'DISABLED') await revokeAllSessions(tx, userId)
    await writeAudit(tx, {
      actorUserId: actor.userId,
      action: 'user.status',
      entityType: 'user',
      entityId: userId,
      oldValue: { status: row.status },
      newValue: { status }
    })
  })
}

export async function listTeachers(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db
    .select({
      teacherId: teachers.id,
      userId: users.id,
      email: users.email,
      status: users.status,
      fullName: profiles.fullName,
      phone: profiles.phone,
      workspaceId: teacherWorkspaces.id,
      workspaceName: teacherWorkspaces.name,
      subject: teachers.subject,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
      groupsCount: sql<number>`(select count(*)::int from ${groups} g where g.workspace_id = ${teacherWorkspaces.id} and g.deleted_at is null)`,
      studentsCount: sql<number>`(select count(distinct gs.student_id)::int from ${groupStudents} gs where gs.workspace_id = ${teacherWorkspaces.id} and gs.status = 'ACTIVE')`
    })
    .from(teachers)
    .innerJoin(users, eq(users.id, teachers.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, teachers.workspaceId))
    .orderBy(desc(users.createdAt))
  return rows
}

export async function listUsers(db: Db, actor: Actor, opts: { search?: string; role?: string; limit?: number; offset?: number } = {}) {
  assertRole(actor, 'SUPER_ADMIN')
  const where = and(
    isNull(users.deletedAt),
    opts.role ? eq(users.role, opts.role) : undefined,
    opts.search
      ? or(ilike(users.email, `%${opts.search}%`), ilike(profiles.fullName, `%${opts.search}%`))
      : undefined
  )
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      status: users.status,
      fullName: profiles.fullName,
      phone: profiles.phone,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt
    })
    .from(users)
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(where)
    .orderBy(desc(users.createdAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0)
  const [total] = await db.select({ n: count() }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(where)
  return { rows, total: total?.n ?? 0 }
}

export async function listAllStudents(db: Db, actor: Actor, opts: { search?: string; limit?: number } = {}) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      studentId: students.id,
      userId: users.id,
      email: users.email,
      status: users.status,
      fullName: profiles.fullName,
      phone: profiles.phone,
      studentType: students.studentType,
      createdAt: users.createdAt,
      activeGroups: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.student_id = ${students.id} and gs.status = 'ACTIVE')`
    })
    .from(students)
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(opts.search ? or(ilike(users.email, `%${opts.search}%`), ilike(profiles.fullName, `%${opts.search}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(opts.limit ?? 100)
}

export async function listAllGroups(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: groups.id,
      name: groups.name,
      status: groups.status,
      workspaceName: teacherWorkspaces.name,
      teacherName: teachers.displayName,
      createdAt: groups.createdAt,
      activeStudents: sql<number>`(select count(*)::int from ${groupStudents} gs where gs.group_id = ${groups.id} and gs.status = 'ACTIVE')`
    })
    .from(groups)
    .innerJoin(teacherWorkspaces, eq(teacherWorkspaces.id, groups.workspaceId))
    .innerJoin(teachers, eq(teachers.id, groups.teacherId))
    .where(isNull(groups.deletedAt))
    .orderBy(desc(groups.createdAt))
}

export async function platformStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const [u] = await db.select({ n: count() }).from(users).where(isNull(users.deletedAt))
  const [s] = await db.select({ n: count() }).from(students)
  const [t] = await db.select({ n: count() }).from(teachers)
  const [g] = await db.select({ n: count() }).from(groups).where(and(isNull(groups.deletedAt), eq(groups.status, 'ACTIVE')))
  const [sessionsToday] = await db
    .select({ n: count() })
    .from(classSessions)
    .where(gte(classSessions.scheduledAt, startOfDay))
  const [att] = await db
    .select({
      total: count(),
      present: sql<number>`sum(case when ${attendanceRecords.status} in ('PRESENT','LATE') then 1 else 0 end)::int`
    })
    .from(attendanceRecords)
  const [activeToday] = await db
    .select({ n: sql<number>`count(distinct ${activityLogs.userId})::int` })
    .from(activityLogs)
    .where(gte(activityLogs.createdAt, startOfDay))
  const [jobsToday] = await db.select({ n: count() }).from(jobs).where(gte(jobs.createdAt, startOfDay))
  const [failedJobs] = await db.select({ n: count() }).from(jobs).where(eq(jobs.status, 'FAILED'))
  const [auditToday] = await db.select({ n: count() }).from(auditLogs).where(gte(auditLogs.createdAt, startOfDay))

  const total = att?.total ?? 0
  return {
    users: u?.n ?? 0,
    students: s?.n ?? 0,
    teachers: t?.n ?? 0,
    activeGroups: g?.n ?? 0,
    sessionsToday: sessionsToday?.n ?? 0,
    attendanceRate: total > 0 ? Math.round(((att?.present ?? 0) / total) * 100) : null,
    activeUsersToday: activeToday?.n ?? 0,
    aiJobsToday: jobsToday?.n ?? 0,
    failedJobs: failedJobs?.n ?? 0,
    auditToday: auditToday?.n ?? 0
  }
}

export async function listAuditLogs(db: Db, actor: Actor, limit = 100) {
  assertRole(actor, 'SUPER_ADMIN')
  return db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      entityId: auditLogs.entityId,
      oldValue: auditLogs.oldValue,
      newValue: auditLogs.newValue,
      createdAt: auditLogs.createdAt,
      actorName: profiles.fullName,
      actorEmail: users.email,
      workspaceName: teacherWorkspaces.name
    })
    .from(auditLogs)
    .leftJoin(users, eq(users.id, auditLogs.actorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(teacherWorkspaces, eq(teacherWorkspaces.id, auditLogs.workspaceId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
}
