import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { resolveActor, revokeSession } from '@/server/auth/session'
import { createTeacher, listTeachers, platformStats, setUserStatus } from '@/server/services/admin.service'
import { login, registerStudent } from '@/server/services/auth.service'
import { listStudentAttendance } from '@/server/services/attendance.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup, getGroupDashboard, listGroupMembers, listGroups } from '@/server/services/groups.service'
import { getStudentProfile, listTeacherStudents } from '@/server/services/students.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let studentA: Actor
let studentB: Actor

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  const groupB = await createGroup(h.db, teacherB, { name: 'فوج ب' })
  studentA = await makeStudent(h.db, 'طالب أ')
  studentB = await makeStudent(h.db, 'طالب ب')
  const ca = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
  const cb = await generateCodes(h.db, teacherB, { groupId: groupB.id, count: 1 })
  await redeemEnrollmentCode(h.db, studentA, ca.codes[0]!.code)
  await redeemEnrollmentCode(h.db, studentB, cb.codes[0]!.code)
})

afterAll(async () => {
  await h.close()
})

describe('المصادقة', () => {
  it('تسجيل ودخول وخروج بجلسات حقيقية', async () => {
    const email = uniq('u') + '@test.dz'
    await expectCode(() => registerStudent(h.db, { email, password: 'short', fullName: 'x' }), 'WEAK_PASSWORD')
    const r = await registerStudent(h.db, { email, password: 'Secret@12345', fullName: 'مستخدم' })
    expect(r.session.token).toBeTruthy()
    await expectCode(() => registerStudent(h.db, { email: email.toUpperCase(), password: 'Secret@12345', fullName: 'x' }), 'EMAIL_TAKEN')

    await expectCode(() => login(h.db, { email, password: 'wrong-password' }), 'INVALID_CREDENTIALS')
    await expectCode(() => login(h.db, { email: 'nobody@test.dz', password: 'wrong-password' }), 'INVALID_CREDENTIALS')
    const l = await login(h.db, { email: email.toUpperCase(), password: 'Secret@12345' })
    const actor = await resolveActor(h.db, l.session.token)
    expect(actor?.role).toBe('STUDENT')
    expect(actor?.studentId).toBeTruthy()

    await revokeSession(h.db, l.session.token)
    expect(await resolveActor(h.db, l.session.token)).toBeNull()
    expect(await resolveActor(h.db, 'garbage')).toBeNull()
  })

  it('تعطيل الحساب يبطل الجلسات ويمنع الدخول', async () => {
    const email = uniq('d') + '@test.dz'
    const r = await registerStudent(h.db, { email, password: 'Secret@12345', fullName: 'معطّل' })
    await setUserStatus(h.db, admin, r.userId, 'DISABLED')
    expect(await resolveActor(h.db, r.session.token)).toBeNull()
    await expectCode(() => login(h.db, { email, password: 'Secret@12345' }), 'ACCOUNT_DISABLED')
    await expectCode(() => setUserStatus(h.db, teacherA, r.userId, 'ACTIVE'), 'FORBIDDEN')
  })
})

describe('الصلاحيات والعزل', () => {
  it('فقط المشرف ينشئ أساتذة ويرى إحصائيات المنصة', async () => {
    await expectCode(() => createTeacher(h.db, teacherA, { email: 'x@test.dz', password: 'Secret@12345', fullName: 'x' }), 'FORBIDDEN')
    await expectCode(() => createTeacher(h.db, studentA, { email: 'x@test.dz', password: 'Secret@12345', fullName: 'x' }), 'FORBIDDEN')
    await expectCode(() => platformStats(h.db, teacherA), 'FORBIDDEN')
    const stats = await platformStats(h.db, admin)
    expect(stats.teachers).toBeGreaterThanOrEqual(2)
    const teachers = await listTeachers(h.db, admin)
    expect(teachers.length).toBeGreaterThanOrEqual(2)
  })

  it('الأستاذ لا يرى أفواج ولا طلاب أستاذ آخر', async () => {
    const gb = await listGroups(h.db, teacherB)
    expect(gb.some((g) => g.id === groupA.id)).toBe(false)
    await expectCode(() => listGroupMembers(h.db, teacherB, groupA.id), 'NOT_FOUND')
    await expectCode(() => getGroupDashboard(h.db, teacherB, groupA.id), 'NOT_FOUND')
    const sb = await listTeacherStudents(h.db, teacherB)
    expect(sb.some((s) => s.studentId === studentA.studentId)).toBe(false)
    await expectCode(() => getStudentProfile(h.db, teacherB, studentA.studentId!), 'NOT_FOUND')
    // المشرف يرى الجميع
    const all = await getStudentProfile(h.db, admin, studentA.studentId!)
    expect(all.enrollments.length).toBe(1)
  })

  it('الطالب يرى بياناته فقط', async () => {
    const mine = await getStudentProfile(h.db, studentA, studentA.studentId!)
    expect(mine.studentId).toBe(studentA.studentId)
    await expectCode(() => getStudentProfile(h.db, studentA, studentB.studentId!), 'FORBIDDEN')
    await expectCode(() => listStudentAttendance(h.db, studentA, studentB.studentId!), 'FORBIDDEN')
    await expectCode(() => listGroups(h.db, studentA), 'FORBIDDEN')
    await expectCode(() => listTeacherStudents(h.db, studentA), 'FORBIDDEN')
  })
})
