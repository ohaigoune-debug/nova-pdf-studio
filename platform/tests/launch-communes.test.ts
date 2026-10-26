import { eq } from 'drizzle-orm'
import { appSettings, orders, products } from '@/server/db/schema'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { EcotrackClient, _resetEcotrackCaches } from '@/server/lib/ecotrack'
import { courseCommunesForWilaya } from '@/server/services/delivery-communes.service'
import { ECOTRACK_SETTINGS_KEY, saveEcotrackSettings } from '@/server/services/ecotrack.service'
import { placeCourseOrder, setCourseBook, courseBookStateById } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { myTrackedOrders, trackByPhone } from '@/server/services/order-tracking.service'
import { createProduct, getOrder, listOrdersAdmin, placeOrder } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let orderId: string
let wilayaId: string
let workspaceId: string
const phone = '0555123456'
const commune = 'Ain Ben Beida'
let calls: string[] = []
const ecoFetch: typeof fetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input))
  calls.push(url.pathname)
  const body = url.pathname.endsWith('/get/wilayas') ? { '24': { id: 24, nom: 'Guelma' } } : {
    '1': { id: 1, nom: 'Guelma', wilaya_id: 24, has_stop_desk: 1 },
    '2': { id: 2, nom: commune, wilaya_id: 24, has_stop_desk: 0 },
    '3': { id: 3, nom: 'Constantine', wilaya_id: 25, stop_desk: 1 }
  }
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}) as typeof fetch

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin))
  wilayaId = (await refIds(h.db)).wilayaId!
  const book = await createProduct(h.db, admin, { title: 'كتاب البلدية', type: 'BOOK', priceDzd: 1200, stock: 10, status: 'PUBLISHED' })
  const o = await placeOrder(h.db, student, { items: [{ productId: book.id, qty: 1 }], customerName: student.fullName, phone, wilayaId, commune, address: 'حي تجريبي' })
  orderId = o.id
})
afterAll(async () => { await h.close() })
beforeEach(async () => { calls = []; _resetEcotrackCaches(); await h.db.delete(appSettings).where(eq(appSettings.key, ECOTRACK_SETTINGS_KEY)) })

describe('بلديات الطلب: بيانات الناقل وعرض العنوان', () => {
  it('communesOf تعيد البلديات والمكتب الصحيح وتعيد استعمال cache بين الولاية وحل البلدية', async () => {
    const client = new EcotrackClient({ baseUrl: 'communes-test.ecotrack.dz', apiToken: 'local-test-token' }, ecoFetch)
    expect(await client.communesOf('24')).toEqual([{ name: 'Guelma', hasDesk: true }, { name: commune, hasDesk: false }])
    expect(await client.communesOf('25')).toEqual([{ name: 'Constantine', hasDesk: true }])
    expect(await client.resolveCommune('24', commune)).toEqual({ id: '2', nom: commune })
    expect(calls.filter((p) => p.endsWith('/get/communes'))).toHaveLength(1)
  })

  it('قائمة الإدارة وتفاصيل الطلب تحتفظان بالبلدية بجانب الولاية', async () => {
    const rows = await listOrdersAdmin(h.db, admin)
    expect(rows.find((o) => o.id === orderId)).toMatchObject({ wilayaName: 'قالمة', commune })
    expect((await getOrder(h.db, student, orderId)).order).toMatchObject({ wilayaName: 'قالمة', commune })
  })

  it('طلباتي تحمل البلدية والولاية والتتبع العام بالهاتف لا يكشف الموقع', async () => {
    expect((await myTrackedOrders(h.db, student)).find((o) => o.id === orderId)).toMatchObject({ wilayaName: 'قالمة', commune })
    const publicOrder = (await trackByPhone(h.db, phone)).find((o) => o.id === orderId)
    expect(publicOrder?.commune ?? null).toBeNull()
    expect(publicOrder?.wilayaName ?? null).toBeNull()
  })
})

async function configure(fetchImpl: typeof fetch = ecoFetch) {
  await saveEcotrackSettings(h.db, admin, { baseUrl: 'communes-lookup.ecotrack.dz', apiToken: 'lookup-test-token', enabled: true, autoSend: false }, fetchImpl)
}

async function paidCourse() {
  const c = await createCourse(h.db, admin, { title: uniq('دورة بلديات'), workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: 'كتاب مرفق', priceDzd: 1800, stock: 5, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return { ...c, bookId: (await courseBookStateById(h.db, c.id)).book!.id }
}

const buy = (courseId: string, name: string, deliveryType: 'HOME' | 'DESK', fetchImpl: typeof fetch = ecoFetch) => placeCourseOrder(h.db, student, {
  courseId, phone, wilayaId, commune: name, address: 'عنوان البلديات', deliveryType
}, fetchImpl)

describe('قائمة البلديات والبديل النصي على الخادم', () => {
  it('عند غياب EcoTrack يعود البديل النصي بلا أي طلب شبكة', async () => {
    const noFetch: typeof fetch = async () => { throw new Error('network must not be called') }
    expect(await courseCommunesForWilaya(h.db, wilayaId, noFetch)).toEqual({ mode: 'manual', communes: [] })
    expect(calls).toHaveLength(0)
    const c = await paidCourse()
    const result = await buy(c.id, 'بلدية مكتوبة يدويًا', 'HOME', noFetch)
    expect((await getOrder(h.db, student, result.id)).order.commune).toBe('بلدية مكتوبة يدويًا')
  })

  it('القائمة من EcoTrack تخص الولاية وتستخدم الذاكرة المؤقتة', async () => {
    await configure()
    const result = await courseCommunesForWilaya(h.db, wilayaId, ecoFetch)
    expect(result).toEqual({ mode: 'select', communes: [{ name: 'Guelma', hasDesk: true }, { name: commune, hasDesk: false }] })
    expect(await courseCommunesForWilaya(h.db, wilayaId, ecoFetch)).toEqual(result)
    expect(calls.filter((p) => p.endsWith('/get/communes'))).toHaveLength(1)
  })

  it('فشل طلب البلديات يعيد بديلًا نصيًا ولا يسرّب رسالة المزوّد', async () => {
    await configure()
    const failedFetch: typeof fetch = async () => new Response('private provider error', { status: 500 })
    expect(await courseCommunesForWilaya(h.db, wilayaId, failedFetch)).toEqual({ mode: 'manual', communes: [] })
    const c = await paidCourse()
    const result = await buy(c.id, 'بلدية يدوية عند العطل', 'HOME', failedFetch)
    expect((await getOrder(h.db, student, result.id)).order.commune).toBe('بلدية يدوية عند العطل')
  })

  it('طلب المكتب لبلدية بلا مكتب أو بلدية خارج الولاية يُرفض قبل حجز المخزون', async () => {
    await configure()
    const c = await paidCourse()
    const before = (await h.db.select().from(products).where(eq(products.id, c.bookId)))[0]!.stock
    const ordersBefore = await h.db.select().from(orders).where(eq(orders.beneficiaryStudentId, student.studentId!))
    await expect(buy(c.id, commune, 'DESK')).rejects.toMatchObject({ code: 'VALIDATION', details: { field: 'deliveryType' } })
    await expect(buy(c.id, 'Constantine', 'HOME')).rejects.toMatchObject({ code: 'VALIDATION', details: { field: 'commune' } })
    expect((await h.db.select().from(products).where(eq(products.id, c.bookId)))[0]!.stock).toBe(before)
    expect(await h.db.select().from(orders).where(eq(orders.beneficiaryStudentId, student.studentId!))).toHaveLength(ordersBefore.length)
    const result = await buy(c.id, 'Guelma', 'DESK')
    expect((await getOrder(h.db, student, result.id)).order).toMatchObject({ commune: 'Guelma', deliveryType: 'DESK' })
  })

  it('رموز حسابين لها النهاية نفسها لا تشارك cache البلديات', async () => {
    const otherFetch: typeof fetch = async () => new Response(JSON.stringify({ '9': { id: 9, nom: 'Other merchant commune', wilaya_id: 24, has_stop_desk: 0 } }), { headers: { 'content-type': 'application/json' } })
    const first = new EcotrackClient({ baseUrl: 'same-host.ecotrack.dz', apiToken: 'merchant-one-abcdefgh' }, ecoFetch)
    const second = new EcotrackClient({ baseUrl: 'same-host.ecotrack.dz', apiToken: 'merchant-two-abcdefgh' }, otherFetch)
    expect(await first.communesOf('24')).toHaveLength(2)
    expect(await second.communesOf('24')).toEqual([{ name: 'Other merchant commune', hasDesk: false }])
  })
})
