import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { downloads, notifications, orders, products, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { uploadFile } from '@/server/services/files.service'
import { attachProductFile, createProduct, deleteProduct, downloadUrl, getOrder, getProduct, listOrdersAdmin, listProducts, listProductsAdmin, myOrders, placeOrder, setOrderStatus, slugify, storeStats, updateProduct } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let other: Actor
let book: string
let pdf: string
let freePdf: string
let wilayaId: string

beforeAll(async () => {
  h = await setupDb()
  process.env.UPLOADS_DIR = await mkdtemp(path.join(tmpdir(), 'store-uploads-'))
  process.env.STORE_SHIPPING_DZD = '400'
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  other = await makeStudent(h.db, 'تلميذ آخر')
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).limit(1))[0]!.id
  book = (await createProduct(h.db, admin, { title: 'كتاب البلاغة للسنة الثالثة', type: 'BOOK', priceDzd: 1200, comparePriceDzd: 1500, stock: 2, status: 'PUBLISHED', author: 'أ. حيقون' })).id
  pdf = (await createProduct(h.db, admin, { title: 'ملخّص النحو PDF', type: 'PDF', priceDzd: 300, status: 'PUBLISHED' })).id
  freePdf = (await createProduct(h.db, admin, { title: 'نماذج بكالوريا مجانية', type: 'PDF', priceDzd: 0, status: 'PUBLISHED' })).id
  await createProduct(h.db, admin, { title: 'مسودة', type: 'BOOK', priceDzd: 100 })
  const f1 = await uploadFile(h.db, admin, { originalName: 'nahw.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 nahw') })
  const f2 = await uploadFile(h.db, admin, { originalName: 'bac.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 bac') })
  await attachProductFile(h.db, admin, pdf, f1.id, 'الملخّص')
  await attachProductFile(h.db, admin, freePdf, f2.id, null)
})

afterAll(async () => {
  delete process.env.STORE_SHIPPING_DZD
  await h.close()
})

describe('متجر الكتب — المرحلة 10', () => {
  it('المنتجات: إنشاء بمعرّف فريد، نشر، عرض عام للمنشور فقط، تعديل، حذف', async () => {
    expect(slugify('كتاب البلاغة للسنة الثالثة')).toBe('كتاب-البلاغه-للسنه-الثالثه')
    const dup = await createProduct(h.db, admin, { title: 'كتاب البلاغة للسنة الثالثة', priceDzd: 10 })
    expect(dup.slug).toBe('كتاب-البلاغه-للسنه-الثالثه-2')
    await expect(createProduct(h.db, teacher, { title: 'x', priceDzd: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(createProduct(h.db, admin, { title: 'x', priceDzd: -1 })).rejects.toMatchObject({ code: 'VALIDATION' })
    const pub = await listProducts(h.db)
    expect(pub.map((p) => p.title).sort()).toEqual(['كتاب البلاغة للسنة الثالثة', 'ملخّص النحو PDF', 'نماذج بكالوريا مجانية'])
    expect(pub.find((p) => p.id === book)).toMatchObject({ physical: true, digital: false, inStock: true, priceDzd: 1200, comparePriceDzd: 1500 })
    expect((await listProducts(h.db, { type: 'PDF' })).map((p) => p.id).sort()).toEqual([pdf, freePdf].sort())
    expect((await listProducts(h.db, { q: 'حيقون' })).map((p) => p.id)).toEqual([book])
    const detail = await getProduct(h.db, 'ملخص-النحو-pdf')
    expect(detail.files).toHaveLength(1)
    expect(detail.files[0]).toMatchObject({ label: 'الملخّص', name: 'nahw.pdf' })
    await expect(getProduct(h.db, 'مسوده')).rejects.toMatchObject({ code: 'PRODUCT_NOT_FOUND' })
    await updateProduct(h.db, admin, dup.id, { title: 'نسخة محدّثة', status: 'PUBLISHED' })
    expect((await listProducts(h.db)).some((p) => p.title === 'نسخة محدّثة')).toBe(true)
    await deleteProduct(h.db, admin, dup.id)
    expect((await listProducts(h.db)).some((p) => p.title === 'نسخة محدّثة')).toBe(false)
    expect((await listProductsAdmin(h.db, admin)).length).toBe(4)
  })

  it('طلب مادي: الدفع عند الاستلام، الشحن، خصم المخزون، إشعار المشرف، ثم تأكيد ← شحن ← تسليم', async () => {
    await expect(placeOrder(h.db, student, { items: [], customerName: 'محمد', phone: '0555555555' })).rejects.toMatchObject({ code: 'ORDER_EMPTY' })
    await expect(placeOrder(h.db, student, { items: [{ productId: book, qty: 1 }], customerName: 'محمد', phone: '12345' })).rejects.toMatchObject({ code: 'VALIDATION' })
    await expect(placeOrder(h.db, student, { items: [{ productId: book, qty: 1 }], customerName: 'محمد', phone: '0555555555' })).rejects.toMatchObject({ code: 'VALIDATION', details: { field: 'wilayaId' } })
    await expect(placeOrder(h.db, student, { items: [{ productId: book, qty: 3 }], customerName: 'محمد', phone: '0555555555', wilayaId, address: 'حي السلام' })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' })
    const o = await placeOrder(h.db, student, { items: [{ productId: book, qty: 1 }, { productId: pdf, qty: 1 }], customerName: 'محمد', phone: '0555 555 555', wilayaId, address: 'حي السلام' })
    expect(o).toMatchObject({ status: 'PENDING', paymentMethod: 'COD', needsShipping: true, subtotalDzd: 1500, shippingDzd: 400, totalDzd: 1900, phone: '0555555555' })
    expect(o.number).toMatch(/^MD-\d{8}-[0-9A-F]{6}$/)
    expect((await h.db.select().from(products).where(eq(products.id, book)))[0]!.stock).toBe(1)
    const adminNotes = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(adminNotes.some((n) => n.title.includes(o.number))).toBe(true)
    // لا تنزيل قبل التأكيد، ولا يرى الطلب غيره
    const v = await getOrder(h.db, student, o.id)
    expect(v.canDownload).toBe(false)
    expect(v.items.find((i) => i.productId === pdf)!.files).toHaveLength(1)
    await expect(getOrder(h.db, other, o.id)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
    await expect(downloadUrl(h.db, student, o.id, v.items[1]!.files[0]!.id)).rejects.toMatchObject({ code: 'DOWNLOAD_NOT_ALLOWED' })
    await expect(setOrderStatus(h.db, student, o.id, 'CONFIRMED')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(setOrderStatus(h.db, admin, o.id, 'DELIVERED')).rejects.toMatchObject({ code: 'ORDER_INVALID_TRANSITION' })
    const c = await setOrderStatus(h.db, admin, o.id, 'CONFIRMED', { shippingDzd: 500 })
    expect(c).toMatchObject({ status: 'CONFIRMED', shippingDzd: 500, totalDzd: 2000 })
    expect(c.confirmedAt).not.toBeNull()
    const v2 = await getOrder(h.db, student, o.id)
    expect(v2.canDownload).toBe(true)
    const dl = await downloadUrl(h.db, student, o.id, v2.items[1]!.files[0]!.id)
    expect(dl.url).toMatch(/^\/api\/v1\/files\/[0-9a-f-]{36}\?exp=\d+&sig=/)
    expect(dl.name).toBe('nahw.pdf')
    expect((await h.db.select().from(downloads).where(eq(downloads.orderId, o.id))).length).toBe(1)
    await expect(downloadUrl(h.db, other, o.id, v2.items[1]!.files[0]!.id)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    await setOrderStatus(h.db, admin, o.id, 'DELIVERED')
    expect((await getOrder(h.db, admin, o.id)).order).toMatchObject({ status: 'DELIVERED', customerEmail: expect.stringContaining('@') })
    const mine = await myOrders(h.db, student)
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ number: o.number, status: 'DELIVERED', items: 2 })
    const studentNotes = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(studentNotes.map((n) => n.title)).toEqual(expect.arrayContaining([expect.stringContaining('مؤكَّد'), expect.stringContaining('في الطريق'), expect.stringContaining('سُلِّم')]))
  })

  it('رقمي مدفوع ⇒ تحويل بانتظار التأكيد؛ مجاني ⇒ مُسلَّم فوراً؛ الإلغاء يعيد المخزون', async () => {
    const paid = await placeOrder(h.db, other, { items: [{ productId: pdf, qty: 2 }], customerName: 'سارة', phone: '0666666666' })
    expect(paid).toMatchObject({ status: 'PENDING', paymentMethod: 'TRANSFER', needsShipping: false, shippingDzd: 0, totalDzd: 600 })
    const free = await placeOrder(h.db, other, { items: [{ productId: freePdf, qty: 1 }], customerName: 'سارة', phone: '0666666666' })
    expect(free).toMatchObject({ status: 'DELIVERED', paymentMethod: 'FREE', totalDzd: 0 })
    const fv = await getOrder(h.db, other, free.id)
    expect(fv.canDownload).toBe(true)
    expect((await downloadUrl(h.db, other, free.id, fv.items[0]!.files[0]!.id)).name).toBe('bac.pdf')
    // إلغاء طلب كتاب يعيد المخزون
    const b = await placeOrder(h.db, other, { items: [{ productId: book, qty: 1 }], customerName: 'سارة', phone: '0666666666', wilayaId, address: 'x' })
    expect((await h.db.select().from(products).where(eq(products.id, book)))[0]!.stock).toBe(0)
    expect((await listProducts(h.db)).find((p) => p.id === book)!.inStock).toBe(false)
    await setOrderStatus(h.db, admin, b.id, 'CANCELLED', { reason: 'نفد الكتاب' })
    expect((await h.db.select().from(products).where(eq(products.id, book)))[0]!.stock).toBe(1)
    expect((await h.db.select().from(orders).where(eq(orders.id, b.id)))[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'نفد الكتاب' })
    await expect(setOrderStatus(h.db, admin, b.id, 'CONFIRMED')).rejects.toMatchObject({ code: 'ORDER_INVALID_TRANSITION' })
    expect((await listOrdersAdmin(h.db, admin, { status: 'PENDING' })).map((o) => o.id)).toEqual([paid.id])
    const s = await storeStats(h.db, admin)
    expect(s).toMatchObject({ pending: 1, delivered: 2, cancelled: 1, revenueDzd: 2000, published: 3, downloads: 2 })
  })
})
