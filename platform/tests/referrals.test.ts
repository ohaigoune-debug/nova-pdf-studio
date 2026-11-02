/**
 * المسوّقون بالعمولة ودعوة الزملاء والرصيد (قرار المالك 2 نوفمبر 2026).
 * المطلوب: السعر واحد (الكود لا يخفّض)، الكود للتلميذ الجديد فقط ويُثبَّت أول كود، لا مكافأة على النفس،
 * المكافأة عند التسليم مرة واحدة وتسقط بالإرجاع، نقد المسوّق يُدفع بعد المهلة ولا يتجاوز المستحق،
 * الرصيد يُخصم من الدورة ويعود عند الإلغاء، والصلاحيات محصورة.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, creditLots, notifications, onlinePayments, orders, partnerApplications, pointsOfSale, profiles, referralRewards, referrals } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { clearGuiddiniConfig, saveGuiddiniConfig } from '@/server/lib/guiddini'
import {
  affiliateHome,
  affiliateMoney,
  approvePartnerApplication,
  createAffiliate,
  getAffiliate,
  recordAffiliatePayout,
  remindCustomer,
  setAffiliateStatus,
  submitPartnerApplication
} from '@/server/services/affiliates.service'
import { login } from '@/server/services/auth.service'
import { createStaffAccount } from '@/server/services/confirmer.service'
import { placeCourseOrder, placeDigitalCourseOrder, setCourseBook, setCourseDigitalPrice } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { verifyPayment } from '@/server/services/online-payment.service'
import { transitionOrder } from '@/server/services/order-status.service'
import {
  attachReferral,
  attachReferralForNewAccount,
  checkCodeForSignup,
  creditBalance,
  creditToApply,
  maskName,
  maskPhone,
  referralPolicy,
  setReferralPolicy,
  studentInviteHome,
  voidReward
} from '@/server/services/referrals.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let manager: Actor
let workspaceId: string
let wilayaId: string
let n = 0
let gateway = { status: 'no_payment_attempted', amount: '0' }
let refN = 0

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
  if (url.includes('/api/payment-requests/check')) {
    const paid = gateway.status === 'paid'
    return json({ data: { id: new URL(url).searchParams.get('order_number'), attributes: { status: gateway.status, amount: gateway.amount, deposit_amount: null, confirmation_status: paid ? 'confirmed' : 'requires_verification' }, links: { href: null } } })
  }
  if (url.includes('/api/payment-requests')) {
    const id = `REF${String(++refN).padStart(6, '0')}`
    return json({ data: { id, type: 'payment_request', attributes: { order_number: id, status: 'no_payment_attempted', form_url: `https://test.satim.dz/payment_ar.html?mdOrder=${id}` } } }, 201)
  }
  return json({ errors: [{ status: '404', code: 'NOT_FOUND' }] }, 404)
})
const lastCreateBody = () => {
  const call = fetchMock.mock.calls.filter(([u, init]) => String(u).endsWith('/api/payment-requests') && init?.method === 'POST').at(-1)!
  return JSON.parse(String(call[1]!.body)) as { amount: number }
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

let phoneN = 0
const phone = () => `0770${String(100000 + ++phoneN).slice(-6)}`
const day = 86_400_000

/** دورة منشورة بكتاب (وبنسخة رقمية اختيارية) */
async function course(book = 4900, digital: number | null = null) {
  const c = await createCourse(h.db, admin, { title: `دورة الدعوة ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب الدعوة ${n}`, priceDzd: book, stock: 100, active: true })
  if (digital) await setCourseDigitalPrice(h.db, admin, c.id, digital)
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

/** تلميذ برقم هاتف في ملفه */
async function student(name = `تلميذ ${++n}`, tel = phone()) {
  const s = await makeStudent(h.db, `${name} بن علي`)
  await h.db.update(profiles).set({ phone: tel }).where(eq(profiles.userId, s.userId))
  return { actor: s, phone: tel }
}

/** طلب دورة مع الكتاب عند الاستلام، ثم مؤكَّد ثم مُسلَّم */
async function buyAndDeliver(s: Actor, courseId: string, opts: { phone?: string; useCredit?: boolean } = {}) {
  const o = await placeCourseOrder(h.db, s, { courseId, phone: opts.phone ?? phone(), wilayaId, address: 'حي الأمل', deliveryType: 'HOME', useCredit: opts.useCredit })
  await transitionOrder(h.db, o.id, 'CONFIRMED', { actorUserId: admin.userId, source: 'admin' })
  await transitionOrder(h.db, o.id, 'DELIVERED', { actorUserId: null, source: 'delivery' })
  return o
}

const rewardsOf = (userId: string) => h.db.select().from(referralRewards).where(eq(referralRewards.beneficiaryUserId, userId))
const referralOf = async (userId: string) => (await h.db.select().from(referrals).where(eq(referrals.referredUserId, userId)))[0]

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الدعوة'))
  wilayaId = (await refIds(h.db)).wilayaId!
  const m = await createStaffAccount(h.db, admin, { email: uniq('ops') + '@test.dz', password: 'Manager@12345', fullName: 'مدير العمليات', phone: '0771999888', role: 'MANAGER' })
  manager = await actorOf(h.db, m.userId)
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await h.close()
})

describe('المسوّقون ودعوة الزملاء والرصيد', () => {
  it('مدير العمليات يضيف المسوّق: يدخل بالهاتف، بكود وعمولة افتراضية 300 (العمولة للمشرف وحده)', async () => {
    const tel = phone()
    const c = await createAffiliate(h.db, manager, { fullName: 'أمين صاحب الصفحة', phone: tel, socialUrl: 'https://instagram.com/amine', followers: 4200, code: 'amine-dz', commissionDzd: 900 })
    expect(c.code).toBe('AMINEDZ')
    expect(c.password).toMatch(/^[a-z]{6}\d{4}$/)
    expect(decodeURIComponent(c.whatsappUrl)).toContain('/r/AMINEDZ')
    expect((await login(h.db, { email: tel, password: c.password })).role).toBe('AFFILIATE')
    const d = await getAffiliate(h.db, manager, c.affiliateId)
    expect(d.affiliate.commissionDzd).toBe(300)
    // الكود والرقم لا يتكرران
    await expectCode(() => createAffiliate(h.db, manager, { fullName: 'آخر', phone: phone(), code: 'AMINEDZ' }), 'PROMO_CODE_TAKEN')
    await expectCode(() => createAffiliate(h.db, manager, { fullName: 'آخر', phone: tel }), 'AFFILIATE_PHONE_TAKEN')
    const byAdmin = await createAffiliate(h.db, admin, { fullName: 'سارة', phone: phone(), commissionDzd: 450 })
    expect((await getAffiliate(h.db, admin, byAdmin.affiliateId)).affiliate.commissionDzd).toBe(450)
    expect(byAdmin.code).toMatch(/^M[A-Z0-9]{5,}$/)
  })

  it('التسجيل بالكود: كود خاطئ أو كود صاحب الرقم نفسه يُرفض قبل إنشاء الحساب؛ أول كود يُثبَّت ولا يتغيّر', async () => {
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق التسجيل', phone: phone() })
    await expectCode(() => checkCodeForSignup(h.db, 'NOPE99', null), 'REFERRAL_CODE_INVALID')
    await expectCode(() => checkCodeForSignup(h.db, aff.code, aff.phone), 'REFERRAL_SELF')
    expect((await checkCodeForSignup(h.db, aff.code.toLowerCase(), phone())).kind).toBe('AFFILIATE')
    const { actor: s } = await student()
    await attachReferralForNewAccount(h.db, s.userId, aff.code, 'REGISTER')
    const other = await createAffiliate(h.db, manager, { fullName: 'مسوّق ثانٍ', phone: phone() })
    await expectCode(() => attachReferral(h.db, s, other.code, 'PAGE'), 'REFERRAL_ALREADY_SET')
    expect((await referralOf(s.userId))!.referrerUserId).toBe(aff.userId)
  })

  it('الكود للتلميذ الجديد فقط: من له دورة لا يُنسب لأحد', async () => {
    const c = await course()
    const { actor: old } = await student()
    await buyAndDeliver(old, c.id)
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق متأخر', phone: phone() })
    await expectCode(() => attachReferral(h.db, old, aff.code, 'PAGE'), 'REFERRAL_NOT_NEW')
  })

  it('أول دورة تُسلَّم: 300 دج للمسوّق بعد مهلة 7 أيام، و200 دج رصيد ترحيبي للتلميذ؛ السعر لم يتغيّر، ومرة واحدة فقط', async () => {
    const c = await course(4900)
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق الأرباح', phone: phone() })
    const affiliate = (await getAffiliate(h.db, manager, aff.affiliateId)).affiliate
    const { actor: s } = await student('يونس')
    await attachReferral(h.db, s, aff.code, 'CHECKOUT')
    const o = await buyAndDeliver(s, c.id)
    expect(o.totalDzd).toBe(4900 + o.shippingDzd)
    const cash = await rewardsOf(aff.userId)
    expect(cash.map((r) => [r.kind, r.amountDzd, r.status])).toEqual([['AFFILIATE_CASH', 300, 'EARNED']])
    expect(cash[0]!.availableAt.getTime() - Date.now()).toBeGreaterThan(6.9 * day)
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(200)
    expect((await referralOf(s.userId))!.status).toBe('QUALIFIED')
    // «سُلِّم» مكرّر من شركة التوصيل: لا مكافأة ثانية
    await transitionOrder(h.db, o.id, 'DELIVERED', { actorUserId: null, source: 'ecotrack' })
    expect(await rewardsOf(aff.userId)).toHaveLength(1)
    // المال: قيد المهلة الآن، مستحق بعد 8 أيام؛ الدفع لا يتجاوز المستحق
    expect(await affiliateMoney(h.db, affiliate)).toMatchObject({ earnedDzd: 300, holdingDzd: 300, dueDzd: 0 })
    await expectCode(() => recordAffiliatePayout(h.db, manager, aff.affiliateId, { amountDzd: 300 }), 'AFFILIATE_PAYOUT_TOO_MUCH')
    const later = new Date(Date.now() + 8 * day)
    expect(await affiliateMoney(h.db, affiliate, later)).toMatchObject({ holdingDzd: 0, dueDzd: 300 })
    await recordAffiliatePayout(h.db, manager, aff.affiliateId, { amountDzd: 300, note: 'بريدي موب' }, later)
    expect(await affiliateMoney(h.db, affiliate, later)).toMatchObject({ paidDzd: 300, dueDzd: 0 })
    // واجهة المسوّق: اسم وهاتف مقنّعان
    const home = await affiliateHome(h.db, await actorOf(h.db, aff.userId), later)
    expect(home.customers[0]).toMatchObject({ name: 'يونس ب.', status: 'BOUGHT' })
    expect(home.customers[0]!.phoneMasked).toMatch(/^07•• ••• •\d\d$/)
  })

  it('لا مكافأة على النفس: طلب بهاتف المسوّق «لا يُحتسب»، ورقم كوفئ عليه لا يُكافأ مرة ثانية', async () => {
    const c = await course()
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق يتحايل', phone: phone() })
    const { actor: s } = await student()
    await attachReferral(h.db, s, aff.code, 'PAGE')
    await buyAndDeliver(s, c.id, { phone: aff.phone })
    expect((await referralOf(s.userId))!.status).toBe('VOID')
    expect(await rewardsOf(aff.userId)).toHaveLength(0)
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(0)
    // رقم استلام سبق أن كوفئ عليه في حساب آخر
    const shared = phone()
    const { actor: a1 } = await student()
    const { actor: a2 } = await student()
    await attachReferral(h.db, a1, aff.code, 'PAGE')
    await attachReferral(h.db, a2, aff.code, 'PAGE')
    await buyAndDeliver(a1, c.id, { phone: shared })
    await buyAndDeliver(a2, c.id, { phone: shared })
    expect((await referralOf(a1.userId))!.status).toBe('QUALIFIED')
    expect((await referralOf(a2.userId))!.status).toBe('VOID')
  })

  it('الإرجاع بعد التسليم يُسقط العمولة والرصيد الترحيبي؛ ومدير العمليات يُلغي مكافأة بسبب', async () => {
    const c = await course()
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق الإرجاع', phone: phone() })
    const affiliate = (await getAffiliate(h.db, manager, aff.affiliateId)).affiliate
    const { actor: s } = await student()
    await attachReferral(h.db, s, aff.code, 'PAGE')
    const o = await buyAndDeliver(s, c.id)
    await transitionOrder(h.db, o.id, 'RETURNED', { actorUserId: null, source: 'delivery' })
    expect((await referralOf(s.userId))!.status).toBe('REVERSED')
    expect((await rewardsOf(aff.userId))[0]!.status).toBe('REVERSED')
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(0)
    expect((await affiliateMoney(h.db, affiliate)).earnedDzd).toBe(0)

    const { actor: s2 } = await student()
    await attachReferral(h.db, s2, aff.code, 'PAGE')
    await buyAndDeliver(s2, c.id)
    const reward = (await rewardsOf(aff.userId)).find((r) => r.status === 'EARNED')!
    await expectCode(() => voidReward(h.db, s2, reward.id, 'تحايل'), 'FORBIDDEN')
    await voidReward(h.db, manager, reward.id, 'حسابات وهمية من الحي نفسه')
    expect((await affiliateMoney(h.db, affiliate)).earnedDzd).toBe(0)
  })

  it('التلميذ يدعو زميله: كوده بعد أول دورة فقط؛ 200 دج له و200 دج لزميله عند الاستلام', async () => {
    const c = await course()
    const { actor: host } = await student('سمير')
    const before = await studentInviteHome(h.db, host)
    expect(before.code).toBeNull()
    await buyAndDeliver(host, c.id)
    const home = await studentInviteHome(h.db, host)
    expect(home.code).toMatch(/^T[A-Z0-9]{5,}$/)
    expect(home.link).toContain(`/r/${home.code}`)
    const { actor: friend } = await student('رياض')
    await attachReferral(h.db, friend, home.code!, 'PAGE')
    await buyAndDeliver(friend, c.id)
    expect((await creditBalance(h.db, host.userId)).availableDzd).toBe(200)
    expect((await creditBalance(h.db, friend.userId)).availableDzd).toBe(200)
    expect((await studentInviteHome(h.db, host)).invitees).toMatchObject([{ name: 'رياض ب.', status: 'BOUGHT' }])
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, host.userId))
    expect(notes.some((x) => x.title.includes('200'))).toBe(true)
  })

  it('الرصيد يُخصم من الدورة عند الاستلام (التوصيل يُدفع دائمًا) ويعود إن أُلغي الطلب', async () => {
    const c = await course(4900)
    const { actor: s } = await student()
    await h.db.insert(creditLots).values({ userId: s.userId, amountDzd: 600, remainingDzd: 600, source: 'ADJUST', expiresAt: new Date(Date.now() + 30 * day) })
    const o = await placeCourseOrder(h.db, s, { courseId: c.id, phone: phone(), wilayaId, address: 'حي الأمل', deliveryType: 'HOME', useCredit: true })
    expect(o.creditDzd).toBe(600)
    expect(o.totalDzd).toBe(4900 + o.shippingDzd - 600)
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(0)
    // محرّك الحالات يُبقي الرصيد مخصومًا
    await transitionOrder(h.db, o.id, 'NO_ANSWER', { actorUserId: admin.userId, source: 'admin' })
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!.totalDzd).toBe(o.totalDzd)
    await transitionOrder(h.db, o.id, 'CANCELLED', { actorUserId: admin.userId, source: 'admin', reason: 'ألغاه' })
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(600)
    // إعادة فتحه تخصم من جديد
    await transitionOrder(h.db, o.id, 'PENDING', { actorUserId: admin.userId, source: 'admin' })
    expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(0)
  })

  it('النسخة الرقمية بالرصيد: البوابة تُطلب بالباقي فقط، والفشل يعيد الرصيد؛ رصيد يغطي الثمن يفتح الدورة دون بوابة', async () => {
    await saveGuiddiniConfig(h.db, { baseUrl: '', appKey: 'APP-test-123456', appSecret: 'SEC-test-abcdef', enabled: true })
    try {
      const c = await course(4900, 2500)
      const { actor: s } = await student()
      await h.db.insert(creditLots).values({ userId: s.userId, amountDzd: 400, remainingDzd: 400, source: 'ADJUST', expiresAt: new Date(Date.now() + 30 * day) })
      const o = await placeDigitalCourseOrder(h.db, s, { courseId: c.id, acceptNoBook: true, useCredit: true })
      expect(o).toMatchObject({ creditDzd: 400, totalDzd: 2100, paidWithCredit: false })
      expect(lastCreateBody().amount).toBe(2100)
      gateway = { status: 'user_cancelled', amount: '2100.00' }
      const pay = (await h.db.select().from(onlinePayments).where(eq(onlinePayments.orderId, o.id)))[0]!
      expect((await verifyPayment(h.db, pay.id)).status).toBe('FAILED')
      expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(400)

      const cheap = await course(3000, 300)
      const calls = fetchMock.mock.calls.length
      const free = await placeDigitalCourseOrder(h.db, s, { courseId: cheap.id, acceptNoBook: true, useCredit: true })
      expect(free).toMatchObject({ paidWithCredit: true, totalDzd: 0, creditDzd: 300 })
      expect(fetchMock.mock.calls.length).toBe(calls)
      const enr = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, cheap.id), eq(courseEnrollments.studentId, s.studentId!)))
      expect(enr[0]?.status).toBe('ACTIVE')
      expect((await h.db.select().from(orders).where(eq(orders.id, free.id)))[0]!.status).toBe('DELIVERED')
      expect((await creditBalance(h.db, s.userId)).availableDzd).toBe(100)
    } finally {
      await clearGuiddiniConfig(h.db)
    }
  })

  it('الرصيد لا يُنزل الدفع بالبطاقة تحت 50 دج، ولا يتجاوز ثمن الدورة', () => {
    expect(creditToApply(2480, { priceDzd: 2500, totalDzd: 2500, online: true })).toBe(2450)
    expect(creditToApply(2500, { priceDzd: 2500, totalDzd: 2500, online: true })).toBe(2500)
    expect(creditToApply(9000, { priceDzd: 4900, totalDzd: 5500, online: false })).toBe(4900)
    expect(creditToApply(200, { priceDzd: 4900, totalDzd: 5500, online: true })).toBe(200)
  })

  it('«ذكّره»: إشعار للتلميذ الذي لم يشترِ، مرة كل 48 ساعة، ولزبائن المسوّق وحده', async () => {
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق يذكّر', phone: phone() })
    const affActor = await actorOf(h.db, aff.userId)
    const { actor: s } = await student()
    await attachReferral(h.db, s, aff.code, 'PAGE')
    const ref = (await referralOf(s.userId))!
    await remindCustomer(h.db, affActor, ref.id)
    await expectCode(() => remindCustomer(h.db, affActor, ref.id), 'REMIND_TOO_SOON')
    await remindCustomer(h.db, affActor, ref.id, new Date(Date.now() + 49 * 3600 * 1000))
    const notes = await h.db.select().from(notifications).where(eq(notifications.userId, s.userId))
    expect(notes.filter((x) => x.title === 'دورتك في انتظارك')).toHaveLength(2)
    const other = await createAffiliate(h.db, manager, { fullName: 'مسوّق غريب', phone: phone() })
    const otherActor = await actorOf(h.db, other.userId)
    await expectCode(() => remindCustomer(h.db, otherActor, ref.id), 'NOT_FOUND')
  })

  it('إيقاف المسوّق يوقف كوده للتلاميذ الجدد', async () => {
    const aff = await createAffiliate(h.db, manager, { fullName: 'مسوّق موقوف', phone: phone() })
    await setAffiliateStatus(h.db, manager, aff.affiliateId, 'SUSPENDED')
    const { actor: s } = await student()
    await expectCode(() => attachReferral(h.db, s, aff.code, 'PAGE'), 'REFERRAL_CODE_INVALID')
    await setAffiliateStatus(h.db, manager, aff.affiliateId, 'ACTIVE')
    expect((await attachReferral(h.db, s, aff.code, 'PAGE')).kind).toBe('AFFILIATE')
  })

  it('«كن شريكًا»: الطلب يصل الإدارة دون تكرار؛ قبول المسوّق ينشئ حسابه، وقبول المدرسة ينشئ النقطة وحسابها', async () => {
    const tel = phone()
    await expectCode(() => submitPartnerApplication(h.db, { kind: 'AFFILIATE', fullName: 'نسرين المؤثرة', phone: tel }), 'VALIDATION')
    const app = await submitPartnerApplication(h.db, { kind: 'AFFILIATE', fullName: 'نسرين المؤثرة', phone: tel, socialUrl: 'https://tiktok.com/@nesrine', followers: 12000 })
    expect(app.duplicate).toBe(false)
    expect((await submitPartnerApplication(h.db, { kind: 'AFFILIATE', fullName: 'نسرين المؤثرة', phone: tel, socialUrl: 'x' })).duplicate).toBe(true)
    const staffNotes = await h.db.select().from(notifications).where(eq(notifications.userId, manager.userId))
    expect(staffNotes.some((x) => x.title.includes('طلب شراكة'))).toBe(true)
    const ok = await approvePartnerApplication(h.db, manager, app.id, { code: 'NESRINE' })
    expect(ok.kind).toBe('AFFILIATE')
    if (ok.kind === 'AFFILIATE') expect(ok.credentials.code).toBe('NESRINE')
    await expectCode(() => approvePartnerApplication(h.db, manager, app.id), 'PARTNER_APPLICATION_DECIDED')
    expect((await h.db.select().from(partnerApplications).where(eq(partnerApplications.id, app.id)))[0]!.status).toBe('APPROVED')

    const school = await submitPartnerApplication(h.db, { kind: 'POINT_OF_SALE', fullName: 'مدير مدرسة النجاح', phone: phone(), orgName: 'مدرسة النجاح', wilayaId, address: 'وسط المدينة' })
    const s = await approvePartnerApplication(h.db, manager, school.id)
    expect(s.kind).toBe('POINT_OF_SALE')
    if (s.kind === 'POINT_OF_SALE') {
      const [pos] = await h.db.select().from(pointsOfSale).where(eq(pointsOfSale.id, s.posId))
      expect(pos).toMatchObject({ name: 'مدرسة النجاح', listed: false })
      expect((await login(h.db, { email: s.credentials.phone, password: s.credentials.password })).role).toBe('POINT_OF_SALE')
    }
  })

  it('الصلاحيات: التلميذ لا يضيف مسوّقًا، ومدير العمليات لا يغيّر مبالغ البرنامج', async () => {
    const { actor: s } = await student()
    await expectCode(() => createAffiliate(h.db, s, { fullName: 'أنا', phone: phone() }), 'FORBIDDEN')
    await expectCode(() => setReferralPolicy(h.db, manager, { welcomeCreditDzd: 1000 }), 'FORBIDDEN')
    const p = await setReferralPolicy(h.db, admin, { welcomeCreditDzd: 150 })
    expect(p.welcomeCreditDzd).toBe(150)
    expect((await referralPolicy(h.db)).welcomeCreditDzd).toBe(150)
    await setReferralPolicy(h.db, admin, { welcomeCreditDzd: 200 })
  })

  it('الإقناع: الاسم والهاتف للمسوّق مقنّعان', () => {
    expect(maskName('أمين بن علي')).toBe('أمين ب.')
    expect(maskName('سارة')).toBe('سارة')
    expect(maskPhone('0661234512')).toBe('06•• ••• •12')
  })
})
