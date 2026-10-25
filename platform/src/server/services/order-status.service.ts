/**
 * محرّك حالات الطلب (على نسق NOVA COMMERCE: state-machine + آثار جانبية في مكان واحد).
 * كل من يغيّر حالة طلب — المشرف، طابور التأكيد، webhook التوصيل، مزامنة EcoTrack، مكالمة التأكيد —
 * يمرّ من هنا، فتُطبَّق الانتقالات المسموحة والمخزون والتفعيل والإشعارات بالطريقة نفسها دائماً.
 */
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { courseClaims, orderItems, orders, products, users } from '@/server/db/schema'
import type { OrderStatus } from '@/server/db/schema/enums'
import { CONFIRMATION_STATUSES } from '@/server/db/schema/enums'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { sendTelegram } from '@/server/lib/telegram'
import { activateCoursesForOrder, type ActivationSummary } from './course-activation.service'
import { grantPurchasesForOrder } from './marketplace.service'
import { revokeEnrollmentsForReturnedOrder } from './courses.service'
import { notify, notifyMany } from './notifications.service'

export type OrderRow = typeof orders.$inferSelect

export const ORDER_STATUS_AR: Record<OrderStatus, string> = {
  PENDING: 'بانتظار التأكيد',
  NO_ANSWER: 'لا يردّ',
  CALL_LATER: 'اتصل لاحقاً',
  CONFIRMED: 'مؤكَّد',
  SHIPPED: 'في الطريق',
  DELIVERED: 'سُلِّم',
  RETURNED: 'مرتجع',
  CANCELLED: 'أُلغي'
}

/**
 * الانتقالات المسموحة (المفتاح: من، القيمة: إلى). وسّعها هنا عند إضافة حالة؛ لا شيء آخر يحتاج تغييراً.
 * NOVA: new → pending_confirmation/no_answer/call_later/confirmed/canceled … delivered → returned.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'NO_ANSWER', 'CALL_LATER', 'CANCELLED'],
  NO_ANSWER: ['CONFIRMED', 'NO_ANSWER', 'CALL_LATER', 'CANCELLED', 'PENDING'],
  CALL_LATER: ['CONFIRMED', 'NO_ANSWER', 'CALL_LATER', 'CANCELLED', 'PENDING'],
  CONFIRMED: ['SHIPPED', 'DELIVERED', 'CANCELLED', 'PENDING'],
  SHIPPED: ['DELIVERED', 'RETURNED', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  RETURNED: [],
  CANCELLED: ['PENDING']
}

export const canTransition = (from: OrderStatus, to: OrderStatus): boolean => ORDER_TRANSITIONS[from]?.includes(to) ?? false
export const isConfirmationStatus = (s: string): boolean => (CONFIRMATION_STATUSES as readonly string[]).includes(s)
/** الحالات التي يُحسب فيها الطلب مؤكَّداً (لنسبة التأكيد) */
export const CONFIRMED_STATUSES: readonly OrderStatus[] = ['CONFIRMED', 'SHIPPED', 'DELIVERED', 'RETURNED']

const isPhysical = (type: string) => type === 'BOOK' || type === 'PACK'

export interface TransitionOptions {
  /** من قام بالتغيير: مشرف (userId) أو النظام (null) */
  actorUserId: string | null
  /** مصدر التغيير، للتدقيق والإشعارات: admin | call | sms | delivery | ecotrack | system */
  source: 'admin' | 'call' | 'sms' | 'delivery' | 'ecotrack' | 'system' | 'customer'
  reason?: string | null
  adminNote?: string | null
  shippingDzd?: number | null
  deliveryProvider?: string | null
  deliveryTrackingId?: string | null
  /** تجاهل جدول الانتقالات (webhook يبلّغ «سُلِّم» لطلب ما زال مؤكَّداً مثلاً) — يبقى ممنوعاً الخروج من الحالات النهائية */
  force?: boolean
}

export interface TransitionResult {
  order: OrderRow
  changed: boolean
  activation: ActivationSummary | null
}

/** المخزون: الإلغاء/الإرجاع يعيدان الكمية (كما تفعل NOVA: release/return) */
async function restock(tx: Db, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const it of items) {
    if (isPhysical(it.type)) await tx.update(products).set({ stock: sql`case when ${products.stock} is null then null else ${products.stock} + ${it.qty} end` }).where(eq(products.id, it.productId))
    await tx.update(products).set({ salesCount: sql`greatest(0, ${products.salesCount} - ${it.qty})` }).where(eq(products.id, it.productId))
  }
}

/** إعادة فتح طلب ملغى: يُحجز المخزون من جديد */
async function reserveAgain(tx: Db, orderId: string): Promise<void> {
  const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId))
  for (const it of items) {
    if (isPhysical(it.type)) await tx.update(products).set({ stock: sql`case when ${products.stock} is null then null else greatest(0, ${products.stock} - ${it.qty}) end` }).where(eq(products.id, it.productId))
    await tx.update(products).set({ salesCount: sql`${products.salesCount} + ${it.qty}` }).where(eq(products.id, it.productId))
  }
}

/** كل مشرفي المنصّة (للإشعارات الداخلية + Push) */
export async function adminUserIds(db: Db): Promise<string[]> {
  const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'SUPER_ADMIN'))
  return rows.map((r) => r.id)
}

/** إشعار المشرفين: داخلي (+Push تلقائياً) وتيليغرام إن كان مفعّلاً */
export async function notifyAdmins(db: Db, input: { title: string; body?: string | null; link?: string | null; telegram?: boolean }): Promise<void> {
  const ids = await adminUserIds(db)
  await notifyMany(
    db,
    ids.map((userId) => ({ userId, workspaceId: null, type: 'SYSTEM' as const, title: input.title, body: input.body ?? null, link: input.link ?? null }))
  )
  if (input.telegram !== false) await sendTelegram(db, [input.title, input.body ?? ''].filter(Boolean).join('\n'))
}

const CUSTOMER_MESSAGE: Partial<Record<OrderStatus, (o: OrderRow, opts: TransitionOptions) => string>> = {
  CONFIRMED: (o) => (o.needsShipping ? 'أُكّد طلبك وسيُرسَل إليك مع شركة التوصيل قريباً.' : 'أُكّد طلبك: ملفاتك جاهزة للتنزيل من «طلباتي».'),
  SHIPPED: (o, opts) => `طلبك في الطريق إليك${opts.deliveryTrackingId || o.deliveryTrackingId ? ` — رقم التتبّع ${opts.deliveryTrackingId ?? o.deliveryTrackingId}` : ''}.`,
  DELIVERED: () => 'سُلّم طلبك. شكراً لك — إن كان يحوي دورة فقد فُعّلت على حساب التلميذ.',
  RETURNED: () => 'أعادت شركة التوصيل طلبك إلينا. تواصل معنا إن كنت ما زلت تريده.',
  CANCELLED: (_o, opts) => `أُلغي طلبك${opts.reason ? `: ${opts.reason}` : ''}.`
}

/**
 * ينقل الطلب إلى حالة جديدة ويطبّق آثارها: الطوابع الزمنية، المخزون، تسليم المشتريات الرقمية،
 * تفعيل الدورة عند «سُلِّم» (من أي مصدر)، إشعار الزبون، وإشعار المشرف حين يأتي التغيير من خارج اللوحة.
 * idempotent: الحالة نفسها ⇒ لا تغيير (لكن «سُلِّم» يعيد محاولة التفعيل لأنه قد يكون فشل سابقاً).
 */
export async function transitionOrder(db: Db, orderId: string, next: OrderStatus, opts: TransitionOptions): Promise<TransitionResult> {
  // قراءة الحالة وقفل الطلب داخل المعاملة: تكرار الإرجاع لا يكرر المخزون أو السحب.
  const result = await db.transaction(async (tx) => {
    const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update').limit(1)
    if (!o) throw new AppError('ORDER_NOT_FOUND')
    const from = o.status as OrderStatus
    if (from === next) {
      return { order: o, changed: false }
    }
    const terminal = from === 'RETURNED' || (from === 'CANCELLED' && next !== 'PENDING') || (from === 'DELIVERED' && next !== 'RETURNED')
    if (terminal || (!opts.force && !canTransition(from, next))) throw new AppError('ORDER_INVALID_TRANSITION')

    const now = new Date()
    const shipping = opts.shippingDzd != null && Number.isInteger(opts.shippingDzd) && opts.shippingDzd >= 0 ? opts.shippingDzd : o.shippingDzd
    const [r] = await tx
      .update(orders)
      .set({
        status: next,
        shippingDzd: shipping,
        totalDzd: o.subtotalDzd + shipping,
        adminNote: opts.adminNote !== undefined ? opts.adminNote?.trim() || null : o.adminNote,
        deliveryProvider: opts.deliveryProvider ?? o.deliveryProvider,
        deliveryTrackingId: opts.deliveryTrackingId ?? o.deliveryTrackingId,
        confirmAttempts: next === 'NO_ANSWER' || next === 'CALL_LATER' ? sql`${orders.confirmAttempts} + 1` : o.confirmAttempts,
        lastCallAt: next === 'NO_ANSWER' || next === 'CALL_LATER' || (next === 'CONFIRMED' && opts.source === 'admin') ? now : o.lastCallAt,
        confirmedAt: next === 'CONFIRMED' ? now : next === 'SHIPPED' || next === 'DELIVERED' ? (o.confirmedAt ?? now) : o.confirmedAt,
        shippedAt: next === 'SHIPPED' ? now : next === 'DELIVERED' && o.needsShipping ? (o.shippedAt ?? now) : o.shippedAt,
        deliveredAt: next === 'DELIVERED' ? now : o.deliveredAt,
        returnedAt: next === 'RETURNED' ? now : o.returnedAt,
        cancelledAt: next === 'CANCELLED' ? now : next === 'PENDING' ? null : o.cancelledAt,
        cancelReason: next === 'CANCELLED' ? opts.reason?.trim() || null : next === 'PENDING' ? null : o.cancelReason,
        updatedAt: now
      })
      .where(eq(orders.id, orderId))
      .returning()
    if (next === 'CANCELLED' || next === 'RETURNED') await restock(tx, orderId)
    if (from === 'CANCELLED' && next === 'PENDING') await reserveAgain(tx, orderId)
    if (next === 'RETURNED') {
      await revokeEnrollmentsForReturnedOrder(tx, orderId, opts.actorUserId)
      await tx.update(courseClaims).set({ expiresAt: now }).where(and(eq(courseClaims.orderId, orderId), isNull(courseClaims.claimedAt)))
    }
    await writeAudit(tx, { actorUserId: opts.actorUserId, workspaceId: null, action: 'store.order_status', entityType: 'order', entityId: orderId, oldValue: { status: from }, newValue: { status: next, source: opts.source, reason: opts.reason ?? null } })
    return { order: r!, changed: true }
  })
  const { order: row } = result
  if (!result.changed) {
    const activation = next === 'DELIVERED' ? await activateCoursesForOrder(db, row.id) : null
    return { order: row, changed: false, activation }
  }

  let activation: ActivationSummary | null = null
  if (next === 'CONFIRMED' || next === 'DELIVERED') await grantPurchasesForOrder(db, orderId)
  // الإرسال التلقائي إلى EcoTrack عند التأكيد (استيراد متأخر: ecotrack.service يعتمد على هذا الملف)
  if (next === 'CONFIRMED' && row.needsShipping) {
    try {
      await import('./ecotrack.service').then((m) => m.maybeAutoSend(db, orderId))
    } catch (e) {
      if (process.env.NODE_ENV !== 'test') console.error('[order-status] ecotrack auto-send enqueue failed', e)
    }
  }
  if (next === 'DELIVERED') {
    try {
      activation = await activateCoursesForOrder(db, orderId)
    } catch (e) {
      // التسليم سُجّل؛ فشل التفعيل يُبلَّغ للمشرف ليُفعِّل يدوياً ولا يُخفى
      if (process.env.NODE_ENV !== 'test') console.error('[order-status] activation failed', e)
      await notifyAdmins(db, { title: `⚠️ تعذّر تفعيل دورة الطلب ${row.number}`, body: e instanceof Error ? e.message.slice(0, 200) : 'خطأ غير معروف', link: `/admin/store?status=DELIVERED` })
    }
  }

  const msg = CUSTOMER_MESSAGE[next]?.(row, opts)
  if (msg) await notify(db, { userId: row.userId, workspaceId: null, type: 'SYSTEM', title: `طلب ${row.number}: ${ORDER_STATUS_AR[next]}`, body: msg, link: `/store/orders/${row.id}` })

  // المشرف يسمع بما يحدث خارج اللوحة: تسليم/إرجاع من شركة التوصيل، تأكيد بمكالمة أو SMS
  if (opts.source !== 'admin' && (next === 'DELIVERED' || next === 'RETURNED' || next === 'CONFIRMED' || next === 'CANCELLED')) {
    const icon = next === 'DELIVERED' ? '✅' : next === 'RETURNED' ? '↩️' : next === 'CONFIRMED' ? '📞' : '✖️'
    const extra = activation ? (activation.enrolled.length ? ` · فُعّلت ${activation.enrolled.length} دورة` : activation.claims.length ? ` · أُرسل رمز مطالبة (${activation.claims.length})` : '') : ''
    await notifyAdmins(db, { title: `${icon} الطلب ${row.number}: ${ORDER_STATUS_AR[next]}${extra}`, body: `${row.customerName} · ${row.totalDzd} دج · ${opts.source === 'ecotrack' ? 'EcoTrack' : opts.source === 'delivery' ? 'شركة التوصيل' : opts.source === 'call' ? 'مكالمة تأكيد' : opts.source === 'sms' ? 'رسالة SMS' : opts.source === 'customer' ? `ألغاه الزبون${opts.reason ? ` — ${opts.reason}` : ''}` : 'النظام'}`, link: `/admin/store?status=${next}` })
  }
  return { order: row, changed: true, activation }
}
