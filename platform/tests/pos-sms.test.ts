/**
 * نقطة البيع تفعّل الدورة برمز SMS (قرار المالك 18 نوفمبر 2026):
 * هاتف التلميذ ← رسالة برمز ← صاحب المكتبة يكتب الرمز ← تفعيل فوري بالاسم الكامل، أو حجز للرقم بلا حساب،
 * أو اختيار بين أبناء الرقم نفسه. لا بيع قبل الرمز، والاسم لا يظهر قبله. تراجع 24 ساعة للمكتبة، ثم الإدارة.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseCodes, courseEnrollments, notifications, otpCodes, rateLimits } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { registerStudent } from '@/server/services/auth.service'
import { createStaffAccount } from '@/server/services/confirmer.service'
import { setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { requestOtp, verifyOtp } from '@/server/services/otp.service'
import {
  addPosMember,
  confirmPosSale,
  createPointOfSale,
  listPosCodes,
  movePosStock,
  pickPosSaleStudent,
  posOtpSmsText,
  posSummary,
  startPosSale,
  undoPosActivation
} from '@/server/services/points-of-sale.service'
import { actorOf, makeAdmin, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let manager: Actor
let workspaceId: string
let ref: Awaited<ReturnType<typeof refIds>>
const sent: SmsMessage[] = []
let n = 0
const phone = () => `0663${String(400000 + ++n).slice(-6)}`

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function bundleCourse() {
  const c = await createCourse(h.db, admin, { title: `دورة المكتبة ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `باقة ${n}`, priceDzd: 5900, stock: 100, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

async function shop(stock = 5) {
  const c = await bundleCourse()
  const pos = await createPointOfSale(h.db, manager, { name: `مكتبة ${++n}`, wilayaId: ref.wilayaId, phone: phone() })
  const creds = await addPosMember(h.db, manager, pos.id, { fullName: `صاحب المكتبة ${n}`, phone: phone() })
  if (stock) await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: stock })
  return { c, pos, member: await actorOf(h.db, creds.userId) }
}

async function student(fullName: string, own: string | null, guardian: string | null = null) {
  const r = await registerStudent(h.db, { password: 'Student@12345', fullName, phone: own, guardianPhone: guardian, wilayaId: ref.wilayaId, levelId: ref.levelId, streamId: ref.streamId, email: own ? null : `${uniq('s')}@test.dz` })
  return r
}

/** يبدأ البيع ويعيد الرمز الذي وصل التلميذ */
async function smsCode(member: Actor, courseId: string, tel: string) {
  const r = await startPosSale(h.db, member, { courseId, phone: tel })
  return r.devCode!
}

const enrollment = async (courseId: string, studentId: string) =>
  (await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId))))[0]

beforeAll(async () => {
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sent.push(m) })
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ المكتبات'))
  ref = await refIds(h.db)
  const m = await createStaffAccount(h.db, admin, { email: uniq('mgr') + '@test.dz', password: 'Manager@12345', fullName: 'مدير العمليات', phone: '0771234599', role: 'MANAGER' })
  manager = await actorOf(h.db, m.userId)
})
afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('البيع برمز SMS في نقطة البيع', () => {
  it('نص الرسالة أقل من 70 حرفًا (رسالة واحدة)', () => {
    expect(posOtpSmsText('482913', true).length).toBeLessThanOrEqual(70)
    expect(posOtpSmsText('482913', false).length).toBeLessThanOrEqual(70)
  })

  it('الإرسال: رسالة بالرمز، لا بيع ولا عدّاد قبل الرمز، ولا اسم يظهر؛ بلا باقات ⇒ رفض قبل أي رسالة', async () => {
    const { c, pos, member } = await shop()
    const tel = phone()
    await student('يوسف بن علي', tel)
    const before = sent.length
    const r = await startPosSale(h.db, member, { courseId: c.id, phone: tel })
    expect(Object.keys(r).sort()).toEqual(['devCode', 'phoneMasked'])
    expect(r.phoneMasked).toBe(`${tel.slice(0, 4)} •• •• ${tel.slice(8)}`)
    expect(sent.length).toBe(before + 1)
    expect(sent.at(-1)).toMatchObject({ to: tel })
    expect(sent.at(-1)!.text).toBe(posOtpSmsText(r.devCode!, true))
    expect((await posSummary(h.db, pos.id)).soldCount).toBe(0)
    const empty = await shop(0)
    const count = sent.length
    await expectCode(() => startPosSale(h.db, empty.member, { courseId: empty.c.id, phone: phone() }), 'POS_OUT_OF_STOCK')
    expect(sent.length).toBe(count)
  })

  it('حساب واحد بالرقم: تفعيل فوري بالاسم الكامل والمستوى والولاية، يُحسب بيعًا ويصل التلميذ إشعار', async () => {
    const { c, pos, member } = await shop(3)
    const tel = phone()
    const s = await student('يوسف بن علي', tel)
    const code = await smsCode(member, c.id, tel)
    await expectCode(() => confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code: code === '000000' ? '111111' : '000000' }), 'OTP_INVALID')
    const r = await confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code })
    expect(r.kind).toBe('ACTIVATED')
    if (r.kind !== 'ACTIVATED') return
    expect(r.student).toMatchObject({ fullName: 'يوسف بن علي', levelName: 'السنة الثالثة ثانوي', streamName: 'علوم تجريبية', wilayaName: 'قالمة' })
    expect(r.remaining).toBe(2)
    expect(await enrollment(c.id, s.studentId!)).toMatchObject({ status: 'ACTIVE', source: 'POS' })
    const sum = await posSummary(h.db, pos.id)
    expect(sum).toMatchObject({ soldCount: 1, activatedCount: 1, grossDzd: 5900 })
    const [code0] = await h.db.select().from(courseCodes).where(eq(courseCodes.id, r.codeId))
    expect(code0).toMatchObject({ status: 'USED', soldVia: 'SMS', soldPhone: tel, usedByStudentId: s.studentId })
    const notes = await h.db.select({ t: notifications.title }).from(notifications).where(eq(notifications.userId, s.userId))
    expect(notes.map((x) => x.t)).toContain(`فُعّلت دورة «${c.title}» على حسابك`)
    // الرمز يُستهلك مرة واحدة
    await expectCode(() => confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code }), 'OTP_INVALID')
  })

  it('الرمز مربوط بالمكتبة التي طلبته: مكتبة أخرى لا تستهلكه', async () => {
    const a = await shop()
    const b = await shop()
    await movePosStock(h.db, manager, b.pos.id, { courseId: a.c.id, qty: 2 })
    const tel = phone()
    await student('سارة', tel)
    const code = await smsCode(a.member, a.c.id, tel)
    await expectCode(() => confirmPosSale(h.db, b.member, { courseId: a.c.id, phone: tel, code }), 'OTP_INVALID')
  })

  it('مشترك من قبل: لا بيع ولا ينقص العدّاد', async () => {
    const { c, pos, member } = await shop()
    const tel = phone()
    await student('أمين', tel)
    await confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code: await smsCode(member, c.id, tel) })
    // مهلة إعادة الإرسال 60 ثانية لنفس الرقم: نتجاوزها بتقديم وقت آخر رمز
    await h.db.update(otpCodes).set({ createdAt: new Date(Date.now() - 120_000) }).where(eq(otpCodes.phone, tel))
    await h.db.update(rateLimits).set({ windowStart: new Date(Date.now() - 120_000) })
    const r = await confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code: await smsCode(member, c.id, tel) })
    expect(r.kind).toBe('ALREADY')
    expect((await posSummary(h.db, pos.id)).soldCount).toBe(1)
  })

  it('لا حساب بالرقم: الدورة تُحجز للرقم، وتُفعَّل وحدها حين يسجّل التلميذ به ويؤكّده', async () => {
    const { c, pos, member } = await shop()
    const tel = phone()
    const code = await smsCode(member, c.id, tel)
    expect(sent.at(-1)!.text).toBe(posOtpSmsText(code, false))
    const r = await confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code })
    expect(r).toMatchObject({ kind: 'RESERVED', phoneMasked: `${tel.slice(0, 4)} •• •• ${tel.slice(8)}` })
    expect((await posSummary(h.db, pos.id))).toMatchObject({ soldCount: 1, activatedCount: 0 })
    const view = (await listPosCodes(h.db, member, pos.id))[0]!
    expect(view).toMatchObject({ status: 'ACTIVE', soldVia: 'SMS', cancellable: true, undoable: false })
    // التلميذ يسجّل بالرقم ثم يؤكّده برمز التسجيل
    const s = await student('ليلى قاسمي', tel)
    expect(await enrollment(c.id, s.studentId!)).toBeUndefined()
    const otp = await requestOtp(h.db, { phone: tel, purpose: 'REGISTER', userId: s.userId })
    await verifyOtp(h.db, { phone: tel, purpose: 'REGISTER', code: otp.devCode!, userId: s.userId })
    expect(await enrollment(c.id, s.studentId!)).toMatchObject({ status: 'ACTIVE', source: 'POS' })
    expect((await posSummary(h.db, pos.id))).toMatchObject({ soldCount: 1, activatedCount: 1 })
  })

  it('رقم وليّ لعدة أبناء: يختار صاحب المكتبة؛ تذكرة مزوّرة أو لتلميذ آخر تُرفض', async () => {
    const { c, member } = await shop()
    const dad = phone()
    const a = await student('مريم شريف', phone(), dad)
    const b = await student('رياض شريف', phone(), dad)
    const r = await confirmPosSale(h.db, member, { courseId: c.id, phone: dad, code: await smsCode(member, c.id, dad) })
    expect(r.kind).toBe('PICK')
    if (r.kind !== 'PICK') return
    expect(r.candidates.map((x) => x.fullName).sort()).toEqual(['رياض شريف', 'مريم شريف'])
    const stranger = await student('غريب', phone())
    await expectCode(() => pickPosSaleStudent(h.db, member, { ticket: r.ticket, studentId: stranger.studentId! }), 'POS_SALE_EXPIRED')
    await expectCode(() => pickPosSaleStudent(h.db, member, { ticket: r.ticket.slice(0, -4) + 'AAAA', studentId: a.studentId! }), 'POS_SALE_EXPIRED')
    const other = await shop()
    await expectCode(() => pickPosSaleStudent(h.db, other.member, { ticket: r.ticket, studentId: a.studentId! }), 'POS_SALE_EXPIRED')
    const done = await pickPosSaleStudent(h.db, member, { ticket: r.ticket, studentId: b.studentId! })
    expect(done).toMatchObject({ kind: 'ACTIVATED', student: { fullName: 'رياض شريف' } })
    expect(await enrollment(c.id, b.studentId!)).toMatchObject({ status: 'ACTIVE' })
    expect(await enrollment(c.id, a.studentId!)).toBeUndefined()
  })

  it('التراجع: المكتبة خلال 24 ساعة (الاشتراك يُلغى والباقة تعود)، وبعدها الإدارة وحدها', async () => {
    const { c, pos, member } = await shop(2)
    const tel = phone()
    const s = await student('تلميذ خطأ', tel)
    const r = await confirmPosSale(h.db, member, { courseId: c.id, phone: tel, code: await smsCode(member, c.id, tel) })
    if (r.kind !== 'ACTIVATED') throw new Error('expected activation')
    expect((await listPosCodes(h.db, member, pos.id))[0]).toMatchObject({ status: 'USED', studentName: 'تلميذ خطأ', undoable: true, cancellable: false })
    await undoPosActivation(h.db, member, r.codeId)
    expect(await enrollment(c.id, s.studentId!)).toMatchObject({ status: 'REVOKED' })
    expect((await posSummary(h.db, pos.id))).toMatchObject({ soldCount: 0, activatedCount: 0, grossDzd: 0 })
    expect((await posSummary(h.db, pos.id)).stock[0]!.remaining).toBe(2)
    await expectCode(() => undoPosActivation(h.db, member, r.codeId), 'POS_CODE_NOT_CANCELLABLE')

    const tel2 = phone()
    const s2 = await student('تلميذ آخر', tel2)
    const r2 = await confirmPosSale(h.db, member, { courseId: c.id, phone: tel2, code: await smsCode(member, c.id, tel2) })
    if (r2.kind !== 'ACTIVATED') throw new Error('expected activation')
    const later = new Date(Date.now() + 25 * 3600 * 1000)
    await expectCode(() => undoPosActivation(h.db, member, r2.codeId, later), 'POS_UNDO_EXPIRED')
    expect((await listPosCodes(h.db, member, pos.id, 100, later))[0]!.undoable).toBe(false)
    expect((await listPosCodes(h.db, manager, pos.id, 100, later))[0]!.undoable).toBe(true)
    await undoPosActivation(h.db, manager, r2.codeId, later)
    expect(await enrollment(c.id, s2.studentId!)).toMatchObject({ status: 'REVOKED' })
    // التلميذ لا يملك هذه الصلاحية
    const sa = await actorOf(h.db, s2.userId)
    await expectCode(() => undoPosActivation(h.db, sa, r2.codeId), 'FORBIDDEN')
  })

  it('الكود الاحتياطي يُعلَّم CODE، ويبقى كما كان', async () => {
    const { c, pos, member } = await shop()
    const { generatePosCode } = await import('@/server/services/points-of-sale.service')
    const g = await generatePosCode(h.db, member, c.id)
    const [row] = await h.db.select().from(courseCodes).where(eq(courseCodes.id, g.codeId))
    expect(row).toMatchObject({ soldVia: 'CODE', soldPhone: null, status: 'ACTIVE' })
    expect((await listPosCodes(h.db, member, pos.id))[0]).toMatchObject({ soldVia: 'CODE', code: g.code })
  })

  it('مسار الطالب: لا يبدأ بيعًا', async () => {
    const s = await student('طالب', phone())
    const sa = await actorOf(h.db, s.userId)
    const { c } = await shop()
    await expectCode(() => startPosSale(h.db, sa, { courseId: c.id, phone: phone() }), 'FORBIDDEN')
  })
})
