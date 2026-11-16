/**
 * «السعر شامل التوصيل» لكل دورة (قرار المالك 16 نوفمبر 2026): لا يشمل / شامل للمكتب (المنزل يدفع الفرق) / شامل للمنزل.
 * القاعدة الصافية، ثم طلبات حقيقية على PGlite بجدول رسوم EcoTrack: الإجمالي من الخادم في كل حالة.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, courses, orders, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { courseShippingDzd, strongestShippingIncluded } from '@/lib/course-shipping'
import { ECOTRACK_FEES_KEY } from '@/server/services/ecotrack.service'
import { courseQuote, placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

const FEES = { home: 600, desk: 400 }

describe('القاعدة: ما يدفعه التلميذ للتوصيل', () => {
  it('لا يشمل: الرسم كاملًا حسب طريقة الاستلام', () => {
    expect(courseShippingDzd('NONE', FEES, 'HOME')).toBe(600)
    expect(courseShippingDzd('NONE', FEES, 'DESK')).toBe(400)
  })
  it('شامل للمكتب: المكتب مجاني، والمنزل يدفع الفرق فقط', () => {
    expect(courseShippingDzd('DESK', FEES, 'DESK')).toBe(0)
    expect(courseShippingDzd('DESK', FEES, 'HOME')).toBe(200)
    // رسم مكتب أعلى من المنزل (جدول غريب): لا فرق سالب
    expect(courseShippingDzd('DESK', { home: 300, desk: 500 }, 'HOME')).toBe(0)
  })
  it('شامل للمنزل: لا رسم أبدًا', () => {
    expect(courseShippingDzd('HOME', FEES, 'HOME')).toBe(0)
    expect(courseShippingDzd('HOME', FEES, 'DESK')).toBe(0)
  })
  it('طرد بكتب عدة دورات: يسري الخيار الأوسع، وأي قيمة غريبة = لا يشمل', () => {
    expect(strongestShippingIncluded(['NONE', 'DESK'])).toBe('DESK')
    expect(strongestShippingIncluded(['DESK', 'HOME', 'NONE'])).toBe('HOME')
    expect(strongestShippingIncluded([])).toBe('NONE')
    expect(strongestShippingIncluded(['FREE', null])).toBe('NONE')
  })
})

describe('طلبات حقيقية بجدول رسوم الولاية', () => {
  let h: DatabaseHandle
  let admin: Actor
  let workspaceId: string
  let wilayaId: string
  let n = 0

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ التوصيل')
    workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    wilayaId = (await refIds(h.db)).wilayaId!
    const [w] = await h.db.select({ code: wilayas.code }).from(wilayas).where(eq(wilayas.id, wilayaId))
    await h.db.insert(appSettings).values({ key: ECOTRACK_FEES_KEY, value: { syncedAt: new Date().toISOString(), rows: [{ wilayaCode: w!.code.padStart(2, '0'), homeDzd: FEES.home, deskDzd: FEES.desk, returnDzd: 200 }] } })
  })

  afterAll(async () => {
    await h.close()
  })

  async function course(shippingIncluded?: 'NONE' | 'DESK' | 'HOME') {
    const c = await createCourse(h.db, admin, { title: `دورة التوصيل ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
    await setCourseBook(h.db, admin, c.id, { title: `كتاب ${n}`, priceDzd: 5900, stock: null, active: true, shippingIncluded })
    await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
    return c
  }

  const buy = async (courseId: string, deliveryType: 'HOME' | 'DESK') => {
    const s = await makeStudent(h.db, `تلميذ التوصيل ${++n}`)
    return placeCourseOrder(h.db, s, { courseId, phone: `06${String(10000000 + n).slice(-8)}`, wilayaId, address: 'حي النصر', deliveryType } as Parameters<typeof placeCourseOrder>[2])
  }

  it('الدورات الجديدة والقائمة: «لا يشمل» افتراضيًا — لا يتغيّر أي سعر', async () => {
    const c = await course()
    expect((await h.db.select({ v: courses.shippingIncluded }).from(courses).where(eq(courses.id, c.id)))[0]!.v).toBe('NONE')
    const o = await buy(c.id, 'HOME')
    expect([o.shippingDzd, o.totalDzd]).toEqual([600, 6500])
  })

  it('شامل للمنزل: الإجمالي = السعر، منزلًا أو مكتبًا', async () => {
    const c = await course('HOME')
    expect((await courseQuote(h.db, c.id, wilayaId, 'HOME'))!.totalDzd).toBe(5900)
    const home = await buy(c.id, 'HOME')
    const desk = await buy(c.id, 'DESK')
    expect([home.shippingDzd, home.totalDzd, desk.shippingDzd, desk.totalDzd]).toEqual([0, 5900, 0, 5900])
    const [row] = await h.db.select().from(orders).where(eq(orders.id, home.id))
    expect([row!.shippingDzd, row!.totalDzd]).toEqual([0, 5900])
  })

  it('شامل للمكتب: المكتب = السعر، والمنزل = السعر + الفرق (200)', async () => {
    const c = await course('DESK')
    const q = await courseQuote(h.db, c.id, wilayaId, 'HOME')
    expect([q!.shippingDzd, q!.totalDzd, q!.shippingIncluded]).toEqual([200, 6100, 'DESK'])
    const desk = await buy(c.id, 'DESK')
    const home = await buy(c.id, 'HOME')
    expect([desk.totalDzd, home.shippingDzd, home.totalDzd]).toEqual([5900, 200, 6100])
  })

  it('تعديل الخيار من بطاقة الكتاب يسري على الطلبات الجديدة فقط، وحفظ بلا خيار يُبقيه', async () => {
    const c = await course('NONE')
    const before = await buy(c.id, 'HOME')
    await setCourseBook(h.db, admin, c.id, { title: 'كتاب معدَّل', priceDzd: 5900, stock: null, active: true, shippingIncluded: 'HOME' })
    await setCourseBook(h.db, admin, c.id, { title: 'كتاب معدَّل مرة ثانية', priceDzd: 5900, stock: null, active: true })
    expect((await h.db.select({ v: courses.shippingIncluded }).from(courses).where(eq(courses.id, c.id)))[0]!.v).toBe('HOME')
    const after = await buy(c.id, 'HOME')
    expect([before.totalDzd, after.totalDzd]).toEqual([6500, 5900])
    expect((await h.db.select({ t: orders.totalDzd }).from(orders).where(eq(orders.id, before.id)))[0]!.t).toBe(6500)
  })

  it('القاعدة ترفض قيمة غير الثلاث', async () => {
    const c = await course()
    await expect(h.db.update(courses).set({ shippingIncluded: 'FREE' }).where(eq(courses.id, c.id))).rejects.toThrow()
  })
})
