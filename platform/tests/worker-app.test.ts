/** تطبيق عامل التأكيد — «بحث وتفعيل» (PGlite فقط). */
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { createConfirmer } from '@/server/services/confirmer.service'
import { claimOrders } from '@/server/services/confirm-reservations.service'
import { createProduct, placeOrder, searchOrdersForWorker, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, refIds, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let amina: Actor
let karim: Actor
let student: Actor
let bookId: string
let wilayaId: string

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  wilayaId = (await refIds(h.db)).wilayaId!
  amina = await actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('a') + '@test.dz', password: 'Worker@12345', fullName: 'أمينة', phone: '0661000001' })).userId)
  karim = await actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('k') + '@test.dz', password: 'Worker@12345', fullName: 'كريم', phone: '0661000002' })).userId)
  student = await makeStudent(h.db)
  bookId = (await createProduct(h.db, admin, { title: 'كتاب', type: 'BOOK', priceDzd: 1500, stock: 50, status: 'PUBLISHED' })).id
})
afterAll(async () => { await h?.close() })

const buy = (phone: string) => placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }], customerName: 'زبون', phone, wilayaId, address: 'حي', commune: 'Guelma' })

it('البحث برقم الهاتف (بأي كتابة) أو رقم الطلب، بكل الحالات', async () => {
  const a = await buy('0770111222')
  const b = await buy('0770111222')
  await setOrderStatus(h.db, admin, b.id, 'CONFIRMED')
  for (const q of ['0770111222', '+213 770 11 12 22', '0770-111-222']) expect((await searchOrdersForWorker(h.db, admin, q)).map((o) => o.id).sort()).toEqual([a.id, b.id].sort())
  expect((await searchOrdersForWorker(h.db, admin, a.number)).map((o) => o.id)).toEqual([a.id])
  expect(await searchOrdersForWorker(h.db, admin, '07')).toEqual([])
  expect(await searchOrdersForWorker(h.db, admin, '%%%%')).toEqual([])
})

it('طلب في التأكيد محجوز لزميل لا يظهر للموظف في البحث؛ ما بعد التأكيد يظهر للجميع', async () => {
  const pending = await buy('0550333444')
  const done = await buy('0550333444')
  await setOrderStatus(h.db, admin, done.id, 'CONFIRMED')
  await claimOrders(h.db, amina, 20)
  expect((await searchOrdersForWorker(h.db, amina, '0550333444')).map((o) => o.id)).toContain(pending.id)
  const forKarim = (await searchOrdersForWorker(h.db, karim, '0550333444')).map((o) => o.id)
  expect(forKarim).not.toContain(pending.id)
  expect(forKarim).toContain(done.id)
  expect((await searchOrdersForWorker(h.db, admin, '0550333444')).find((o) => o.id === pending.id)?.reservedById).toBe(amina.userId)
})

it('البحث للموظفين فقط', async () => {
  await expect(searchOrdersForWorker(h.db, student, '0770111222')).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
