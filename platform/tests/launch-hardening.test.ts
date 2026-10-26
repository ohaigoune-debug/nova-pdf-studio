/** تقوية دفعة الإطلاق بعد المراجعة: التخمين في استعادة الهاتف، نطاق الموظف، رمز كتب الدورات، الإرسال المزدوج لـEcoTrack. */
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseProducts, orders, profiles, users } from '@/server/db/schema'
import { verifyPassword } from '@/server/auth/password'
import type { Actor } from '@/server/lib/actor'
import { sha256 } from '@/server/lib/codes'
import { setMailerForTests, type MailMessage } from '@/server/lib/mailer'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { createConfirmer } from '@/server/services/confirmer.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { saveEcotrackSettings, sendOrderToEcotrack } from '@/server/services/ecotrack.service'
import { uploadFile } from '@/server/services/files.service'
import { requestOtp } from '@/server/services/otp.service'
import { PHONE_RESET_DAILY_CODES, PHONE_RESET_DAILY_FAILURES, requestPhonePasswordReset, resetPasswordByPhone } from '@/server/services/phone-recovery.service'
import { attachProductFile, createProduct, listConfirmationQueue, placeOrder, setOrderStatus, setStorePolicy } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let confirmer: Actor
let workspaceId: string
let wilayaId: string
let n = 0
const sent: SmsMessage[] = []
const emails: MailMessage[] = []
const NEXT = 'Next-password-2026!'
const meta = () => ({ ip: `198.51.100.${++n}` })
const phoneNumber = () => `0773${String(++n).padStart(6, '0')}`
const smsChannel = () => {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.test.invalid')
}
const memorySms = () => setSmsSenderForTests({ name: 'memory', send: async (m) => void sent.push(m) })
const sentTo = (phone: string) => sent.filter((m) => m.to === phone)
const codeFor = (phone: string) => sentTo(phone).at(-1)!.variables!.code!

beforeAll(async () => {
  h = await setupDb()
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'hardening-uploads-'))
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin))
  wilayaId = (await refIds(h.db)).wilayaId!
  confirmer = await actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('emp') + '@test.dz', password: 'Worker@12345', fullName: 'موظف', phone: '0661234567' })).userId)
  memorySms()
  setMailerForTests({ name: 'memory', send: async (m) => void emails.push(m) })
})
afterEach(() => { vi.unstubAllEnvs(); memorySms() })
afterAll(async () => { setSmsSenderForTests(null); setMailerForTests(null); await h.close() })

async function student(opts: { phone?: string } = {}) {
  const actor = await makeStudent(h.db)
  const phone = opts.phone ?? phoneNumber()
  await h.db.update(profiles).set({ phone, phoneVerifiedAt: new Date() }).where(eq(profiles.userId, actor.userId))
  return { actor, phone }
}
const passwordIs = async (userId: string, password: string) => verifyPassword(password, (await h.db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, userId)))[0]!.hash)

describe('استعادة كلمة السر بالهاتف: لا تخمين ولا حسابات إدارة', () => {
  it('حسابات المشرف والموظف والأستاذ لا تُستعاد بالهاتف ولو كان موثّقاً', async () => {
    smsChannel()
    for (const role of ['SUPER_ADMIN', 'CONFIRMER', 'TEACHER'] as const) {
      const { actor, phone } = await student()
      await h.db.update(users).set({ role }).where(eq(users.id, actor.userId))
      expect(await requestPhonePasswordReset(h.db, phone, meta())).toEqual({ cooldown: 60 })
      expect(sentTo(phone)).toHaveLength(0)
      await expect(resetPasswordByPhone(h.db, { phone, code: '000000', password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
      expect(await passwordIs(actor.userId, 'Student@12345')).toBe(true)
    }
  })

  it(`بعد ${PHONE_RESET_DAILY_FAILURES} إخفاقات في اليوم يُرفض حتى الرمز الصحيح، ولا تُرسل رموز جديدة`, async () => {
    smsChannel()
    const { actor, phone } = await student()
    for (let i = 0; i < PHONE_RESET_DAILY_FAILURES - 1; i++) await expect(resetPasswordByPhone(h.db, { phone, code: '000000', password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    await requestPhonePasswordReset(h.db, phone, meta())
    const correct = codeFor(phone)
    await expect(resetPasswordByPhone(h.db, { phone, code: correct === '000000' ? '111111' : '000000', password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_INVALID' })
    await expect(resetPasswordByPhone(h.db, { phone, code: correct, password: NEXT }, meta())).rejects.toMatchObject({ code: 'OTP_TOO_MANY_ATTEMPTS' })
    expect(await passwordIs(actor.userId, 'Student@12345')).toBe(true)
    const before = sentTo(phone).length
    expect(await requestPhonePasswordReset(h.db, phone, meta())).toEqual({ cooldown: 60 })
    expect(sentTo(phone)).toHaveLength(before)
  })

  it(`سقف ${PHONE_RESET_DAILY_CODES} رموز استعادة لكل هاتف في اليوم، بالرد العام نفسه`, async () => {
    smsChannel()
    const { phone } = await student()
    for (let i = 0; i < PHONE_RESET_DAILY_CODES; i++) await checkRateLimit(h.db, { scope: 'phone-reset-day', subject: sha256(phone), limit: PHONE_RESET_DAILY_CODES, windowSeconds: 86400 })
    expect(await requestPhonePasswordReset(h.db, phone, meta())).toEqual({ cooldown: 60 })
    expect(sentTo(phone)).toHaveLength(0)
  })

  it('الاستعادة الناجحة تُبلَّغ لصاحب الحساب ببريده', async () => {
    smsChannel()
    const { actor, phone } = await student()
    await requestPhonePasswordReset(h.db, phone, meta())
    await resetPasswordByPhone(h.db, { phone, code: codeFor(phone), password: NEXT }, meta())
    expect(emails.at(-1)).toMatchObject({ to: actor.email, subject: 'تغيّرت كلمة سر حسابك — مدرسة' })
    expect(emails.at(-1)!.text).toContain(phone.slice(-2))
  })

  it('مع التأجيل يعود الرد قبل الإرسال، فلا يكشف التوقيت وجود الحساب', async () => {
    smsChannel()
    const { phone } = await student()
    const tasks: (() => Promise<void>)[] = []
    expect(await requestPhonePasswordReset(h.db, phone, meta(), { defer: (t) => void tasks.push(t) })).toEqual({ cooldown: 60 })
    expect(sentTo(phone)).toHaveLength(0)
    expect(tasks).toHaveLength(1)
    await tasks[0]!()
    expect(sentTo(phone)).toHaveLength(1)
    // الرقم المجهول لا يؤجّل شيئاً
    const unknownTasks: (() => Promise<void>)[] = []
    await requestPhonePasswordReset(h.db, phoneNumber(), meta(), { defer: (t) => void unknownTasks.push(t) })
    expect(unknownTasks).toHaveLength(0)
  })
})

describe('نطاق موظف التأكيد: الباقة ذات الملفات للمشرف وحده', () => {
  it('باقة لها ملفات (تُفتح تنزيلاتها عند التأكيد) خارج طابور الموظف، والباقة الورقية داخله', async () => {
    const buyer = await makeStudent(h.db)
    const withFiles = (await createProduct(h.db, admin, { title: 'باقة بملفات', type: 'PACK', priceDzd: 900, stock: 20, status: 'PUBLISHED' })).id
    const paperOnly = (await createProduct(h.db, admin, { title: 'باقة ورقية', type: 'PACK', priceDzd: 700, stock: 20, status: 'PUBLISHED' })).id
    const file = await uploadFile(h.db, admin, { originalName: 'pack.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 pack') })
    await attachProductFile(h.db, admin, withFiles, file.id, null)
    const buy = (productId: string) => placeOrder(h.db, buyer, { items: [{ productId, qty: 1 }], customerName: 'زبون', phone: phoneNumber(), wilayaId, address: 'حي', commune: 'Guelma' })
    const digital = await buy(withFiles)
    const paper = await buy(paperOnly)
    const queue = (await listConfirmationQueue(h.db, confirmer)).map((o) => o.id)
    expect(queue).not.toContain(digital.id)
    expect(queue).toContain(paper.id)
    await expect(setOrderStatus(h.db, confirmer, digital.id, 'CONFIRMED')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('رمز كتب الدورات', () => {
  async function courseBook() {
    const c = await createCourse(h.db, admin, { title: `دورة ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseBook(h.db, admin, c.id, { title: `كتاب دورة ${n}`, priceDzd: 1500, stock: 10, active: true })
    await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
    const [link] = await h.db.select({ productId: courseProducts.productId }).from(courseProducts).where(eq(courseProducts.courseId, c.id)).limit(1)
    return { courseId: c.id, productId: link!.productId }
  }

  it('كتاب الدورة من السلّة بهاتف غير مؤكَّد: الخادم يطلب الرمز (فتُظهر السلّة حقله) ثم يقبله', async () => {
    smsChannel()
    const { productId } = await courseBook()
    const actor = await makeStudent(h.db)
    const phone = phoneNumber()
    const input = { items: [{ productId, qty: 1 }], customerName: 'تلميذ', phone, wilayaId, address: 'حي', commune: 'Guelma' }
    await expect(placeOrder(h.db, actor, input)).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    const code = await requestOtp(h.db, { phone, purpose: 'ORDER', userId: actor.userId })
    const order = await placeOrder(h.db, actor, { ...input, otpCode: code.devCode })
    expect(order.otpVerifiedAt).not.toBeNull()
  })

  it('سياسة «الرمز إلزامي» بلا قناة SMS لا تعطّل طلبات الدورة لمن هاتفه مؤكَّد (كما قبل الدفعة)', async () => {
    await setStorePolicy(h.db, admin, { requireOtp: true })
    try {
      const { courseId } = await courseBook()
      const { actor, phone } = await student()
      const order = await placeCourseOrder(h.db, actor, { courseId, phone, wilayaId, commune: 'Guelma', address: 'حي', deliveryType: 'HOME' })
      expect(order.number).toBeTruthy()
      const other = await student()
      await expect(placeCourseOrder(h.db, other.actor, { courseId, phone: phoneNumber(), wilayaId, commune: 'Guelma', address: 'حي', deliveryType: 'HOME' })).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    } finally {
      await setStorePolicy(h.db, admin, { requireOtp: false })
    }
  })
})

describe('EcoTrack: ضغطتان متزامنتان لا تنشئان طردين', () => {
  it('إرسالان متزامنان للطلب نفسه = طرد واحد ورقم تتبّع واحد', async () => {
    let creates = 0
    const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
      const url = new URL(String(input))
      const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '9000' } })
      if (url.pathname.endsWith('/get/wilayas')) return json({ '24': { id: 24, nom: 'Guelma' } })
      if (url.pathname.endsWith('/get/communes')) return json({ '1': { id: 1, nom: 'Guelma', wilaya_id: 24, has_stop_desk: 1 } })
      if (url.pathname.endsWith('/create/order')) {
        creates++
        await new Promise((r) => setTimeout(r, 50))
        return json({ success: true, tracking: `RACE-${creates}` })
      }
      throw new Error(`unexpected mock path ${url.pathname}`)
    }) as typeof fetch
    await saveEcotrackSettings(h.db, admin, { baseUrl: 'race-test.ecotrack.dz', apiToken: 'test-only-race-token', enabled: true, autoSend: false }, fakeFetch)
    const book = (await createProduct(h.db, admin, { title: 'كتاب سباق', type: 'BOOK', priceDzd: 1000, stock: 5, status: 'PUBLISHED' })).id
    const buyer = await makeStudent(h.db)
    const order = await placeOrder(h.db, buyer, { items: [{ productId: book, qty: 1 }], customerName: 'زبون', phone: phoneNumber(), wilayaId, address: 'حي', commune: 'Guelma' })
    await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')
    const results = await Promise.allSettled([sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch), sendOrderToEcotrack(h.db, admin, order.id, fakeFetch)])
    expect(creates).toBe(1)
    for (const r of results) {
      if (r.status === 'fulfilled') expect(r.value).toEqual({ tracking: 'RACE-1' })
      else expect(r.reason).toMatchObject({ code: 'RATE_LIMITED' })
    }
    expect(await sendOrderToEcotrack(h.db, admin, order.id, fakeFetch)).toEqual({ tracking: 'RACE-1' })
    expect((await h.db.select().from(orders).where(and(eq(orders.id, order.id), eq(orders.deliveryTrackingId, 'RACE-1'))))).toHaveLength(1)
  })
})
