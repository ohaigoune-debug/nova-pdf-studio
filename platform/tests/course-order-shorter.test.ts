/**
 * البند ب4 (12 نوفمبر 2026): صفحة طلب الدورة أقصر.
 * العنوان من آخر طلب، وإعفاء هاتف الحساب المؤكَّد من الرمز بإعداد في اللوحة (معطَّل افتراضيًا)، وعدّاد إتمام الطلب.
 */
import { readFileSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { activityLogs, orders, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests } from '@/server/lib/sms'
import { courseOrderFunnel, recordCourseOrderView } from '@/server/services/course-order-funnel.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { requestOtp } from '@/server/services/otp.service'
import { courseCheckoutData, lastShippingAddress, setStorePolicy, storePolicy } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string
let seq = 0

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin))
  wilayaId = (await refIds(h.db)).wilayaId!
  setSmsSenderForTests({ name: 'memory', send: async () => undefined })
})
afterEach(() => {
  vi.unstubAllEnvs()
})
afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

function smsChannel() {
  vi.stubEnv('SMS_PROVIDER', 'webhook')
  vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.example.test/never-called')
}

async function course() {
  const c = await createCourse(h.db, admin, { title: `دورة ب4 ${++seq}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب ب4 ${seq}`, priceDzd: 1500, stock: 10, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}

async function verifiedStudent(phone: string) {
  const s = await makeStudent(h.db)
  await h.db.update(profiles).set({ phone, phoneVerifiedAt: new Date() }).where(eq(profiles.userId, s.userId))
  return s
}

const input = (courseId: string, phone: string, extra: Record<string, unknown> = {}) => ({ courseId, phone, wilayaId, commune: 'Guelma', address: 'حي الأمل، عمارة 3', deliveryType: 'HOME' as const, ...extra })

describe('العنوان من آخر طلب', () => {
  it('لا طلب سابق: لا عنوان؛ بعد طلب: عنوانه في بيانات النموذج', async () => {
    const s = await makeStudent(h.db)
    expect(await lastShippingAddress(h.db, s.userId)).toBeNull()
    expect((await courseCheckoutData(h.db, s)).last).toBeNull()
    await placeCourseOrder(h.db, s, input((await course()).id, '0661000001'))
    const last = await lastShippingAddress(h.db, s.userId)
    expect(last).toEqual({ wilayaId, commune: 'Guelma', address: 'حي الأمل، عمارة 3', deliveryType: 'HOME' })
    expect((await courseCheckoutData(h.db, s)).last).toEqual(last)
  })

  it('الأحدث يغلب', async () => {
    const s = await makeStudent(h.db)
    await placeCourseOrder(h.db, s, input((await course()).id, '0661000002', { address: 'العنوان القديم' }))
    await placeCourseOrder(h.db, s, input((await course()).id, '0661000002', { address: 'العنوان الجديد' }))
    expect((await lastShippingAddress(h.db, s.userId))?.address).toBe('العنوان الجديد')
  })
})

describe('إعفاء هاتف الحساب المؤكَّد من الرمز', () => {
  it('معطَّل افتراضيًا: رمز لكل طلب كما كان', async () => {
    smsChannel()
    expect((await storePolicy(h.db)).skipOtpForVerifiedPhone).toBe(false)
    const s = await verifiedStudent('0771220001')
    await expect(placeCourseOrder(h.db, s, input((await course()).id, '0771220001'))).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    expect((await courseCheckoutData(h.db, s)).skipOtpForVerifiedPhone).toBe(false)
  })

  it('مفعَّل: هاتف الحساب المؤكَّد يُؤكَّد مباشرة، وهاتف آخر يبقى برمز', async () => {
    smsChannel()
    const before = await storePolicy(h.db)
    const next = await setStorePolicy(h.db, admin, { skipOtpForVerifiedPhone: true })
    expect(next).toEqual({ requireOtp: before.requireOtp, skipOtpForVerifiedPhone: true })
    try {
      const s = await verifiedStudent('0771220002')
      const o = await placeCourseOrder(h.db, s, input((await course()).id, '0771220002'))
      expect(o.status).toBe('CONFIRMED')
      const [row] = await h.db.select({ otpVerifiedAt: orders.otpVerifiedAt }).from(orders).where(eq(orders.id, o.id))
      expect(row?.otpVerifiedAt).toBeInstanceOf(Date)
      // هاتف الولي أو رقم آخر: الرمز إلزامي
      await expect(placeCourseOrder(h.db, s, input((await course()).id, '0551220002'))).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
      const code = await requestOtp(h.db, { phone: '0551220002', purpose: 'ORDER', userId: s.userId })
      expect((await placeCourseOrder(h.db, s, input((await course()).id, '0551220002', { otpCode: code.devCode }))).status).toBe('CONFIRMED')
      // هاتف غير مؤكَّد في الحساب: الرمز إلزامي
      const unverified = await makeStudent(h.db)
      await h.db.update(profiles).set({ phone: '0771220003', phoneVerifiedAt: null }).where(eq(profiles.userId, unverified.userId))
      await expect(placeCourseOrder(h.db, unverified, input((await course()).id, '0771220003'))).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    } finally {
      await setStorePolicy(h.db, admin, { skipOtpForVerifiedPhone: false })
    }
  })

  it('الإعداد للمشرف العام فقط', async () => {
    const s = await makeStudent(h.db)
    await expect(setStorePolicy(h.db, s, { skipOtpForVerifiedPhone: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('عدّاد إتمام صفحة الطلب', () => {
  it('بالتلاميذ لا بمرات الفتح، وفي المدة فقط', async () => {
    await h.db.delete(activityLogs)
    const c = await course()
    const a = await makeStudent(h.db)
    const b = await makeStudent(h.db)
    await recordCourseOrderView(h.db, a.userId, c.id)
    await recordCourseOrderView(h.db, a.userId, c.id) // تحديث الصفحة
    await recordCourseOrderView(h.db, b.userId, c.id)
    expect(await courseOrderFunnel(h.db)).toEqual({ days: 7, viewed: 2, placed: 0, pct: 0 })
    await placeCourseOrder(h.db, a, input(c.id, '0661000009'))
    expect(await courseOrderFunnel(h.db)).toEqual({ days: 7, viewed: 2, placed: 1, pct: 50 })
    // بعد ثمانية أيام: خارج المدة
    expect(await courseOrderFunnel(h.db, new Date(Date.now() + 8 * 86_400_000))).toEqual({ days: 7, viewed: 0, placed: 0, pct: null })
  })
})

describe('الواجهة', () => {
  const read = (p: string) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8')

  it('النموذج يُعبّأ من آخر طلب ويتخطى الرمز لهاتف الحساب المؤكَّد، والزر ثابت في الهاتف', () => {
    const form = read('components/academy/course-order-form.tsx')
    expect(form).toContain('address: last?.address')
    expect(form).toContain('const needsOtp = data.smsReady && !payNow && !accountPhoneOk')
    expect(form).toContain('data-order-submit className="sticky')
  })

  it('صفحة الطلب تسجّل الفتح، ولوحة الطلبات تعرض النسبة، والإعداد في الإعدادات', () => {
    expect(read('app/student/courses/[slug]/order/page.tsx')).toContain('recordCourseOrderView(db, actor.userId, course.id)')
    expect(read('app/admin/store/page.tsx')).toContain('إتمام صفحة الطلب')
    expect(read('components/domain/store-sms-settings.tsx')).toContain('setStorePolicyAction({ skipOtpForVerifiedPhone: v })')
  })
})
