/**
 * الواجهة المبسّطة للأستاذ: أرقام لوحته محصورة في مساحته، والأدوات القديمة لم تُحذف.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { navFor, TEACHER_TOOLS } from '@/components/layout/nav'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, liveSessions, orderItems, orders } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { createContent } from '@/server/services/content.service'
import { createCourse, enrollStudent, linkProduct } from '@/server/services/courses.service'
import { createProduct } from '@/server/services/store.service'
import { teacherHome } from '@/server/services/teacher-home.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, uniq, workspaceIdOfTeacher } from './helpers'
import { eq } from 'drizzle-orm'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let other: Actor

beforeAll(async () => {
  h = await setupDb()
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'أستاذ الواجهة')
  other = await makeTeacher(h.db, admin, 'أستاذ آخر')
})
afterAll(async () => {
  await h.close()
})

async function order(userId: string, status: string, productId: string, price: number, qty = 1) {
  const [o] = await h.db.insert(orders).values({ number: uniq('ORD'), userId, status, customerName: 'زبون', phone: '0550000000', subtotalDzd: price * qty, totalDzd: price * qty }).returning()
  await h.db.insert(orderItems).values({ orderId: o!.id, productId, title: 'كتاب', type: 'BOOK', unitPriceDzd: price, qty, lineTotalDzd: price * qty })
}

describe('لوحة الأستاذ المبسّطة', () => {
  it('المسجّلون: النشط فقط في الرقم الكبير، والمجموع منذ البداية؛ دورات غيره لا تظهر', async () => {
    const ws = await workspaceIdOfTeacher(h.db, teacher)
    const otherWs = await workspaceIdOfTeacher(h.db, other)
    const mine = await createCourse(h.db, admin, { title: 'دورتي', workspaceId: ws, season: '2026/2027', status: 'DRAFT', priceDzd: 4900 })
    await publishLegacyCourse(h.db, mine.id)
    const theirs = await createCourse(h.db, admin, { title: 'دورة غيري', workspaceId: otherWs, season: '2026/2027', status: 'PUBLISHED' })
    const [s1, s2, s3] = [await makeStudent(h.db, 'ت1'), await makeStudent(h.db, 'ت2'), await makeStudent(h.db, 'ت3')]
    await enrollStudent(h.db, admin, { courseId: mine.id, studentId: s1.studentId!, source: 'MANUAL' })
    await enrollStudent(h.db, admin, { courseId: mine.id, studentId: s2.studentId!, source: 'MANUAL' })
    const e3 = await enrollStudent(h.db, admin, { courseId: mine.id, studentId: s3.studentId!, source: 'MANUAL' })
    await h.db.update(courseEnrollments).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(courseEnrollments.id, e3.id))
    await enrollStudent(h.db, admin, { courseId: theirs.id, studentId: s1.studentId!, source: 'MANUAL' })

    const home = await teacherHome(h.db, teacher)
    expect(home.courses.map((c) => c.title)).toEqual(['دورتي'])
    expect(home.enrolledActive).toBe(2)
    expect(home.enrolledTotal).toBe(3)
    expect(home.courses[0]).toMatchObject({ active: 2, total: 3 })
    // لا بيانات تلاميذ بأسمائهم في اللوحة
    expect(JSON.stringify(home)).not.toMatch(/ت1|ت2|ت3/)

    // المداخيل: كتب الدورة المسلَّمة = مؤكَّد، المؤكَّدة/المشحونة = قيد التوصيل، الملغاة والمعلّقة لا تُحتسب، كتب غيره لا تُحتسب
    const book = await createProduct(h.db, admin, { title: 'كتاب الدورة', priceDzd: 2500, status: 'PUBLISHED' })
    const otherBook = await createProduct(h.db, admin, { title: 'كتاب غيري', priceDzd: 9999, status: 'PUBLISHED' })
    await linkProduct(h.db, admin, mine.id, book.id)
    await linkProduct(h.db, admin, theirs.id, otherBook.id)
    await order(s1.userId, 'DELIVERED', book.id, 2500, 2)
    await order(s2.userId, 'DELIVERED', book.id, 2500)
    await order(s3.userId, 'SHIPPED', book.id, 2500)
    await order(s3.userId, 'CANCELLED', book.id, 2500)
    await order(s3.userId, 'PENDING', book.id, 2500)
    await order(s1.userId, 'DELIVERED', otherBook.id, 9999)
    const money = (await teacherHome(h.db, teacher)).income
    expect(money.deliveredDzd).toBe(7500)
    expect(money.deliveredOrders).toBe(2)
    expect(money.pendingDzd).toBe(2500)

    // الحصص السابقة: الماضية فقط، مع رابط التسجيل إن وُجد
    const rec = await createContent(h.db, teacher, { type: 'VIDEO', title: 'تسجيل الحصة 1', visibility: 'GROUP_ONLY', groupIds: [mine.groupId], videoProvider: 'YOUTUBE', externalUrl: 'https://youtu.be/dQw4w9WgXcQ', publish: true })
    await h.db.insert(liveSessions).values([
      { courseId: mine.id, title: 'الحصة 1', startsAt: new Date(Date.now() - 86_400_000), status: 'ENDED', recordingContentId: rec.id },
      { courseId: mine.id, title: 'الحصة القادمة', startsAt: new Date(Date.now() + 86_400_000), status: 'SCHEDULED' },
      { courseId: theirs.id, title: 'حصة غيري', startsAt: new Date(Date.now() - 3600_000), status: 'ENDED' }
    ])
    const past = (await teacherHome(h.db, teacher)).pastSessions
    expect(past.map((p) => p.title)).toEqual(['الحصة 1'])
    expect(past[0]!.recordingSlug).toBe(rec.slug)
  })

  it('للأستاذ فقط', async () => {
    await expect(teacherHome(h.db, admin)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
    await expect(teacherHome(h.db, await makeStudent(h.db))).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'FORBIDDEN')
  })
})

describe('قائمة الأستاذ المبسّطة', () => {
  const pageFile = (href: string) => join(process.cwd(), 'src/app', href.replace(/^\//, '').split('?')[0]!, 'page.tsx')
  const items = navFor('TEACHER').flatMap((s) => s.items)

  it('قرار 2026-10-24: المسجّلون والمداخيل، نشر المحتوى، التفاعل + الحساب — ولكل مدخل صفحة', () => {
    expect(items.map((i) => i.href)).toEqual(['/teacher', '/teacher/students', '/teacher/publish', '/teacher/content', '/teacher/classroom', '/teacher/comments', '/teacher/notifications', '/teacher/settings', '/teacher/tools'])
    for (const i of items) expect(existsSync(pageFile(i.href)), i.href).toBe(true)
  })

  it('أدوات التقييم والمحتوى باقية في «أدوات أخرى»؛ الحضور والأكواد والمساعدون مخفية', () => {
    const kept = ['/teacher/groups', '/teacher/announcements', '/teacher/assignments', '/teacher/quizzes', '/teacher/exams', '/teacher/bank', '/teacher/library', '/teacher/market', '/teacher/rubrics', '/teacher/drive', '/teacher/files', '/teacher/reports', '/teacher/ai-insights']
    const tools = TEACHER_TOOLS.map((x) => x.href)
    for (const href of kept) {
      expect(tools, href).toContain(href)
      expect(existsSync(pageFile(href)), href).toBe(true)
    }
    for (const hidden of ['/teacher/scanner', '/teacher/sessions', '/teacher/attendance', '/teacher/codes', '/teacher/assistants']) expect(tools).not.toContain(hidden)
  })
})
