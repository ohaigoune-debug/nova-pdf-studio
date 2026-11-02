/**
 * الدفع الإلكتروني (eFawtara/SATIM، كانت Guiddini) — 1 و2 نوفمبر 2026. البوابة محاكاة (fetch وهمي)، والقاعدة PGlite في الذاكرة.
 * المطلوب: لا تفعيل قبل تأكّد الخادم من الدفع، التفعيل فوري بعده ومرة واحدة، الفشل يلغي الطلب ويعيد المخزون،
 * المبلغ المختلف لا يفعّل، والطلب غير المدفوع لا يظهر في طابور التأكيد.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, auditLogs, courseEnrollments, onlinePayments, orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import {
  GUIDDINI_SETTINGS_KEY,
  clearGuiddiniConfig,
  getGuiddiniConfig,
  getGuiddiniView,
  guiddiniInitiate,
  guiddiniTest,
  normalizeGatewayBase,
  paymentReturnUrl,
  saveGuiddiniConfig
} from '@/server/lib/guiddini'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { listRecentPaymentRejections, reconcilePendingPayments, verifyPayment } from '@/server/services/online-payment.service'
import { listConfirmationQueue } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string
let gateway: { status: string; amount: string; confirmation?: string; deposit?: string | null } = { status: 'no_payment_attempted', amount: '0' }
/** ردّ بديل لإنشاء الطلب (لمحاكاة الرفض) */
let createReply: { status: number; body: unknown } | null = null
let refN = 0

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  // eFawtara: التحقق أولًا (مساره يحتوي مسار الإنشاء)
  if (url.includes('/api/payment-requests/check')) {
    const paid = gateway.status === 'paid'
    return json({
      data: {
        id: new URL(url).searchParams.get('order_number'),
        type: 'payment_request',
        attributes: { status: gateway.status, amount: gateway.amount, deposit_amount: gateway.deposit ?? null, confirmation_status: gateway.confirmation ?? (paid ? 'confirmed' : 'requires_verification') },
        links: { href: paid ? 'https://epay.efawtara.com/receipts/signed-x' : null }
      },
      meta: { code: 'PAYMENT_REQUEST_CHECKED' }
    })
  }
  if (url.includes('/api/payment-requests')) {
    if (createReply) return json(createReply.body, createReply.status)
    const id = `K3F9Q2ZP${String(++refN).padStart(2, '0')}`
    return json({ data: { id, type: 'payment_request', attributes: { amount: '0.00', order_number: id, status: 'no_payment_attempted', confirmation_status: 'requires_verification', form_url: 'https://test.satim.dz/payment_ar.html?mdOrder=x' } }, meta: { code: 'PAYMENT_REQUEST_CREATED' } }, 201)
  }
  return json({ errors: [{ status: '404', code: 'NOT_FOUND', title: 'Not found', detail: 'no route', meta: [] }] }, 404)
})
const createCalls = () => fetchMock.mock.calls.filter(([u, init]) => String(u).includes('/api/payment-requests') && !String(u).includes('/check') && init?.method === 'POST')

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

let n = 0
async function paidCourse(price = 3000, stock: number | null = 5) {
  const c = await createCourse(h.db, admin, { title: `دورة دفع ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: price, stock, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}
const payNow = (s: Actor, courseId: string) => placeCourseOrder(h.db, s, { courseId, phone: `06${String(10000000 + ++n).slice(-8)}`, wilayaId, address: 'حي النصر', deliveryType: 'HOME', payNow: true })
const enrollments = (studentId: string) => h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))
const paymentOf = async (orderId: string) => (await h.db.select().from(onlinePayments).where(eq(onlinePayments.orderId, orderId)))[0]!

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الدفع'))
  wilayaId = (await refIds(h.db)).wilayaId!
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await h.close()
})

describe('الدفع الإلكتروني', () => {
  it('بلا مفاتيح مفعّلة: «ادفع الآن» مرفوض والدفع عند الاستلام باقٍ', async () => {
    const c = await paidCourse()
    const s = await makeStudent(h.db, 'بلا بوابة')
    await expectCode(() => payNow(s, c.id), 'PAYMENT_NOT_CONFIGURED')
  })

  it('ادفع الآن ⇒ رابط SATIM، لا تفعيل قبل الدفع، ولا يظهر في طابور التأكيد', async () => {
    await saveGuiddiniConfig(h.db, { baseUrl: '', appKey: 'APP-test-123456', appSecret: 'SEC-test-abcdef', enabled: true })
    const c = await paidCourse(3000)
    const s = await makeStudent(h.db, 'يدفع الآن')
    const o = await payNow(s, c.id)
    expect(o.payUrl).toMatch(/^https:\/\/test\.satim\.dz/)
    const [row] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(row!.paymentMethod).toBe('ONLINE')
    expect(row!.status).toBe('PENDING')
    expect(await enrollments(s.studentId!)).toHaveLength(0)
    expect((await listConfirmationQueue(h.db, admin)).some((q) => q.id === o.id)).toBe(false)
    gateway = { status: 'no_payment_attempted', amount: '0' }
    expect((await verifyPayment(h.db, (await paymentOf(o.id)).id)).status).toBe('PENDING')
    expect(await enrollments(s.studentId!)).toHaveLength(0)
  })

  it('«paid» بالمبلغ نفسه ⇒ الدورة تُفعَّل فورًا مرة واحدة، والطلب مؤكَّد للشحن', async () => {
    const c = await paidCourse(2500)
    const s = await makeStudent(h.db, 'دفع ناجح')
    const o = await payNow(s, c.id)
    gateway = { status: 'paid', amount: `${o.totalDzd}.00`, deposit: `${o.totalDzd}.00` }
    const pid = (await paymentOf(o.id)).id
    const out = await verifyPayment(h.db, pid)
    expect(out.status).toBe('PAID')
    expect(out.courseIds).toEqual([c.id])
    const e = await enrollments(s.studentId!)
    expect(e.map((x) => [x.courseId, x.source, x.status])).toEqual([[c.id, 'ONLINE_PAYMENT', 'ACTIVE']])
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.status).toBe('CONFIRMED')
    // تكرار (عودة الولي + الفحص الآلي) لا يكرر شيئًا
    expect((await verifyPayment(h.db, pid)).courseIds).toEqual([])
    expect(await enrollments(s.studentId!)).toHaveLength(1)
  })

  it('المبلغ المختلف لا يفعّل؛ الفشل يلغي الطلب ويعيد الكتاب للمخزون', async () => {
    const c = await paidCourse(2000, 3)
    const s1 = await makeStudent(h.db, 'مبلغ مختلف')
    const o1 = await payNow(s1, c.id)
    gateway = { status: 'paid', amount: '2000.00', deposit: '10.00' }
    expect((await verifyPayment(h.db, (await paymentOf(o1.id)).id)).status).toBe('MISMATCH')
    expect(await enrollments(s1.studentId!)).toHaveLength(0)

    const s2 = await makeStudent(h.db, 'دفع فاشل')
    const o2 = await payNow(s2, c.id)
    gateway = { status: 'user_cancelled', amount: '2000.00', deposit: '0.00', confirmation: 'failed' }
    expect((await verifyPayment(h.db, (await paymentOf(o2.id)).id)).status).toBe('FAILED')
    expect((await h.db.select().from(orders).where(eq(orders.id, o2.id)))[0]!.status).toBe('CANCELLED')
    expect(await enrollments(s2.studentId!)).toHaveLength(0)
  })

  it('الولي الذي دفع وأغلق الصفحة: الفحص الآلي يفعّل الدورة', async () => {
    const c = await paidCourse(1800)
    const s = await makeStudent(h.db, 'أغلق الصفحة')
    const o = await payNow(s, c.id)
    gateway = { status: 'paid', amount: `${o.totalDzd}.00`, deposit: `${o.totalDzd}.00` }
    const later = new Date(Date.now() + 5 * 60_000)
    const r = await reconcilePendingPayments(h.db, undefined, later)
    expect(r.paid).toBeGreaterThanOrEqual(1)
    expect((await enrollments(s.studentId!)).map((x) => x.source)).toEqual(['ONLINE_PAYMENT'])
  })

  it('eFawtara: جسم الطلب وترويساته ومساراته كما في التوثيق', async () => {
    vi.stubEnv('APP_URL', 'https://madrasadz.com/')
    try {
      const c = await paidCourse(2200)
      const s = await makeStudent(h.db, 'يفحص الطلب')
      const before = createCalls().length
      const o = await payNow(s, c.id)
      const calls = createCalls()
      expect(calls.length).toBe(before + 1)
      const [url, init] = calls.at(-1)!
      expect(url).toBe('https://epay.efawtara.com/api/payment-requests')
      const hd = init!.headers as Record<string, string>
      expect(hd['X-App-Key']).toBe('APP-test-123456')
      expect(hd['X-App-Secret']).toBe('SEC-test-abcdef')
      expect(hd.Accept).toBe('application/json')
      expect(hd['Content-Type']).toBe('application/json')
      expect(hd['Idempotency-Key']).toBe(`madrasa-${o.id}`)
      expect(hd['Idempotency-Key']!.length).toBeLessThanOrEqual(64)
      expect(JSON.parse(String(init!.body))).toEqual({ amount: o.totalDzd, language: 'AR', return_url: 'https://madrasadz.com/student/payments/return' })
      // رقم الطلب (data.id) هو ما يُحفظ، والتحقق يسأل به المسار الجديد
      const p = await paymentOf(o.id)
      expect(p.gatewayRef).toMatch(/^K3F9Q2ZP\d+$/)
      gateway = { status: 'no_payment_attempted', amount: `${o.totalDzd}.00` }
      expect((await verifyPayment(h.db, p.id)).status).toBe('PENDING')
      const checkUrl = String(fetchMock.mock.calls.at(-1)![0])
      expect(checkUrl).toBe(`https://epay.efawtara.com/api/payment-requests/check?order_number=${p.gatewayRef}`)
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/payment/'))).toBe(false)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('رابط العودة: من APP_URL إن كان https، وإلا madrasadz.com', () => {
    expect(paymentReturnUrl('https://madrasadz.com')).toBe('https://madrasadz.com/student/payments/return')
    expect(paymentReturnUrl('https://staging.madrasadz.com/x?y=1')).toBe('https://staging.madrasadz.com/student/payments/return')
    expect(paymentReturnUrl('http://localhost:3000')).toBe('https://madrasadz.com/student/payments/return')
    expect(paymentReturnUrl(undefined)).toBe('https://madrasadz.com/student/payments/return')
  })

  it('رفض الإنشاء: يُلغى الطلب، ويُحفظ السبب كاملًا ويظهر للمشرف؛ 403 ليس «مفاتيح خاطئة»', async () => {
    const c = await paidCourse(2100, 4)
    const s = await makeStudent(h.db, 'رفض SATIM')
    createReply = {
      status: 403,
      body: { errors: [{ status: '403', code: 'ACCESS_DENIED', title: 'Access denied', detail: 'The gateway refused the merchant access.', meta: { current_environment: 'production', satim_response: { errorCode: '5', errorMessage: 'Access denied' } } }] }
    }
    try {
      await expectCode(() => payNow(s, c.id), 'PAYMENT_GATEWAY_REJECTED')
    } finally {
      createReply = null
    }
    const [o] = await h.db.select().from(orders).where(eq(orders.userId, s.userId))
    expect(o!.status).toBe('CANCELLED')
    const [log] = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'payment.rejected'), eq(auditLogs.entityId, o!.id)))
    expect(log!.newValue).toMatchObject({ error: 'PAYMENT_GATEWAY_REJECTED', httpStatus: 403, code: 'ACCESS_DENIED', title: 'Access denied', detail: 'The gateway refused the merchant access.', meta: { current_environment: 'production', satim_response: { errorCode: '5' } } })
    const shown = await listRecentPaymentRejections(h.db, 5)
    expect(shown[0]).toMatchObject({ orderNumber: o!.number, httpStatus: 403, code: 'ACCESS_DENIED', title: 'Access denied', amountDzd: o!.totalDzd })
    // لا يعرض الصفحة أكثر من 5
    for (const status of [402, 422, 422, 500, 401]) {
      createReply = { status, body: { errors: [{ status: String(status), code: status === 401 ? 'INVALID_API_KEYS' : status === 402 ? 'GATEWAY_ERROR' : status === 500 ? 'GATEWAY_NO_RESPONSE' : 'RAIL_PAUSED', title: 't', detail: 'd', meta: [] }] } }
      const s2 = await makeStudent(h.db, `رفض ${status}`)
      try {
        await expectCode(() => payNow(s2, c.id), status === 401 ? 'PAYMENT_KEYS_INVALID' : 'PAYMENT_GATEWAY_REJECTED')
      } finally {
        createReply = null
      }
    }
    const five = await listRecentPaymentRejections(h.db, 5)
    expect(five).toHaveLength(5)
    expect(five[0]).toMatchObject({ httpStatus: 401, code: 'INVALID_API_KEYS', error: 'PAYMENT_KEYS_INVALID' })
    expect(five.some((r) => r.code === 'ACCESS_DENIED')).toBe(false)
  })

  it('حالات الفشل الجديدة وconfirmation_status = failed تُلغي؛ no_payment_attempted تبقى معلّقة', async () => {
    const c = await paidCourse(1500, 10)
    for (const [g, want] of [
      [{ status: 'insufficient_funds', amount: '1500.00', deposit: '0.00', confirmation: 'failed' }, 'FAILED'],
      [{ status: 'card_input_error', amount: '1500.00' }, 'FAILED'],
      [{ status: 'gateway_unreachable', amount: '1500.00' }, 'FAILED'],
      [{ status: 'some_new_status', amount: '1500.00', confirmation: 'failed' }, 'FAILED'],
      [{ status: 'no_payment_attempted', amount: '1500.00', confirmation: 'requires_verification' }, 'PENDING']
    ] as const) {
      const s = await makeStudent(h.db, `حالة ${g.status}`)
      const o = await payNow(s, c.id)
      gateway = { ...g }
      expect((await verifyPayment(h.db, (await paymentOf(o.id)).id)).status, g.status).toBe(want)
      expect(await enrollments(s.studentId!)).toHaveLength(0)
    }
  })

  it('اختبار الاتصال: 404 لرقم غير موجود = المفاتيح مقبولة؛ 401 = مفاتيح خاطئة', async () => {
    const c = (await getGuiddiniConfig(h.db))!
    await expect(guiddiniTest(c, async () => json({ errors: [{ status: '404', code: 'NOT_FOUND', title: 'Not found', detail: '', meta: [] }] }, 404))).resolves.toEqual({ ok: true })
    await expectCode(() => guiddiniTest(c, async () => json({ errors: [{ status: '401', code: 'INVALID_API_KEYS', title: 'Invalid', detail: '', meta: [] }] }, 401)), 'PAYMENT_KEYS_INVALID')
    await expectCode(() => guiddiniTest(c, async () => json({ errors: [{ status: '403', code: 'ACCESS_DENIED', title: 'Denied', detail: '', meta: [] }] }, 403)), 'PAYMENT_GATEWAY_REJECTED')
  })

  it('تصحيح العنوان عند الحفظ والقراءة: guiddini.dz ولوحة app.efawtara.com ⇒ epay.efawtara.com', async () => {
    expect(normalizeGatewayBase('')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://app.efawtara.com')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://app.efawtara.com/company/settings/rails')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://efawtara.com')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://epay.guiddini.dz')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://guiddini.dz/')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://epay.efawtara.com/api/')).toBe('https://epay.efawtara.com')
    expect(normalizeGatewayBase('https://pay.example.dz')).toBe('https://pay.example.dz')
    expect(() => normalizeGatewayBase('http://pay.example.dz')).toThrow()

    // عند الحفظ
    await saveGuiddiniConfig(h.db, { baseUrl: 'https://app.efawtara.com', appKey: 'APP-test-123456', appSecret: '', enabled: true })
    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY))
    expect((row!.value as { baseUrl: string }).baseUrl).toBe('https://epay.efawtara.com')

    // عند القراءة: قيمة قديمة محفوظة كما هي (لوحة التحكم) تُقرأ مصحّحة، والسرّ باقٍ
    await h.db.update(appSettings).set({ value: { ...(row!.value as object), baseUrl: 'https://app.efawtara.com' } }).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY))
    expect((await getGuiddiniConfig(h.db))!.baseUrl).toBe('https://epay.efawtara.com')
    expect((await getGuiddiniConfig(h.db))!.appSecret).toBe('SEC-test-abcdef')
    expect((await getGuiddiniView(h.db))!.baseUrl).toBe('https://epay.efawtara.com')
    await h.db.update(appSettings).set({ value: { ...(row!.value as object), baseUrl: 'https://epay.guiddini.dz' } }).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY))
    expect((await getGuiddiniConfig(h.db))!.baseUrl).toBe('https://epay.efawtara.com')

    // وطلب «ادفع الآن» بعدها يذهب إلى واجهة eFawtara لا إلى لوحة التحكم
    const c = await paidCourse(1900)
    const s = await makeStudent(h.db, 'عنوان مصحّح')
    await payNow(s, c.id)
    expect(String(createCalls().at(-1)![0])).toBe('https://epay.efawtara.com/api/payment-requests')
  })

  it('المسارات القديمة تبقى فقط لمضيف guiddini.dz المُمرَّر صراحةً', async () => {
    const seen: string[] = []
    const legacy = async (u: string | URL | Request) => {
      seen.push(String(u))
      return json({ data: { id: 'OLD1', attributes: { form_url: 'https://test.satim.dz/p' } } })
    }
    await guiddiniInitiate({ baseUrl: 'https://epay.guiddini.dz', appKey: 'k-12345678', appSecret: 's', enabled: true }, { amountDzd: 100, orderId: 'x' }, legacy as typeof fetch)
    await guiddiniInitiate({ baseUrl: 'https://epay.efawtara.com', appKey: 'k-12345678', appSecret: 's', enabled: true }, { amountDzd: 100, orderId: 'x' }, legacy as typeof fetch)
    expect(seen).toEqual(['https://epay.guiddini.dz/api/payment/initiate', 'https://epay.efawtara.com/api/payment-requests'])
    await clearGuiddiniConfig(h.db)
  })
})
