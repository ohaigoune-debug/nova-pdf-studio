/** صلاحيات موظف التأكيد: PGlite فقط، وشركة توصيل وهمية. */
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { homeFor } from '@/lib/role-home'
import { navFor } from '@/components/layout/nav'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseEnrollments, orders, profiles, sessions, streams, students, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createConfirmer, listConfirmers } from '@/server/services/confirmer.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { placeCourseOrder, setCourseBook } from '@/server/services/course-purchase.service'
import { adjustOrderAmount, banOrderCustomer, changeOrderStream } from '@/server/services/order-edit.service'
import { generateCourseCodes } from '@/server/services/course-codes.service'
import { sendActivationCode } from '@/server/services/course-activation.service'
import { ecotrackOperatorStatus, saveEcotrackSettings, sendOrderToEcotrack } from '@/server/services/ecotrack.service'
import { saveDeliveryWebhookSecret } from '@/server/services/delivery.service'
import { createProduct, getOrder, listConfirmationQueue, listOrdersAdmin, listProductsAdmin, placeOrder, setOrderStatus, setStorePolicy, storeStats } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let confirmer: Actor
let student: Actor
let bookId: string
let digitalId: string
let wilayaId: string
let createCalls = 0
const fakeFetch: typeof fetch = (async (input: string | URL | Request) => {
  const url = new URL(String(input))
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '9000' } })
  if (url.pathname.endsWith('/get/wilayas')) return json({ '24': { id: 24, nom: 'Guelma' } })
  if (url.pathname.endsWith('/get/communes')) return json({ '1': { id: 1, nom: 'Guelma', wilaya_id: 24, has_stop_desk: 1 } })
  if (url.pathname.endsWith('/create/order')) return json({ success: true, tracking: `CONFIRMER-${++createCalls}` })
  throw new Error(`unexpected mock path ${url.pathname}`)
}) as typeof fetch

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  student = await makeStudent(h.db)
  const employee = await createConfirmer(h.db, admin, { email: uniq('employee') + '@test.dz', password: 'Worker@12345', fullName: 'موظف تأكيد تجريبي', phone: '+213661234567' })
  confirmer = await actorOf(h.db, employee.userId)
  wilayaId = (await refIds(h.db)).wilayaId!
  bookId = (await createProduct(h.db, admin, { title: 'كتاب تجريبي', type: 'BOOK', priceDzd: 1500, stock: 30, status: 'PUBLISHED' })).id
  digitalId = (await createProduct(h.db, admin, { title: 'ملف تجريبي', type: 'PDF', priceDzd: 100, status: 'PUBLISHED' })).id
  await saveEcotrackSettings(h.db, admin, { baseUrl: 'confirmer-test.ecotrack.dz', apiToken: 'test-only-confirmer-token', enabled: true, autoSend: false }, fakeFetch)
})
afterAll(async () => { await h?.close() })

const buy = (productId = bookId) => placeOrder(h.db, student, { items: [{ productId, qty: 1 }], customerName: 'طالب', phone: '0661112233', wilayaId, address: 'حي تجريبي', commune: 'Guelma' })

it('المشرف ينشئ حساب موظف بدوره الثابت وهاتفه، والحساب يعمل بجلسة حقيقية', async () => {
  expect(confirmer.role).toBe('CONFIRMER')
  expect(confirmer.workspaceId).toBeNull()
  expect(confirmer.studentId).toBeNull()
  expect((await h.db.select().from(profiles).where(eq(profiles.userId, confirmer.userId)))[0]!.phone).toBe('0661234567')
  expect((await listConfirmers(h.db, admin)).map((u) => u.id)).toContain(confirmer.userId)
  expect(await h.db.select().from(auditLogs).where(eq(auditLogs.action, 'confirmer.create'))).toHaveLength(1)
})

it('إنشاء الموظف وإدارته متاحان للمشرف فقط', async () => {
  await expect(createConfirmer(h.db, confirmer, { email: uniq('forbidden') + '@test.dz', password: 'Worker@12345', fullName: 'آخر', phone: '0661234567' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(listConfirmers(h.db, confirmer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(createConfirmer(h.db, admin, { email: 'bad', password: 'Worker@12345', fullName: 'موظف آخر', phone: '0661234567' })).rejects.toMatchObject({ code: 'VALIDATION' })
})

it('صفحة الموظف وقائمته تقتصران على التأكيد والطلبات', () => {
  expect(homeFor('CONFIRMER')).toBe('/admin/store/confirm')
  expect(navFor('CONFIRMER').flatMap((s) => s.items.map((i) => i.href))).toEqual(['/admin/store/confirm', '/admin/store'])
})

it('كل صفحات الإدارة الأخرى ومسارات التصدير تحتفظ بحراسة المشرف ولو أُعيد استعمال Layout', () => {
  const allowed = new Set(['store/page.tsx', 'store/confirm/page.tsx'])
  const walk = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)])
  const pages = walk('src/app/admin').filter((p) => p.endsWith('/page.tsx'))
  expect(pages.length).toBeGreaterThan(35)
  for (const path of pages) {
    if (!allowed.has(relative('src/app/admin', path))) expect(readFileSync(path, 'utf8'), path).toContain("requirePageActor('SUPER_ADMIN')")
  }
  for (const path of walk('src/app/admin').filter((p) => p.endsWith('/route.ts'))) expect(readFileSync(path, 'utf8'), path).toContain("requireRole('SUPER_ADMIN')")
})

it('الموظف يؤكد طلب COD ويرسله إلى EcoTrack مرة واحدة', async () => {
  const order = await buy()
  expect((await listConfirmationQueue(h.db, confirmer)).map((o) => o.id)).toContain(order.id)
  expect((await listOrdersAdmin(h.db, confirmer)).map((o) => o.id)).toContain(order.id)
  const confirmed = await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')
  expect(confirmed.status).toBe('CONFIRMED')
  const before = createCalls
  const sent = await sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)
  expect(createCalls).toBe(before + 1)
  expect((await h.db.select().from(orders).where(eq(orders.id, order.id)))[0]).toMatchObject({ status: 'SHIPPED', deliveryTrackingId: sent.tracking })
  expect(await sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)).toEqual(sent)
  expect(createCalls).toBe(before + 1)
  expect(await ecotrackOperatorStatus(h.db, confirmer)).toEqual({ enabled: true })
})

it('الموظف يسجل لا يردّ/لاحقًا، والإلغاء يحتاج سببًا', async () => {
  const order = await buy()
  expect((await setOrderStatus(h.db, confirmer, order.id, 'NO_ANSWER')).status).toBe('NO_ANSWER')
  expect((await setOrderStatus(h.db, confirmer, order.id, 'CALL_LATER')).status).toBe('CALL_LATER')
  await expect(setOrderStatus(h.db, confirmer, order.id, 'CANCELLED', { reason: ' ' })).rejects.toMatchObject({ code: 'VALIDATION' })
  expect((await setOrderStatus(h.db, confirmer, order.id, 'CANCELLED', { reason: 'طلب العميل الإلغاء' })).status).toBe('CANCELLED')
})

it.each(['DELIVERED', 'RETURNED', 'SHIPPED', 'PENDING'] as const)('الموظف لا يستطيع فرض الحالة %s', async (status) => {
  const order = await buy()
  await expect(setOrderStatus(h.db, confirmer, order.id, status)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect((await h.db.select().from(orders).where(eq(orders.id, order.id)))[0]!.status).toBe('PENDING')
})

it('الموظف لا يغير الشحن أو الملاحظات الإدارية ولا يلغي طلبًا شُحن', async () => {
  const order = await buy()
  await expect(setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED', { shippingDzd: 0 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED', { adminNote: 'test' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await setOrderStatus(h.db, admin, order.id, 'CONFIRMED')
  await sendOrderToEcotrack(h.db, admin, order.id, fakeFetch)
  await expect(setOrderStatus(h.db, confirmer, order.id, 'CANCELLED', { reason: 'x' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('قرار المالك 2026-10-28: الموظف يدير طلب التحويل الرقمي ويؤكده، ولا يرسل إلى الناقل ما لا يُشحن', async () => {
  const order = await buy(digitalId)
  expect(order.paymentMethod).toBe('TRANSFER')
  expect((await listConfirmationQueue(h.db, confirmer)).map((o) => o.id)).toContain(order.id)
  expect((await listOrdersAdmin(h.db, confirmer)).map((o) => o.id)).toContain(order.id)
  expect((await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')).status).toBe('CONFIRMED')
  await expect(sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('الدورات والإعدادات والأكواد والمنتجات والمداخيل خارج صلاحيات الموظف', async () => {
  const id = '00000000-0000-4000-8000-000000000000'
  await expect(createCourse(h.db, confirmer, { title: 'ممنوع', workspaceId: id, season: '2026/2027' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(setStorePolicy(h.db, confirmer, { requireOtp: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(saveEcotrackSettings(h.db, confirmer, { baseUrl: 'x', enabled: true, autoSend: true }, fakeFetch)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(saveDeliveryWebhookSecret(h.db, confirmer, 'test-secret-at-least-16')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(generateCourseCodes(h.db, confirmer, { courseId: id, count: 1 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  // كود التفعيل صار من صلاحيات الموظف (قرار المالك): معرّف غير موجود ⇒ «غير موجود» لا «ممنوع»
  await expect(sendActivationCode(h.db, confirmer.userId, id)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
  await expect(listProductsAdmin(h.db, confirmer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await expect(storeStats(h.db, confirmer)).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('صفحة تفاصيل الطلب والتنزيلات لا تُفتح للموظف نيابةً عن المشتري', async () => {
  const order = await buy()
  await expect(getOrder(h.db, confirmer, order.id)).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND' })
  expect((await h.db.select().from(users).where(eq(users.id, confirmer.userId)))[0]!.role).toBe('CONFIRMER')
})

it('التراجع عن 0035 يرفض حذف الدور ما دامت حسابات الموظفين موجودة', async () => {
  await expect(h.db.execute(sql.raw(readFileSync('drizzle/down/0035_confirmer_role.down.sql', 'utf8')))).rejects.toThrow('Reassign CONFIRMER accounts')
  expect((await h.db.select().from(users).where(eq(users.id, confirmer.userId)))[0]!.role).toBe('CONFIRMER')
})

it('قرار المالك 2026-10-28: الموظف يؤكد طلب COD المختلط بملف رقمي ويرسله إلى الناقل', async () => {
  const order = await placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }, { productId: digitalId, qty: 1 }], customerName: 'طالب', phone: '0661112233', wilayaId, address: 'حي تجريبي', commune: 'Guelma' })
  expect(order.paymentMethod).toBe('COD')
  expect((await listConfirmationQueue(h.db, confirmer)).map((o) => o.id)).toContain(order.id)
  expect((await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')).status).toBe('CONFIRMED')
  const before = createCalls
  await sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)
  expect(createCalls).toBe(before + 1)
})

/* ───── صلاحيات الموظف الموسّعة (قرار المالك 2026-10-28) ───── */

const streamIds = async () => {
  const sci = (await refIds(h.db)).streamId!
  const [existing] = await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'LET')).limit(1)
  const let_ = existing?.id ?? (await h.db.insert(streams).values({ code: 'LET', nameAr: 'آداب وفلسفة', sortOrder: 2 }).returning())[0]!.id
  return { sci, let: let_ }
}

const auditFor = (action: string, entityId: string) => h.db.select().from(auditLogs).where(eq(auditLogs.entityId, entityId)).then((rows) => rows.filter((r) => r.action === action))

it('الموظف يغيّر شعبة الطلب قبل الشحن، مع تدقيق، ولا يغيّرها بعده', async () => {
  const { sci, let: letId } = await streamIds()
  const order = await buy()
  expect((await changeOrderStream(h.db, confirmer, order.id, sci)).streamId).toBe(sci)
  expect((await changeOrderStream(h.db, confirmer, order.id, letId)).streamId).toBe(letId)
  const audit = await auditFor('store.order_stream', order.id)
  expect(audit.at(-1)).toMatchObject({ actorUserId: confirmer.userId, oldValue: { streamId: sci }, newValue: { streamId: letId } })
  await expect(changeOrderStream(h.db, confirmer, order.id, 'not-a-uuid')).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(changeOrderStream(h.db, confirmer, order.id, '00000000-0000-4000-8000-000000000000')).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(changeOrderStream(h.db, student, order.id, sci)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')
  await sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)
  await expect(changeOrderStream(h.db, confirmer, order.id, sci)).rejects.toMatchObject({ code: 'ORDER_LOCKED' })
})

it('الموظف يغيّر المبلغ بسبب إلزامي؛ الإجمالي = الثمن + التوصيل ويبقى كذلك بعد التأكيد', async () => {
  const order = await buy()
  await expect(adjustOrderAmount(h.db, confirmer, order.id, { subtotalDzd: 1000, reason: ' ' })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(adjustOrderAmount(h.db, confirmer, order.id, { subtotalDzd: -5, reason: 'تخفيض' })).rejects.toMatchObject({ code: 'VALIDATION' })
  await expect(adjustOrderAmount(h.db, confirmer, order.id, { reason: 'لا شيء' })).rejects.toMatchObject({ code: 'VALIDATION' })
  const changed = await adjustOrderAmount(h.db, confirmer, order.id, { subtotalDzd: 1200, shippingDzd: 300, reason: 'تخفيض متفق عليه هاتفيًا' })
  expect(changed).toMatchObject({ subtotalDzd: 1200, shippingDzd: 300, totalDzd: 1500 })
  expect((await auditFor('store.order_amount', order.id))[0]).toMatchObject({ actorUserId: confirmer.userId, oldValue: { totalDzd: order.totalDzd }, newValue: { totalDzd: 1500, reason: 'تخفيض متفق عليه هاتفيًا' } })
  expect((await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')).totalDzd).toBe(1500)
  await sendOrderToEcotrack(h.db, confirmer, order.id, fakeFetch)
  await expect(adjustOrderAmount(h.db, confirmer, order.id, { subtotalDzd: 1, reason: 'بعد الشحن' })).rejects.toMatchObject({ code: 'ORDER_LOCKED' })
  await expect(adjustOrderAmount(h.db, student, order.id, { subtotalDzd: 1, reason: 'تلميذ' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('الحظر يوقف حساب الزبون وجلساته ويلغي طلباته المفتوحة؛ لا يمسّ حسابات الطاقم', async () => {
  const customer = await makeStudent(h.db, 'زبون وهمي')
  const place = () => placeOrder(h.db, customer, { items: [{ productId: bookId, qty: 1 }], customerName: 'زبون', phone: '0661112299', wilayaId, address: 'حي', commune: 'Guelma' })
  const first = await place()
  const second = await place()
  await expect(banOrderCustomer(h.db, confirmer, first.id, ' ')).rejects.toMatchObject({ code: 'VALIDATION' })
  const r = await banOrderCustomer(h.db, confirmer, first.id, 'طلبات وهمية متكررة')
  expect(r).toEqual({ userId: customer.userId, cancelledOrders: 2 })
  expect((await h.db.select().from(users).where(eq(users.id, customer.userId)))[0]!.status).toBe('DISABLED')
  expect(await h.db.select().from(sessions).where(eq(sessions.userId, customer.userId)).then((rows) => rows.filter((s) => !s.revokedAt))).toHaveLength(0)
  for (const id of [first.id, second.id]) expect((await h.db.select().from(orders).where(eq(orders.id, id)))[0]!.status).toBe('CANCELLED')
  expect((await auditFor('store.customer_ban', customer.userId))[0]).toMatchObject({ actorUserId: confirmer.userId, newValue: { status: 'DISABLED', reason: 'طلبات وهمية متكررة' } })
  const teacher = await makeTeacher(h.db, admin, 'أستاذ لا يُحظر')
  const teacherOrder = await placeOrder(h.db, teacher, { items: [{ productId: bookId, qty: 1 }], customerName: 'أستاذ', phone: '0661112288', wilayaId, address: 'حي', commune: 'Guelma' })
  await expect(banOrderCustomer(h.db, confirmer, teacherOrder.id, 'محاولة حظر أستاذ')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  expect((await h.db.select().from(users).where(eq(users.id, teacher.userId)))[0]!.status).toBe('ACTIVE')
  await expect(banOrderCustomer(h.db, student, teacherOrder.id, 'تلميذ يحظر')).rejects.toMatchObject({ code: 'FORBIDDEN' })
})

it('الموظف يسلّم الطلب فتُفعَّل الدورة، ثم يرسل كود التفعيل؛ ولا تسليم قبل التأكيد', async () => {
  const teacher = await makeTeacher(h.db, admin, 'أستاذ الدورة')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const course = await createCourse(h.db, admin, { title: 'دورة يفعّلها الموظف', workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, course.id, { title: 'كتاب دورة الموظف', priceDzd: 2000, stock: 5, active: true })
  await setCourseStatus(h.db, admin, course.id, 'PUBLISHED')
  const buyer = await makeStudent(h.db, 'مشترٍ للدورة')
  const order = await placeCourseOrder(h.db, buyer, { courseId: course.id, phone: '0661112277', wilayaId, address: 'حي الأمل', deliveryType: 'HOME' } as Parameters<typeof placeCourseOrder>[2])
  expect((await listOrdersAdmin(h.db, confirmer)).find((o) => o.id === order.id)).toMatchObject({ hasCourse: true })
  await expect(setOrderStatus(h.db, confirmer, order.id, 'DELIVERED')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  await setOrderStatus(h.db, confirmer, order.id, 'CONFIRMED')
  expect((await setOrderStatus(h.db, confirmer, order.id, 'DELIVERED')).status).toBe('DELIVERED')
  const enrolled = await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.courseId, course.id))
  expect(enrolled.map((e) => e.studentId)).toEqual([buyer.studentId])
  const code = await sendActivationCode(h.db, confirmer.userId, order.id)
  expect(code.codes.map((c) => c.courseId)).toEqual([course.id])
})

it('قيود الشعبة نفسها: لا تُنقل شعبة طلب دورة إلى شعبة ليست من شعب الدورة', async () => {
  const { sci, let: letId } = await streamIds()
  const teacher = await makeTeacher(h.db, admin, 'أستاذ العلوم')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const course = await createCourse(h.db, admin, { title: 'دورة علوم فقط', workspaceId, season: '2026/2027', status: 'DRAFT', streamIds: [sci] })
  await setCourseBook(h.db, admin, course.id, { title: 'كتاب العلوم', priceDzd: 1800, stock: 5, active: true })
  await setCourseStatus(h.db, admin, course.id, 'PUBLISHED')
  const buyer = await makeStudent(h.db, 'تلميذ علوم')
  await h.db.update(students).set({ streamId: sci }).where(eq(students.id, buyer.studentId!))
  const order = await placeCourseOrder(h.db, buyer, { courseId: course.id, phone: '0661112266', wilayaId, address: 'حي', deliveryType: 'HOME' } as Parameters<typeof placeCourseOrder>[2])
  await expect(changeOrderStream(h.db, confirmer, order.id, letId)).rejects.toMatchObject({ code: 'ORDER_STREAM_MISMATCH' })
  expect((await changeOrderStream(h.db, confirmer, order.id, sci)).streamId).toBe(sci)
})

it('سجلّ نشاط الموظف عند المشرف يعرض التعديلات الجديدة كلها باسمه', async () => {
  const { listConfirmerActivity } = await import('@/server/services/confirmer.service')
  const activity = await listConfirmerActivity(h.db, admin, 300)
  const kinds = new Set(activity.filter((a) => a.employeeId === confirmer.userId).map((a) => a.kind))
  for (const kind of ['status', 'stream', 'amount', 'ban', 'code'] as const) expect(kinds.has(kind), kind).toBe(true)
  const ban = activity.find((a) => a.kind === 'ban')!
  expect(ban.orderNumber).toMatch(/^MD-/)
  expect(activity.find((a) => a.kind === 'amount')!.detail).toMatch(/← 1500 دج$/)
})
