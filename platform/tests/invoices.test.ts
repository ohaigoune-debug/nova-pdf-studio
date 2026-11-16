/**
 * الفواتير (قرار المالك 16 نوفمبر 2026): تلقائيًا عند التسليم + يدويًا، يراها المشرف والتلميذ.
 * الترقيم المتسلسل، فاتورة واحدة لكل طلب، الإلغاء عند الإرجاع، والصلاحيات. قاعدة PGlite في الذاكرة.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { invoices, orders, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { transitionOrder } from '@/server/services/order-status.service'
import {
  cancelInvoice,
  createManualInvoice,
  formatInvoiceNumber,
  getInvoiceForViewer,
  invoiceSettings,
  invoiceSummary,
  invoiceYear,
  issueInvoiceForOrder,
  issueMissingInvoices,
  listInvoices,
  listMyInvoices,
  monthRange,
  setInvoiceSettings
} from '@/server/services/invoices.service'
import { createProduct, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let buyer: Actor
let other: Actor
let bookId: string
let wilayaId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function deliveredOrder(student: Actor, name: string) {
  const o = await placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }], customerName: name, phone: '0555112233', wilayaId, address: 'حي 20 أوت' })
  await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
  await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
  await setOrderStatus(h.db, admin, o.id, 'DELIVERED')
  return o
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  buyer = await makeStudent(h.db, 'تلميذ الفاتورة')
  other = await makeStudent(h.db, 'تلميذ آخر')
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).where(eq(wilayas.code, '24')))[0]!.id
  bookId = (await createProduct(h.db, admin, { title: 'كتاب الأدب العربي', type: 'BOOK', priceDzd: 2500, stock: 50, status: 'PUBLISHED' })).id
})

afterAll(async () => {
  await h.close()
})

describe('الترقيم والإعدادات', () => {
  it('الرقم: البادئة-السنة-6 خانات؛ السنة بتوقيت الجزائر؛ حدود الشهر', () => {
    expect(formatInvoiceNumber('F', 2026, 7)).toBe('F-2026-000007')
    expect(invoiceYear(new Date('2026-12-31T23:30:00Z'))).toBe(2027) // 00:30 بتوقيت الجزائر
    const r = monthRange('2026-11')!
    expect(r.from.toISOString()).toBe('2026-10-31T23:00:00.000Z')
    expect(r.to.toISOString()).toBe('2026-11-30T23:00:00.000Z')
    expect(monthRange('2026-13')).toBeNull()
  })

  it('بيانات البائع من اللوحة (المشرف فقط)، والبادئة لاتينية', async () => {
    expect((await invoiceSettings(h.db)).prefix).toBe('F')
    await expectCode(() => setInvoiceSettings(h.db, buyer, { sellerName: 'x' }), 'FORBIDDEN')
    await expect(setInvoiceSettings(h.db, admin, { prefix: 'ف' })).rejects.toSatisfy((e) => e instanceof AppError && e.details?.field === 'prefix')
    const s = await setInvoiceSettings(h.db, admin, { sellerName: 'مدرسة — اختبار', sellerAddress: 'بوسعادة', sellerLegal: 'NIF: 000', prefix: 'mdz' })
    expect(s.prefix).toBe('MDZ')
  })
})

describe('الإصدار التلقائي عند التسليم', () => {
  it('تسليم الطلب يصدر فاتورة واحدة بالاسم والهاتف ورمز الحساب، مجمَّدة البيانات', async () => {
    const o = await deliveredOrder(buyer, 'تلميذ الفاتورة')
    const [inv] = await h.db.select().from(invoices).where(eq(invoices.orderId, o.id))
    expect(inv).toBeTruthy()
    expect(inv!.number).toMatch(/^MDZ-\d{4}-\d{6}$/)
    expect(inv!.customerName).toBe('تلميذ الفاتورة')
    expect(inv!.customerPhone).toBe('0555112233')
    expect(inv!.studentCode).toBe(buyer.userId.slice(0, 8))
    expect(inv!.studentId).toBe(buyer.studentId)
    expect(inv!.lines).toEqual([{ title: 'كتاب الأدب العربي', qty: 1, unitDzd: 2500, totalDzd: 2500 }])
    expect(inv!.subtotalDzd).toBe(2500)
    expect(inv!.totalDzd).toBe(2500 + inv!.shippingDzd)
    expect(inv!.seller.name).toBe('مدرسة — اختبار')
    expect(inv!.paymentMethod).toBe('COD')
    // إعادة «سُلِّم» أو استدعاء مكرّر: الفاتورة نفسها
    await transitionOrder(h.db, o.id, 'DELIVERED', { actorUserId: null, source: 'delivery' })
    expect((await issueInvoiceForOrder(h.db, o.id))!.id).toBe(inv!.id)
    expect(await h.db.select().from(invoices).where(eq(invoices.orderId, o.id))).toHaveLength(1)
    // تغيير الإعدادات لاحقًا لا يمسّ الفاتورة الصادرة
    await setInvoiceSettings(h.db, admin, { sellerName: 'اسم جديد' })
    expect((await getInvoiceForViewer(h.db, admin, inv!.id)).seller.name).toBe('مدرسة — اختبار')
  })

  it('الأرقام متتالية بلا تكرار', async () => {
    const a = await deliveredOrder(other, 'تلميذ آخر')
    const b = await deliveredOrder(other, 'تلميذ آخر')
    const rows = await h.db.select({ seq: invoices.seq, orderId: invoices.orderId }).from(invoices)
    const seqA = rows.find((r) => r.orderId === a.id)!.seq
    const seqB = rows.find((r) => r.orderId === b.id)!.seq
    expect(seqB).toBe(seqA + 1)
    expect(new Set(rows.map((r) => r.seq)).size).toBe(rows.length)
  })

  it('لا فاتورة قبل التسليم؛ والإرجاع يلغيها ويبقى رقمها', async () => {
    const o = await placeOrder(h.db, buyer, { items: [{ productId: bookId, qty: 2 }], customerName: 'تلميذ الفاتورة', phone: '0555112233', wilayaId, address: 'x' })
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    expect(await issueInvoiceForOrder(h.db, o.id)).toBeNull()
    await setOrderStatus(h.db, admin, o.id, 'DELIVERED')
    const [inv] = await h.db.select().from(invoices).where(eq(invoices.orderId, o.id))
    expect(inv!.lines[0]).toMatchObject({ qty: 2, totalDzd: 5000 })
    await setOrderStatus(h.db, admin, o.id, 'RETURNED')
    const [after] = await h.db.select().from(invoices).where(eq(invoices.orderId, o.id))
    expect(after!.status).toBe('CANCELLED')
    expect(after!.number).toBe(inv!.number)
    expect(after!.cancelReason).toContain('إرجاع')
  })

  it('«أصدر الفواتير الناقصة»: طلب سُلِّم قبل الميزة يأخذ فاتورته مرة واحدة', async () => {
    const o = await deliveredOrder(other, 'تلميذ آخر')
    await h.db.delete(invoices).where(eq(invoices.orderId, o.id)) // محاكاة طلب سابق للميزة
    expect((await invoiceSummary(h.db, admin)).missing).toBe(1)
    await expectCode(() => issueMissingInvoices(h.db, buyer), 'FORBIDDEN')
    expect(await issueMissingInvoices(h.db, admin)).toEqual({ issued: 1, remaining: 0 })
    expect(await issueMissingInvoices(h.db, admin)).toEqual({ issued: 0, remaining: 0 })
    const [o2] = await h.db.select().from(orders).where(eq(orders.id, o.id))
    expect(o2!.status).toBe('DELIVERED')
  })
})

describe('الفاتورة اليدوية والإلغاء', () => {
  it('المشرف يصدر فاتورة لتلميذ (الاسم والهاتف من حسابه) أو لزبون باسمه؛ غير المشرف ممنوع', async () => {
    await expectCode(() => createManualInvoice(h.db, buyer, { customerName: 'x', lines: [{ title: 'y', qty: 1, unitDzd: 1 }], paymentMethod: 'CASH' }), 'FORBIDDEN')
    const inv = await createManualInvoice(h.db, admin, { studentId: buyer.studentId, lines: [{ title: 'دورة الأدب العربي — نسخة رقمية', qty: 1, unitDzd: 3900 }], discountDzd: 400, paymentMethod: 'POS', note: 'بيع في مدرسة شريكة' })
    expect(inv.source).toBe('MANUAL')
    expect(inv.customerName).toBe('تلميذ الفاتورة')
    expect(inv.userId).toBe(buyer.userId)
    expect(inv.totalDzd).toBe(3500)
    const walkIn = await createManualInvoice(h.db, admin, { customerName: 'وليّ أمر', customerPhone: '0661000000', lines: [{ title: 'كتاب', qty: 2, unitDzd: 1000 }], shippingDzd: 300, paymentMethod: 'CASH' })
    expect(walkIn.totalDzd).toBe(2300)
    expect(walkIn.studentId).toBeNull()
    await expect(createManualInvoice(h.db, admin, { customerName: 'x', lines: [], paymentMethod: 'CASH' })).rejects.toSatisfy((e) => e instanceof AppError && e.details?.field === 'lines')
    await expect(createManualInvoice(h.db, admin, { customerName: 'x', lines: [{ title: 'y', qty: 1, unitDzd: 100 }], discountDzd: 500, paymentMethod: 'CASH' })).rejects.toSatisfy((e) => e instanceof AppError && e.details?.field === 'discountDzd')
  })

  it('الإلغاء بسبب إلزامي، ولا حذف', async () => {
    const inv = await createManualInvoice(h.db, admin, { customerName: 'خطأ', lines: [{ title: 'سطر', qty: 1, unitDzd: 100 }], paymentMethod: 'CASH' })
    await expect(cancelInvoice(h.db, admin, inv.id, ' ')).rejects.toSatisfy((e) => e instanceof AppError && e.details?.field === 'reason')
    await expectCode(() => cancelInvoice(h.db, buyer, inv.id, 'x'), 'FORBIDDEN')
    const c = await cancelInvoice(h.db, admin, inv.id, 'اسم خاطئ')
    expect(c.status).toBe('CANCELLED')
    expect((await listInvoices(h.db, admin, { status: 'CANCELLED' })).map((r) => r.id)).toContain(inv.id)
  })
})

describe('الاطّلاع والإحصاء', () => {
  it('التلميذ يرى فواتيره فقط؛ المشرف يرى الكل', async () => {
    const mine = await listMyInvoices(h.db, buyer)
    expect(mine.length).toBeGreaterThan(0)
    const othersRows = await h.db.select({ id: invoices.id }).from(invoices).where(eq(invoices.studentId, other.studentId!))
    expect(mine.map((r) => r.id)).not.toContain(othersRows[0]!.id)
    await expectCode(() => getInvoiceForViewer(h.db, buyer, othersRows[0]!.id), 'INVOICE_NOT_FOUND')
    expect((await getInvoiceForViewer(h.db, buyer, mine[0]!.id)).id).toBe(mine[0]!.id)
    expect((await getInvoiceForViewer(h.db, admin, othersRows[0]!.id)).id).toBe(othersRows[0]!.id)
    await expectCode(() => getInvoiceForViewer(h.db, buyer, 'not-a-uuid'), 'INVOICE_NOT_FOUND')
  })

  it('الإحصاء: التلاميذ المسجَّلون، والمداخيل من الفواتير الصادرة فقط', async () => {
    const s = await invoiceSummary(h.db, admin)
    expect(s.registeredStudents).toBe(2)
    const issued = await h.db.select({ total: invoices.totalDzd, status: invoices.status }).from(invoices)
    expect(s.revenueDzd).toBe(issued.filter((r) => r.status === 'ISSUED').reduce((n, r) => n + r.total, 0))
    expect(s.invoices).toBe(issued.filter((r) => r.status === 'ISSUED').length)
    expect(s.cancelled).toBe(issued.filter((r) => r.status === 'CANCELLED').length)
    await expectCode(() => invoiceSummary(h.db, buyer), 'FORBIDDEN')
    expect((await listInvoices(h.db, admin, { q: buyer.userId.slice(0, 8) })).length).toBeGreaterThan(0)
  })
})
