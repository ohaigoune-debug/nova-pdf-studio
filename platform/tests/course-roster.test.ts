/**
 * تلاميذ دورة معيّنة (قرار المالك 21 نوفمبر 2026): قائمة منسدلة بالدورات وعدد المسجَّلين، وتفصيلهم،
 * ومداخيل الدورة (فواتير طلباتها ومبيعات نقاط البيع)، والتصفية، والتصدير إلى Excel، وطباعة فواتيرها.
 */
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { auditLogs, courseCodes, courseEnrollments, invoices, wilayas } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { setSmsSenderForTests } from '@/server/lib/sms'
import { registerStudent } from '@/server/services/auth.service'
import { createStaffAccount } from '@/server/services/confirmer.service'
import {
  courseInvoicesForPrint,
  courseOptions,
  courseRoster,
  courseRosterCsv,
  courseRosterForPrint,
  parseRosterFilters
} from '@/server/services/course-roster.service'
import { setCourseBook } from '@/server/services/course-purchase.service'
import { createCourse, enrollStudent, setCourseStatus } from '@/server/services/courses.service'
import { addPosMember, confirmPosSale, createPointOfSale, movePosStock, startPosSale } from '@/server/services/points-of-sale.service'
import { createProduct, placeOrder, setOrderStatus } from '@/server/services/store.service'
import { actorOf, makeAdmin, makeTeacher, refIds, setupDb, uniq, workspaceIdOfTeacher } from './helpers'

let h: DatabaseHandle
let admin: Actor
let courseId: string
let otherCourseId: string
let wilayaName: string
const ids: Record<'order' | 'pos' | 'manual' | 'revoked', { studentId: string; userId: string; phone: string }> = {} as never
let invoiceTotal = 0
let posPrice = 0
let n = 0
const phone = () => `0664${String(500000 + ++n).slice(-6)}`

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

beforeAll(async () => {
  h = await setupDb()
  setSmsSenderForTests({ name: 'memory', send: async () => undefined })
  admin = await makeAdmin(h.db)
  const workspaceId = await workspaceIdOfTeacher(h.db, await makeTeacher(h.db, admin, 'أستاذ الكشف'))
  const ref = await refIds(h.db)
  wilayaName = (await h.db.select({ n: wilayas.nameAr }).from(wilayas).where(eq(wilayas.id, ref.wilayaId!)))[0]!.n

  const c = await createCourse(h.db, admin, { title: 'دورة الفصل الأول', workspaceId, season: '2026/2027', status: 'DRAFT' })
  await setCourseBook(h.db, admin, c.id, { title: 'باقة الفصل الأول', priceDzd: 5900, stock: 100, active: true })
  await setCourseStatus(h.db, admin, c.id, 'PUBLISHED')
  courseId = c.id
  otherCourseId = (await createCourse(h.db, admin, { title: 'دورة أخرى', workspaceId, season: '2026/2027', status: 'DRAFT' })).id

  const reg = async (key: keyof typeof ids, fullName: string) => {
    const tel = phone()
    const r = await registerStudent(h.db, { password: 'Student@12345', fullName, phone: tel, guardianPhone: null, wilayaId: ref.wilayaId, levelId: ref.levelId, streamId: ref.streamId, email: null })
    ids[key] = { studentId: r.studentId!, userId: r.userId, phone: tel }
  }
  await reg('order', 'أمينة طلب')
  await reg('pos', 'بلال مكتبة')
  await reg('manual', 'خالد منتهي')
  await reg('revoked', 'دنيا ملغاة')

  // 1) من طلب مُسلَّم ⇒ فاتورة
  const book = await createProduct(h.db, admin, { title: 'كتاب', type: 'BOOK', priceDzd: 2500, stock: 10, status: 'PUBLISHED' })
  const buyer = await actorOf(h.db, ids.order.userId)
  const o = await placeOrder(h.db, buyer, { items: [{ productId: book.id, qty: 1 }], customerName: 'أمينة طلب', phone: ids.order.phone, wilayaId: ref.wilayaId!, address: 'حي 20 أوت' })
  for (const s of ['CONFIRMED', 'SHIPPED', 'DELIVERED'] as const) await setOrderStatus(h.db, admin, o.id, s)
  const [inv] = await h.db.select().from(invoices).where(eq(invoices.orderId, o.id))
  invoiceTotal = inv!.totalDzd
  await enrollStudent(h.db, admin, { courseId, studentId: ids.order.studentId, source: 'BOOK_ORDER', orderId: o.id, silent: true })

  // 2) من نقطة بيع برمز SMS
  const m = await createStaffAccount(h.db, admin, { email: uniq('mgr') + '@test.dz', password: 'Manager@12345', fullName: 'مدير', phone: '0771234598', role: 'MANAGER' })
  const manager = await actorOf(h.db, m.userId)
  const pos = await createPointOfSale(h.db, manager, { name: 'مكتبة النجاح', wilayaId: ref.wilayaId, phone: phone() })
  const creds = await addPosMember(h.db, manager, pos.id, { fullName: 'صاحب المكتبة', phone: phone() })
  await movePosStock(h.db, manager, pos.id, { courseId, qty: 3 })
  const member = await actorOf(h.db, creds.userId)
  const { devCode } = await startPosSale(h.db, member, { courseId, phone: ids.pos.phone })
  await confirmPosSale(h.db, member, { courseId, phone: ids.pos.phone, code: devCode! })
  posPrice = Number((await h.db.select({ p: courseCodes.salePriceDzd }).from(courseCodes).where(and(eq(courseCodes.courseId, courseId), eq(courseCodes.usedByStudentId, ids.pos.studentId))))[0]?.p ?? 0)

  // 3) يدوي انتهى أجله، 4) ملغى، 5) دورة أخرى
  await enrollStudent(h.db, admin, { courseId, studentId: ids.manual.studentId, source: 'MANUAL', expiresAt: new Date(Date.now() - 86_400_000), silent: true })
  await enrollStudent(h.db, admin, { courseId, studentId: ids.revoked.studentId, source: 'MANUAL', silent: true })
  await h.db.update(courseEnrollments).set({ status: 'REVOKED' }).where(and(eq(courseEnrollments.courseId, courseId), eq(courseEnrollments.studentId, ids.revoked.studentId)))
  await enrollStudent(h.db, admin, { courseId: otherCourseId, studentId: ids.manual.studentId, source: 'GIFT', silent: true })
})

afterAll(async () => {
  setSmsSenderForTests(null)
  await h.close()
})

describe('تلاميذ دورة معيّنة', () => {
  it('القائمة المنسدلة: كل دورة بعدد المسجَّلين الآن والإجمالي، الأكثر أولًا', async () => {
    const opts = await courseOptions(h.db, admin)
    const mine = opts.find((o) => o.id === courseId)!
    expect(mine).toMatchObject({ title: 'دورة الفصل الأول', active: 2, total: 4 })
    expect(opts.find((o) => o.id === otherCourseId)).toMatchObject({ active: 1, total: 1 })
    expect(opts.findIndex((o) => o.id === courseId)).toBeLessThan(opts.findIndex((o) => o.id === otherCourseId))
  })

  it('العدد والحسابات: الحالات، المصدر، الولاية، مداخيل الفواتير ومبيعات نقاط البيع', async () => {
    const r = await courseRoster(h.db, admin, { courseId, ...parseRosterFilters({}) })
    expect(r.matched).toBe(2)
    expect(r.stats).toMatchObject({ total: 4, active: 2, expired: 1, revoked: 1, newInMonth: 4, orderWithoutInvoice: 0 })
    expect(r.stats.invoiced).toEqual({ count: 1, totalDzd: invoiceTotal })
    expect(posPrice).toBeGreaterThan(0)
    expect(r.stats.pos).toEqual({ count: 1, totalDzd: posPrice })
    expect(r.stats.bySource.map((s) => [s.source, s.n]).sort()).toEqual([['BOOK_ORDER', 1], ['POS', 1]])
    expect(r.stats.byWilaya).toEqual([{ name: wilayaName, n: 2 }])
    const order = r.rows.find((x) => x.studentId === ids.order.studentId)!
    expect(order).toMatchObject({ fullName: 'أمينة طلب', phone: ids.order.phone, wilaya: wilayaName, status: 'ACTIVE', invoiceTotalDzd: invoiceTotal, invoiceCancelled: false })
    expect(order.invoiceNumber).toBeTruthy()
    expect(r.rows.find((x) => x.studentId === ids.pos.studentId)).toMatchObject({ source: 'POS', posName: 'مكتبة النجاح', posPriceDzd: posPrice, invoiceNumber: null })
  })

  it('التصفية: الحالة، المصدر، الشهر، والبحث بالاسم أو بأرقام الهاتف', async () => {
    const run = async (sp: Record<string, string>) => (await courseRoster(h.db, admin, { courseId, ...parseRosterFilters(sp) })).rows.map((x) => x.studentId)
    expect(await run({ status: 'EXPIRED' })).toEqual([ids.manual.studentId])
    expect(await run({ status: 'REVOKED' })).toEqual([ids.revoked.studentId])
    expect((await run({ status: 'ALL' })).length).toBe(4)
    expect(await run({ source: 'POS' })).toEqual([ids.pos.studentId])
    expect(await run({ q: ids.order.phone.slice(4) })).toEqual([ids.order.studentId])
    expect(await run({ q: 'بلال' })).toEqual([ids.pos.studentId])
    expect(await run({ status: 'ALL', month: '2020-01' })).toEqual([])
    // قيم غير صالحة ⇒ الافتراضي (المسجَّلون الآن)
    expect(parseRosterFilters({ status: 'X', source: 'Y', month: '2026-13', q: '  ' })).toEqual({ status: 'ACTIVE', source: null, month: null, q: null })
  })

  it('Excel: ملف CSV بالعربية بالتصفية نفسها، ويُسجَّل التصدير في سجلّ النشاط', async () => {
    const { csv, count, filename } = await courseRosterCsv(h.db, admin, { courseId, ...parseRosterFilters({ status: 'ALL' }) })
    expect(count).toBe(4)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv.split('﻿').length).toBe(2) // BOM واحد فقط
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(5)
    expect(lines[0]).toContain('الاسم واللقب')
    expect(csv).toContain('مكتبة النجاح')
    expect(filename).toMatch(/^تلاميذ-.+\.csv$/)
    const logs = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'course.roster_export'), eq(auditLogs.entityId, courseId)))
    expect(logs).toHaveLength(1)
    expect(logs[0]!.newValue).toMatchObject({ rows: 4, status: 'ALL' })
  })

  it('الطباعة: الكشف كاملًا، وفواتير طلبات الدورة دفعة واحدة', async () => {
    const p = await courseRosterForPrint(h.db, admin, { courseId, ...parseRosterFilters({ status: 'ALL' }) })
    expect(p.rows).toHaveLength(4)
    const inv = await courseInvoicesForPrint(h.db, admin, { courseId, ...parseRosterFilters({}) })
    expect(inv.invoices).toHaveLength(1)
    expect(inv.invoices[0]!.totalDzd).toBe(invoiceTotal)
    expect(inv.more).toBe(false)
    expect((await courseInvoicesForPrint(h.db, admin, { courseId: otherCourseId, ...parseRosterFilters({}) })).invoices).toHaveLength(0)
  })

  it('المشرف وحده، ودورة غير موجودة ⇒ COURSE_NOT_FOUND', async () => {
    const student = await actorOf(h.db, ids.order.userId)
    await expectCode(() => courseOptions(h.db, student), 'FORBIDDEN')
    await expectCode(() => courseRoster(h.db, student, { courseId }), 'FORBIDDEN')
    await expectCode(() => courseRosterCsv(h.db, student, { courseId }), 'FORBIDDEN')
    await expectCode(() => courseRoster(h.db, admin, { courseId: '00000000-0000-4000-8000-000000000000' }), 'COURSE_NOT_FOUND')
    await expectCode(() => courseRoster(h.db, admin, { courseId: 'not-a-uuid' }), 'COURSE_NOT_FOUND')
  })
})
