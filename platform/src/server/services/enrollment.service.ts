import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import {
  attendanceRecords,
  enrollmentCodes,
  groupStudents,
  groups,
  studentStatusHistory,
  students,
  teachers
} from '@/server/db/schema'
import type { EnrollmentStatus } from '@/server/db/schema/enums'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { hashEnrollmentCode, normalizeEnrollmentCode } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { notify } from './notifications.service'
import { addTimeline } from './timeline.service'

/**
 * الطالب يستعمل كود التسجيل: تحقّق كامل داخل معاملة مع قفل صف الكود.
 */
export async function redeemEnrollmentCode(db: Db, actor: Actor, rawCode: string) {
  const studentId = studentIdOf(actor)
  const code = normalizeEnrollmentCode(rawCode)
  if (!/^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(code)) throw new AppError('CODE_INVALID')
  const codeHash = hashEnrollmentCode(code)

  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(enrollmentCodes).where(eq(enrollmentCodes.codeHash, codeHash)).for('update').limit(1)
    if (!c) throw new AppError('CODE_INVALID')
    if (c.status === 'USED') throw new AppError('CODE_USED')
    if (c.status === 'DISABLED') throw new AppError('CODE_DISABLED')
    if (c.status === 'EXPIRED' || (c.expiresAt && c.expiresAt.getTime() < Date.now())) {
      if (c.status !== 'EXPIRED') await tx.update(enrollmentCodes).set({ status: 'EXPIRED' }).where(eq(enrollmentCodes.id, c.id))
      throw new AppError('CODE_EXPIRED')
    }

    const [g] = await tx.select().from(groups).where(eq(groups.id, c.groupId)).limit(1)
    if (!g || g.deletedAt) throw new AppError('CODE_INVALID')
    if (g.status !== 'ACTIVE') throw new AppError('GROUP_NOT_ACTIVE')

    const [existing] = await tx
      .select()
      .from(groupStudents)
      .where(and(eq(groupStudents.groupId, g.id), eq(groupStudents.studentId, studentId)))
      .limit(1)
    if (existing && existing.status === 'ACTIVE') throw new AppError('ALREADY_ENROLLED')

    if (g.capacity) {
      const [cnt] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(groupStudents)
        .where(and(eq(groupStudents.groupId, g.id), eq(groupStudents.status, 'ACTIVE')))
      if ((cnt?.n ?? 0) >= g.capacity) throw new AppError('GROUP_FULL')
    }

    let groupStudentId: string
    if (existing) {
      // طالب سابق يعود بكود جديد → إعادة تفعيل مع تاريخ
      await tx
        .update(groupStudents)
        .set({ status: 'ACTIVE', leftAt: null, suspendedAt: null, suspensionReason: null, enrolledViaCodeId: c.id })
        .where(eq(groupStudents.id, existing.id))
      await tx.insert(studentStatusHistory).values({
        groupStudentId: existing.id,
        fromStatus: existing.status,
        toStatus: 'ACTIVE',
        reason: 're-enrolled with code',
        changedByUserId: actor.userId
      })
      groupStudentId = existing.id
    } else {
      const [gs] = await tx
        .insert(groupStudents)
        .values({ workspaceId: g.workspaceId, groupId: g.id, studentId, status: 'ACTIVE', enrolledViaCodeId: c.id })
        .returning({ id: groupStudents.id })
      if (!gs) throw new AppError('INTERNAL')
      await tx.insert(studentStatusHistory).values({
        groupStudentId: gs.id,
        fromStatus: null,
        toStatus: 'ACTIVE',
        reason: 'enrolled with code',
        changedByUserId: actor.userId
      })
      groupStudentId = gs.id
    }

    await tx
      .update(enrollmentCodes)
      .set({ status: 'USED', usedAt: new Date(), usedByStudentId: studentId })
      .where(eq(enrollmentCodes.id, c.id))

    // الطالب ذو النوع FREE يصبح حضورياً افتراضياً عند الانضمام لفوج
    await tx
      .update(students)
      .set({ studentType: 'IN_PERSON' })
      .where(and(eq(students.id, studentId), eq(students.studentType, 'FREE')))

    await addTimeline(tx, {
      studentId,
      workspaceId: g.workspaceId,
      type: 'ENROLLED',
      title: `انضم إلى فوج ${g.name}`,
      meta: { groupId: g.id }
    })
    await notify(tx, {
      userId: actor.userId,
      workspaceId: g.workspaceId,
      type: 'ENROLLED',
      title: `تم تسجيلك في فوج ${g.name}`,
      link: `/student/groups`
    })
    const [teacher] = await tx.select({ userId: teachers.userId }).from(teachers).where(eq(teachers.id, g.teacherId)).limit(1)
    if (teacher) {
      await notify(tx, {
        userId: teacher.userId,
        workspaceId: g.workspaceId,
        type: 'SYSTEM',
        title: `انضم ${actor.fullName} إلى فوج ${g.name}`,
        link: `/teacher/groups/${g.id}`
      })
    }
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: g.workspaceId,
      action: 'enrollment.redeem_code',
      entityType: 'group_student',
      entityId: groupStudentId,
      newValue: { groupId: g.id, codeId: c.id }
    })

    return { groupId: g.id, groupName: g.name, groupStudentId }
  })
}

/**
 * يعيد حساب عدد الغيابات غير المبرّرة لطالب في فوج، ويطبّق قاعدة التعليق.
 * يُستدعى داخل معاملة. لا يعيد التفعيل تلقائياً أبداً.
 */
export async function recomputeUnexcused(
  tx: Db,
  params: { groupStudentId: string; actorUserId: string | null; applySuspension: boolean }
): Promise<{ count: number; suspendedNow: boolean; status: EnrollmentStatus }> {
  const [gs] = await tx.select().from(groupStudents).where(eq(groupStudents.id, params.groupStudentId)).for('update').limit(1)
  if (!gs) throw new AppError('ENROLLMENT_NOT_FOUND')
  const [g] = await tx.select().from(groups).where(eq(groups.id, gs.groupId)).limit(1)
  if (!g) throw new AppError('NOT_FOUND')

  const [cnt] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(attendanceRecords)
    .where(and(eq(attendanceRecords.groupStudentId, gs.id), eq(attendanceRecords.status, 'UNEXCUSED')))
  const count = cnt?.n ?? 0

  let status = gs.status as EnrollmentStatus
  let suspendedNow = false
  if (params.applySuspension && status === 'ACTIVE' && count >= g.maxUnexcusedAbsences) {
    status = 'SUSPENDED_DUE_TO_ABSENCE'
    suspendedNow = true
    await tx.insert(studentStatusHistory).values({
      groupStudentId: gs.id,
      fromStatus: gs.status,
      toStatus: status,
      reason: `${count} unexcused absences`,
      changedByUserId: params.actorUserId
    })
    await tx
      .update(groupStudents)
      .set({
        status,
        suspendedAt: new Date(),
        suspensionReason: `تم تعليق الطالب بسبب ${count} غيابات غير مبررة.`,
        unexcusedAbsencesCount: count
      })
      .where(eq(groupStudents.id, gs.id))
    await writeAudit(tx, {
      actorUserId: params.actorUserId,
      workspaceId: gs.workspaceId,
      action: 'enrollment.suspend_absence',
      entityType: 'group_student',
      entityId: gs.id,
      oldValue: { status: gs.status },
      newValue: { status, unexcused: count }
    })
    const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, gs.studentId)).limit(1)
    if (st) {
      await notify(tx, {
        userId: st.userId,
        workspaceId: gs.workspaceId,
        type: 'SUSPENDED_ABSENCE',
        title: `تم تعليق تسجيلك في فوج ${g.name}`,
        body: `بسبب ${count} غيابات غير مبررة. تواصل مع أستاذك لإعادة التفعيل.`,
        link: '/student/attendance'
      })
    }
    await addTimeline(tx, {
      studentId: gs.studentId,
      workspaceId: gs.workspaceId,
      type: 'SUSPENDED',
      title: `تم تعليق التسجيل في فوج ${g.name} بسبب ${count} غيابات غير مبررة`,
      meta: { groupId: g.id, unexcused: count }
    })
  } else {
    await tx.update(groupStudents).set({ unexcusedAbsencesCount: count }).where(eq(groupStudents.id, gs.id))
  }
  return { count, suspendedNow, status }
}

/** الأستاذ يعيد تفعيل طالب معلّق (يدوياً، سياسة صريحة). */
export async function reactivateStudent(db: Db, actor: Actor, groupStudentId: string, reason?: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  return db.transaction(async (tx) => {
    const [gs] = await tx.select().from(groupStudents).where(eq(groupStudents.id, groupStudentId)).for('update').limit(1)
    if (!gs) throw new AppError('ENROLLMENT_NOT_FOUND')
    if (actor.role === 'TEACHER' && gs.workspaceId !== actor.workspaceId) throw new AppError('NOT_FOUND')
    if (gs.status === 'ACTIVE') throw new AppError('ENROLLMENT_NOT_SUSPENDED')

    await tx
      .update(groupStudents)
      .set({ status: 'ACTIVE', suspendedAt: null, suspensionReason: null, leftAt: null })
      .where(eq(groupStudents.id, gs.id))
    await tx.insert(studentStatusHistory).values({
      groupStudentId: gs.id,
      fromStatus: gs.status,
      toStatus: 'ACTIVE',
      reason: reason ?? 'reactivated by teacher',
      changedByUserId: actor.userId
    })
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: gs.workspaceId,
      action: 'enrollment.reactivate',
      entityType: 'group_student',
      entityId: gs.id,
      oldValue: { status: gs.status },
      newValue: { status: 'ACTIVE', reason: reason ?? null }
    })
    const [g] = await tx.select({ name: groups.name }).from(groups).where(eq(groups.id, gs.groupId)).limit(1)
    const [st] = await tx.select({ userId: students.userId }).from(students).where(eq(students.id, gs.studentId)).limit(1)
    if (st) {
      await notify(tx, {
        userId: st.userId,
        workspaceId: gs.workspaceId,
        type: 'REACTIVATED',
        title: `تمت إعادة تفعيل تسجيلك في فوج ${g?.name ?? ''}`,
        link: '/student/groups'
      })
    }
    await addTimeline(tx, {
      studentId: gs.studentId,
      workspaceId: gs.workspaceId,
      type: 'REACTIVATED',
      title: `أُعيد تفعيل التسجيل في فوج ${g?.name ?? ''}`,
      meta: { groupId: gs.groupId }
    })
    return { groupStudentId: gs.id }
  })
}

/** تغيير حالة التسجيل يدوياً (تعليق، مغادرة، إكمال، إلغاء تنشيط) — بلا حذف. */
export async function setEnrollmentStatus(
  db: Db,
  actor: Actor,
  groupStudentId: string,
  status: Exclude<EnrollmentStatus, 'ACTIVE' | 'SUSPENDED_DUE_TO_ABSENCE'>,
  reason?: string
) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  return db.transaction(async (tx) => {
    const [gs] = await tx.select().from(groupStudents).where(eq(groupStudents.id, groupStudentId)).for('update').limit(1)
    if (!gs) throw new AppError('ENROLLMENT_NOT_FOUND')
    if (actor.role === 'TEACHER' && gs.workspaceId !== actor.workspaceId) throw new AppError('NOT_FOUND')
    const patch: Partial<typeof groupStudents.$inferInsert> = { status }
    if (status === 'LEFT_GROUP') patch.leftAt = new Date()
    if (status === 'SUSPENDED') {
      patch.suspendedAt = new Date()
      patch.suspensionReason = reason ?? null
    }
    await tx.update(groupStudents).set(patch).where(eq(groupStudents.id, gs.id))
    await tx.insert(studentStatusHistory).values({
      groupStudentId: gs.id,
      fromStatus: gs.status,
      toStatus: status,
      reason: reason ?? null,
      changedByUserId: actor.userId
    })
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: gs.workspaceId,
      action: 'enrollment.status',
      entityType: 'group_student',
      entityId: gs.id,
      oldValue: { status: gs.status },
      newValue: { status, reason: reason ?? null }
    })
    if (status === 'LEFT_GROUP') {
      await addTimeline(tx, { studentId: gs.studentId, workspaceId: gs.workspaceId, type: 'LEFT', title: 'غادر الفوج', meta: { groupId: gs.groupId } })
    }
  })
}

export async function listStatusHistory(db: Db, groupStudentId: string) {
  return db
    .select()
    .from(studentStatusHistory)
    .where(eq(studentStatusHistory.groupStudentId, groupStudentId))
    .orderBy(studentStatusHistory.changedAt)
}
