/** إضافات الإطلاق: سجلّ رقم الزبون في طابور التأكيد، وسجلّ عمل الموظفين للمشرف. */
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import type { Actor } from '@/server/lib/actor'
import { confirmerStats, createConfirmer, listConfirmerActivity } from '@/server/services/confirmer.service'
import { createProduct, listConfirmationQueue, phoneOrderHistory, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, refIds, setupDb, uniq } from './helpers'

let h: DatabaseHandle
let admin: Actor
let confirmer: Actor
let student: Actor
let bookId: string
let wilayaId: string

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db)
  const employee = await createConfirmer(h.db, admin, { email: uniq('employee') + '@test.dz', password: 'Worker@12345', fullName: 'موظفة التأكيد', phone: '0661234567' })
  confirmer = await actorOf(h.db, employee.userId)
  wilayaId = (await refIds(h.db)).wilayaId!
  bookId = (await createProduct(h.db, admin, { title: 'كتاب تجريبي', type: 'BOOK', priceDzd: 1500, stock: 50, status: 'PUBLISHED' })).id
})
afterAll(async () => { await h?.close() })

const buy = (phone: string) => placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }], customerName: 'زبون', phone, wilayaId, address: 'حي تجريبي', commune: 'Guelma' })

it('الرقم الذي رفض الاستلام سابقاً يظهر بتحذير في طابور التأكيد، والزبون الجديد بلا سجلّ', async () => {
  const refused = await buy('0662000001')
  await setOrderStatus(h.db, admin, refused.id, 'CONFIRMED')
  await setOrderStatus(h.db, admin, refused.id, 'SHIPPED')
  await setOrderStatus(h.db, admin, refused.id, 'RETURNED')
  const again = await buy('0662000001')
  const fresh = await buy('0662000002')

  const queue = await listConfirmationQueue(h.db, confirmer)
  expect(queue.find((o) => o.id === again.id)?.history).toEqual({ delivered: 0, returned: 1, cancelled: 0 })
  expect(queue.find((o) => o.id === fresh.id)?.history).toEqual({ delivered: 0, returned: 0, cancelled: 0 })
})

it('سجلّ الهاتف يعدّ المسلَّم والمرتجع والملغى في استعلام واحد', async () => {
  const delivered = await buy('0662000003')
  await setOrderStatus(h.db, admin, delivered.id, 'CONFIRMED')
  await setOrderStatus(h.db, admin, delivered.id, 'DELIVERED')
  const cancelled = await buy('0662000003')
  await setOrderStatus(h.db, admin, cancelled.id, 'CANCELLED', { reason: 'اختبار' })
  const map = await phoneOrderHistory(h.db, ['0662000003', '0662000003', '0662000999'])
  expect(map.get('0662000003')).toEqual({ delivered: 1, returned: 0, cancelled: 1 })
  expect(map.has('0662000999')).toBe(false)
  expect((await phoneOrderHistory(h.db, [])).size).toBe(0)
})

it('المشرف يرى من أكّد أو ألغى كل طلب ومتى، وعدد ما أنجزه كل موظف', async () => {
  const since = new Date(Date.now() - 60_000)
  const a = await buy('0662000010')
  const b = await buy('0662000011')
  await setOrderStatus(h.db, confirmer, a.id, 'CONFIRMED')
  await setOrderStatus(h.db, confirmer, b.id, 'NO_ANSWER')
  await setOrderStatus(h.db, confirmer, b.id, 'CANCELLED', { reason: 'الزبون لا يريده' })

  const activity = await listConfirmerActivity(h.db, admin)
  expect(activity.slice(0, 3).map((x) => [x.orderNumber, x.from, x.to])).toEqual([
    [b.number, 'NO_ANSWER', 'CANCELLED'],
    [b.number, 'PENDING', 'NO_ANSWER'],
    [a.number, 'PENDING', 'CONFIRMED']
  ])
  expect(activity[0]).toMatchObject({ employee: 'موظفة التأكيد', employeeId: confirmer.userId, reason: 'الزبون لا يريده' })
  // تغييرات المشرف نفسه ليست في سجلّ الموظفين
  expect(activity.every((x) => x.employeeId === confirmer.userId)).toBe(true)

  expect((await confirmerStats(h.db, admin, since)).get(confirmer.userId)).toEqual({ confirmed: 1, cancelled: 1, followUp: 1 })
})

it('سجلّ الموظفين وإحصاءاتهم للمشرف وحده', async () => {
  await expect(listConfirmerActivity(h.db, confirmer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(confirmerStats(h.db, confirmer, new Date(0))).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
