/**
 * إتمام صفحة طلب الدورة (البند ب4، 12 نوفمبر 2026): من فتح صفحة الطلب، وكم منهم أرسل طلب كتاب دورة.
 * الرقم يقيس أثر تقصير الصفحة قبل التغيير وبعده. يُحسب بالتلاميذ (لا بمرات الفتح)، فتحديث الصفحة لا يغيّره.
 */
import { and, eq, gte, isNotNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { activityLogs, orderItems, orders } from '@/server/db/schema'
import { writeActivity } from '@/server/lib/audit'

export const COURSE_ORDER_VIEW_EVENT = 'course_order.view'

/** فتح صفحة طلب دورة بنموذج الطلب ظاهرًا. لا يُفشل الصفحة إن تعذّر التسجيل. */
export async function recordCourseOrderView(db: Db, userId: string, courseId: string): Promise<void> {
  await writeActivity(db, { userId, event: COURSE_ORDER_VIEW_EVENT, meta: { courseId } }).catch(() => undefined)
}

export interface CourseOrderFunnel {
  days: number
  /** تلاميذ فتحوا صفحة الطلب في المدة */
  viewed: number
  /** منهم: من أرسل طلب كتاب دورة في المدة نفسها */
  placed: number
  /** النسبة المئوية، أو null إن لم يفتحها أحد */
  pct: number | null
}

export async function courseOrderFunnel(db: Db, now: Date = new Date(), days = 7): Promise<CourseOrderFunnel> {
  const since = new Date(now.getTime() - days * 86_400_000)
  const viewers = db
    .selectDistinct({ userId: activityLogs.userId })
    .from(activityLogs)
    .where(and(eq(activityLogs.event, COURSE_ORDER_VIEW_EVENT), gte(activityLogs.createdAt, since), isNotNull(activityLogs.userId)))
  const [v] = await db.select({ n: sql<number>`count(*)::int` }).from(viewers.as('viewers'))
  const [p] = await db
    .select({ n: sql<number>`count(distinct ${orders.userId})::int` })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .where(and(gte(orders.createdAt, since), isNotNull(orderItems.courseId), eq(orderItems.type, 'BOOK'), sql`${orders.userId} in (${viewers})`))
  const viewed = v?.n ?? 0
  const placed = p?.n ?? 0
  return { days, viewed, placed, pct: viewed ? Math.round((placed / viewed) * 100) : null }
}
