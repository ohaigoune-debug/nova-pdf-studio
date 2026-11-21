/**
 * تفعيل الدورة بالكود — مدخل واحد بسيط (21 نوفمبر 2026، بعد معاناة التلاميذ):
 * أرقام عربية أو فرنسية، فراغات وشرطات، كود دورة 11 رقمًا أو كود طلب 6 أرقام بلا خانة هاتف.
 */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseClaims, courseEnrollments, profiles, students } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { codeDigits, codeKind, formatCode, toWesternDigits } from '@/lib/code-input'
import { createClaim } from '@/server/services/claims.service'
import { redeemTypedCode } from '@/server/services/code-redeem.service'
import { generateCourseCodes } from '@/server/services/course-codes.service'
import { courseBookStateById, setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, setCourseStatus } from '@/server/services/courses.service'
import { placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, refIds, setupDb, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let workspaceId: string
let wilayaId: string
let seq = 0
const phone = () => `05${String(30000000 + ++seq).slice(-8)}`
const AR = (s: string) => s.replace(/\d/g, (d) => String.fromCharCode(0x0660 + Number(d)))

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

async function courseWithBook() {
  const c = await createCourse(h.db, admin, { title: `دورة الكود ${++seq}`, workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: `كتاب ${seq}`, priceDzd: 2500, stock: 20, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  return { ...c, bookId: (await courseBookStateById(h.db, c.id)).book!.id }
}

async function deliveredOrder(bookId: string) {
  const o = await placeOrder(h.db, admin, { items: [{ productId: bookId, qty: 1 }], customerName: 'زبون', phone: phone(), wilayaId, address: 'عنوان' })
  for (const s of ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const) await setOrderStatus(h.db, admin, o.id, s)
  return o
}

const enrolled = async (studentId: string, courseId: string) =>
  (await h.db.select().from(courseEnrollments).where(eq(courseEnrollments.studentId, studentId))).some((e) => e.courseId === courseId && e.status === 'ACTIVE')

beforeAll(async () => {
  vi.stubEnv('STORE_SHIPPING_DZD', '0')
  h = await setupDb()
  admin = await makeAdmin(h.db)
  workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الأكواد'))
  wilayaId = (await refIds(h.db)).wilayaId!
})

afterAll(async () => {
  vi.unstubAllEnvs()
  await h.close()
})

describe('كتابة الكود كيفما كان', () => {
  it('الأرقام العربية والفارسية تتحوّل، والفواصل تُحذف، والنوع من عدد الأرقام', () => {
    expect(toWesternDigits('١٢٣۴۵')).toBe('12345')
    expect(codeDigits(' ١٢٣ ٤٥٦٧-٨٩٠١ ')).toBe('12345678901')
    expect(codeKind('12345678901')).toBe('COURSE')
    expect(codeKind('123456')).toBe('ORDER')
    expect(codeKind('1234567')).toBeNull()
    expect(formatCode('12345678901')).toBe('123 4567 8901')
  })
})

describe('مدخل واحد للتفعيل', () => {
  it('كود الدورة بالأرقام العربية ومع فراغات يُفعّل الدورة ويعيد رابطها', async () => {
    const c = await courseWithBook()
    const { codes } = await generateCourseCodes(h.db, admin, { courseId: c.id, count: 1 })
    const s = await makeStudent(h.db)
    const typed = AR(`${codes[0]!.slice(0, 3)} ${codes[0]!.slice(3, 7)}-${codes[0]!.slice(7)}`)
    const r = await redeemTypedCode(h.db, s, { code: typed })
    expect(r.href).toBe(`/student/courses/${encodeURIComponent(c.slug)}`)
    expect(await enrolled(s.studentId!, c.id)).toBe(true)
  })

  it('كود الطلب (6 أرقام) يُطابَق بهاتف الحساب تلقائيًّا، دون خانة هاتف', async () => {
    const c = await courseWithBook()
    const o = await deliveredOrder(c.bookId)
    const s = await makeStudent(h.db)
    const tel = phone()
    await h.db.update(profiles).set({ phone: tel }).where(eq(profiles.userId, s.userId))
    const claim = await createClaim(h.db, { orderId: o.id, courseId: c.id, phone: tel })
    await redeemTypedCode(h.db, await actorOf(h.db, s.userId), { code: AR(claim.code) })
    expect(await enrolled(s.studentId!, c.id)).toBe(true)
  })

  it('وبهاتف الوليّ كذلك، ولا يُحتسب فشل على هاتف لا يخصّ الكود', async () => {
    const c = await courseWithBook()
    const o = await deliveredOrder(c.bookId)
    const s = await makeStudent(h.db)
    const own = phone()
    const guardian = phone()
    await h.db.update(profiles).set({ phone: own }).where(eq(profiles.userId, s.userId))
    await h.db.update(students).set({ guardianPhone: guardian }).where(eq(students.id, s.studentId!))
    // رمز مفتوح آخر على هاتف التلميذ نفسه (طلب آخر): يجب ألا تزيد محاولاته
    const other = await createClaim(h.db, { orderId: (await deliveredOrder(c.bookId)).id, courseId: c.id, phone: own })
    const claim = await createClaim(h.db, { orderId: o.id, courseId: c.id, phone: guardian })
    await redeemTypedCode(h.db, s, { code: claim.code })
    expect(await enrolled(s.studentId!, c.id)).toBe(true)
    expect((await h.db.select().from(courseClaims).where(eq(courseClaims.id, other.id)))[0]!.attempts).toBe(0)
  })

  it('كود طلب وصل إلى هاتف ثالث ⇒ نطلب الهاتف؛ مع الهاتف الصحيح يُفعَّل', async () => {
    const c = await courseWithBook()
    const o = await deliveredOrder(c.bookId)
    const s = await makeStudent(h.db)
    const third = phone()
    const claim = await createClaim(h.db, { orderId: o.id, courseId: c.id, phone: third })
    await expectCode(() => redeemTypedCode(h.db, s, { code: claim.code }), 'CLAIM_NEEDS_PHONE')
    await redeemTypedCode(h.db, s, { code: claim.code, phone: AR(third) })
    expect(await enrolled(s.studentId!, c.id)).toBe(true)
  })

  it('عدد أرقام خاطئ ⇒ CODE_LENGTH؛ كود دورة غير موجود ⇒ CODE_INVALID؛ غير التلميذ ممنوع', async () => {
    const s = await makeStudent(h.db)
    await expectCode(() => redeemTypedCode(h.db, s, { code: '12345' }), 'CODE_LENGTH')
    await expectCode(() => redeemTypedCode(h.db, s, { code: '٠٠٠٠٠٠٠٠٠٠٠' }), 'CODE_INVALID')
    await expectCode(() => redeemTypedCode(h.db, admin, { code: '12345678901' }), 'FORBIDDEN')
  })
})
