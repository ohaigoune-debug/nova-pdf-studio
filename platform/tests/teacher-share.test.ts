import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { orderItems, orders } from '@/server/db/schema'
import { monthOf } from '@/lib/assistant-pay'
import { DEFAULT_TEACHER_SHARE, cleanTeacherShare, shareOf } from '@/lib/teacher-share'
import type { Actor } from '@/server/lib/actor'
import { createCourse, linkProduct } from '@/server/services/courses.service'
import { platformRevenue } from '@/server/services/platform-revenue.service'
import { createProduct } from '@/server/services/store.service'
import { setTeacherSharePaid, setTeacherShareConfig, teacherDues, teacherShareMonth } from '@/server/services/teacher-share.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

describe('نصيب الأستاذ (قرار المالك 24 نوفمبر 2026)', () => {
  it('بالبطاقة: تُحذف TVA 19% ثمّ 80%؛ بغيرها: 70%', () => {
    const c = DEFAULT_TEACHER_SHARE
    expect(c).toMatchObject({ cardPct: 80, otherPct: 70, vatPct: 19, vatMode: 'SUBTRACT' })
    expect(shareOf(3900, 'ONLINE', c)).toEqual({ baseDzd: 3159, shareDzd: 2527, card: true })
    expect(shareOf(3900, 'COD', c)).toEqual({ baseDzd: 3900, shareDzd: 2730, card: false })
    expect(shareOf(3900, 'TRANSFER', c).shareDzd).toBe(2730)
    expect(shareOf(3900, 'ONLINE', { ...c, vatMode: 'INCLUDED' })).toEqual({ baseDzd: 3277, shareDzd: 2622, card: true })
  })
  it('الإعدادات: نسب بين 0 و100 فقط، والشركاء معرّفات صحيحة', () => {
    const c = cleanTeacherShare({ cardPct: '85', otherPct: 150, vatPct: -1, vatMode: 'X', partners: ['bad', '7f1f2a3b-0000-4000-8000-000000000001'] })
    expect(c).toEqual({ cardPct: 85, otherPct: 70, vatPct: 19, vatMode: 'SUBTRACT', partners: ['7f1f2a3b-0000-4000-8000-000000000001'] })
  })
})

describe('كشف الأستاذ الشريك في قاعدة البيانات', () => {
  let h: DatabaseHandle
  let admin: Actor
  let teacher: Actor
  let other: Actor
  let ws: string
  let courseId: string
  const month = monthOf(new Date())

  async function delivered(productId: string, title: string, price: number, method: 'COD' | 'ONLINE') {
    const buyer = await makeStudent(h.db)
    const [o] = await h.db
      .insert(orders)
      .values({ number: `MD-T-${Math.random().toString(36).slice(2, 8)}`, userId: buyer.userId, status: 'DELIVERED', paymentMethod: method, subtotalDzd: price, shippingDzd: 600, totalDzd: price + 600, customerName: 'تلميذ', phone: '0555000000', deliveredAt: new Date() })
      .returning({ id: orders.id })
    await h.db.insert(orderItems).values({ orderId: o!.id, productId, title, type: 'BOOK', unitPriceDzd: price, qty: 1, lineTotalDzd: price })
    return o!.id
  }

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    teacher = await makeTeacher(h.db, admin, 'أستاذ شريك')
    other = await makeTeacher(h.db, admin, 'أستاذ آخر')
    ws = await workspaceIdOfTeacher(h.db, teacher)
    const course = await createCourse(h.db, admin, { title: 'دورة الرياضيات', workspaceId: ws, season: '2026/2027', priceDzd: 3900, accessEndsOn: '2027-06-30', status: 'DRAFT' })
    const book = await createProduct(h.db, admin, { title: 'كتاب الرياضيات', type: 'BOOK', priceDzd: 3900, stock: 50, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, course.id, book.id)
    courseId = course.id
    await delivered(book.id, 'كتاب الرياضيات', 3900, 'COD')
    await delivered(book.id, 'كتاب الرياضيات', 3900, 'ONLINE')
    const cancelled = await delivered(book.id, 'كتاب الرياضيات', 3900, 'COD')
    await h.db.update(orders).set({ status: 'RETURNED' }).where(eq(orders.id, cancelled))
  })
  afterAll(async () => {
    await h.close()
  })

  it('غير الشريك: لا نصيب، ولا يُطرح من الصافي', async () => {
    const d = await teacherDues(h.db, admin, month)
    const row = d.rows.find((r) => r.workspaceId === ws)!
    expect(row).toMatchObject({ partner: false, salesDzd: 7800, shareDzd: 0, lines: 2 })
    expect((await teacherShareMonth(h.db, teacher, { month })).totalShareDzd).toBe(0)
    expect((await platformRevenue(h.db, admin, month)).teacherDueDzd).toBe(0)
  })

  it('الشريك: 2730 (عند الاستلام) + 2527 (بالبطاقة)، يراه وحده، ويُطرح من الصافي', async () => {
    await expect(setTeacherShareConfig(h.db, teacher, { partners: [ws] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setTeacherShareConfig(h.db, admin, { ...DEFAULT_TEACHER_SHARE, partners: [ws] })
    const m = await teacherShareMonth(h.db, teacher, { month })
    expect(m).toMatchObject({ partner: true, totalShareDzd: 2730 + 2527, card: { grossDzd: 3900, baseDzd: 3159, shareDzd: 2527 }, other: { grossDzd: 3900, shareDzd: 2730 } })
    expect(m.lines).toHaveLength(2)
    await expect(teacherShareMonth(h.db, other, { workspaceId: ws, month })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect((await teacherShareMonth(h.db, other, { month })).totalShareDzd).toBe(0)
    expect((await platformRevenue(h.db, admin, month)).teacherDueDzd).toBe(5257)
  })

  it('«مدفوع» مرّة واحدة بالمبلغ يوم الدفع، ويُلغى', async () => {
    await expect(setTeacherSharePaid(h.db, teacher, ws, month, true)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await setTeacherSharePaid(h.db, admin, ws, month, true)
    await expect(setTeacherSharePaid(h.db, admin, ws, month, true)).rejects.toMatchObject({ code: 'PAYOUT_ALREADY_RECORDED' })
    expect((await teacherShareMonth(h.db, teacher, { month })).payout?.amountDzd).toBe(5257)
    await setTeacherSharePaid(h.db, admin, ws, month, false)
    expect((await teacherShareMonth(h.db, teacher, { month })).payout).toBeNull()
  })

  it('سطر «الدورة الرقمية» بلا منتج يُنسب بدورته (course_id)', async () => {
    const buyer = await makeStudent(h.db)
    const [o] = await h.db
      .insert(orders)
      .values({ number: 'MD-T-COURSE', userId: buyer.userId, status: 'DELIVERED', paymentMethod: 'COD', subtotalDzd: 2000, totalDzd: 2000, customerName: 'تلميذ', phone: '0555000001', deliveredAt: new Date() })
      .returning({ id: orders.id })
    await h.db.insert(orderItems).values({ orderId: o!.id, productId: null, courseId, title: 'الدورة الرقمية', type: 'COURSE', unitPriceDzd: 2000, qty: 1, lineTotalDzd: 2000 })
    expect((await teacherShareMonth(h.db, teacher, { month })).totalShareDzd).toBe(5257 + 1400)
  })
})
