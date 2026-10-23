import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { orders, profiles, students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { setSmsSenderForTests } from '@/server/lib/sms'
import { requestOtp } from '@/server/services/otp.service'
import { createProduct, customerDefaults, placeOrder, setStorePolicy, storePolicy, updateProduct } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, refIds, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let student: Actor
let teacher: Actor
let streamId: string
let wilayaId: string
let limited: string
let streamed: string
let plain: string

const base = { customerName: 'وليّ أمر', phone: '0550000000', address: 'حي السلام', note: null }

beforeAll(async () => {
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async () => undefined })
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  const ids = await refIds(h.db)
  streamId = ids.streamId!
  wilayaId = ids.wilayaId!
  await h.db.update(students).set({ streamId }).where(eq(students.id, student.studentId!))
  limited = (await createProduct(h.db, admin, { title: 'كتاب الدورة', type: 'BOOK', priceDzd: 2500, status: 'PUBLISHED', maxPerOrder: 1 })).id
  streamed = (await createProduct(h.db, admin, { title: 'كتاب موجَّه بالشعبة', type: 'BOOK', priceDzd: 1500, status: 'PUBLISHED', requiresStream: true })).id
  plain = (await createProduct(h.db, admin, { title: 'ملخّص PDF', type: 'PDF', priceDzd: 300, status: 'PUBLISHED' })).id
})

afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('سياسة المتجر: الحدّ بالطلب، الشعبة، التحقق بالهاتف', () => {
  it('المنتج يحمل requiresStream و maxPerOrder (افتراضي 20) ويُعدَّلان؛ التحقق يرفض 0', async () => {
    const p = await createProduct(h.db, admin, { title: 'عادي', priceDzd: 10 })
    expect(p).toMatchObject({ requiresStream: false, maxPerOrder: 20 })
    const u = await updateProduct(h.db, admin, p.id, { requiresStream: true, maxPerOrder: 3 })
    expect(u).toMatchObject({ requiresStream: true, maxPerOrder: 3 })
    await expect(updateProduct(h.db, admin, p.id, { maxPerOrder: 0 })).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('maxPerOrder: تجاوز الحدّ يرفض بـ ORDER_MAX_PER_PRODUCT مع اسم المنتج والحدّ', async () => {
    await expect(placeOrder(h.db, teacher, { ...base, wilayaId, items: [{ productId: limited, qty: 2 }] })).rejects.toMatchObject({ code: 'ORDER_MAX_PER_PRODUCT', details: { product: 'كتاب الدورة', max: 1 } })
    const o = await placeOrder(h.db, teacher, { ...base, wilayaId, items: [{ productId: limited, qty: 1 }] })
    expect(o.totalDzd).toBeGreaterThanOrEqual(2500)
  })

  it('requiresStream: بلا شعبة يُرفض؛ التلميذ يأخذ شعبته افتراضياً؛ شعبة غير موجودة تُرفض', async () => {
    await expect(placeOrder(h.db, teacher, { ...base, wilayaId, items: [{ productId: streamed, qty: 1 }] })).rejects.toMatchObject({ code: 'ORDER_STREAM_REQUIRED' })
    await expect(placeOrder(h.db, teacher, { ...base, wilayaId, items: [{ productId: streamed, qty: 1 }], streamId: '00000000-0000-4000-8000-000000000000' })).rejects.toMatchObject({ code: 'ORDER_STREAM_REQUIRED' })
    const t = await placeOrder(h.db, teacher, { ...base, wilayaId, items: [{ productId: streamed, qty: 1 }], streamId })
    expect(t.streamId).toBe(streamId)
    expect((await customerDefaults(h.db, student)).streamId).toBe(streamId)
    const s = await placeOrder(h.db, student, { ...base, wilayaId, items: [{ productId: streamed, qty: 1 }] })
    expect(s.streamId).toBe(streamId)
  })

  it('beneficiaryStudentId يُحفظ على الطلب', async () => {
    const o = await placeOrder(h.db, teacher, { ...base, items: [{ productId: plain, qty: 1 }], beneficiaryStudentId: student.studentId })
    expect(o.beneficiaryStudentId).toBe(student.studentId)
    expect(o.otpVerifiedAt).toBeNull()
  })

  it('store.requireOtp معطَّل افتراضياً: الطلب يمرّ بلا رمز؛ المشرف وحده يغيّره', async () => {
    expect(await storePolicy(h.db)).toEqual({ requireOtp: false })
    await expect(setStorePolicy(h.db, teacher, { requireOtp: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(await setStorePolicy(h.db, admin, { requireOtp: true })).toEqual({ requireOtp: true })
    expect(await storePolicy(h.db)).toEqual({ requireOtp: true })
  })

  it('requireOtp مفعَّل: يُرفض بلا رمز أو برمز خاطئ، ويُقبل بالصحيح مع otpVerifiedAt', async () => {
    const items = [{ productId: plain, qty: 1 }]
    await expect(placeOrder(h.db, teacher, { ...base, items })).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    const r = await requestOtp(h.db, { phone: base.phone, purpose: 'ORDER', userId: teacher.userId })
    const wrong = r.devCode === '123456' ? '654321' : '123456'
    await expect(placeOrder(h.db, teacher, { ...base, items, otpCode: wrong })).rejects.toMatchObject({ code: 'OTP_INVALID' })
    const before = await h.db.select({ id: orders.id }).from(orders).where(eq(orders.userId, teacher.userId))
    const o = await placeOrder(h.db, teacher, { ...base, items, otpCode: r.devCode! })
    expect(o.otpVerifiedAt).toBeInstanceOf(Date)
    expect(o.phone).toBe(base.phone)
    const after = await h.db.select({ id: orders.id }).from(orders).where(eq(orders.userId, teacher.userId))
    expect(after.length).toBe(before.length + 1)
    // الرمز استُهلك
    await expect(placeOrder(h.db, teacher, { ...base, items, otpCode: r.devCode! })).rejects.toMatchObject({ code: 'OTP_INVALID' })
  })

  it('من أكّد هاتفه في حسابه (نفس الرقم) يُعفى من الرمز', async () => {
    await h.db.update(profiles).set({ phone: '0660000009', phoneVerifiedAt: new Date() }).where(eq(profiles.userId, student.userId))
    const o = await placeOrder(h.db, student, { ...base, phone: '0660000009', items: [{ productId: plain, qty: 1 }] })
    expect(o.otpVerifiedAt).toBeInstanceOf(Date)
    // رقم آخر ⇒ يلزم رمز
    await expect(placeOrder(h.db, student, { ...base, phone: '0660000010', items: [{ productId: plain, qty: 1 }] })).rejects.toMatchObject({ code: 'ORDER_OTP_REQUIRED' })
    await setStorePolicy(h.db, admin, { requireOtp: false })
  })
})
