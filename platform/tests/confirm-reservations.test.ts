/** حجز طابور التأكيد بين الموظفين (قرار المالك 2 نوفمبر 2026): PGlite فقط. */
import { readFileSync } from 'node:fs'
import { eq, inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createConfirmer } from '@/server/services/confirmer.service'
import { claimOrders, queueSummary, releaseOrders, reservationPolicy, setReservationPolicy } from '@/server/services/confirm-reservations.service'
import { adjustOrderAmount, banOrderCustomer, changeOrderStream } from '@/server/services/order-edit.service'
import { createProduct, listConfirmationQueue, listOrdersAdmin, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, refIds, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let amina: Actor
let karim: Actor
let bookId: string
let wilayaId: string
let streamId: string
let n = 0
const HOUR = 3_600_000

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  const ids = await refIds(h.db)
  wilayaId = ids.wilayaId!
  streamId = ids.streamId!
  const mk = async (name: string) => actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('conf') + '@test.dz', password: 'Worker@12345', fullName: name, phone: `+21366${String(1000000 + ++n).slice(-7)}` })).userId)
  amina = await mk('أمينة')
  karim = await mk('كريم')
  bookId = (await createProduct(h.db, admin, { title: 'كتاب الحجز', type: 'BOOK', priceDzd: 1500, stock: 500, status: 'PUBLISHED' })).id
})
afterAll(async () => { await h?.close() })

/** كل اختبار يبدأ بطابور فارغ وسياسة افتراضية */
beforeEach(async () => {
  await h.db.update(orders).set({ status: 'CANCELLED', reservedByUserId: null, reservedAt: null, reservedUntil: null }).where(inArray(orders.status, ['PENDING', 'NO_ANSWER', 'CALL_LATER']))
  await setReservationPolicy(h.db, admin, { enabled: true, holdMinutes: 120, maxHeld: 20 })
})

async function newOrders(count: number): Promise<string[]> {
  const ids: string[] = []
  for (let i = 0; i < count; i++) {
    const s = await makeStudent(h.db, `زبون ${++n}`)
    const o = await placeOrder(h.db, s, { items: [{ productId: bookId, qty: 1 }], customerName: `زبون ${n}`, phone: `05${String(10000000 + n).slice(-8)}`, wilayaId, address: 'حي تجريبي', commune: 'Guelma' })
    ids.push(o.id)
  }
  return ids
}
const queueIds = async (a: Actor, now?: Date) => (await listConfirmationQueue(h.db, a, now)).map((o) => o.id)

describe('حجز طابور التأكيد', () => {
  it('السياسة الافتراضية مفعّلة: الطابور فارغ للموظف حتى يحجز، والحجز يأخذ الأقدم أولًا', async () => {
    expect(await reservationPolicy(h.db)).toEqual({ enabled: true, holdMinutes: 120, maxHeld: 20 })
    const ids = await newOrders(12)
    expect(await queueIds(amina)).toEqual([])
    const r = await claimOrders(h.db, amina, 10)
    expect(r).toMatchObject({ claimed: 10, held: 10 })
    expect(await queueIds(amina)).toEqual(ids.slice(0, 10))
    const s = await queueSummary(h.db, amina)
    expect(s).toMatchObject({ free: 2, mine: 10 })
    expect(await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'store.queue_claim'))).not.toHaveLength(0)
  })

  it('ما يحجزه موظف يختفي من زميله (الطابور وكل الطلبات)، والمشرف يرى الكل ومن حجز', async () => {
    const ids = await newOrders(4)
    await claimOrders(h.db, amina, 10)
    expect(await queueIds(karim)).toEqual([])
    const karimAll = (await listOrdersAdmin(h.db, karim)).map((o) => o.id)
    for (const id of ids) expect(karimAll).not.toContain(id)
    expect((await listOrdersAdmin(h.db, amina)).map((o) => o.id)).toEqual(expect.arrayContaining(ids))
    const adminQueue = await listConfirmationQueue(h.db, admin)
    expect(adminQueue.filter((o) => ids.includes(o.id)).every((o) => o.reservedById === amina.userId && o.reservedByName === 'أمينة' && o.reservedUntil instanceof Date)).toBe(true)
    const s = await queueSummary(h.db, admin)
    expect(s.byConfirmer).toEqual([expect.objectContaining({ userId: amina.userId, name: 'أمينة', held: 4 })])
  })

  it('حجزان في اللحظة نفسها لا يتقاطعان', async () => {
    await newOrders(16)
    const [a, k] = await Promise.all([claimOrders(h.db, amina, 10), claimOrders(h.db, karim, 10)])
    expect(a.claimed + k.claimed).toBe(16)
    const mine = new Set(await queueIds(amina))
    for (const id of await queueIds(karim)) expect(mine.has(id)).toBe(false)
  })

  it('الحد الأقصى: لا يحجز فوقه، وما أنهاه يُفسح مكانًا', async () => {
    await setReservationPolicy(h.db, admin, { maxHeld: 12 })
    const ids = await newOrders(20)
    expect((await claimOrders(h.db, amina, 20)).claimed).toBe(12)
    await expect(claimOrders(h.db, amina, 10)).rejects.toMatchObject({ code: 'RESERVATION_LIMIT' })
    for (const id of ids.slice(0, 3)) await setOrderStatus(h.db, amina, id, 'CONFIRMED')
    expect((await claimOrders(h.db, amina, 10)).claimed).toBe(3)
  })

  it('الجديدة أولًا، ثم «لا يردّ» الأقدم اتصالًا', async () => {
    const [old, fresh] = await newOrders(2)
    await setOrderStatus(h.db, admin, old!, 'NO_ANSWER')
    await setReservationPolicy(h.db, admin, { maxHeld: 1 })
    await claimOrders(h.db, amina, 10)
    expect(await queueIds(amina)).toEqual([fresh])
  })

  it('لا إجراء على طلب محجوز لزميل؛ والمشرف غير مقيَّد', async () => {
    const [id] = await newOrders(1)
    await claimOrders(h.db, amina, 10)
    await expect(setOrderStatus(h.db, karim, id!, 'CONFIRMED')).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    await expect(setOrderStatus(h.db, karim, id!, 'NO_ANSWER')).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    await expect(changeOrderStream(h.db, karim, id!, streamId)).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    await expect(adjustOrderAmount(h.db, karim, id!, { shippingDzd: 0, reason: 'تخفيض' })).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    await expect(banOrderCustomer(h.db, karim, id!, 'زبون وهمي')).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    expect((await h.db.select().from(orders).where(eq(orders.id, id!)))[0]!.status).toBe('PENDING')
    expect((await setOrderStatus(h.db, amina, id!, 'NO_ANSWER')).status).toBe('NO_ANSWER')
    expect((await setOrderStatus(h.db, admin, id!, 'CONFIRMED')).status).toBe('CONFIRMED')
  })

  it('إجراء على طلب غير محجوز (من «كل الطلبات») يحجزه لصاحبه تلقائيًّا', async () => {
    const [id] = await newOrders(1)
    expect((await setOrderStatus(h.db, karim, id!, 'CALL_LATER')).status).toBe('CALL_LATER')
    expect(await queueIds(karim)).toEqual([id])
    await expect(setOrderStatus(h.db, amina, id!, 'CONFIRMED')).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
    expect((await claimOrders(h.db, amina, 10)).claimed).toBe(0)
  })

  it('الحجز المنتهي يعود إلى الطابور العام ويأخذه غيره', async () => {
    const [id] = await newOrders(1)
    await claimOrders(h.db, amina, 10)
    await setOrderStatus(h.db, amina, id!, 'NO_ANSWER')
    expect(await queueIds(amina)).toEqual([id])
    const later = new Date(Date.now() + 3 * HOUR)
    expect(await queueIds(amina, later)).toEqual([])
    expect((await queueSummary(h.db, karim, later)).free).toBe(1)
    expect((await claimOrders(h.db, karim, 10, later)).claimed).toBe(1)
    expect(await queueIds(karim, later)).toEqual([id])
  })

  it('الإعادة: الموظف يعيد طلبًا أو كل حجوزاته، ولا يمسّ حجوزات زميله؛ المشرف يفكّ حجوزات موظف', async () => {
    const ids = await newOrders(6)
    await setReservationPolicy(h.db, admin, { maxHeld: 3 })
    await claimOrders(h.db, amina, 10)
    await claimOrders(h.db, karim, 10)
    const a = await queueIds(amina)
    const k = await queueIds(karim)
    expect([...a, ...k].sort()).toEqual([...ids].sort())
    expect(await releaseOrders(h.db, amina, { orderIds: [k[0]!] })).toBe(0)
    expect(await releaseOrders(h.db, amina, { orderIds: [a[0]!] })).toBe(1)
    expect(await queueIds(amina)).toEqual(a.slice(1))
    expect(await releaseOrders(h.db, amina, {})).toBe(2)
    expect(await queueIds(amina)).toEqual([])
    expect(await releaseOrders(h.db, admin, { forUserId: karim.userId })).toBe(3)
    expect((await queueSummary(h.db, admin)).byConfirmer).toEqual([])
    expect((await queueSummary(h.db, admin)).free).toBe(6)
  })

  it('المشرف يعطّل الحجز فيعود الطابور مشتركًا؛ والإعدادات له وحده وبحدود', async () => {
    const ids = await newOrders(2)
    await setReservationPolicy(h.db, admin, { enabled: false })
    expect(await queueIds(amina)).toEqual(ids)
    expect(await queueIds(karim)).toEqual(ids)
    await expect(claimOrders(h.db, amina, 10)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await setOrderStatus(h.db, karim, ids[0]!, 'CONFIRMED')).status).toBe('CONFIRMED')
    await expect(setReservationPolicy(h.db, amina, { enabled: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(setReservationPolicy(h.db, admin, { holdMinutes: 5 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(setReservationPolicy(h.db, admin, { maxHeld: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(claimOrders(h.db, admin, 10)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(claimOrders(h.db, amina, 15)).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('الطلب المدفوع إلكترونيًّا لا يُحجز (لا ينتظر اتصالًا)', async () => {
    const [id] = await newOrders(1)
    await h.db.update(orders).set({ paymentMethod: 'ONLINE' }).where(eq(orders.id, id!))
    expect((await claimOrders(h.db, amina, 10)).claimed).toBe(0)
  })

  it('التراجع عن 0042 يزيل الأعمدة', async () => {
    const tmp = await setupDb()
    await tmp.db.execute(sql.raw(readFileSync('drizzle/down/0042_confirm_reservations.down.sql', 'utf8')))
    const cols = (await tmp.db.execute(sql`select column_name from information_schema.columns where table_name = 'orders' and column_name like 'reserved%'`)) as unknown as { rows: unknown[] }
    expect(cols.rows).toEqual([])
    await tmp.close()
  })
})
