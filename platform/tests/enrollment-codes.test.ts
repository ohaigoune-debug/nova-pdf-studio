import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { normalizeEnrollmentCode } from '@/server/lib/codes'
import { cancelBatch, disableCode, generateCodes, listCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup, listGroupMembers, listGroups } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacherA: Actor
let teacherB: Actor
let groupA: { id: string }
let groupB: { id: string }

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacherA = await makeTeacher(h.db, admin, 'حيقون أسامة')
  teacherB = await makeTeacher(h.db, admin, 'أستاذ آخر')
  groupA = await createGroup(h.db, teacherA, { name: 'فوج قالمة السبت 08:00', dayOfWeek: 6, startTime: '08:00' })
  groupB = await createGroup(h.db, teacherB, { name: 'فوج قسنطينة', dayOfWeek: 2, startTime: '16:00' })
})

afterAll(async () => {
  await h.close()
})

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

describe('أكواد التسجيل', () => {
  it('يطبّع مدخلات الكود', () => {
    expect(normalizeEnrollmentCode(' hg8kp72 ')).toBe('HG8-KP72')
    expect(normalizeEnrollmentCode('HG8-KP72')).toBe('HG8-KP72')
    expect(normalizeEnrollmentCode('hg8 kp72')).toBe('HG8-KP72')
  })

  it('يولّد دفعة أكواد فريدة بصيغة XXX-XXXX ويخزّن hash فقط', async () => {
    const r = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 30, label: 'دفعة سبتمبر' })
    expect(r.codes).toHaveLength(30)
    const set = new Set(r.codes.map((c) => c.code))
    expect(set.size).toBe(30)
    for (const c of r.codes) expect(c.code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{4}$/)
    const listed = await listCodes(h.db, teacherA, groupA.id)
    expect(listed.length).toBeGreaterThanOrEqual(30)
    // لا يوجد كود صريح في القاعدة
    for (const row of listed) expect(row.codePrefix).toHaveLength(3)
  })

  it('الطالب ينضم تلقائياً إلى الفوج الصحيح ولا يمكن إعادة استعمال الكود', async () => {
    const r = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
    const code = r.codes[0]!.code
    const student = await makeStudent(h.db, 'محمد أحمد')
    const joined = await redeemEnrollmentCode(h.db, student, code.toLowerCase())
    expect(joined.groupId).toBe(groupA.id)

    const members = await listGroupMembers(h.db, teacherA, groupA.id)
    expect(members.some((m) => m.studentId === student.studentId && m.status === 'ACTIVE')).toBe(true)

    // نفس الطالب مرة أخرى
    await expectCode(() => redeemEnrollmentCode(h.db, student, code), 'CODE_USED')
    // طالب آخر بنفس الكود
    const other = await makeStudent(h.db, 'طالب ثانٍ')
    await expectCode(() => redeemEnrollmentCode(h.db, other, code), 'CODE_USED')
    const listed = await listCodes(h.db, teacherA, groupA.id, 'USED')
    expect(listed.some((c) => c.usedByName === 'محمد أحمد')).toBe(true)
  })

  it('الكود مرتبط بفوج واحد فقط (لا ينقل الطالب إلى فوج آخر)', async () => {
    const r = await generateCodes(h.db, teacherB, { groupId: groupB.id, count: 1 })
    const student = await makeStudent(h.db)
    const joined = await redeemEnrollmentCode(h.db, student, r.codes[0]!.code)
    expect(joined.groupId).toBe(groupB.id)
    const membersA = await listGroupMembers(h.db, teacherA, groupA.id)
    expect(membersA.some((m) => m.studentId === student.studentId)).toBe(false)
  })

  it('يرفض كوداً غير موجود أو منتهياً أو معطّلاً', async () => {
    const student = await makeStudent(h.db)
    await expectCode(() => redeemEnrollmentCode(h.db, student, 'AAA-BBBB'), 'CODE_INVALID')
    await expectCode(() => redeemEnrollmentCode(h.db, student, 'xx'), 'CODE_INVALID')

    const expired = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1, expiresAt: new Date(Date.now() - 1000) })
    await expectCode(() => redeemEnrollmentCode(h.db, student, expired.codes[0]!.code), 'CODE_EXPIRED')

    const disabled = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 1 })
    await disableCode(h.db, teacherA, disabled.codes[0]!.id)
    await expectCode(() => redeemEnrollmentCode(h.db, student, disabled.codes[0]!.code), 'CODE_DISABLED')
  })

  it('إلغاء دفعة يعطّل كل الأكواد غير المستعملة فيها', async () => {
    const r = await generateCodes(h.db, teacherA, { groupId: groupA.id, count: 5 })
    const s = await makeStudent(h.db)
    await redeemEnrollmentCode(h.db, s, r.codes[0]!.code)
    const res = await cancelBatch(h.db, teacherA, r.batchId)
    expect(res.disabled).toBe(4)
    const other = await makeStudent(h.db)
    await expectCode(() => redeemEnrollmentCode(h.db, other, r.codes[1]!.code), 'CODE_DISABLED')
  })

  it('يرفض الانضمام إلى فوج ممتلئ أو غير نشط', async () => {
    const small = await createGroup(h.db, teacherA, { name: 'فوج صغير', capacity: 1 })
    const r = await generateCodes(h.db, teacherA, { groupId: small.id, count: 2 })
    await redeemEnrollmentCode(h.db, await makeStudent(h.db), r.codes[0]!.code)
    const second = await makeStudent(h.db)
    await expectCode(() => redeemEnrollmentCode(h.db, second, r.codes[1]!.code), 'GROUP_FULL')

    const paused = await createGroup(h.db, teacherA, { name: 'فوج متوقف', status: 'PAUSED' })
    const r2 = await generateCodes(h.db, teacherA, { groupId: paused.id, count: 1 })
    const third = await makeStudent(h.db)
    await expectCode(() => redeemEnrollmentCode(h.db, third, r2.codes[0]!.code), 'GROUP_NOT_ACTIVE')
  })

  it('الأستاذ لا يستطيع توليد أو رؤية أكواد فوج أستاذ آخر', async () => {
    await expectCode(() => generateCodes(h.db, teacherB, { groupId: groupA.id, count: 1 }), 'NOT_FOUND')
    await expectCode(() => listCodes(h.db, teacherB, groupA.id), 'NOT_FOUND')
    const groupsOfB = await listGroups(h.db, teacherB)
    expect(groupsOfB.some((g) => g.id === groupA.id)).toBe(false)
    // الطالب لا يولّد أكواداً
    const s = await makeStudent(h.db)
    await expectCode(() => generateCodes(h.db, s, { groupId: groupA.id, count: 1 }), 'FORBIDDEN')
  })
})
