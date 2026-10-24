/**
 * المرحلة B (قرار المالك 2026-10-24): أكواد تفعيل لدورة بعينها، شراء الدورة برمز تأكيد، قفل الشعبة،
 * بوّابة تأكيد الهاتف للحسابات الجديدة (رمز أو مكالمة فائتة)، والهاتفان معاً في طرد EcoTrack.
 * قاعدة PGlite في الذاكرة وبيانات وهمية.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseCodes, courseEnrollments, orders, profiles, streams, students, users, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { registerStudent } from '@/server/services/auth.service'
import { handleIncomingCall, saveCallConfirm } from '@/server/services/call-confirm.service'
import { disableCourseCodeBatch, generateCourseCodes, listCourseCodeBatches, redeemCourseCode } from '@/server/services/course-codes.service'
import { createCourse, linkProduct } from '@/server/services/courses.service'
import { secondPhoneFor } from '@/server/services/ecotrack.service'
import { requestOtp } from '@/server/services/otp.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { createProduct, placeOrder } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let workspaceId: string
let sciId: string
let mathId: string
let wilayaId: string
let courseA: Awaited<ReturnType<typeof createCourse>>
let courseB: Awaited<ReturnType<typeof createCourse>>
let bookSci: string
const sms: SmsMessage[] = []

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}
const enrolled = async (courseId: string, studentId: string) => (await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, studentId))))[0]

/** تلميذ بشعبة وهاتفين محدَّدين */
async function studentWith(name: string, streamId: string, phone: string, guardian: string, verified = false): Promise<Actor> {
  const s = await makeStudent(h.db, name)
  await h.db.update(students).set({ streamId, guardianPhone: guardian }).where(eq(students.id, s.studentId!))
  await h.db.update(profiles).set({ phone, phoneVerifiedAt: verified ? new Date() : null }).where(eq(profiles.userId, s.userId))
  return s
}

beforeAll(async () => {
  // البوّابة تُطبَّق على الحسابات المنشأة بعد هذا التاريخ
  process.env.PHONE_VERIFY_REQUIRED_SINCE = '2026-06-01T00:00:00Z'
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sms.push(m) })
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ B')
  workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  sciId = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  mathId = (await h.db.insert(streams).values({ code: 'MATH', nameAr: 'رياضيات', sortOrder: 2 }).returning({ id: streams.id }))[0]!.id
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).where(eq(wilayas.code, '24')))[0]!.id
  courseA = await createCourse(h.db, admin, { title: 'دورة العلوم', workspaceId, season: '2026/2027', streamIds: [sciId], status: 'PUBLISHED' })
  courseB = await createCourse(h.db, admin, { title: 'دورة الرياضيات', workspaceId, season: '2026/2027', streamIds: [mathId], status: 'PUBLISHED' })
  bookSci = (await createProduct(h.db, admin, { title: 'كتاب العلوم', type: 'BOOK', priceDzd: 2000, status: 'PUBLISHED' })).id
  await linkProduct(h.db, admin, courseA.id, bookSci)
})

afterAll(async () => {
  delete process.env.PHONE_VERIFY_REQUIRED_SINCE
  setSmsSenderForTests(null)
  await h.close()
})

describe('1. أكواد تفعيل لدورة بعينها', () => {
  it('المشرف وحده يولّد؛ الكود يفتح الدورة الموجّه لها وحدها، مرة واحدة', async () => {
    await expectCode(() => generateCourseCodes(h.db, teacher, { courseId: courseA.id, count: 2 }), 'FORBIDDEN')
    const batch = await generateCourseCodes(h.db, admin, { courseId: courseA.id, count: 3, label: 'طبعة 1' })
    expect(batch.codes).toHaveLength(3)
    expect(batch.codes.every((c) => /^\d{11}$/.test(c))).toBe(true)
    // لا يُخزَّن الكود الصريح
    const stored = await h.db.select().from(courseCodes).where(eq(courseCodes.batchId, batch.batchId))
    expect(stored.some((r) => batch.codes.includes(r.codeHash))).toBe(false)

    const s = await makeStudent(h.db, 'تلميذ الكود')
    const r = await redeemCourseCode(h.db, s, ` ${batch.codes[0]!.slice(0, 3)} ${batch.codes[0]!.slice(3)} `)
    expect(r.courseId).toBe(courseA.id)
    expect((await enrolled(courseA.id, s.studentId!))?.source).toBe('CODE')
    expect(await enrolled(courseB.id, s.studentId!)).toBeUndefined()
    const s2 = await makeStudent(h.db, 'تلميذ ثانٍ')
    await expectCode(() => redeemCourseCode(h.db, s2, batch.codes[0]!), 'CODE_USED')
    await expectCode(() => redeemCourseCode(h.db, s2, '12345678901'), 'CODE_INVALID')

    // تعطيل الدفعة يوقف ما لم يُستعمل
    expect(await disableCourseCodeBatch(h.db, admin, batch.batchId)).toBe(2)
    await expectCode(() => redeemCourseCode(h.db, s2, batch.codes[1]!), 'CODE_DISABLED')
    const [b] = await listCourseCodeBatches(h.db, admin, courseA.id)
    expect(b).toMatchObject({ courseTitle: 'دورة العلوم', label: 'طبعة 1', total: 3, used: 1, disabled: 2 })
  })
  it('كود منتهٍ مرفوض، وكود دورة B يفتح B', async () => {
    const past = await generateCourseCodes(h.db, admin, { courseId: courseB.id, count: 1, expiresAt: new Date(Date.now() + 60_000) })
    await h.db.update(courseCodes).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(courseCodes.batchId, past.batchId))
    const s = await makeStudent(h.db, 'تلميذ منتهٍ')
    await expectCode(() => redeemCourseCode(h.db, s, past.codes[0]!), 'CODE_EXPIRED')
    const ok = await generateCourseCodes(h.db, admin, { courseId: courseB.id, count: 1 })
    expect((await redeemCourseCode(h.db, s, ok.codes[0]!)).courseId).toBe(courseB.id)
  })
})

describe('2. شراء الدورة: قفل الشعبة ورمز التأكيد', () => {
  it('تلميذ الرياضيات لا يطلب كتاب دورة العلوم', async () => {
    const m = await studentWith('تلميذ رياضيات', mathId, '0550000001', '0660000001')
    await expectCode(() => placeOrder(h.db, m, { items: [{ productId: bookSci, qty: 1 }], customerName: 'x', phone: '0550000001', wilayaId, address: 'x' }), 'ORDER_STREAM_MISMATCH')
  })
  it('هاتفه المؤكَّد سلفاً ⇒ الطلب مؤكَّد مباشرة (بلا مكالمة) حين تتوفّر قناة SMS', async () => {
    process.env.SMS_PROVIDER = 'webhook'
    process.env.SMS_WEBHOOK_URL = 'https://sms.test/hook'
    try {
      const s = await studentWith('تلميذ علوم مؤكَّد', sciId, '0550000002', '0660000002', true)
      const o = await placeOrder(h.db, s, { items: [{ productId: bookSci, qty: 1 }], customerName: 'x', phone: '0550000002', wilayaId, address: 'x' })
      expect(o.status).toBe('CONFIRMED')
      expect(o.otpVerifiedAt).toBeTruthy()
    } finally {
      delete process.env.SMS_PROVIDER
      delete process.env.SMS_WEBHOOK_URL
    }
  })
  it('هاتف الولي ⇒ رمز إلى هاتف الولي إلزامي؛ بالرمز الصحيح يُؤكَّد الطلب', async () => {
    process.env.SMS_PROVIDER = 'webhook'
    process.env.SMS_WEBHOOK_URL = 'https://sms.test/hook'
    try {
      const s = await studentWith('تلميذ علوم للولي', sciId, '0550000003', '0660000003', true)
      await expectCode(() => placeOrder(h.db, s, { items: [{ productId: bookSci, qty: 1 }], customerName: 'x', phone: '0660000003', wilayaId, address: 'x' }), 'ORDER_OTP_REQUIRED')
      const { devCode } = await requestOtp(h.db, { phone: '0660000003', purpose: 'ORDER', userId: s.userId })
      const o = await placeOrder(h.db, s, { items: [{ productId: bookSci, qty: 1 }], customerName: 'x', phone: '0660000003', wilayaId, address: 'x', otpCode: devCode })
      expect(o.status).toBe('CONFIRMED')
      // الطرد يحمل الهاتفين: هاتف الطلب (الولي) والآخر (التلميذ)
      expect(await secondPhoneFor(h.db, s.userId, o.phone)).toBe('0550000003')
    } finally {
      delete process.env.SMS_PROVIDER
      delete process.env.SMS_WEBHOOK_URL
    }
  })
  it('بلا قناة SMS: الطلب ينتظر التأكيد الهاتفي (لا يُحجب الشراء)', async () => {
    const s = await studentWith('تلميذ بلا SMS', sciId, '0550000004', '0660000004')
    const o = await placeOrder(h.db, s, { items: [{ productId: bookSci, qty: 1 }], customerName: 'x', phone: '0550000004', wilayaId, address: 'x' })
    expect(o.status).toBe('PENDING')
  })
})

describe('3. التسجيل وبوّابة الهاتف', () => {
  it('التسجيل يحفظ هاتف الولي ويشترط الشعبة للثانوي', async () => {
    const [lv] = await h.db.select({ id: (await import('@/server/db/schema')).levels.id }).from((await import('@/server/db/schema')).levels)
    await expectCode(() => registerStudent(h.db, { email: `${uniq('r')}@t.dz`, password: 'Passw0rd!x', fullName: 'تلميذ جديد', phone: '0770000001', guardianPhone: '0660000101', levelId: lv!.id, wilayaId }), 'VALIDATION')
    const r = await registerStudent(h.db, { email: `${uniq('r')}@t.dz`, password: 'Passw0rd!x', fullName: 'تلميذ جديد', phone: '0770000001', guardianPhone: '0660000101', levelId: lv!.id, streamId: sciId, wilayaId })
    const [st] = await h.db.select().from(students).where(eq(students.id, r.studentId!))
    expect(st!.guardianPhone).toBe('0660000101')
    expect(st!.streamId).toBe(sciId)
  })
  it('الحساب الجديد بلا قناة: لا بوّابة؛ مع التأكيد بالمكالمة: بوّابة، والمكالمة الفائتة تفتحها', async () => {
    const r = await registerStudent(h.db, { email: `${uniq('g')}@t.dz`, password: 'Passw0rd!x', fullName: 'تلميذ البوّابة', phone: '0770000002', guardianPhone: '0660000102', wilayaId })
    expect((await phoneGateFor(h.db, r.userId)).required).toBe(false)
    await saveCallConfirm(h.db, admin, { enabled: true, number: '0555998877', windowHours: 72, autoReject: true })
    const g = await phoneGateFor(h.db, r.userId)
    expect(g.required).toBe(true)
    expect(g.channels.callNumber).toBe('0555998877')
    const call = await handleIncomingCall(h.db, '0770000002')
    expect(call.result).toBe('phone_verified')
    expect((await phoneGateFor(h.db, r.userId)).required).toBe(false)
  })
  it('الحسابات القديمة (قبل تاريخ البوّابة) لا تُحجب', async () => {
    const old = await makeStudent(h.db, 'تلميذ قديم')
    await h.db.update(users).set({ createdAt: new Date('2026-01-01T00:00:00Z') }).where(eq(users.id, old.userId))
    expect((await phoneGateFor(h.db, old.userId)).required).toBe(false)
    void actorOf
    void orders
  })
})
