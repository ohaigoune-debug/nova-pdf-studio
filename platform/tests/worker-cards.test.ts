/** بطاقات تطبيق التأكيد (قرار المالك 4 نوفمبر 2026): «تعديل» بيانات الزبون و«تفعيل» طلب الدورة بلمسة. PGlite فقط. */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseEnrollments, orders, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { claimOrders } from '@/server/services/confirm-reservations.service'
import { createConfirmer, listConfirmerActivity } from '@/server/services/confirmer.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { updateOrderCustomer } from '@/server/services/order-edit.service'
import { activateOrderNow, createProduct, listConfirmationQueue, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let amina: Actor
let karim: Actor
let student: Actor
let bookId: string
let wilayaId: string
let otherWilayaId: string
let seq = 0
const phone = () => `0770${String(100000 + ++seq).slice(-6)}`

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  amina = await actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('a') + '@test.dz', password: 'Worker@12345', fullName: 'أمينة', phone: '0661000011' })).userId)
  karim = await actorOf(h.db, (await createConfirmer(h.db, admin, { email: uniq('k') + '@test.dz', password: 'Worker@12345', fullName: 'كريم', phone: '0661000012' })).userId)
  student = await makeStudent(h.db)
  wilayaId = (await refIds(h.db)).wilayaId!
  otherWilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).where(eq(wilayas.code, '25')))[0]!.id
  bookId = (await createProduct(h.db, admin, { title: 'كتاب', type: 'BOOK', priceDzd: 1500, stock: 100, status: 'PUBLISHED' })).id
})
afterAll(async () => { await h?.close() })

const buy = () => placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }], customerName: 'زبون', phone: phone(), wilayaId, address: 'حي قديم', commune: 'Guelma' })

it('الموظف يصحّح الاسم والهاتف والولاية والبلدية والعنوان، مع تدقيق بما تغيّر فقط', async () => {
  const o = await buy()
  await claimOrders(h.db, amina, 10)
  const row = await updateOrderCustomer(h.db, amina, o.id, { customerName: '  محمد   بن علي ', phone: '+213 770 99 88 77', wilayaId: otherWilayaId, commune: 'الخروب', address: 'حي 8 ماي' })
  expect(row).toMatchObject({ customerName: 'محمد بن علي', phone: '0770998877', wilayaId: otherWilayaId, commune: 'الخروب', address: 'حي 8 ماي' })
  // المبلغ لا يتغيّر بتغيّر الولاية
  expect(row.totalDzd).toBe(o.totalDzd)
  const [audit] = await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'store.order_customer'))
  expect(audit!.oldValue).toMatchObject({ customerName: 'زبون', address: 'حي قديم' })
  expect(Object.keys(audit!.newValue as object).sort()).toEqual(['address', 'commune', 'customerName', 'phone', 'wilayaId'])
  // لا شيء تغيّر ⇒ لا سطر تدقيق جديد
  await updateOrderCustomer(h.db, amina, o.id, { address: 'حي 8 ماي' })
  expect((await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'store.order_customer'))).length).toBe(1)
  const queued = (await listConfirmationQueue(h.db, amina)).find((q) => q.id === o.id)!
  expect(queued).toMatchObject({ wilayaId: otherWilayaId, address: 'حي 8 ماي', commune: 'الخروب' })
  const act = (await listConfirmerActivity(h.db, admin, 50)).find((a) => a.kind === 'customer')!
  expect(act.detail).toContain('العنوان')
})

it('هاتف غير جزائري أو اسم فارغ مرفوضان؛ طلب زميل محجوز وطلب مشحون لا يُعدَّلان', async () => {
  const o = await buy()
  await expect(updateOrderCustomer(h.db, admin, o.id, { phone: '0123' })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(updateOrderCustomer(h.db, admin, o.id, { customerName: ' ' })).rejects.toMatchObject({ code: 'VALIDATION' })
  await claimOrders(h.db, karim, 10)
  await expect(updateOrderCustomer(h.db, amina, o.id, { address: 'x' })).rejects.toMatchObject({ code: 'ORDER_RESERVED' })
  await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
  await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
  await expect(updateOrderCustomer(h.db, admin, o.id, { address: 'x' })).rejects.toMatchObject({ code: 'ORDER_LOCKED' })
  await expect(updateOrderCustomer(h.db, student, o.id, { address: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('«تفعيل»: طلب دورة في الطابور يصبح مُسلَّمًا وتُفتح الدورة؛ طلب بلا دورة مرفوض', async () => {
  const teacher = await makeTeacher(h.db, admin, 'أستاذ البطاقات')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const course = await createCourse(h.db, admin, { title: 'دورة تُفعَّل من البطاقة', workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, course.id, { title: 'كتاب الدورة', priceDzd: 2000, stock: 5, active: true })
  await setCourseStatus(h.db, admin, course.id, 'PUBLISHED')
  const buyer = await makeStudent(h.db, 'تلميذ البطاقة')
  const order = await placeCourseOrder(h.db, buyer, { courseId: course.id, phone: phone(), wilayaId, address: 'حي', deliveryType: 'HOME' } as Parameters<typeof placeCourseOrder>[2])
  const done = await activateOrderNow(h.db, amina, order.id)
  expect(done.status).toBe('DELIVERED')
  const enrolled = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))
  expect(enrolled.map((e) => e.studentId)).toEqual([buyer.studentId])
  const plain = await buy()
  await expect(activateOrderNow(h.db, admin, plain.id)).rejects.toMatchObject({ code: 'ORDER_NO_COURSE' })
  expect((await h.db.select({ s: orders.status }).from(orders).where(eq(orders.id, plain.id)))[0]!.s).toBe('PENDING')
  await expect(activateOrderNow(h.db, student, order.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})
