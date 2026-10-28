/**
 * تعديلات الطلب أثناء التأكيد الهاتفي (قرار المالك 2026-10-28): المشرف وموظف التأكيد
 * يغيّران الشعبة والمبلغ ويحظران حساب الزبون. كل تعديل:
 * - قبل الشحن فقط (لا رقم تتبّع، والحالة في مرحلة التأكيد أو «مؤكَّد»)، لأن الطرد عند الناقل بمبلغه.
 * - داخل معاملة تقفل الطلب، ومع سجلّ تدقيق بالقيمة القديمة والجديدة ومن قام به.
 * لا يغيّر الأسعار في المنتجات ولا نموذج البيع؛ يغيّر هذا الطلب وحده.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revokeAllSessions } from '@/server/auth/session'
import type { Db } from '@/server/db/connect'
import { courseProducts, courses, orderItems, orders, streams, users } from '@/server/db/schema'
import { CONFIRMATION_STATUSES, type OrderStatus } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { streamFamily } from './academy-catalog.service'
import { transitionOrder, type OrderRow } from './order-status.service'

/** أدوار الزبائن الذين يجوز للموظف حظرهم؛ حسابات الطاقم لا تُحظر من هنا أبدًا. */
const CUSTOMER_ROLES = ['STUDENT', 'PARENT', 'PUBLIC'] as const
const EDITABLE_STATUSES: readonly OrderStatus[] = [...CONFIRMATION_STATUSES, 'CONFIRMED']
const MAX_AMOUNT_DZD = 1_000_000

function cleanReason(reason: string | null | undefined): string {
  const text = reason?.trim() ?? ''
  if (text.length < 3 || text.length > 300) throw new AppError('VALIDATION', { field: 'reason' })
  return text
}

/** يقفل الطلب ويتحقق أنه ما زال قابلًا للتعديل (لم يُشحن ولم يُسلَّم ولم يُلغَ). */
async function lockEditable(tx: Db, orderId: string): Promise<OrderRow> {
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update').limit(1)
  if (!order) throw new AppError('ORDER_NOT_FOUND')
  if (order.deliveryTrackingId || !EDITABLE_STATUSES.includes(order.status as OrderStatus)) throw new AppError('ORDER_LOCKED')
  return order
}

/**
 * تغيير شعبة الطلب (الكتاب الموجّه بالشعبة يُجهَّز بها). إن احتوى الطلب كتاب دورة محدّدة الشعب،
 * يجب أن تكون الشعبة الجديدة من شعب الدورة — القاعدة نفسها التي يطبّقها الطلب عند إنشائه.
 */
export async function changeOrderStream(db: Db, actor: Actor, orderId: string, streamId: string): Promise<OrderRow> {
  assertRole(actor, 'SUPER_ADMIN', 'CONFIRMER')
  assertUuid(streamId, 'VALIDATION')
  return db.transaction(async (tx) => {
    const order = await lockEditable(tx, orderId)
    const [stream] = await tx.select({ id: streams.id }).from(streams).where(eq(streams.id, streamId)).limit(1)
    if (!stream) throw new AppError('VALIDATION', { field: 'streamId' })
    if (order.streamId === streamId) return order
    const items = await tx.select({ productId: orderItems.productId, courseId: orderItems.courseId }).from(orderItems).where(eq(orderItems.orderId, order.id))
    const explicit = items.map((i) => i.courseId).filter((c): c is string => Boolean(c))
    const linked = explicit.length
      ? await tx.select({ streamIds: courses.streamIds }).from(courses).where(inArray(courses.id, explicit))
      : items.length
        ? await tx.select({ streamIds: courses.streamIds }).from(courseProducts).innerJoin(courses, eq(courses.id, courseProducts.courseId))
          .where(and(inArray(courseProducts.productId, items.map((i) => i.productId)), isNull(courses.deletedAt)))
        : []
    if (linked.length) {
      const family = await streamFamily(tx, streamId)
      const open = linked.every((c) => c.streamIds.length === 0 || c.streamIds.some((id) => family.includes(id)))
      if (!open) throw new AppError('ORDER_STREAM_MISMATCH', { product: '' })
    }
    const [row] = await tx.update(orders).set({ streamId, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'store.order_stream', entityType: 'order', entityId: order.id, oldValue: { streamId: order.streamId }, newValue: { streamId } })
    return row!
  })
}

/**
 * تغيير مبلغ الطلب: ثمن السلع و/أو رسوم التوصيل، والإجمالي = الثمن + التوصيل دائمًا
 * (محرّك الحالات يعيد حسابه بالطريقة نفسها). السبب إلزامي ويُحفظ في سجلّ التدقيق.
 */
export async function adjustOrderAmount(db: Db, actor: Actor, orderId: string, input: { subtotalDzd?: number | null; shippingDzd?: number | null; reason: string }): Promise<OrderRow> {
  assertRole(actor, 'SUPER_ADMIN', 'CONFIRMER')
  const reason = cleanReason(input.reason)
  const valid = (v: number | null | undefined) => v == null || (Number.isInteger(v) && v >= 0 && v <= MAX_AMOUNT_DZD)
  if (!valid(input.subtotalDzd)) throw new AppError('VALIDATION', { field: 'subtotalDzd' })
  if (!valid(input.shippingDzd)) throw new AppError('VALIDATION', { field: 'shippingDzd' })
  if (input.subtotalDzd == null && input.shippingDzd == null) throw new AppError('VALIDATION', { field: 'subtotalDzd' })
  return db.transaction(async (tx) => {
    const order = await lockEditable(tx, orderId)
    const subtotalDzd = input.subtotalDzd ?? order.subtotalDzd
    const shippingDzd = input.shippingDzd ?? order.shippingDzd
    if (subtotalDzd === order.subtotalDzd && shippingDzd === order.shippingDzd) return order
    const [row] = await tx.update(orders).set({ subtotalDzd, shippingDzd, totalDzd: subtotalDzd + shippingDzd, updatedAt: new Date() }).where(eq(orders.id, order.id)).returning()
    await writeAudit(tx, {
      actorUserId: actor.userId,
      workspaceId: null,
      action: 'store.order_amount',
      entityType: 'order',
      entityId: order.id,
      oldValue: { subtotalDzd: order.subtotalDzd, shippingDzd: order.shippingDzd, totalDzd: order.totalDzd },
      newValue: { subtotalDzd, shippingDzd, totalDzd: subtotalDzd + shippingDzd, reason }
    })
    return row!
  })
}

/**
 * حظر صاحب الطلب: يوقف حسابه (لا دخول ولا طلبات جديدة)، ويُنهي جلساته، ويلغي طلباته التي ما زالت
 * في مرحلة التأكيد. للزبائن فقط (تلميذ/وليّ/عام)، لا للأساتذة ولا للطاقم. رفع الحظر للمشرف وحده.
 */
export async function banOrderCustomer(db: Db, actor: Actor, orderId: string, reasonInput: string): Promise<{ userId: string; cancelledOrders: number }> {
  assertRole(actor, 'SUPER_ADMIN', 'CONFIRMER')
  const reason = cleanReason(reasonInput)
  assertUuid(orderId, 'ORDER_NOT_FOUND')
  const [order] = await db.select({ id: orders.id, number: orders.number, userId: orders.userId }).from(orders).where(eq(orders.id, orderId)).limit(1)
  if (!order) throw new AppError('ORDER_NOT_FOUND')
  const [customer] = await db.select({ id: users.id, role: users.role, status: users.status }).from(users).where(eq(users.id, order.userId)).limit(1)
  if (!customer) throw new AppError('ORDER_NOT_FOUND')
  if (!(CUSTOMER_ROLES as readonly string[]).includes(customer.role) || customer.id === actor.userId) throw new AppError('FORBIDDEN')
  await db.transaction(async (tx) => {
    if (customer.status !== 'DISABLED') {
      await tx.update(users).set({ status: 'DISABLED' }).where(eq(users.id, customer.id))
      await revokeAllSessions(tx, customer.id)
    }
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: null, action: 'store.customer_ban', entityType: 'user', entityId: customer.id, oldValue: { status: customer.status }, newValue: { status: 'DISABLED', reason, orderId: order.id, orderNumber: order.number } })
  })
  // كل طلب مفتوح يمر بمحرّك الحالات نفسه (المخزون، الإشعار، التدقيق).
  const open = await db.select({ id: orders.id }).from(orders)
    .where(and(eq(orders.userId, customer.id), inArray(orders.status, [...CONFIRMATION_STATUSES]), isNull(orders.deliveryTrackingId)))
  for (const o of open) await transitionOrder(db, o.id, 'CANCELLED', { actorUserId: actor.userId, source: 'admin', reason: `حظر الحساب: ${reason}` })
  return { userId: customer.id, cancelledOrders: open.length }
}
