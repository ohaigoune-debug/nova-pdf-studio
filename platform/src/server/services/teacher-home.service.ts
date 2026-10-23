/**
 * الواجهة المبسّطة للأستاذ: دوراته وعدد المسجّلين فيها، ومداخيله، وحصصه السابقة.
 * قراءة فقط ومحصورة في مساحة الأستاذ (workspace) — لا يرى دورات غيره ولا بيانات تلاميذ بأسمائهم.
 */
import { and, asc, desc, eq, inArray, isNull, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, courseEnrollments, courseProducts, courses, liveSessions, orderItems, orders } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { qcol } from '@/server/db/sql-helpers'
import { AppError } from '@/server/lib/errors'
import { teacherEarnings } from './marketplace.service'

export interface TeacherCourseRow {
  id: string
  title: string
  status: string
  priceDzd: number
  /** اشتراك نشط غير منتهٍ */
  active: number
  /** كل من اشترك يوماً (نشط + منتهٍ + ملغى) */
  total: number
}

export interface TeacherPastSession {
  id: string
  courseTitle: string
  title: string
  startsAt: Date
  /** تسجيل الحصة إن رُبط بدرس */
  recordingSlug: string | null
}

export interface TeacherHome {
  courses: TeacherCourseRow[]
  enrolledActive: number
  enrolledTotal: number
  income: {
    /** مبيعات الكتب المرتبطة بدورات الأستاذ — طلبات سُلّمت (دخل مؤكَّد) */
    deliveredDzd: number
    deliveredOrders: number
    /** طلبات مؤكَّدة أو في الطريق (دخل متوقَّع) */
    pendingDzd: number
    /** حصة الأستاذ من «سوق الأساتذة» والرصيد المستحق له */
    marketEarnedDzd: number
    marketBalanceDzd: number
  }
  pastSessions: TeacherPastSession[]
}

export async function teacherHome(db: Db, actor: Actor): Promise<TeacherHome> {
  assertRole(actor, 'TEACHER')
  const workspaceId = actor.workspaceId
  if (!workspaceId) throw new AppError('FORBIDDEN')
  const now = new Date()

  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      status: courses.status,
      priceDzd: courses.priceDzd,
      active: sql<number>`(select count(*)::int from ${courseEnrollments} ce where ce.course_id = ${qcol(courses.id)} and ce.status = 'ACTIVE' and (ce.expires_at is null or ce.expires_at > now()))`,
      total: sql<number>`(select count(*)::int from ${courseEnrollments} ce where ce.course_id = ${qcol(courses.id)})`
    })
    .from(courses)
    .where(and(eq(courses.workspaceId, workspaceId), isNull(courses.deletedAt)))
    .orderBy(desc(courses.createdAt))
  const ids = rows.map((r) => r.id)

  // المنتجات المرتبطة بدورات الأستاذ (منتج مرتبط بدورتين يُحسب مرة واحدة)
  const productIds = ids.length ? Array.from(new Set((await db.select({ p: courseProducts.productId }).from(courseProducts).where(inArray(courseProducts.courseId, ids))).map((r) => r.p))) : []
  const sales = productIds.length
    ? await db
        .select({ status: orders.status, dzd: sql<number>`coalesce(sum(${orderItems.unitPriceDzd} * ${orderItems.qty}), 0)::int`, n: sql<number>`count(distinct ${orders.id})::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(and(inArray(orderItems.productId, productIds), inArray(orders.status, ['CONFIRMED', 'SHIPPED', 'DELIVERED'])))
        .groupBy(orders.status)
    : []
  const delivered = sales.find((s) => s.status === 'DELIVERED')
  const pendingDzd = sales.filter((s) => s.status !== 'DELIVERED').reduce((a, s) => a + s.dzd, 0)
  const market = await teacherEarnings(db, actor).catch(() => null)

  const past = ids.length
    ? await db
        .select({ id: liveSessions.id, courseId: liveSessions.courseId, title: liveSessions.title, startsAt: liveSessions.startsAt, recordingSlug: content.slug })
        .from(liveSessions)
        .leftJoin(content, and(eq(content.id, liveSessions.recordingContentId), isNull(content.deletedAt)))
        .where(and(inArray(liveSessions.courseId, ids), lt(liveSessions.startsAt, now)))
        .orderBy(desc(liveSessions.startsAt), asc(liveSessions.title))
        .limit(10)
    : []
  const titleOf = new Map(rows.map((r) => [r.id, r.title]))

  return {
    courses: rows,
    enrolledActive: rows.reduce((a, r) => a + r.active, 0),
    enrolledTotal: rows.reduce((a, r) => a + r.total, 0),
    income: {
      deliveredDzd: delivered?.dzd ?? 0,
      deliveredOrders: delivered?.n ?? 0,
      pendingDzd,
      marketEarnedDzd: market?.earnedDzd ?? 0,
      marketBalanceDzd: market?.balanceDzd ?? 0
    },
    pastSessions: past.map((p) => ({ id: p.id, courseTitle: titleOf.get(p.courseId) ?? '', title: p.title, startsAt: p.startsAt, recordingSlug: p.recordingSlug }))
  }
}
