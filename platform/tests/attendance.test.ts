import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { groupStudents, notifications } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { issueQrToken } from '@/server/lib/qr-token'
import {
  excuseAbsence,
  issueAttendanceToken,
  listSessionAttendance,
  listStudentAttendance,
  scanAttendanceToken,
  setAttendanceManually
} from '@/server/services/attendance.service'
import { cancelSession, closeSession, startSession } from '@/server/services/class-sessions.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { reactivateStudent, redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup, getGroupDashboard, listGroupMembers } from '@/server/services/groups.service'
import { getStudentProfile } from '@/server/services/students.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let otherTeacher: Actor
let group: { id: string }
let otherGroup: { id: string }
let s1: Actor
let s2: Actor
let s3: Actor
let outsider: Actor

const T0 = new Date('2026-09-19T08:00:00+01:00')
const minutes = (n: number, from: Date = T0) => new Date(from.getTime() + n * 60_000)

async function enroll(student: Actor, g: { id: string }, t: Actor) {
  const r = await generateCodes(h.db, t, { groupId: g.id, count: 1 })
  await redeemEnrollmentCode(h.db, student, r.codes[0]!.code)
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'حيقون أسامة')
  otherTeacher = await makeTeacher(h.db, admin, 'أستاذ آخر')
  group = await createGroup(h.db, teacher, { name: 'فوج قالمة السبت 08:00', lateAfterMinutes: 10, maxUnexcusedAbsences: 4 })
  otherGroup = await createGroup(h.db, otherTeacher, { name: 'فوج آخر' })
  s1 = await makeStudent(h.db, 'محمد أحمد')
  s2 = await makeStudent(h.db, 'سارة بن علي')
  s3 = await makeStudent(h.db, 'ياسين بوزيد')
  outsider = await makeStudent(h.db, 'طالب من فوج آخر')
  await enroll(s1, group, teacher)
  await enroll(s2, group, teacher)
  await enroll(s3, group, teacher)
  await enroll(outsider, otherGroup, otherTeacher)
})

afterAll(async () => {
  await h.close()
})

describe('الحصة والحضور بالـQR', () => {
  let sessionId: string

  it('الأستاذ يبدأ حصة واحدة مفتوحة لكل فوج', async () => {
    const s = await startSession(h.db, teacher, { groupId: group.id, title: 'الصور البيانية', now: T0 })
    sessionId = s.id
    expect(s.status).toBe('OPEN')
    expect(s.attendanceOpen).toBe(true)
    await expectCode(() => startSession(h.db, teacher, { groupId: group.id, now: T0 }), 'SESSION_ALREADY_OPEN')
    // أستاذ آخر لا يرى الحصة
    await expectCode(() => closeSession(h.db, otherTeacher, sessionId), 'SESSION_NOT_FOUND')
    // الطالب لا يبدأ حصة
    await expectCode(() => startSession(h.db, s1, { groupId: group.id }), 'FORBIDDEN')
  })

  it('الطالب يحصل على رمز ديناميكي موقّع بلا بيانات شخصية', async () => {
    const t = await issueAttendanceToken(h.db, s1, group.id, T0)
    expect(t.token.split('.')).toHaveLength(2)
    const body = JSON.parse(Buffer.from(t.token.split('.')[0]!, 'base64url').toString('utf8'))
    expect(body).not.toHaveProperty('name')
    expect(body).not.toHaveProperty('phone')
    expect(body.sid).toBe(s1.studentId)
    expect(t.expiresAt.getTime()).toBe(T0.getTime() + 60_000)
    // طالب ليس في الفوج لا يحصل على رمز
    await expectCode(() => issueAttendanceToken(h.db, outsider, group.id, T0), 'STUDENT_NOT_IN_GROUP')
  })

  it('المسح يسجّل PRESENT ضمن مهلة التأخر و LATE بعدها', async () => {
    const t1 = await issueAttendanceToken(h.db, s1, group.id, minutes(4))
    const r1 = await scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: t1.token, now: minutes(4) })
    expect(r1.status).toBe('PRESENT')
    expect(r1.fullName).toBe('محمد أحمد')

    const t2 = await issueAttendanceToken(h.db, s2, group.id, minutes(15))
    const r2 = await scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: t2.token, now: minutes(15) })
    expect(r2.status).toBe('LATE')
    expect(r2.minutesLate).toBe(15)
  })

  it('يرفض التكرار وإعادة الاستعمال (replay) والرمز المنتهي والفوج الخاطئ', async () => {
    // نفس الطالب برمز جديد → مسجل مسبقاً
    const again = await issueAttendanceToken(h.db, s1, group.id, minutes(5))
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: again.token, now: minutes(5) }), 'ATTENDANCE_DUPLICATE')

    // إعادة استعمال نفس الرمز (nonce مستهلك)
    const t3 = await issueAttendanceToken(h.db, s3, group.id, minutes(6))
    await scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: t3.token, now: minutes(6) })
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: t3.token, now: minutes(6) }), 'QR_REPLAYED')

    // رمز منتهي الصلاحية
    const old = await issueAttendanceToken(h.db, s3, group.id, T0)
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: old.token, now: minutes(2) }), 'QR_EXPIRED')

    // رمز مزوّر
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: 'abc.def', now: minutes(2) }), 'QR_INVALID')
    const tampered = again.token.slice(0, -3) + 'AAA'
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: tampered, now: minutes(5) }), 'QR_INVALID')

    // طالب من فوج آخر
    const foreign = await issueAttendanceToken(h.db, outsider, otherGroup.id, minutes(3))
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: foreign.token, now: minutes(3) }), 'STUDENT_NOT_IN_GROUP')

    // رمز مصنوع للفوج الصحيح لكن لطالب غير مسجل فيه (توقيع صحيح)
    const forged = issueQrToken({ studentId: outsider.studentId!, groupId: group.id, now: minutes(3) })
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: forged.token, now: minutes(3) }), 'STUDENT_NOT_IN_GROUP')
  })

  it('إنهاء الحصة: الغائبون يصبحون UNEXCUSED تلقائياً والحصة لا تقبل مسحاً بعدها', async () => {
    // s1 حاضر، s2 متأخر، s3 حاضر — لا غائب هنا؛ نضيف طالباً رابعاً لم يمسح
    const s4 = await makeStudent(h.db, 'أمين بلقاسم')
    await enroll(s4, group, teacher)
    const result = await closeSession(h.db, teacher, sessionId, minutes(90))
    expect(result.present).toBe(2)
    expect(result.late).toBe(1)
    expect(result.autoAbsent).toBe(1)

    const rows = await listSessionAttendance(h.db, teacher, sessionId)
    const s4row = rows.find((r) => r.studentId === s4.studentId)
    expect(s4row?.status).toBe('UNEXCUSED')
    expect(s4row?.source).toBe('AUTO_CLOSE')

    const t = await issueAttendanceToken(h.db, s4, group.id, minutes(95))
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: sessionId, token: t.token, now: minutes(95) }), 'SESSION_NOT_OPEN')
    await expectCode(() => closeSession(h.db, teacher, sessionId), 'SESSION_NOT_OPEN')

    // الحضور يظهر في ملف الطالب
    const profile = await getStudentProfile(h.db, teacher, s4.studentId!)
    expect(profile.attendance.unexcused).toBe(1)
    expect(profile.enrollments[0]?.unexcused).toBe(1)
    expect(profile.timeline.some((e) => e.type === 'ABSENT')).toBe(true)
  })

  it('4 غيابات غير مبررة تعلّق التسجيل دون حذف أي بيانات، ثم التبرير وإعادة التفعيل', async () => {
    const victim = await makeStudent(h.db, 'طالب كثير الغياب')
    await enroll(victim, group, teacher)
    let day = new Date('2026-09-26T08:00:00+01:00')
    let notifiedWarning = false
    for (let i = 1; i <= 4; i++) {
      const s = await startSession(h.db, teacher, { groupId: group.id, title: `حصة ${i}`, now: day })
      // الآخرون يحضرون
      for (const st of [s1, s2, s3]) {
        const t = await issueAttendanceToken(h.db, st, group.id, minutes(2, day))
        await scanAttendanceToken(h.db, teacher, { classSessionId: s.id, token: t.token, now: minutes(2, day) })
      }
      const r = await closeSession(h.db, teacher, s.id, minutes(90, day))
      if (i === 3) {
        expect(r.warned).toBeGreaterThanOrEqual(1)
        notifiedWarning = true
      }
      const victimSuspended = r.suspended.some((x) => x.studentId === victim.studentId)
      expect(victimSuspended).toBe(i === 4)
      day = new Date(day.getTime() + 7 * 24 * 3600_000)
    }
    expect(notifiedWarning).toBe(true)

    const [gs] = await h.db
      .select()
      .from(groupStudents)
      .where(and(eq(groupStudents.groupId, group.id), eq(groupStudents.studentId, victim.studentId!)))
    expect(gs?.status).toBe('SUSPENDED_DUE_TO_ABSENCE')
    expect(gs?.unexcusedAbsencesCount).toBeGreaterThanOrEqual(4)
    expect(gs?.suspensionReason).toContain('غيابات غير مبررة')

    // خرج من قائمة النشطين لكن بياناته محفوظة
    const members = await listGroupMembers(h.db, teacher, group.id)
    const m = members.find((x) => x.studentId === victim.studentId)!
    expect(m.status).toBe('SUSPENDED_DUE_TO_ABSENCE')
    expect(m.absentCount).toBeGreaterThanOrEqual(4)
    const dash = await getGroupDashboard(h.db, teacher, group.id)
    expect(dash.suspended).toBeGreaterThanOrEqual(1)
    expect(dash.atRisk.some((r) => r.studentId === victim.studentId)).toBe(true)

    // إشعار التعليق وصل للطالب
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, victim.userId))
    expect(notes.some((n) => n.type === 'SUSPENDED_ABSENCE')).toBe(true)
    expect(notes.some((n) => n.type === 'ABSENCE_WARNING')).toBe(true)

    // الطالب المعلّق لا يحصل على رمز حضور
    await expectCode(() => issueAttendanceToken(h.db, victim, group.id), 'STUDENT_NOT_ACTIVE')

    // إعادة التفعيل قبل التبرير مرفوضة؟ لا — لكن التبرير لا يعيد التفعيل تلقائياً
    const att = await listStudentAttendance(h.db, teacher, victim.studentId!)
    const firstAbs = att.find((a) => a.status === 'UNEXCUSED')!
    const ex = await excuseAbsence(h.db, teacher, { recordId: firstAbs.recordId, reason: 'شهادة طبية' })
    expect(ex.unexcused).toBe(3)
    expect(ex.enrollmentStatus).toBe('SUSPENDED_DUE_TO_ABSENCE')
    expect(ex.canReactivate).toBe(true)

    // الأستاذ الآخر لا يستطيع تبرير غياب ليس في مساحته
    await expectCode(() => excuseAbsence(h.db, otherTeacher, { recordId: firstAbs.recordId, reason: 'x' }), 'ATTENDANCE_NOT_FOUND')

    // إعادة التفعيل يدوياً
    await reactivateStudent(h.db, teacher, gs!.id, 'بعد تبرير الغياب')
    const [after] = await h.db.select().from(groupStudents).where(eq(groupStudents.id, gs!.id))
    expect(after?.status).toBe('ACTIVE')
    expect(after?.unexcusedAbsencesCount).toBe(3)
    await expectCode(() => reactivateStudent(h.db, teacher, gs!.id), 'ENROLLMENT_NOT_SUSPENDED')

    // الملف يحتفظ بكل التاريخ
    const profile = await getStudentProfile(h.db, teacher, victim.studentId!)
    expect(profile.enrollments[0]?.history.map((x) => x.toStatus)).toEqual(['ACTIVE', 'SUSPENDED_DUE_TO_ABSENCE', 'ACTIVE'])
    expect(profile.attendance.excused).toBe(1)
    expect(profile.attendance.unexcused).toBe(3)
  })

  it('التسجيل اليدوي وإلغاء الحصة', async () => {
    const s = await startSession(h.db, teacher, { groupId: group.id, now: new Date() })
    const r = await setAttendanceManually(h.db, teacher, { classSessionId: s.id, studentId: s1.studentId!, status: 'PRESENT' })
    expect(r.recordId).toBeTruthy()
    await expectCode(() => setAttendanceManually(h.db, teacher, { classSessionId: s.id, studentId: outsider.studentId!, status: 'PRESENT' }), 'STUDENT_NOT_IN_GROUP')
    await cancelSession(h.db, teacher, s.id)
    const t = await issueAttendanceToken(h.db, s2, group.id)
    await expectCode(() => scanAttendanceToken(h.db, teacher, { classSessionId: s.id, token: t.token }), 'SESSION_NOT_OPEN')
  })
})
