import { and, asc, desc, eq, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  attendanceRecords,
  classSessions,
  groupStudents,
  groups,
  profiles,
  qrNonces,
  scannerSessions,
  students,
  users
} from '@/server/db/schema'
import { qcol } from '@/server/db/sql-helpers'
import type { AttendanceStatus } from '@/server/db/schema/enums'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeActivity, writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { issueQrToken, verifyQrToken } from '@/server/lib/qr-token'
import { recomputeUnexcused } from './enrollment.service'
import { notify } from './notifications.service'
import { addTimeline } from './timeline.service'
import { assertSessionAccess } from './class-sessions.service'

/* -------------------------------------------------------------------------- */
/*                               Student: QR token                            */
/* -------------------------------------------------------------------------- */

/** الطالب يطلب رمز حضور لفوج هو نشط فيه. لا يُصدر لغير ACTIVE. */
export async function issueAttendanceToken(db: Db, actor: Actor, groupId: string, now: Date = new Date()) {
  const studentId = studentIdOf(actor)
  const [gs] = await db
    .select({ status: groupStudents.status, groupName: groups.name })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.studentId, studentId)))
    .limit(1)
  if (!gs) throw new AppError('STUDENT_NOT_IN_GROUP')
  if (gs.status !== 'ACTIVE') throw new AppError('STUDENT_NOT_ACTIVE')
  const { token, payload } = issueQrToken({ studentId, groupId, now })
  return { token, expiresAt: new Date(payload.exp * 1000), groupName: gs.groupName }
}

/** أفواج الطالب النشطة (لبطاقة الحضور) */
export async function listStudentActiveGroups(db: Db, actor: Actor) {
  const studentId = studentIdOf(actor)
  return db
    .select({
      groupId: groups.id,
      name: groups.name,
      status: groupStudents.status,
      dayOfWeek: groups.dayOfWeek,
      startTime: groups.startTime,
      hasOpenSession: sql<boolean>`exists(select 1 from ${classSessions} cs where cs.group_id = ${qcol(groups.id)} and cs.status = 'OPEN')`
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(eq(groupStudents.studentId, studentId))
    .orderBy(asc(groups.name))
}

/* -------------------------------------------------------------------------- */
/*                               Teacher: scanner                             */
/* -------------------------------------------------------------------------- */

export interface ScanResult {
  status: 'PRESENT' | 'LATE'
  studentId: string
  fullName: string
  groupName: string
  recordedAt: Date
  minutesLate: number
}

export async function openScannerSession(db: Db, actor: Actor, classSessionId: string, deviceLabel?: string | null) {
  const s = await assertSessionAccess(db, actor, classSessionId)
  if (s.status !== 'OPEN') throw new AppError('SESSION_NOT_OPEN')
  const [row] = await db
    .insert(scannerSessions)
    .values({ workspaceId: s.workspaceId, classSessionId: s.id, teacherUserId: actor.userId, deviceLabel: deviceLabel ?? null })
    .returning()
  return row
}

/**
 * مسح رمز QR داخل حصة مفتوحة. كل الفحوص في الخادم:
 * التوقيع → الصلاحية → nonce → الحصة OPEN → الطالب ACTIVE في نفس الفوج → لا تكرار → PRESENT/LATE
 */
export async function scanAttendanceToken(
  db: Db,
  actor: Actor,
  input: { classSessionId: string; token: string; scannerSessionId?: string | null; now?: Date }
): Promise<ScanResult> {
  const now = input.now ?? new Date()
  const s = await assertSessionAccess(db, actor, input.classSessionId)
  if (s.status !== 'OPEN') throw new AppError('SESSION_NOT_OPEN')
  if (!s.attendanceOpen) throw new AppError('ATTENDANCE_CLOSED')

  const payload = verifyQrToken(input.token, now)
  if (payload.gid !== s.groupId) throw new AppError('STUDENT_NOT_IN_GROUP')

  return db.transaction(async (tx) => {
    // Replay protection: nonce يُستهلك مرة واحدة
    try {
      await tx.insert(qrNonces).values({ nonce: payload.n, studentId: payload.sid, expiresAt: new Date(payload.exp * 1000) })
    } catch {
      throw new AppError('QR_REPLAYED')
    }

    const [gs] = await tx
      .select({ id: groupStudents.id, status: groupStudents.status, fullName: profiles.fullName, email: users.email, userId: users.id })
      .from(groupStudents)
      .innerJoin(students, eq(students.id, groupStudents.studentId))
      .innerJoin(users, eq(users.id, students.userId))
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .where(and(eq(groupStudents.groupId, s.groupId), eq(groupStudents.studentId, payload.sid)))
      .limit(1)
    if (!gs) throw new AppError('STUDENT_NOT_IN_GROUP')
    if (gs.status !== 'ACTIVE') throw new AppError('STUDENT_NOT_ACTIVE')

    const [dup] = await tx
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.classSessionId, s.id), eq(attendanceRecords.studentId, payload.sid)))
      .limit(1)
    if (dup) throw new AppError('ATTENDANCE_DUPLICATE')

    const startedAt = s.startedAt ?? s.scheduledAt
    const minutesLate = Math.max(0, Math.floor((now.getTime() - startedAt.getTime()) / 60000))
    const status: 'PRESENT' | 'LATE' = minutesLate > s.lateAfterMinutes ? 'LATE' : 'PRESENT'

    try {
      await tx.insert(attendanceRecords).values({
        workspaceId: s.workspaceId,
        classSessionId: s.id,
        groupStudentId: gs.id,
        studentId: payload.sid,
        status,
        source: 'SCAN',
        recordedAt: now,
        minutesLate: status === 'LATE' ? minutesLate : 0,
        scannerSessionId: input.scannerSessionId ?? null,
        recordedByUserId: actor.userId
      })
    } catch {
      throw new AppError('ATTENDANCE_DUPLICATE')
    }

    if (input.scannerSessionId) {
      await tx
        .update(scannerSessions)
        .set({ scansCount: sql`${scannerSessions.scansCount} + 1` })
        .where(eq(scannerSessions.id, input.scannerSessionId))
    }

    const [g] = await tx.select({ name: groups.name }).from(groups).where(eq(groups.id, s.groupId)).limit(1)
    const groupName = g?.name ?? ''
    await addTimeline(tx, {
      studentId: payload.sid,
      workspaceId: s.workspaceId,
      type: status === 'LATE' ? 'LATE' : 'ATTENDED',
      title: status === 'LATE' ? `حضر متأخراً (${minutesLate} د) حصة ${s.title || groupName}` : `حضر حصة ${s.title || groupName}`,
      meta: { classSessionId: s.id, groupId: s.groupId, minutesLate },
      occurredAt: now
    })
    await writeActivity(tx, { userId: gs.userId, workspaceId: s.workspaceId, event: 'attendance.scan', meta: { classSessionId: s.id, status } })

    return {
      status,
      studentId: payload.sid,
      fullName: gs.fullName ?? gs.email,
      groupName,
      recordedAt: now,
      minutesLate
    }
  })
}

/* -------------------------------------------------------------------------- */
/*                         Teacher: manual + excuse                           */
/* -------------------------------------------------------------------------- */

/** تسجيل/تعديل حضور يدوياً (مثلاً طالب بلا هاتف). */
export async function setAttendanceManually(
  db: Db,
  actor: Actor,
  input: { classSessionId: string; studentId: string; status: AttendanceStatus; notes?: string | null; now?: Date }
) {
  const now = input.now ?? new Date()
  const s = await assertSessionAccess(db, actor, input.classSessionId)
  if (s.status === 'CANCELLED') throw new AppError('SESSION_CLOSED')

  return db.transaction(async (tx) => {
    const [gs] = await tx
      .select({ id: groupStudents.id, status: groupStudents.status })
      .from(groupStudents)
      .where(and(eq(groupStudents.groupId, s.groupId), eq(groupStudents.studentId, input.studentId)))
      .limit(1)
    if (!gs) throw new AppError('STUDENT_NOT_IN_GROUP')

    const [existing] = await tx
      .select()
      .from(attendanceRecords)
      .where(and(eq(attendanceRecords.classSessionId, s.id), eq(attendanceRecords.studentId, input.studentId)))
      .for('update')
      .limit(1)

    let recordId: string
    if (existing) {
      await tx
        .update(attendanceRecords)
        .set({ status: input.status, source: 'MANUAL', recordedByUserId: actor.userId, excuseNotes: input.notes ?? existing.excuseNotes })
        .where(eq(attendanceRecords.id, existing.id))
      recordId = existing.id
    } else {
      const [row] = await tx
        .insert(attendanceRecords)
        .values({
          workspaceId: s.workspaceId,
          classSessionId: s.id,
          groupStudentId: gs.id,
          studentId: input.studentId,
          status: input.status,
          source: 'MANUAL',
          recordedAt: now,
          recordedByUserId: actor.userId,
          excuseNotes: input.notes ?? null
        })
        .returning({ id: attendanceRecords.id })
      if (!row) throw new AppError('INTERNAL')
      recordId = row.id
    }

    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: s.workspaceId,
      action: 'attendance.manual',
      entityType: 'attendance_record',
      entityId: recordId,
      oldValue: existing ? { status: existing.status } : null,
      newValue: { status: input.status }
    })
    // أي تغيير قد يؤثر على عدد الغيابات غير المبررة؛ لا نعلّق تلقائياً إلا عند إغلاق الحصة
    const r = await recomputeUnexcused(tx, { groupStudentId: gs.id, actorUserId: actor.userId, applySuspension: s.status === 'CLOSED' })
    return { recordId, unexcused: r.count, suspendedNow: r.suspendedNow }
  })
}

/**
 * تبرير غياب: UNEXCUSED/ABSENT → EXCUSED مع سبب وملاحظات ومرفق اختياري.
 * يعيد حساب العدد لكن لا يعيد تفعيل الطالب تلقائياً (زر مستقل).
 */
export async function excuseAbsence(
  db: Db,
  actor: Actor,
  input: { recordId: string; reason: string; notes?: string | null; fileUrl?: string | null }
) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const reason = input.reason.trim()
  if (!reason) throw new AppError('VALIDATION', { field: 'reason' })

  return db.transaction(async (tx) => {
    const [rec] = await tx.select().from(attendanceRecords).where(eq(attendanceRecords.id, input.recordId)).for('update').limit(1)
    if (!rec) throw new AppError('ATTENDANCE_NOT_FOUND')
    if (actor.role === 'TEACHER' && rec.workspaceId !== actor.workspaceId) throw new AppError('ATTENDANCE_NOT_FOUND')
    if (rec.status !== 'UNEXCUSED' && rec.status !== 'ABSENT') throw new AppError('VALIDATION', { reason: 'not an absence' })

    await tx
      .update(attendanceRecords)
      .set({
        status: 'EXCUSED',
        excuseReason: reason,
        excuseNotes: input.notes ?? null,
        excuseFileUrl: input.fileUrl ?? null,
        excusedByUserId: actor.userId,
        excusedAt: new Date()
      })
      .where(eq(attendanceRecords.id, rec.id))

    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: rec.workspaceId,
      action: 'attendance.excuse',
      entityType: 'attendance_record',
      entityId: rec.id,
      oldValue: { status: rec.status },
      newValue: { status: 'EXCUSED', reason }
    })

    const r = await recomputeUnexcused(tx, { groupStudentId: rec.groupStudentId, actorUserId: actor.userId, applySuspension: false })
    const [gs] = await tx.select({ status: groupStudents.status }).from(groupStudents).where(eq(groupStudents.id, rec.groupStudentId)).limit(1)
    const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, rec.studentId)).limit(1)
    if (st) {
      await notify(tx, {
        userId: st.userId,
        workspaceId: rec.workspaceId,
        type: 'SYSTEM',
        title: 'تم تبرير غيابك',
        body: reason,
        link: '/student/attendance'
      })
    }
    await addTimeline(tx, {
      studentId: rec.studentId,
      workspaceId: rec.workspaceId,
      type: 'EXCUSED',
      title: `تم تبرير الغياب: ${reason}`,
      meta: { recordId: rec.id }
    })
    return {
      recordId: rec.id,
      unexcused: r.count,
      enrollmentStatus: gs?.status ?? null,
      canReactivate: gs?.status === 'SUSPENDED_DUE_TO_ABSENCE'
    }
  })
}

/* -------------------------------------------------------------------------- */
/*                                   Queries                                  */
/* -------------------------------------------------------------------------- */

export interface SessionAttendanceRow {
  recordId: string | null
  groupStudentId: string
  studentId: string
  fullName: string
  status: string | null
  source: string | null
  recordedAt: Date | null
  minutesLate: number | null
  excuseReason: string | null
  enrollmentStatus: string
  unexcusedCount: number
}

/** قائمة الحضور لحصة: كل طلاب الفوج (النشطين + المعلّقين) مع سجلهم إن وجد */
export async function listSessionAttendance(db: Db, actor: Actor, sessionId: string): Promise<SessionAttendanceRow[]> {
  const s = await assertSessionAccess(db, actor, sessionId)
  const rows = await db
    .select({
      recordId: attendanceRecords.id,
      groupStudentId: groupStudents.id,
      studentId: groupStudents.studentId,
      fullName: profiles.fullName,
      email: users.email,
      status: attendanceRecords.status,
      source: attendanceRecords.source,
      recordedAt: attendanceRecords.recordedAt,
      minutesLate: attendanceRecords.minutesLate,
      excuseReason: attendanceRecords.excuseReason,
      enrollmentStatus: groupStudents.status,
      unexcusedCount: groupStudents.unexcusedAbsencesCount
    })
    .from(groupStudents)
    .innerJoin(students, eq(students.id, groupStudents.studentId))
    .innerJoin(users, eq(users.id, students.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(attendanceRecords, and(eq(attendanceRecords.groupStudentId, groupStudents.id), eq(attendanceRecords.classSessionId, s.id)))
    .where(and(eq(groupStudents.groupId, s.groupId), sql`${groupStudents.status} <> 'LEFT_GROUP'`))
    .orderBy(asc(profiles.fullName))
  return rows.map((r) => ({ ...r, fullName: r.fullName ?? r.email }))
}

export interface StudentAttendanceItem {
  recordId: string
  classSessionId: string
  groupId: string
  groupName: string
  sessionTitle: string | null
  scheduledAt: Date
  status: string
  minutesLate: number
  excuseReason: string | null
  recordedAt: Date
}

/** سجل حضور طالب (للطالب نفسه أو لأستاذه). */
export async function listStudentAttendance(db: Db, actor: Actor, studentId: string, opts: { groupId?: string; limit?: number } = {}): Promise<StudentAttendanceItem[]> {
  if (actor.role === 'STUDENT') {
    if (actor.studentId !== studentId) throw new AppError('FORBIDDEN')
  } else {
    assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  }
  const rows = await db
    .select({
      recordId: attendanceRecords.id,
      classSessionId: attendanceRecords.classSessionId,
      groupId: classSessions.groupId,
      groupName: groups.name,
      sessionTitle: classSessions.title,
      scheduledAt: classSessions.scheduledAt,
      status: attendanceRecords.status,
      minutesLate: attendanceRecords.minutesLate,
      excuseReason: attendanceRecords.excuseReason,
      recordedAt: attendanceRecords.recordedAt,
      workspaceId: attendanceRecords.workspaceId
    })
    .from(attendanceRecords)
    .innerJoin(classSessions, eq(classSessions.id, attendanceRecords.classSessionId))
    .innerJoin(groups, eq(groups.id, classSessions.groupId))
    .where(
      and(
        eq(attendanceRecords.studentId, studentId),
        opts.groupId ? eq(classSessions.groupId, opts.groupId) : undefined,
        actor.role === 'TEACHER' ? eq(attendanceRecords.workspaceId, actor.workspaceId ?? '') : undefined
      )
    )
    .orderBy(desc(classSessions.scheduledAt))
    .limit(opts.limit ?? 100)
  return rows
}

export interface AttendanceStats {
  total: number
  present: number
  late: number
  excused: number
  unexcused: number
  rate: number | null
}

export function summarizeAttendance(items: { status: string }[]): AttendanceStats {
  const present = items.filter((i) => i.status === 'PRESENT').length
  const late = items.filter((i) => i.status === 'LATE').length
  const excused = items.filter((i) => i.status === 'EXCUSED').length
  const unexcused = items.filter((i) => i.status === 'UNEXCUSED' || i.status === 'ABSENT').length
  const total = items.length
  return { total, present, late, excused, unexcused, rate: total > 0 ? Math.round(((present + late) / total) * 100) : null }
}

/** تنظيف nonces المنتهية (يُستدعى دورياً أو عند كل مسح بنسبة منخفضة) */
export async function purgeExpiredNonces(db: Db, now: Date = new Date()): Promise<void> {
  await db.delete(qrNonces).where(lt(qrNonces.expiresAt, new Date(now.getTime() - 5 * 60 * 1000)))
}
