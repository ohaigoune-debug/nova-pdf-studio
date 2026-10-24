/**
 * مسار الطلب كاملاً على نسق NOVA COMMERCE، بقاعدة PGlite في الذاكرة وبيانات وهمية:
 * طلب الكتاب = طلب الدورة (السعر من الكتاب) → طابور التأكيد (لا يردّ/لاحقاً/تأكيد، أو مكالمة فائتة)
 * → إرسال الطرد إلى EcoTrack (fetch وهمي) → مزامنة التتبّع: «Livré» ⇒ سُلِّم + تفعيل الدورة
 * → إشعارات المشرف والزبون. وكذلك: التسليم اليدوي يفعّل، المرتجع يعيد المخزون، كود الكتاب يفعّل، رسوم الولاية.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { callEvents, courseEnrollments, deliveryEvents, jobs, notifications, orders, products, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { setSmsSenderForTests, type SmsMessage } from '@/server/lib/sms'
import { listCourseCatalog } from '@/server/services/academy-catalog.service'
import { getCallConfirm, handleIncomingCall, saveCallConfirm } from '@/server/services/call-confirm.service'
import { createCourse, linkProduct } from '@/server/services/courses.service'
import { ecotrackStatus, ensureEcotrackSyncScheduled, saveEcotrackSettings, sendOrderToEcotrack, syncEcotrackFees, syncEcotrackShipments } from '@/server/services/ecotrack.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { ORDER_TRANSITIONS, canTransition, transitionOrder } from '@/server/services/order-status.service'
import { createProduct, listConfirmationQueue, placeOrder, setOrderStatus, shippingFeeFor, storeStats } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let courseId: string
let bookId: string
let wilayaId: string
const sms: SmsMessage[] = []

/** منصّة EcoTrack وهمية: حالة كل طرد قابلة للتغيير من الاختبار */
const eco = { statuses: new Map<string, string>(), created: [] as Record<string, unknown>[], seq: 0, rateRemaining: 9000 }
const ecoFetch: typeof fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input))
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': String(eco.rateRemaining) } })
  if (url.pathname.endsWith('/get/wilayas')) return json({ '16': { id: 16, nom: 'Alger' }, '24': { id: 24, nom: 'Guelma' } })
  if (url.pathname.endsWith('/get/communes')) return json({ '1': { id: 1, nom: 'Guelma', wilaya_id: 24, has_stop_desk: 1 } })
  if (url.pathname.endsWith('/get/fees')) return json({ livraison: [{ wilaya_id: 24, tarif: 600, tarif_stopdesk: 400 }, { wilaya_id: 25, tarif: 700, tarif_stopdesk: 450 }] })
  if (url.pathname.endsWith('/create/order')) {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    eco.created.push(body)
    const tracking = `ECO-${++eco.seq}`
    eco.statuses.set(tracking, 'Nouveau')
    return json({ success: true, tracking })
  }
  if (url.pathname.endsWith('/get/orders')) {
    const t = url.searchParams.get('tracking')!
    return json({ data: eco.statuses.has(t) ? [{ tracking: t, status: eco.statuses.get(t), driver_name: 'Karim', tarif_prestation: 600 }] : [] })
  }
  if (url.pathname.endsWith('/get/tracking/info')) {
    const t = url.searchParams.get('tracking')!
    return json({ activity: eco.statuses.has(t) ? [{ event: eco.statuses.get(t), date: '2026-10-24 10:00:00' }] : [] })
  }
  if (url.pathname.endsWith('/delete/order')) return json({ delete: 'success' })
  return new Response('nf', { status: 404 })
}) as typeof fetch

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}
const order = async (id: string) => (await h.db.select().from(orders).where(eq(orders.id, id)))[0]!
const enrollment = async (sid: string) => (await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, sid))))[0]
const adminNotes = async () => h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
const stockOf = async () => (await h.db.select({ s: products.stock }).from(products).where(eq(products.id, bookId)))[0]!.s ?? -1

beforeAll(async () => {
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async (m) => void sms.push(m) })
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الدورة')
  student = await makeStudent(h.db, 'تلميذ المتجر')
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).where(eq(wilayas.code, '24')))[0]!.id
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  courseId = (await createCourse(h.db, admin, { title: 'دورة الأدب العربي 2027', workspaceId, season: '2026/2027', priceDzd: 9999, accessEndsOn: '2027-06-30', status: 'PUBLISHED' })).id
  bookId = (await createProduct(h.db, admin, { title: 'كتاب وسام التفوق', type: 'BOOK', priceDzd: 1500, stock: 10, status: 'PUBLISHED' })).id
  await linkProduct(h.db, admin, courseId, bookId)
})

afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('1. الدورة = الكتاب: السعر من الكتاب المرتبط', () => {
  it('الكتالوج يعرض سعر الكتاب لا سعر الدورة المكتوب', async () => {
    const c = (await listCourseCatalog(h.db, student)).find((x) => x.id === courseId)!
    expect(c.priceDzd).toBe(1500)
  })
})

describe('2. جدول الانتقالات (state machine)', () => {
  it('الانتقالات المسموحة كما في NOVA، والنهائية مغلقة', () => {
    expect(canTransition('PENDING', 'NO_ANSWER')).toBe(true)
    expect(canTransition('NO_ANSWER', 'CONFIRMED')).toBe(true)
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false)
    expect(canTransition('SHIPPED', 'RETURNED')).toBe(true)
    expect(canTransition('DELIVERED', 'CANCELLED')).toBe(false)
    expect(ORDER_TRANSITIONS.RETURNED).toEqual([])
    expect(canTransition('CANCELLED', 'PENDING')).toBe(true)
  })
})

describe('3. من طلب الكتاب إلى تفعيل الدورة عبر EcoTrack', () => {
  let orderId: string
  it('طلب الكتاب (COD) ⇒ بانتظار التأكيد، وإشعار للمشرف، والمخزون محجوز', async () => {
    const o = await placeOrder(h.db, student, { items: [{ productId: bookId, qty: 1 }], customerName: 'تلميذ المتجر', phone: '0555 11 22 33', wilayaId, address: 'حي 20 أوت', commune: 'Guelma', deliveryType: 'HOME' })
    orderId = o.id
    expect(o.status).toBe('PENDING')
    expect(o.commune).toBe('Guelma')
    expect(await stockOf()).toBe(9)
    expect((await adminNotes()).some((n) => n.title.includes(o.number))).toBe(true)
    expect((await listConfirmationQueue(h.db, admin)).map((q) => q.id)).toContain(orderId)
  })
  it('لا يردّ ثم لاحقاً: تُعدّ المحاولات؛ ولا يمكن «سُلِّم» قبل التأكيد', async () => {
    await setOrderStatus(h.db, admin, orderId, 'NO_ANSWER')
    expect((await order(orderId)).confirmAttempts).toBe(1)
    await setOrderStatus(h.db, admin, orderId, 'CALL_LATER')
    const o = await order(orderId)
    expect(o.confirmAttempts).toBe(2)
    expect(o.lastCallAt).toBeTruthy()
    await expectCode(() => setOrderStatus(h.db, admin, orderId, 'DELIVERED'), 'ORDER_INVALID_TRANSITION')
  })
  it('حفظ حساب EcoTrack يتحقق من الرمز؛ رمز مرفوض لا يُحفظ', async () => {
    const bad: typeof fetch = (async () => new Response('{}', { status: 401 })) as typeof fetch
    await expectCode(() => saveEcotrackSettings(h.db, admin, { baseUrl: 'x.ecotrack.dz', apiToken: 'bad-token-123', enabled: true, autoSend: false }, bad), 'ECOTRACK_REJECTED')
    expect((await ecotrackStatus(h.db)).configured).toBe(false)
    const st = await saveEcotrackSettings(h.db, admin, { baseUrl: 'test.ecotrack.dz', apiToken: 'tok_test_1234567890', enabled: true, autoSend: false }, ecoFetch)
    expect(st.configured && st.enabled).toBe(true)
    expect(st.baseUrl).toBe('https://test.ecotrack.dz')
    expect(st.hint).toBe('7890')
    // الرسوم تُجلب وتُحفظ وتُستعمل في السلة
    expect((await syncEcotrackFees(h.db, admin, ecoFetch)).count).toBe(2)
    expect(await shippingFeeFor(h.db, wilayaId, 'HOME')).toBe(600)
    expect(await shippingFeeFor(h.db, wilayaId, 'DESK')).toBe(400)
    expect(await shippingFeeFor(h.db, null, 'HOME')).toBe(0)
  })
  it('التأكيد ثم «إرسال إلى EcoTrack»: طرد بحمولة صحيحة، الطلب في الطريق برقم التتبّع، وإشعار للزبون', async () => {
    await expectCode(() => sendOrderToEcotrack(h.db, admin, orderId, ecoFetch), 'ORDER_INVALID_TRANSITION')
    await setOrderStatus(h.db, admin, orderId, 'CONFIRMED')
    const { tracking } = await sendOrderToEcotrack(h.db, admin, orderId, ecoFetch)
    expect(tracking).toBe('ECO-1')
    const o = await order(orderId)
    expect(o.status).toBe('SHIPPED')
    expect(o.deliveryProvider).toBe('ecotrack')
    expect(o.deliveryTrackingId).toBe('ECO-1')
    const payload = eco.created[0]!
    expect(payload.reference).toBe(o.number)
    expect(payload.telephone).toBe('0555112233')
    expect(payload.code_wilaya).toBe(24)
    expect(payload.montant).toBe(o.totalDzd)
    expect(payload.commune_id).toBe('1')
    expect(String(payload.produit)).toContain('كتاب وسام التفوق')
    // إعادة الإرسال لا تنشئ طرداً ثانياً
    expect((await sendOrderToEcotrack(h.db, admin, orderId, ecoFetch)).tracking).toBe('ECO-1')
    expect(eco.created.length).toBe(1)
    const cust = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(cust.some((n) => n.body?.includes('ECO-1'))).toBe(true)
    expect((await h.db.select().from(deliveryEvents).where(eq(deliveryEvents.trackingId, 'ECO-1')))[0]?.status).toBe('CREATED')
  })
  it('المزامنة: في الطريق لا يغيّر؛ محاولة فاشلة تُخطر المشرف؛ «Livré» ⇒ سُلِّم + تفعيل الدورة + إشعارات', async () => {
    eco.statuses.set('ECO-1', 'En transit vers wilaya')
    let s = await syncEcotrackShipments(h.db, { fetchImpl: ecoFetch })
    expect(s.polled).toBe(1)
    expect((await order(orderId)).status).toBe('SHIPPED')
    eco.statuses.set('ECO-1', 'Tentative échouée')
    s = await syncEcotrackShipments(h.db, { fetchImpl: ecoFetch })
    expect((await order(orderId)).status).toBe('SHIPPED')
    expect((await adminNotes()).some((n) => n.title.includes('محاولة تسليم فاشلة'))).toBe(true)
    expect(await enrollment(student.studentId!)).toBeUndefined()

    eco.statuses.set('ECO-1', 'Livré')
    s = await syncEcotrackShipments(h.db, { fetchImpl: ecoFetch })
    expect(s.delivered).toBe(1)
    const o = await order(orderId)
    expect(o.status).toBe('DELIVERED')
    expect(o.deliveredAt).toBeTruthy()
    const e = await enrollment(student.studentId!)
    expect(e?.status).toBe('ACTIVE')
    expect(e?.source).toBe('BOOK_ORDER')
    expect(e?.orderId).toBe(orderId)
    expect((await adminNotes()).some((n) => n.title.includes('سُلِّم') && n.title.includes('فُعّلت 1 دورة'))).toBe(true)
    const cust = await h.db.select().from(notifications).where(eq(notifications.userId, student.userId))
    expect(cust.some((n) => n.title.includes('سُلِّم'))).toBe(true)
    expect(cust.some((n) => n.title.includes('تم تفعيل اشتراكك'))).toBe(true)
    // مزامنة ثانية: الطرد المسلَّم لم يعد مفتوحاً، ولا حدث مكرَّر
    const before = (await h.db.select().from(deliveryEvents)).length
    s = await syncEcotrackShipments(h.db, { fetchImpl: ecoFetch })
    expect(s.polled).toBe(0)
    expect((await h.db.select().from(deliveryEvents)).length).toBe(before)
  })
  it('جدولة المزامنة: مرة واحدة في النافذة', async () => {
    expect(await ensureEcotrackSyncScheduled(h.db)).toBe(true)
    expect(await ensureEcotrackSyncScheduled(h.db)).toBe(false)
    expect((await h.db.select().from(jobs).where(eq(jobs.type, 'ECOTRACK_SYNC'))).length).toBe(1)
  })
  it('الإرسال التلقائي عند التأكيد يُدرج مهمة ECOTRACK_SEND', async () => {
    await saveEcotrackSettings(h.db, admin, { baseUrl: 'test.ecotrack.dz', enabled: true, autoSend: true }, ecoFetch)
    const s2 = await makeStudent(h.db, 'تلميذ تلقائي')
    const o = await placeOrder(h.db, s2, { items: [{ productId: bookId, qty: 1 }], customerName: 'تلميذ تلقائي', phone: '0666000111', wilayaId, address: 'x' })
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    const queued = await h.db.select().from(jobs).where(eq(jobs.type, 'ECOTRACK_SEND'))
    expect(queued.some((j) => (j.payload as { orderId?: string }).orderId === o.id)).toBe(true)
    await saveEcotrackSettings(h.db, admin, { baseUrl: 'test.ecotrack.dz', enabled: true, autoSend: false }, ecoFetch)
  })
})

describe('4. التسليم اليدوي يفعّل، والمرتجع يعيد المخزون', () => {
  it('تعليم الطلب «سُلِّم» من اللوحة يفعّل الدورة (الثغرة القديمة)', async () => {
    const s3 = await makeStudent(h.db, 'تلميذ يدوي')
    const o = await placeOrder(h.db, s3, { items: [{ productId: bookId, qty: 1 }], customerName: 'تلميذ يدوي', phone: '0777000222', wilayaId, address: 'x' })
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await setOrderStatus(h.db, admin, o.id, 'DELIVERED')
    expect((await enrollment(s3.studentId!))?.status).toBe('ACTIVE')
    // «سُلِّم» مرة ثانية: لا خطأ، ويعيد محاولة التفعيل بلا تكرار
    const r = await transitionOrder(h.db, o.id, 'DELIVERED', { actorUserId: admin.userId, source: 'admin' })
    expect(r.changed).toBe(false)
    expect((await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, s3.studentId!))).length).toBe(1)
  })
  it('مرتجع: المخزون يعود، والحالة نهائية، والمشرف يُخطر حين يأتي من الشركة', async () => {
    const s4 = await makeStudent(h.db, 'تلميذ مرتجع')
    const o = await placeOrder(h.db, s4, { items: [{ productId: bookId, qty: 2 }], customerName: 'تلميذ مرتجع', phone: '0555000333', wilayaId, address: 'x' })
    const stock = await stockOf()
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await setOrderStatus(h.db, admin, o.id, 'SHIPPED')
    await transitionOrder(h.db, o.id, 'RETURNED', { actorUserId: null, source: 'ecotrack', reason: 'Retourné au vendeur' })
    expect(await stockOf()).toBe(stock + 2)
    expect((await order(o.id)).returnedAt).toBeTruthy()
    await expectCode(() => setOrderStatus(h.db, admin, o.id, 'PENDING'), 'ORDER_INVALID_TRANSITION')
    expect((await adminNotes()).some((n) => n.title.includes(o.number) && n.title.includes('مرتجع'))).toBe(true)
    expect(await enrollment(s4.studentId!)).toBeUndefined()
    const st = await storeStats(h.db, admin)
    expect(st.returned).toBe(1)
  })
  it('إلغاء ثم إعادة فتح: المخزون يُعاد ثم يُحجز من جديد', async () => {
    const s5 = await makeStudent(h.db, 'تلميذ إلغاء')
    const o = await placeOrder(h.db, s5, { items: [{ productId: bookId, qty: 1 }], customerName: 'x', phone: '0555000444', wilayaId, address: 'x' })
    const stock = await stockOf()
    await setOrderStatus(h.db, admin, o.id, 'CANCELLED', { reason: 'طلب مكرّر' })
    expect(await stockOf()).toBe(stock + 1)
    await setOrderStatus(h.db, admin, o.id, 'PENDING')
    expect(await stockOf()).toBe(stock)
    expect((await order(o.id)).cancelledAt).toBeNull()
  })
})

describe('5. التأكيد بالمكالمة الفائتة (NOVA Call)', () => {
  let pendingId: string
  it('معطَّل ⇒ disabled؛ بعد التفعيل: مكالمة من رقم طلب معلّق تؤكّده وتُسجَّل', async () => {
    const s6 = await makeStudent(h.db, 'تلميذ مكالمة')
    pendingId = (await placeOrder(h.db, s6, { items: [{ productId: bookId, qty: 1 }], customerName: 'تلميذ مكالمة', phone: '0661223344', wilayaId, address: 'x' })).id
    expect((await handleIncomingCall(h.db, '0661223344')).result).toBe('disabled')
    const cfg = await saveCallConfirm(h.db, admin, { enabled: true, number: '0555 99 88 77', windowHours: 72, autoReject: true })
    expect(cfg.secret).toBeTruthy()
    expect(cfg.number).toBe('0555998877')
    expect((await getCallConfirm(h.db)).secret).toBe(cfg.secret)
    const r = await handleIncomingCall(h.db, '+213661223344')
    expect(r.result).toBe('confirmed')
    expect(r.reject).toBe(true)
    expect((await order(pendingId)).status).toBe('CONFIRMED')
    expect((await adminNotes()).some((n) => n.title.includes('📞'))).toBe(true)
  })
  it('مكالمة ثانية ⇒ مؤكَّد من قبل؛ رقم بلا طلب ⇒ no_order؛ رقم غير مفهوم ⇒ invalid_phone', async () => {
    expect((await handleIncomingCall(h.db, '0661223344')).result).toBe('already_confirmed')
    expect((await handleIncomingCall(h.db, '0699000000')).result).toBe('no_order')
    expect((await handleIncomingCall(h.db, '12')).result).toBe('invalid_phone')
    const log = await h.db.select().from(callEvents)
    expect(log.map((e) => e.result).sort()).toEqual(['already_confirmed', 'confirmed', 'invalid_phone', 'no_order'])
  })
  it('تدوير السرّ يغيّره', async () => {
    const before = (await getCallConfirm(h.db)).secret
    const after = (await saveCallConfirm(h.db, admin, {}, { rotateSecret: true })).secret
    expect(after).not.toBe(before)
  })
})

describe('6. كود الكتاب يفعّل الدورة', () => {
  it('المشرف يولّد أكواد الدورة؛ التلميذ يُدخل الكود فيُفعَّل اشتراكه ويُستهلك الكود', async () => {
    const s7 = await makeStudent(h.db, 'تلميذ الكود')
    const course = (await h.db.select().from((await import('@/server/db/schema')).courses).where(eq((await import('@/server/db/schema')).courses.id, courseId)))[0]!
    await expectCode(() => generateCodes(h.db, teacher, { groupId: course.groupId, count: 1 }), 'COURSE_GROUP_CODE')
    const batch = await generateCodes(h.db, admin, { groupId: course.groupId, count: 3, label: 'طبعة 1' })
    expect(batch.codes.length).toBe(3)
    const r = await redeemEnrollmentCode(h.db, s7, batch.codes[0]!.code)
    expect(r.courseId).toBe(courseId)
    expect(r.courseTitle).toBe('دورة الأدب العربي 2027')
    const e = await enrollment(s7.studentId!)
    expect(e?.status).toBe('ACTIVE')
    expect(e?.source).toBe('CODE')
    const s8 = await makeStudent(h.db, 'تلميذ كود مستهلك')
    await expectCode(() => redeemEnrollmentCode(h.db, s8, batch.codes[0]!.code), 'CODE_USED')
  })
})
