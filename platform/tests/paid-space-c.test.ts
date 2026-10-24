/**
 * المرحلة C (قرار المالك 2026-10-24): تحت فيديو الحصة (QCM مرتبط + تعليقات بموافقة الأستاذ)،
 * وتتبّع الطلب بالهاتف، وإلغاء الطلب من صاحبه قبل الشحن. قاعدة PGlite في الذاكرة وبيانات وهمية.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications, orders, products, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createContent } from '@/server/services/content.service'
import { createCourse, enrollStudent, linkProduct } from '@/server/services/courses.service'
import { addLessonComment, lessonQuizForStudent, listLessonComments, listPendingComments, moderateLessonComment, setLessonQuiz } from '@/server/services/lesson-extras.service'
import { cancelMyOrder, myTrackedOrders, trackByPhone } from '@/server/services/order-tracking.service'
import { createQuiz } from '@/server/services/quizzes.service'
import { createProduct, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let member: Actor
let outsider: Actor
let course: Awaited<ReturnType<typeof createCourse>>
let lesson: Awaited<ReturnType<typeof createContent>>
let bookId: string
let wilayaId: string

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ C')
  member = await makeStudent(h.db, 'تلميذ مشترك')
  outsider = await makeStudent(h.db, 'تلميذ غريب')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  course = await createCourse(h.db, admin, { title: 'دورة C', workspaceId, season: '2026/2027', status: 'PUBLISHED' })
  await enrollStudent(h.db, admin, { courseId: course.id, studentId: member.studentId!, source: 'MANUAL' })
  lesson = await createContent(h.db, teacher, { type: 'LESSON', title: 'الحصة 1', visibility: 'GROUP_ONLY', groupIds: [course.groupId], body: 'محتوى', publish: true })
  bookId = (await createProduct(h.db, admin, { title: 'كتاب C', type: 'BOOK', priceDzd: 1000, stock: 5, status: 'PUBLISHED' })).id
  await linkProduct(h.db, admin, course.id, bookId)
  wilayaId = (await h.db.select({ id: wilayas.id }).from(wilayas).limit(1))[0]!.id
})

afterAll(async () => {
  await h.close()
})

describe('1. QCM تحت الحصة', () => {
  it('الأستاذ يربط اختباراً ⇒ يُستهدف بفوج الحصة ويظهر للمشترك وحده', async () => {
    // اختبار أنشأه الأستاذ لفوج آخر: ربطه بالحصة يستهدفه بفوج الدورة تلقائياً
    const { createGroup } = await import('@/server/services/groups.service')
    const g = await createGroup(h.db, teacher, { name: 'فوج آخر' })
    const quiz = await createQuiz(h.db, teacher, { title: 'QCM الحصة 1', isPublic: false, publish: true, maxAttempts: 1, groupIds: [g.id], studentIds: [], questions: [{ type: 'MCQ', prompt: 'سؤال؟', points: 1, answerKey: null, options: [{ label: 'أ', isCorrect: true }, { label: 'ب', isCorrect: false }] }] })
    expect(await lessonQuizForStudent(h.db, member, lesson.id)).toBeNull()
    await setLessonQuiz(h.db, teacher, lesson.id, quiz.id)
    const q = await lessonQuizForStudent(h.db, member, lesson.id)
    expect(q?.id).toBe(quiz.id)
    expect(await lessonQuizForStudent(h.db, outsider, lesson.id)).toBeNull()
    await setLessonQuiz(h.db, teacher, lesson.id, null)
    expect(await lessonQuizForStudent(h.db, member, lesson.id)).toBeNull()
  })
})

describe('2. التعليقات بموافقة الأستاذ', () => {
  it('التعليق PENDING لا يراه غير صاحبه؛ الأستاذ يُخطر ويوافق بردّ ⇒ يظهر للجميع', async () => {
    await expectCode(() => addLessonComment(h.db, outsider, lesson.slug, 'سؤال من خارج الدورة'), 'CONTENT_NOT_FOUND')
    await addLessonComment(h.db, member, lesson.slug, 'ما معنى الفقرة الثانية؟')
    const other = await makeStudent(h.db, 'مشترك ثانٍ')
    await enrollStudent(h.db, admin, { courseId: course.id, studentId: other.studentId!, source: 'MANUAL' })
    expect((await listLessonComments(h.db, member, lesson.id)).map((c) => c.status)).toEqual(['PENDING'])
    expect(await listLessonComments(h.db, other, lesson.id)).toHaveLength(0)
    expect((await h.db.select().from(notifications).where(eq(notifications.userId, teacher.userId))).some((n) => n.title.includes('بانتظار موافقتك'))).toBe(true)
    const pending = await listPendingComments(h.db, teacher)
    expect(pending).toHaveLength(1)
    await moderateLessonComment(h.db, teacher, pending[0]!.id, 'APPROVED', 'الفقرة تشرح السياق')
    const seen = await listLessonComments(h.db, other, lesson.id)
    expect(seen).toHaveLength(1)
    expect(seen[0]!.reply).toBe('الفقرة تشرح السياق')
    expect(await listPendingComments(h.db, teacher)).toHaveLength(0)
  })
  it('المرفوض لا يظهر لغير صاحبه؛ أستاذ آخر لا يرى تعليقات غيره', async () => {
    const c = await addLessonComment(h.db, member, lesson.slug, 'تعليق غير لائق')
    const t2 = await makeTeacher(h.db, admin, 'أستاذ آخر')
    expect(await listPendingComments(h.db, t2)).toHaveLength(0)
    await expectCode(() => moderateLessonComment(h.db, t2, c.id, 'APPROVED'), 'NOT_FOUND')
    await moderateLessonComment(h.db, teacher, c.id, 'REJECTED')
    const other = await makeStudent(h.db, 'مشترك ثالث')
    await enrollStudent(h.db, admin, { courseId: course.id, studentId: other.studentId!, source: 'MANUAL' })
    expect((await listLessonComments(h.db, other, lesson.id)).some((x) => x.body === 'تعليق غير لائق')).toBe(false)
    expect((await listLessonComments(h.db, member, lesson.id)).find((x) => x.body === 'تعليق غير لائق')?.status).toBe('REJECTED')
  })
})

describe('3. تتبّع الطلب والإلغاء', () => {
  it('التتبّع بالهاتف يعرض الحالة والخط الزمني بلا عنوان ولا إلغاء؛ صاحبه يلغي قبل الشحن فيعود المخزون', async () => {
    const buyer = await makeStudent(h.db, 'سارة بن علي')
    const o = await placeOrder(h.db, buyer, { items: [{ productId: bookId, qty: 1 }], customerName: 'سارة بن علي', phone: '0551234567', wilayaId, address: 'حي سري' })
    const pub = await trackByPhone(h.db, '+213 551 23 45 67')
    expect(pub).toHaveLength(1)
    expect(pub[0]!.firstName).toBe('سارة')
    expect(JSON.stringify(pub)).not.toContain('حي سري')
    expect(pub[0]!.canCancel).toBe(false)
    expect(pub[0]!.timeline[0]!.label).toBe('استُلم الطلب')

    const mine = await myTrackedOrders(h.db, buyer)
    expect(mine[0]!.canCancel).toBe(true)
    await expectCode(() => cancelMyOrder(h.db, outsider, o.id, 'other'), 'ORDER_NOT_FOUND')
    const stock = (await h.db.select({ s: products.stock }).from(products).where(eq(products.id, bookId)))[0]!.s!
    await cancelMyOrder(h.db, buyer, o.id, 'ordered_by_mistake', 'طلبت مرتين')
    const after = (await h.db.select().from(orders).where(eq(orders.id, o.id)))[0]!
    expect(after.status).toBe('CANCELLED')
    expect(after.cancelReason).toContain('طلبت بالخطأ')
    expect((await h.db.select({ s: products.stock }).from(products).where(eq(products.id, bookId)))[0]!.s).toBe(stock + 1)
    expect((await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))).some((n) => n.title.includes(o.number) && n.title.includes('أُلغي'))).toBe(true)
  })
  it('بعد التسليم لشركة التوصيل: لا إلغاء من الزبون', async () => {
    const buyer = await makeStudent(h.db, 'تلميذ شُحن')
    const o = await placeOrder(h.db, buyer, { items: [{ productId: bookId, qty: 1 }], customerName: 'x', phone: '0552222222', wilayaId, address: 'x' })
    await setOrderStatus(h.db, admin, o.id, 'CONFIRMED')
    await h.db.update(orders).set({ deliveryProvider: 'ecotrack', deliveryTrackingId: 'ECO-9' }).where(eq(orders.id, o.id))
    expect((await myTrackedOrders(h.db, buyer))[0]!.canCancel).toBe(false)
    await expectCode(() => cancelMyOrder(h.db, buyer, o.id, 'delay'), 'ORDER_NOT_CANCELLABLE')
    const pub = await trackByPhone(h.db, '0552222222')
    expect(pub[0]!.trackingId).toBe('ECO-9')
  })
})
