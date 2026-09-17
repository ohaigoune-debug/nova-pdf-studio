import { and, asc, desc, eq, gte, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  attendanceRecords,
  classSessions,
  groupStudents,
  groups,
  scannerSessions,
  students
} from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { recomputeUnexcused } from './enrollment.service'
import { assertGroupAccess } from './groups.service'
import { notifyMany } from './notifications.service'
import { addTimelineMany } from './timeline.service'

export type ClassSessionRow = typeof classSessions.$inferSelect

export async function assertSessionAccess(db: Db, actor: Actor, sessionId: string): Promise<ClassSessionRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId)).limit(1)
  if (!s) throw new AppError('SESSION_NOT_FOUND')
  if (actor.role === 'TEACHER' && s.workspaceId !== actor.workspaceId) throw new AppError('SESSION_NOT_FOUND')
  return s
}

export interface StartSessionInput {
  groupId: string
  title?: string | null
  topic?: string | null
  lateAfterMinutes?: number | null
  now?: Date
}

/** "بدء الحصة": ينشئ حصة OPEN ويفتح الحضور. حصة مفتوحة واحدة لكل فوج. */
export async function startSession(db: Db, actor: Actor, input: StartSessionInput) {
  const g = await assertGroupAccess(db, actor, input.groupId)
  if (g.status !== 'ACTIVE') throw new AppError('GROUP_NOT_ACTIVE')
  const now = input.now ?? new Date()

  return db.transaction(async (tx) => {
    const [open] = await tx
      .select({ id: classSessions.id })
      .from(classSessions)
      .where(and(eq(classSessions.groupId, g.id), eq(classSessions.status, 'OPEN')))
      .limit(1)
    if (open) throw new AppError('SESSION_ALREADY_OPEN', { sessionId: open.id })

    const [row] = await tx
      .insert(classSessions)
      .values({
        workspaceId: g.workspaceId,
        groupId: g.id,
        teacherId: g.teacherId,
        title: input.title?.trim() || null,
        topic: input.topic?.trim() || null,
        scheduledAt: now,
        startedAt: now,
        status: 'OPEN',
        attendanceOpen: true,
        lateAfterMinutes: input.lateAfterMinutes ?? g.lateAfterMinutes
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')

    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: g.workspaceId,
      action: 'session.start',
      entityType: 'class_session',
      entityId: row.id,
      newValue: { groupId: g.id, title: row.title }
    })
    return row
  })
}

export interface CloseSessionResult {
  sessionId: string
  present: number
  late: number
  autoAbsent: number
  suspended: { studentId: string; groupStudentId: string }[]
  warned: number
}

/**
 * "إنهاء الحصة" — معاملة واحدة:
 * 1) إغلاق الحصة والسكانر ومنع أي QR جديد
 * 2) كل طالب ACTIVE بلا سجل ⇒ UNEXCUSED (AUTO_CLOSE)
 * 3) إعادة حساب الإحصائيات وتطبيق قاعدة الغيابات ⇒ تعليق عند الحد
 * 4) إشعارات + Timeline + Audit
 */
export async function closeSession(db: Db, actor: Actor, sessionId: string, now: Date = new Date()): Promise<CloseSessionResult> {
  const s0 = await assertSessionAccess(db, actor, sessionId)
  if (s0.status !== 'OPEN') throw new AppError('SESSION_NOT_OPEN')

  return db.transaction(async (tx) => {
    const [s] = await tx.select().from(classSessions).where(eq(classSessions.id, sessionId)).for('update').limit(1)
    if (!s || s.status !== 'OPEN') throw new AppError('SESSION_NOT_OPEN')
    const [g] = await tx.select().from(groups).where(eq(groups.id, s.groupId)).limit(1)
    if (!g) throw new AppError('NOT_FOUND')

    await tx
      .update(classSessions)
      .set({ status: 'CLOSED', attendanceOpen: false, endedAt: now, closedByUserId: actor.userId })
      .where(eq(classSessions.id, s.id))
    await tx
      .update(scannerSessions)
      .set({ closedAt: now })
      .where(and(eq(scannerSessions.classSessionId, s.id), isNull(scannerSessions.closedAt)))

    const active = await tx
      .select({ id: groupStudents.id, studentId: groupStudents.studentId, userId: students.userId })
      .from(groupStudents)
      .innerJoin(students, eq(students.id, groupStudents.studentId))
      .where(and(eq(groupStudents.groupId, s.groupId), eq(groupStudents.status, 'ACTIVE')))

    const recorded = await tx
      .select({ studentId: attendanceRecords.studentId, status: attendanceRecords.status })
      .from(attendanceRecords)
      .where(eq(attendanceRecords.classSessionId, s.id))
    const recordedIds = new Set(recorded.map((r) => r.studentId))

    const missing = active.filter((a) => !recordedIds.has(a.studentId))
    if (missing.length > 0) {
      await tx.insert(attendanceRecords).values(
        missing.map((m) => ({
          workspaceId: s.workspaceId,
          classSessionId: s.id,
          groupStudentId: m.id,
          studentId: m.studentId,
          status: 'UNEXCUSED' as const,
          source: 'AUTO_CLOSE' as const,
          recordedAt: now,
          recordedByUserId: actor.userId
        }))
      )
    }

    const suspended: CloseSessionResult['suspended'] = []
    let warned = 0
    const notifications: Parameters<typeof notifyMany>[1] = []
    const timeline: Parameters<typeof addTimelineMany>[1] = []
    const sessionLabel = s.title || g.name

    for (const m of missing) {
      const r = await recomputeUnexcused(tx, { groupStudentId: m.id, actorUserId: actor.userId, applySuspension: true })
      timeline.push({
        studentId: m.studentId,
        workspaceId: s.workspaceId,
        type: 'ABSENT',
        title: `غاب عن حصة ${sessionLabel}`,
        meta: { classSessionId: s.id, groupId: g.id },
        occurredAt: now
      })
      if (r.suspendedNow) {
        suspended.push({ studentId: m.studentId, groupStudentId: m.id })
      } else {
        const remaining = g.maxUnexcusedAbsences - r.count
        if (remaining === 1) {
          warned++
          notifications.push({
            userId: m.userId,
            workspaceId: s.workspaceId,
            type: 'ABSENCE_WARNING',
            title: `إنذار غياب في فوج ${g.name}`,
            body: `لديك ${r.count} غيابات غير مبررة. غياب إضافي واحد سيؤدي إلى تعليق تسجيلك.`,
            link: '/student/attendance'
          })
        } else {
          notifications.push({
            userId: m.userId,
            workspaceId: s.workspaceId,
            type: 'ABSENCE',
            title: `تم تسجيل غيابك عن حصة ${sessionLabel}`,
            body: `عدد الغيابات غير المبررة: ${r.count} من ${g.maxUnexcusedAbsences}.`,
            link: '/student/attendance'
          })
        }
      }
    }

    await notifyMany(tx, notifications)
    await addTimelineMany(tx, timeline)
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: s.workspaceId,
      action: 'session.close',
      entityType: 'class_session',
      entityId: s.id,
      oldValue: { status: 'OPEN' },
      newValue: { status: 'CLOSED', autoAbsent: missing.length, suspended: suspended.length }
    })

    return {
      sessionId: s.id,
      present: recorded.filter((r) => r.status === 'PRESENT').length,
      late: recorded.filter((r) => r.status === 'LATE').length,
      autoAbsent: missing.length,
      suspended,
      warned
    }
  })
}

export async function cancelSession(db: Db, actor: Actor, sessionId: string) {
  const s = await assertSessionAccess(db, actor, sessionId)
  if (s.status === 'CLOSED') throw new AppError('SESSION_CLOSED')
  await db.transaction(async (tx) => {
    await tx.update(classSessions).set({ status: 'CANCELLED', attendanceOpen: false, endedAt: new Date() }).where(eq(classSessions.id, s.id))
    await tx.update(scannerSessions).set({ closedAt: new Date() }).where(and(eq(scannerSessions.classSessionId, s.id), isNull(scannerSessions.closedAt)))
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: s.workspaceId,
      action: 'session.cancel',
      entityType: 'class_session',
      entityId: s.id,
      oldValue: { status: s.status },
      newValue: { status: 'CANCELLED' }
    })
  })
}

export async function planSession(db: Db, actor: Actor, input: { groupId: string; scheduledAt: Date; title?: string | null; topic?: string | null }) {
  const g = await assertGroupAccess(db, actor, input.groupId)
  const [row] = await db
    .insert(classSessions)
    .values({
      workspaceId: g.workspaceId,
      groupId: g.id,
      teacherId: g.teacherId,
      title: input.title?.trim() || null,
      topic: input.topic?.trim() || null,
      scheduledAt: input.scheduledAt,
      status: 'PLANNED',
      lateAfterMinutes: g.lateAfterMinutes
    })
    .returning()
  return row
}

export interface SessionListItem {
  id: string
  groupId: string
  groupName: string
  title: string | null
  topic: string | null
  scheduledAt: Date
  startedAt: Date | null
  endedAt: Date | null
  status: string
  attendanceOpen: boolean
  present: number
  late: number
  absent: number
}

export async function listSessions(
  db: Db,
  actor: Actor,
  opts: { groupId?: string; status?: string[]; from?: Date; to?: Date; limit?: number; workspaceId?: string } = {}
): Promise<SessionListItem[]> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : (opts.workspaceId ?? null)
  return db
    .select({
      id: classSessions.id,
      groupId: classSessions.groupId,
      groupName: groups.name,
      title: classSessions.title,
      topic: classSessions.topic,
      scheduledAt: classSessions.scheduledAt,
      startedAt: classSessions.startedAt,
      endedAt: classSessions.endedAt,
      status: classSessions.status,
      attendanceOpen: classSessions.attendanceOpen,
      present: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status = 'PRESENT')`,
      late: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status = 'LATE')`,
      absent: sql<number>`(select count(*)::int from ${attendanceRecords} a where a.class_session_id = ${classSessions.id} and a.status in ('ABSENT','UNEXCUSED','EXCUSED'))`
    })
    .from(classSessions)
    .innerJoin(groups, eq(groups.id, classSessions.groupId))
    .where(
      and(
        workspaceId ? eq(classSessions.workspaceId, workspaceId) : undefined,
        opts.groupId ? eq(classSessions.groupId, opts.groupId) : undefined,
        opts.status && opts.status.length > 0 ? inArray(classSessions.status, opts.status) : undefined,
        opts.from ? gte(classSessions.scheduledAt, opts.from) : undefined,
        opts.to ? lt(classSessions.scheduledAt, opts.to) : undefined
      )
    )
    .orderBy(desc(classSessions.scheduledAt))
    .limit(opts.limit ?? 50)
}

export async function getSessionDetail(db: Db, actor: Actor, sessionId: string) {
  const s = await assertSessionAccess(db, actor, sessionId)
  const [g] = await db.select({ name: groups.name, maxUnexcused: groups.maxUnexcusedAbsences }).from(groups).where(eq(groups.id, s.groupId)).limit(1)
  return { ...s, groupName: g?.name ?? '', maxUnexcusedAbsences: g?.maxUnexcused ?? 4 }
}

/** الطلاب النشطون في الفوج الذين لم يُسجَّلوا بعد في هذه الحصة (لوضع السكانر) */
export async function listUnrecordedStudents(db: Db, actor: Actor, sessionId: string) {
  const s = await assertSessionAccess(db, actor, sessionId)
  const recorded = db.select({ id: attendanceRecords.studentId }).from(attendanceRecords).where(eq(attendanceRecords.classSessionId, s.id))
  return db
    .select({ groupStudentId: groupStudents.id, studentId: groupStudents.studentId })
    .from(groupStudents)
    .where(and(eq(groupStudents.groupId, s.groupId), eq(groupStudents.status, 'ACTIVE'), notInArray(groupStudents.studentId, recorded)))
    .orderBy(asc(groupStudents.enrolledAt))
}
