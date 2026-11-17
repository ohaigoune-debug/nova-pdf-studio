/**
 * قرار المالك 18 نوفمبر 2026: المسوّق بالعمولة وحده (400 دج عن كل تلميذ جديد)، ودعوات التلاميذ ورصيدهم مطفأة
 * افتراضيًا — لا كود تلميذ يُقبل، ولا رصيد ترحيبي، ولا صفحة «ادعُ زميلك» — مع مفتاح يعيدها كاملة (الموسم القادم).
 * و«طبّق على المسوّقين الحاليين» يغيّر عمولة الموجودين بضغطة.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { affiliates, profiles, referralRewards } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createAffiliate } from '@/server/services/affiliates.service'
import { createStaffAccount } from '@/server/services/confirmer.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { transitionOrder } from '@/server/services/order-status.service'
import { attachReferral, checkCodeForSignup, creditBalance, effectiveWelcomeDzd, referralPolicy, setReferralPolicy, studentCreditsOn, studentInviteHome, withInvitesHidden } from '@/server/services/referrals.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let manager: Actor
let workspaceId: string
let wilayaId: string
let n = 0
const phone = () => `0664${String(500000 + ++n).slice(-6)}`
const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }))

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function course() {
  const c = await createCourse(h.db, admin, { title: `دورة المفتاح ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب المفتاح ${n}`, priceDzd: 4900, stock: 100, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

async function student(name: string) {
  const s = await makeStudent(h.db, `${name} بن علي`)
  await h.db.update(profiles).set({ phone: phone() }).where(eq(profiles.userId, s.userId))
  return s
}

async function buyAndDeliver(s: Actor, courseId: string) {
  const o = await placeCourseOrder(h.db, s, { courseId, phone: phone(), wilayaId, address: 'حي الأمل', deliveryType: 'HOME' })
  await transitionOrder(h.db, o.id, 'CONFIRMED', { actorUserId: admin.userId, source: 'admin' })
  await transitionOrder(h.db, o.id, 'DELIVERED', { actorUserId: null, source: 'delivery' })
  return o
}

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchMock)
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ المفتاح'))
  wilayaId = (await refIds(h.db)).wilayaId!
  const m = await createStaffAccount(h.db, admin, { email: uniq('ops') + '@test.dz', password: 'Manager@12345', fullName: 'مدير العمليات', phone: '0771999877', role: 'MANAGER' })
  manager = await actorOf(h.db, m.userId)
})
afterAll(async () => {
  vi.unstubAllGlobals()
  await h.close()
})

describe('المسوّق وحده، ودعوات التلاميذ خلف مفتاح', () => {
  it('الافتراضي: عمولة 400، ودعوات التلاميذ ورصيدهم مطفأة', async () => {
    const p = await referralPolicy(h.db)
    expect(p).toMatchObject({ enabled: true, affiliateDefaultDzd: 400, studentInvites: false })
    expect(studentCreditsOn(p)).toBe(false)
    expect(effectiveWelcomeDzd(p)).toBe(0)
    expect(withInvitesHidden(['/student/play'], p)).toEqual(['/student/play', '/student/invite'])
  })

  it('مطفأة: كود المسوّق يعمل (400 دج نقدًا) دون رصيد ترحيبي، وكود التلميذ مرفوض ولا يُنشأ', async () => {
    const c = await course()
    const aff = await createAffiliate(h.db, manager, { fullName: 'نسرين', phone: phone() })
    expect((await h.db.select({ c: affiliates.commissionDzd }).from(affiliates).where(eq(affiliates.id, aff.affiliateId)))[0]!.c).toBe(400)
    const buyer = await student('أنيس')
    const r = await attachReferral(h.db, buyer, aff.code, 'PAGE')
    expect(r.welcomeCreditDzd).toBe(0)
    await buyAndDeliver(buyer, c.id)
    const rewards = await h.db.select({ kind: referralRewards.kind, amount: referralRewards.amountDzd }).from(referralRewards)
    expect(rewards).toEqual([{ kind: 'AFFILIATE_CASH', amount: 400 }])
    expect((await creditBalance(h.db, buyer.userId)).availableDzd).toBe(0)
    // التلميذ المشترك لا يأخذ كودًا وهي مطفأة
    expect((await studentInviteHome(h.db, buyer)).code).toBeNull()
  })

  it('تشغيلها (الموسم القادم): كود التلميذ يُنشأ ويُقبل، والرصيد يُمنح للداعي والمدعو؛ ثم إطفاؤها يرفض الكود من جديد', async () => {
    const on = await setReferralPolicy(h.db, admin, { studentInvites: true })
    expect(withInvitesHidden(['/student/play'], on)).toEqual(['/student/play'])
    const c = await course()
    const host = await student('سمير')
    await buyAndDeliver(host, c.id)
    const code = (await studentInviteHome(h.db, host)).code!
    expect(code).toMatch(/^T/)
    const friend = await student('رياض')
    expect((await attachReferral(h.db, friend, code, 'PAGE')).welcomeCreditDzd).toBe(200)
    await buyAndDeliver(friend, c.id)
    expect((await creditBalance(h.db, host.userId)).availableDzd).toBe(200)
    expect((await creditBalance(h.db, friend.userId)).availableDzd).toBe(200)

    await setReferralPolicy(h.db, admin, { studentInvites: false })
    const late = await student('متأخر')
    await expectCode(() => attachReferral(h.db, late, code, 'PAGE'), 'REFERRAL_CODE_INVALID')
    await expectCode(() => checkCodeForSignup(h.db, code, phone()), 'REFERRAL_CODE_INVALID')
    // من أخذ رصيدًا يحتفظ به
    expect((await creditBalance(h.db, host.userId)).availableDzd).toBe(200)
  })

  it('«طبّق على المسوّقين الحاليين»: يغيّر عمولة الموجودين؛ ودونه يبقون كما هم — للمشرف وحده', async () => {
    const a = await createAffiliate(h.db, manager, { fullName: 'قديم أ', phone: phone() })
    const b = await createAffiliate(h.db, admin, { fullName: 'قديم ب', phone: phone(), commissionDzd: 250 })
    const commission = async (id: string) => (await h.db.select({ c: affiliates.commissionDzd }).from(affiliates).where(eq(affiliates.id, id)))[0]!.c
    await setReferralPolicy(h.db, admin, { affiliateDefaultDzd: 450 })
    expect([await commission(a.affiliateId), await commission(b.affiliateId)]).toEqual([400, 250])
    await setReferralPolicy(h.db, admin, { affiliateDefaultDzd: 500, applyToAffiliates: true })
    expect([await commission(a.affiliateId), await commission(b.affiliateId)]).toEqual([500, 500])
    await expectCode(() => setReferralPolicy(h.db, manager, { affiliateDefaultDzd: 900, applyToAffiliates: true }), 'FORBIDDEN')
  })
})
