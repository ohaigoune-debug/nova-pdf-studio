/**
 * نقاط البيع (قرار المالك 2 نوفمبر 2026): مدارس شريكة تستلم باقات وتولّد كود التفعيل لحظة البيع.
 * المطلوب: الدخول بالهاتف، لا تجاوز للمخزون، الكود يُستعمل مرة واحدة ويُسجَّل بيعًا على النقطة لحظة توليده،
 * الإلغاء خلال 48 ساعة يعيد الباقة، والحساب المالي (السعر − العمولة − ما سُدّد) صحيح، والصلاحيات محصورة.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, notifications, products } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { login } from '@/server/services/auth.service'
import { createStaffAccount } from '@/server/services/confirmer.service'
import { redeemCourseCode } from '@/server/services/course-codes.service'
import { setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import {
  addPosMember,
  cancelPosCode,
  createPointOfSale,
  generatePosCode,
  generatePosCodeFor,
  listPosCodes,
  movePosStock,
  posSummary,
  publicPointsOfSale,
  recordPosPayment,
  requestRestock,
  resetPosMemberPassword,
  setPosStatus,
  updatePointOfSale
} from '@/server/services/points-of-sale.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let manager: Actor
let workspaceId: string
let wilayaId: string
let n = 0

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

/** دورة منشورة بكتاب (سعر الباقة 6500، مخزون المخزن 50) */
async function bundleCourse(price = 6500, stock: number | null = 50) {
  const c = await createCourse(h.db, admin, { title: `دورة الباقات ${++n}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `باقة الكتب ${n}`, priceDzd: price, stock, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return c
}
let phoneN = 0
const phone = () => `0661${String(100000 + ++phoneN).slice(-6)}`

/** نقطة بيع بحساب واحد (يدخل بالهاتف) */
async function school(name = `مدرسة ${++n}`) {
  const pos = await createPointOfSale(h.db, manager, { name, wilayaId, address: 'حي النصر', phone: phone() })
  const creds = await addPosMember(h.db, manager, pos.id, { fullName: `مسيّر ${name}`, phone: phone() })
  return { pos, creds, member: await actorOf(h.db, creds.userId) }
}

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الباقات'))
  wilayaId = (await refIds(h.db)).wilayaId!
  const m = await createStaffAccount(h.db, admin, { email: uniq('manager') + '@test.dz', password: 'Manager@12345', fullName: 'مدير العمليات', phone: '0771234567', role: 'MANAGER' })
  manager = await actorOf(h.db, m.userId)
})
afterAll(async () => {
  await h.close()
})

describe('نقاط البيع', () => {
  it('مدير العمليات يضيف المدرسة وحسابها؛ الحساب يدخل بالهاتف وكلمة السر المولَّدة، ورابط واتساب جاهز', async () => {
    const { pos, creds } = await school('مدرسة الأمل')
    expect(creds.password).toMatch(/^[a-z]{6}\d{4}$/)
    expect(creds.whatsappUrl).toContain(`wa.me/213${creds.phone.slice(1)}`)
    expect(decodeURIComponent(creds.whatsappUrl)).toContain(creds.password)
    const r = await login(h.db, { email: creds.phone, password: creds.password })
    expect(r.role).toBe('POINT_OF_SALE')
    await expectCode(() => login(h.db, { email: creds.phone, password: 'wrong-pass' }), 'INVALID_CREDENTIALS')
    // الرقم نفسه لا يُستعمل لحساب نقطة بيع ثانٍ
    await expectCode(() => addPosMember(h.db, manager, pos.id, { fullName: 'ثانٍ', phone: creds.phone }), 'POS_PHONE_TAKEN')
    // كلمة سر جديدة تُبطل القديمة
    const again = await resetPosMemberPassword(h.db, manager, creds.userId)
    await expectCode(() => login(h.db, { email: creds.phone, password: creds.password }), 'INVALID_CREDENTIALS')
    expect((await login(h.db, { email: again.phone, password: again.password })).role).toBe('POINT_OF_SALE')
    // التلميذ والمشرف يدخلان بالبريد كما كانا
    expect((await login(h.db, { email: 'nobody@test.dz', password: 'x' }).catch((e) => e.code))).toBe('INVALID_CREDENTIALS')
  })

  it('العمولة للمشرف وحده: مدير العمليات يعدّل البيانات ولا يغيّر العمولة', async () => {
    const { pos } = await school()
    const updated = await updatePointOfSale(h.db, manager, pos.id, { name: 'اسم جديد', commissionDzd: 5000 })
    expect(updated.name).toBe('اسم جديد')
    expect(updated.commissionDzd).toBe(1000)
    expect((await updatePointOfSale(h.db, admin, pos.id, { name: 'اسم جديد', commissionDzd: 1200 })).commissionDzd).toBe(1200)
  })

  it('الباقات المرسَلة تُخصم من مخزن الكتب؛ لا يتجاوز التوليد المخزون، والعدّاد ينقص مع كل بيع', async () => {
    const c = await bundleCourse(6500, 50)
    const { pos, member } = await school()
    const [book0] = await h.db.select({ stock: products.stock }).from(products).where(eq(products.title, `باقة الكتب ${n - 1}`))
    expect((await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 3 })).remaining).toBe(3)
    const [book1] = await h.db.select({ stock: products.stock }).from(products).where(eq(products.title, `باقة الكتب ${n - 1}`))
    expect(book1!.stock).toBe(book0!.stock! - 3)
    const a = await generatePosCode(h.db, member, c.id)
    expect(a.code).toMatch(/^\d{11}$/)
    expect(a.remaining).toBe(2)
    expect(a.priceDzd).toBe(6500)
    expect(a.shareText).toContain('/claim')
    await generatePosCode(h.db, member, c.id)
    expect((await generatePosCode(h.db, member, c.id)).remaining).toBe(0)
    await expectCode(() => generatePosCode(h.db, member, c.id), 'POS_OUT_OF_STOCK')
    // استرجاع ما لم يُبع فقط
    await expectCode(() => movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: -1 }), 'POS_RETURN_TOO_MANY')
    await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 2 })
    expect((await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: -1 })).remaining).toBe(1)
  })

  it('التلميذ يُدخل الكود فتُفتح الدورة (مصدر POS) مرة واحدة، ويظهر «فُعِّل» عند المدرسة', async () => {
    const c = await bundleCourse()
    const { pos, member } = await school()
    await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 2 })
    const g = await generatePosCode(h.db, member, c.id)
    const s = await makeStudent(h.db, 'تلميذ المدرسة')
    expect((await redeemCourseCode(h.db, s, g.code)).courseId).toBe(c.id)
    const [en] = await h.db.select().from(courseEnrollments).where(and(eq(courseEnrollments.studentId, s.studentId!), eq(courseEnrollments.courseId, c.id)))
    expect(en).toMatchObject({ source: 'POS', status: 'ACTIVE' })
    const other = await makeStudent(h.db, 'تلميذ آخر')
    await expectCode(() => redeemCourseCode(h.db, other, g.code), 'COURSE_CODE_USED')
    const codes = await listPosCodes(h.db, member, pos.id)
    expect(codes.find((x) => x.id === g.codeId)).toMatchObject({ status: 'USED', code: g.code, cancellable: false })
  })

  it('الإلغاء: المدرسة خلال 48 ساعة لكود لم يُستعمل فتعود الباقة؛ بعدها لمدير العمليات وحده؛ والملغى لا يُفعِّل', async () => {
    const c = await bundleCourse()
    const { pos, member } = await school()
    await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 2 })
    const g1 = await generatePosCode(h.db, member, c.id)
    await cancelPosCode(h.db, member, g1.codeId)
    expect((await generatePosCode(h.db, member, c.id)).remaining).toBe(1)
    const s = await makeStudent(h.db, 'كود ملغى')
    await expectCode(() => redeemCourseCode(h.db, s, g1.code), 'POS_CODE_CANCELLED')
    const g2 = await generatePosCode(h.db, member, c.id)
    const later = new Date(Date.now() + 49 * 3600 * 1000)
    await expectCode(() => cancelPosCode(h.db, member, g2.codeId, later), 'POS_CODE_NOT_CANCELLABLE')
    await cancelPosCode(h.db, manager, g2.codeId, later)
    await expectCode(() => cancelPosCode(h.db, manager, g2.codeId), 'POS_CODE_NOT_CANCELLABLE')
  })

  it('الحساب: كل كود غير ملغى = (السعر − العمولة) على المدرسة؛ المال المستلَم يُنقصه؛ المدرسة لا تسجّل مالًا', async () => {
    const c = await bundleCourse(6500)
    const { pos, member } = await school()
    await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 5 })
    for (let i = 0; i < 3; i++) await generatePosCode(h.db, member, c.id)
    let sum = await posSummary(h.db, pos.id)
    expect(sum).toMatchObject({ soldCount: 3, grossDzd: 19500, commissionDzd: 3000, owedDzd: 16500, paidDzd: 0 })
    expect(sum.stock.find((x) => x.courseId === c.id)).toMatchObject({ sent: 5, sold: 3, remaining: 2 })
    await recordPosPayment(h.db, manager, pos.id, { amountDzd: 10000, note: 'دفعة نقدًا' })
    sum = await posSummary(h.db, pos.id)
    expect(sum).toMatchObject({ owedDzd: 6500, paidDzd: 10000 })
    await expectCode(() => recordPosPayment(h.db, member, pos.id, { amountDzd: 100 }), 'FORBIDDEN')
    // العمولة مجمَّدة في الكود: تغييرها لاحقًا لا يغيّر ما بيع
    await updatePointOfSale(h.db, admin, pos.id, { name: pos.name, commissionDzd: 2000 })
    expect((await posSummary(h.db, pos.id)).commissionDzd).toBe(3000)
  })

  it('الإغلاق يوقف التوليد؛ مدير العمليات يولّد نيابةً عن المدرسة ويُحسب عليها؛ ولا تطّلع مدرسة على أخرى', async () => {
    const c = await bundleCourse()
    const a = await school()
    const b = await school()
    await movePosStock(h.db, manager, a.pos.id, { courseId: c.id, qty: 3 })
    await setPosStatus(h.db, manager, a.pos.id, 'SUSPENDED')
    await expectCode(() => generatePosCode(h.db, a.member, c.id), 'POS_SUSPENDED')
    await setPosStatus(h.db, manager, a.pos.id, 'ACTIVE')
    const g = await generatePosCodeFor(h.db, manager, a.pos.id, c.id)
    expect(g.remaining).toBe(2)
    expect((await posSummary(h.db, a.pos.id)).soldCount).toBe(1)
    await expectCode(() => listPosCodes(h.db, b.member, a.pos.id), 'FORBIDDEN')
    await expectCode(() => cancelPosCode(h.db, b.member, g.codeId), 'FORBIDDEN')
    await expectCode(() => generatePosCodeFor(h.db, a.member, a.pos.id, c.id), 'FORBIDDEN')
  })

  it('تنبيه عند بلوغ حدّ التنبيه، و«اطلب باقات جديدة» يصل لمدير العمليات', async () => {
    const c = await bundleCourse()
    const { pos, member } = await school()
    await updatePointOfSale(h.db, admin, pos.id, { name: pos.name, lowStockAlert: 1 })
    await movePosStock(h.db, manager, pos.id, { courseId: c.id, qty: 2 })
    await generatePosCode(h.db, member, c.id)
    const mine = await h.db.select().from(notifications).where(eq(notifications.userId, manager.userId))
    expect(mine.some((x) => x.title.includes('بقي 1'))).toBe(true)
    await requestRestock(h.db, member, { courseId: c.id, qty: 20 })
    const after = await h.db.select().from(notifications).where(eq(notifications.userId, manager.userId))
    expect(after.some((x) => x.title.includes('تطلب باقات جديدة (20)'))).toBe(true)
  })

  it('صفحة «نقاط البيع» العامة: الفعّالة الظاهرة فقط، بلا أرقام مالية', async () => {
    const shown = await school('مدرسة ظاهرة')
    const hidden = await school('مدرسة مخفية')
    await updatePointOfSale(h.db, manager, hidden.pos.id, { name: 'مدرسة مخفية', listed: false })
    const list = (await publicPointsOfSale(h.db)).flatMap((g) => g.items)
    expect(list.some((x) => x.id === shown.pos.id)).toBe(true)
    expect(list.some((x) => x.id === hidden.pos.id)).toBe(false)
    expect(Object.keys(list[0]!)).toEqual(['id', 'name', 'address', 'phone'])
  })
})
