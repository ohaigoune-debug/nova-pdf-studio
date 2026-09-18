import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSession, resolveActor } from '@/server/auth/session'
import type { DatabaseHandle } from '@/server/db/connect'
import { assistantCodes, notifications, teacherAssistants } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import {
  createAssistantCode,
  disableAssistantCode,
  getAssistantContext,
  joinAsAssistant,
  listAssistants,
  revokeAssistant
} from '@/server/services/assistants.service'
import { excuseAbsence, issueAttendanceToken, listSessionAttendance, listStudentAttendance, openScannerSession, scanAttendanceToken, setAttendanceManually } from '@/server/services/attendance.service'
import { closeSession, listSessions, startSession } from '@/server/services/class-sessions.service'
import { createContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { reactivateStudent, redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup, listGroups } from '@/server/services/groups.service'
import { getStudentProfile, listTeacherStudents } from '@/server/services/students.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let groupB: { id: string }
let studentA: Actor
let studentB: Actor
let assistant: Actor
let assistantEmail: string
let assistantUserId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'الأستاذ أ')
  teacherB = await makeTeacher(h.db, admin, 'الأستاذ ب')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج أ' })
  groupB = await createGroup(h.db, teacherB, { name: 'فوج ب' })
  studentA = await makeStudent(h.db, 'طالب أ')
  studentB = await makeStudent(h.db, 'طالب ب')
  const ca = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
  const cb = await generateCodes(h.db, teacherB, { groupId: groupB.id, count: 1 })
  await redeemEnrollmentCode(h.db, studentA, ca.codes[0]!.code)
  await redeemEnrollmentCode(h.db, studentB, cb.codes[0]!.code)
  assistantEmail = uniq('assistant') + '@test.dz'
})

afterAll(async () => {
  await h.close()
})

describe('مساعد الأستاذ: الكود والانضمام', () => {
  it('الأستاذ فقط يولّد كود مساعد، مرتبطاً ببريد، ولا يُخزَّن صريحاً', async () => {
    await expectCode(() => createAssistantCode(h.db, studentA, { email: assistantEmail }), 'FORBIDDEN')
    await expectCode(() => createAssistantCode(h.db, admin, { email: assistantEmail }), 'FORBIDDEN')
    await expectCode(() => createAssistantCode(h.db, teacherA, { email: 'not-an-email' }), 'VALIDATION')
    // بريد يخص طالباً ⇒ مرفوض
    await expectCode(() => createAssistantCode(h.db, teacherA, { email: studentA.email }), 'ASSISTANT_EMAIL_TAKEN')
    // بريد الأستاذ نفسه ⇒ مرفوض
    await expectCode(() => createAssistantCode(h.db, teacherA, { email: teacherA.email }), 'VALIDATION')

    const first = await createAssistantCode(h.db, teacherA, { email: assistantEmail.toUpperCase() })
    expect(first.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{4}$/)
    expect(first.email).toBe(assistantEmail)
    const rows = await h.db.select().from(assistantCodes).where(eq(assistantCodes.workspaceId, teacherA.workspaceId!))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.codeHash).not.toBe(first.code)
    expect(rows[0]?.codePrefix).toBe(first.code.slice(0, 3))

    // توليد كود جديد لنفس البريد يعطّل السابق
    const second = await createAssistantCode(h.db, teacherA, { email: assistantEmail })
    const after = await h.db.select().from(assistantCodes).where(eq(assistantCodes.workspaceId, teacherA.workspaceId!))
    expect(after.find((r) => r.id === first.id)?.status).toBe('DISABLED')
    expect(after.find((r) => r.id === second.id)?.status).toBe('ACTIVE')
    await expectCode(() => joinAsAssistant(h.db, { code: first.code, email: assistantEmail, fullName: 'مساعد', password: 'Assist@12345' }), 'CODE_DISABLED')

    const list = await listAssistants(h.db, teacherA)
    expect(list.assistants).toHaveLength(0)
    expect(list.pendingCodes.map((c) => c.id)).toEqual([second.id])
    // الأستاذ ب لا يرى أكواد أ
    expect((await listAssistants(h.db, teacherB)).pendingCodes).toHaveLength(0)
  })

  it('الانضمام: يرفض الكود الخاطئ/البريد المختلف/كلمة السر الضعيفة، ثم ينشئ حساب ASSISTANT مرتبطاً بالمساحة فوراً', async () => {
    const [pending] = (await listAssistants(h.db, teacherA)).pendingCodes
    // نحتاج الكود الصريح: نولّد كوداً جديداً (يعطّل المعلّق) ونستعمله
    const c = await createAssistantCode(h.db, teacherA, { email: assistantEmail, expiresAt: new Date(Date.now() + 3600_000) })
    expect(pending).toBeTruthy()

    await expectCode(() => joinAsAssistant(h.db, { code: 'AAA-BBBB', email: assistantEmail, fullName: 'مساعد', password: 'Assist@12345' }), 'CODE_INVALID')
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email: 'other@test.dz', fullName: 'مساعد', password: 'Assist@12345' }), 'ASSISTANT_EMAIL_MISMATCH')
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email: assistantEmail, fullName: 'مساعد', password: 'short' }), 'WEAK_PASSWORD')
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email: assistantEmail, fullName: 'x', password: 'Assist@12345' }), 'VALIDATION')

    const r = await joinAsAssistant(h.db, { code: c.code.toLowerCase(), email: assistantEmail.toUpperCase(), fullName: 'أمين المساعد', password: 'Assist@12345' })
    expect(r.teacherName).toBe('الأستاذ أ')
    assistantUserId = r.userId
    const a = await resolveActor(h.db, r.session.token)
    expect(a).toBeTruthy()
    assistant = a!
    expect(assistant.role).toBe('ASSISTANT')
    expect(assistant.workspaceId).toBe(teacherA.workspaceId)
    expect(assistant.teacherId).toBeNull()
    expect(assistant.studentId).toBeNull()
    expect(assistant.fullName).toBe('أمين المساعد')

    // الكود استُهلك
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email: assistantEmail, fullName: 'مساعد', password: 'Assist@12345' }), 'CODE_USED')
    const ctx = await getAssistantContext(h.db, assistant)
    expect(ctx?.teacherName).toBe('الأستاذ أ')
    // الأستاذ أُشعر
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, teacherA.userId))
    expect(n.some((x) => x.title.includes('كمساعد'))).toBe(true)
    const list = await listAssistants(h.db, teacherA)
    expect(list.assistants).toHaveLength(1)
    expect(list.assistants[0]?.status).toBe('ACTIVE')
    expect(list.pendingCodes).toHaveLength(0)
  })

  it('كود منتهي الصلاحية يُرفض ويُعلَّم EXPIRED، وتعطيل الكود يدوياً يعمل', async () => {
    const email = uniq('exp') + '@test.dz'
    const c = await createAssistantCode(h.db, teacherA, { email, expiresAt: new Date(Date.now() - 1000) })
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email, fullName: 'مساعد', password: 'Assist@12345' }), 'CODE_EXPIRED')
    const [row] = await h.db.select().from(assistantCodes).where(eq(assistantCodes.id, c.id))
    expect(row?.status).toBe('EXPIRED')
    await disableAssistantCode(h.db, teacherA, c.id)
    await expectCode(() => disableAssistantCode(h.db, teacherB, c.id), 'NOT_FOUND')
    const c2 = await createAssistantCode(h.db, teacherA, { email })
    await expectCode(() => disableAssistantCode(h.db, teacherB, c2.id), 'NOT_FOUND')
    await disableAssistantCode(h.db, teacherA, c2.id)
    await expectCode(() => joinAsAssistant(h.db, { code: c2.code, email, fullName: 'مساعد', password: 'Assist@12345' }), 'CODE_DISABLED')
  })
})

describe('مساعد الأستاذ: الصلاحيات', () => {
  let sessionId: string

  it('يرى أفواج وطلاب أستاذه فقط (بلا أفواج الأستاذ ب)', async () => {
    const groups = await listGroups(h.db, assistant)
    expect(groups.map((g) => g.id)).toEqual([groupA.id])
    const students = await listTeacherStudents(h.db, assistant)
    expect(students.map((s) => s.studentId)).toEqual([studentA.studentId])
    const profile = await getStudentProfile(h.db, assistant, studentA.studentId!)
    expect(profile.enrollments).toHaveLength(1)
    await expectCode(() => getStudentProfile(h.db, assistant, studentB.studentId!), 'NOT_FOUND')
  })

  it('يبدأ حصة لفوج أستاذه، يفتح السكانر، يمسح رمز الطالب، ويسجّل يدوياً', async () => {
    await expectCode(() => startSession(h.db, assistant, { groupId: groupB.id }), 'NOT_FOUND')
    const s = await startSession(h.db, assistant, { groupId: groupA.id, title: 'حصة المساعد' })
    sessionId = s.id
    expect(s.workspaceId).toBe(teacherA.workspaceId)
    const scanner = await openScannerSession(h.db, assistant, s.id, 'هاتف المساعد')
    expect(scanner?.teacherUserId).toBe(assistant.userId)

    const tok = await issueAttendanceToken(h.db, studentA, groupA.id)
    const r = await scanAttendanceToken(h.db, assistant, { classSessionId: s.id, token: tok.token, scannerSessionId: scanner?.id })
    expect(r.status).toBe('PRESENT')
    expect(r.fullName).toBe('طالب أ')
    const rows = await listSessionAttendance(h.db, assistant, s.id)
    expect(rows.find((x) => x.studentId === studentA.studentId)?.status).toBe('PRESENT')
    await setAttendanceManually(h.db, assistant, { classSessionId: s.id, studentId: studentA.studentId!, status: 'LATE' })
    expect((await listSessionAttendance(h.db, assistant, s.id)).find((x) => x.studentId === studentA.studentId)?.status).toBe('LATE')

    // الأستاذ يرى الحصة التي بدأها مساعده
    const teacherView = await listSessions(h.db, teacherA, { status: ['OPEN'] })
    expect(teacherView.map((x) => x.id)).toContain(s.id)
    // حضور الطالب من منظور المساعد
    const att = await listStudentAttendance(h.db, assistant, studentA.studentId!)
    expect(att).toHaveLength(1)
    // ولا يرى حضور طالب من مساحة أخرى
    expect(await listStudentAttendance(h.db, assistant, studentB.studentId!)).toHaveLength(0)
  })

  it('لا يصل إلى حصص الأستاذ ب', async () => {
    const sB = await startSession(h.db, teacherB, { groupId: groupB.id })
    await expectCode(() => listSessionAttendance(h.db, assistant, sB.id), 'SESSION_NOT_FOUND')
    await expectCode(() => closeSession(h.db, assistant, sB.id), 'SESSION_NOT_FOUND')
    const tokB = await issueAttendanceToken(h.db, studentB, groupB.id)
    await expectCode(() => scanAttendanceToken(h.db, assistant, { classSessionId: sB.id, token: tokB.token }), 'SESSION_NOT_FOUND')
    expect((await listSessions(h.db, assistant)).map((x) => x.id)).not.toContain(sB.id)
    await closeSession(h.db, teacherB, sB.id)
  })

  it('ممنوع: أكواد التسجيل، إنشاء فوج، المحتوى، تبرير الغياب، إعادة التفعيل', async () => {
    await expectCode(() => generateCodes(h.db, assistant, { groupId: groupA.id, count: 1 }), 'FORBIDDEN')
    await expectCode(() => createGroup(h.db, assistant, { name: 'فوج المساعد' }), 'FORBIDDEN')
    await expectCode(() => createContent(h.db, assistant, { type: 'LESSON', title: 'درس', visibility: 'PUBLIC', publish: true }), 'FORBIDDEN')
    await expectCode(() => reactivateStudent(h.db, assistant, 'x'), 'FORBIDDEN')
    await expectCode(() => excuseAbsence(h.db, assistant, { recordId: 'x', reason: 'مرض' }), 'FORBIDDEN')
    await expectCode(() => createAssistantCode(h.db, assistant, { email: 'z@test.dz' }), 'FORBIDDEN')
  })

  it('يغلق الحصة فتُطبَّق قاعدة الغياب التلقائي كالمعتاد', async () => {
    const r = await closeSession(h.db, assistant, sessionId)
    expect(r.late).toBe(1)
    expect(r.autoAbsent).toBe(0)
  })

  it('الإلغاء: الأستاذ ب لا يستطيع، الأستاذ أ يلغي ⇒ الجلسات تُبطل ويفقد المساعد مساحته', async () => {
    const [m] = await h.db.select().from(teacherAssistants).where(eq(teacherAssistants.userId, assistantUserId))
    expect(m?.status).toBe('ACTIVE')
    await expectCode(() => revokeAssistant(h.db, teacherB, m!.id), 'ASSISTANT_NOT_FOUND')
    await revokeAssistant(h.db, teacherA, m!.id)
    await expectCode(() => revokeAssistant(h.db, teacherA, m!.id), 'ASSISTANT_NOT_FOUND')

    // جلسة جديدة (بنفس الحساب) بلا مساحة ⇒ كل خدمات الحضور مرفوضة
    const s2 = await createSession(h.db, { userId: assistantUserId })
    const revoked = await resolveActor(h.db, s2.token)
    expect(revoked?.role).toBe('ASSISTANT')
    expect(revoked?.workspaceId).toBeNull()
    expect(await getAssistantContext(h.db, revoked!)).toBeNull()
    await expectCode(() => listSessions(h.db, revoked!), 'ASSISTANT_NO_WORKSPACE')
    await expectCode(() => listTeacherStudents(h.db, revoked!), 'ASSISTANT_NO_WORKSPACE')
    await expectCode(() => startSession(h.db, revoked!, { groupId: groupA.id }), 'ASSISTANT_NO_WORKSPACE')
    expect((await listAssistants(h.db, teacherA)).assistants[0]?.status).toBe('REVOKED')
  })

  it('إعادة الدعوة بعد الإلغاء: نفس الحساب وكلمة السر، كلمة سر خاطئة تُرفض، وأستاذ آخر يمكنه ضمّه', async () => {
    const c = await createAssistantCode(h.db, teacherB, { email: assistantEmail })
    await expectCode(() => joinAsAssistant(h.db, { code: c.code, email: assistantEmail, fullName: 'أمين', password: 'Wrong@12345' }), 'INVALID_CREDENTIALS')
    const r = await joinAsAssistant(h.db, { code: c.code, email: assistantEmail, fullName: 'أمين المساعد', password: 'Assist@12345' })
    expect(r.userId).toBe(assistantUserId)
    const a2 = await resolveActor(h.db, r.session.token)
    expect(a2?.workspaceId).toBe(teacherB.workspaceId)
    expect((await listGroups(h.db, a2!)).map((g) => g.id)).toEqual([groupB.id])
    // نشط الآن عند ب ⇒ أ لا يستطيع توليد كود له
    await expectCode(() => createAssistantCode(h.db, teacherA, { email: assistantEmail }), 'ASSISTANT_ALREADY_ACTIVE')
    // عضوية نشطة واحدة فقط
    const memberships = await h.db.select().from(teacherAssistants).where(eq(teacherAssistants.userId, assistantUserId))
    expect(memberships.filter((x) => x.status === 'ACTIVE')).toHaveLength(1)
  })
})
