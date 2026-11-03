/**
 * «طلباتي» و«الدعم والشكاوى» في تطبيق الآيفون (Build 15، 3 نوفمبر 2026).
 * الطلبات للتتبّع فقط: لا سعر ولا دفع ولا إيصال ولا إلغاء ولا عنوان. والتذاكر بلا الملاحظات الداخلية ولا «طلب شراء».
 */
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { createProduct, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { replyTicket } from '@/server/services/support.service'
import { GET as ordersRoute } from '@/app/api/v1/ios/orders/route'
import { GET as ticketsRoute, POST as openRoute } from '@/app/api/v1/ios/support/route'
import { GET as ticketRoute } from '@/app/api/v1/ios/support/[id]/route'
import { POST as replyRoute } from '@/app/api/v1/ios/support/[id]/reply/route'
import { POST as closeRoute } from '@/app/api/v1/ios/support/[id]/close/route'
import { makeAdmin, makeStudent, refIds, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let admin: Actor
let student: Actor
let other: Actor
let cookie: string
let otherCookie: string
let orderId: string

const url = (path: string) => `https://madrasadz.com/api/v1/ios/${path}`
const get = (path: string, c?: string) => new NextRequest(url(path), c ? { headers: { cookie: c } } : undefined)
const post = (path: string, body: unknown, c: string, ios = true) =>
  new NextRequest(url(path), { method: 'POST', headers: { 'content-type': 'application/json', cookie: c, ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify(body) })
const params = (id: string) => ({ params: Promise.resolve({ id }) })
const cookieOf = async (a: Actor) => `${SESSION_COOKIE}=${(await createSession(h.db, { userId: a.userId })).token}`

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db, 'أمينة بن سالم')
  other = await makeStudent(h.db, 'كريم')
  cookie = await cookieOf(student)
  otherCookie = await cookieOf(other)
  const { wilayaId } = await refIds(h.db)
  const book = await createProduct(h.db, admin, { title: 'كتاب الرياضيات', type: 'BOOK', priceDzd: 1750, stock: 50, status: 'PUBLISHED' })
  const o = await placeOrder(h.db, student, { items: [{ productId: book.id, qty: 2 }], customerName: 'أمينة بن سالم', phone: '0661234567', wilayaId: wilayaId!, address: 'حي النصر عمارة 3', commune: 'Guelma' })
  orderId = o.id
  await setOrderStatus(h.db, admin, o.id, 'NO_ANSWER')
})
afterAll(async () => h?.close())

describe('طلباتي في التطبيق', () => {
  it('يتطلّب الدخول', async () => {
    expect((await ordersRoute(get('orders'))).status).toBe(401)
  })

  it('الحالة والمراحل والعنوان المختصر فقط — لا سعر ولا دفع ولا إلغاء ولا عنوان', async () => {
    const res = await ordersRoute(get('orders', cookie))
    expect(res.status).toBe(200)
    expect(res.headers.get('x-madrasadz-account')).toBe(student.userId)
    const raw = await res.text()
    const { data } = JSON.parse(raw)
    expect(data.orders).toHaveLength(1)
    const o = data.orders[0]
    expect(o).toMatchObject({ id: orderId, status: 'NO_ANSWER', statusText: 'بانتظار التأكيد', items: 'كتاب الرياضيات ×2', trackingId: null })
    expect(o.timeline[0]).toMatchObject({ label: 'استُلم الطلب', tone: 'done' })
    expect(Object.keys(o).sort()).toEqual(['createdAt', 'deliveryProvider', 'id', 'items', 'number', 'status', 'statusText', 'timeline', 'trackingId'])
    for (const banned of ['1750', '3500', 'totalDzd', 'receipt', 'canCancel', 'حي النصر', 'Guelma', 'دفع', 'دج']) expect(raw).not.toContain(banned)
  })

  it('طلبات تلميذ آخر لا تظهر', async () => {
    const { data } = await (await ordersRoute(get('orders', otherCookie))).json()
    expect(data.orders).toEqual([])
  })
})

describe('الدعم والشكاوى في التطبيق', () => {
  let ticketId: string

  it('فتح تذكرة: ترويسة التطبيق إلزامية، و«طلب شراء» غير متاح', async () => {
    expect((await openRoute(post('support', { kind: 'TECHNICAL', subject: 'الفيديو لا يعمل', body: 'يتوقف بعد دقيقة' }, cookie, false))).status).toBe(403)
    const order = await openRoute(post('support', { kind: 'ORDER', subject: 'طلب', body: 'تفاصيل' }, cookie))
    expect(order.status).toBe(422)
    const short = await openRoute(post('support', { kind: 'OTHER', subject: 'ا', body: 'تفاصيل' }, cookie))
    expect(short.status).toBe(422)
    const res = await openRoute(post('support', { kind: 'DELIVERY', subject: 'تأخّر كتابي', body: 'لم يصلني الكتاب بعد', orderId }, cookie))
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.number).toBeGreaterThan(0)
    ticketId = data.id
  })

  it('لا يربط التذكرة بطلب تلميذ آخر', async () => {
    const res = await openRoute(post('support', { kind: 'DELIVERY', subject: 'طلب ليس لي', body: 'تجربة', orderId }, otherCookie))
    expect(res.status).toBe(404)
  })

  it('القائمة والمحادثة: ردّ الفريق باسم «فريق مدرسة» والملاحظة الداخلية لا تصل', async () => {
    await replyTicket(h.db, admin, ticketId, 'الكتاب عند شركة التوصيل، يصلك غدًا', {})
    await replyTicket(h.db, admin, ticketId, 'ملاحظة داخلية: اتصل بالموزّع', { internal: true })
    const list = await (await ticketsRoute(get('support', cookie))).json()
    expect(list.data.tickets[0]).toMatchObject({ id: ticketId, kind: 'DELIVERY', status: 'WAITING_USER', messages: 2 })
    const res = await ticketRoute(get(`support/${ticketId}`, cookie), params(ticketId))
    const raw = await res.text()
    expect(raw).not.toContain('ملاحظة داخلية')
    const { data } = JSON.parse(raw)
    expect(data.messages).toHaveLength(2)
    expect(data.messages[0]).toMatchObject({ mine: true, staff: false })
    expect(data.messages[1]).toMatchObject({ mine: false, staff: true, author: null, body: 'الكتاب عند شركة التوصيل، يصلك غدًا' })
    expect(data.orderNumber).toBeTruthy()
  })

  it('تلميذ آخر لا يرى التذكرة ولا يردّ عليها', async () => {
    expect((await ticketRoute(get(`support/${ticketId}`, otherCookie), params(ticketId))).status).toBe(404)
    expect((await replyRoute(post(`support/${ticketId}/reply`, { body: 'تجربة' }, otherCookie), params(ticketId))).status).toBe(404)
  })

  it('الردّ يعيد التذكرة مفتوحة، والإغلاق يمنع ردودًا جديدة', async () => {
    const r = await replyRoute(post(`support/${ticketId}/reply`, { body: 'شكرًا، وصلني' }, cookie), params(ticketId))
    expect(r.status).toBe(200)
    let { data } = await (await ticketRoute(get(`support/${ticketId}`, cookie), params(ticketId))).json()
    expect(data.status).toBe('OPEN')
    expect((await closeRoute(post(`support/${ticketId}/close`, {}, cookie), params(ticketId))).status).toBe(200)
    ;({ data } = await (await ticketRoute(get(`support/${ticketId}`, cookie), params(ticketId))).json())
    expect(data.status).toBe('CLOSED')
    const after = await replyRoute(post(`support/${ticketId}/reply`, { body: 'سؤال آخر' }, cookie), params(ticketId))
    expect((await after.json()).error.code).toBe('TICKET_CLOSED')
  })
})
