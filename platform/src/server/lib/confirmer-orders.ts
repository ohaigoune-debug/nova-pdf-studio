import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { orderItems, orders, productFiles } from '@/server/db/schema'
import { AppError } from './errors'

/**
 * تأكيد العميل ليس إثبات دفع رقمي: لا نُدخل الملفات الرقمية المختلطة في نطاق الموظف.
 * الباقة (PACK) التي لها ملفات تُفتح تنزيلاتها عند «مؤكَّد»، فتبقى للمشرف وحده؛ الباقة الورقية فقط تبقى للموظف.
 */
export function confirmerOrderScope() {
  return and(
    eq(orders.paymentMethod, 'COD'),
    eq(orders.needsShipping, true),
    sql`not exists (select 1 from ${orderItems} oi where oi.order_id = ${orders.id} and (oi.type not in ('BOOK', 'PACK') or (oi.type = 'PACK' and exists (select 1 from ${productFiles} pf where pf.product_id = oi.product_id))))`
  )!
}

/** بعد تحميل الطلب (وقفله عند تغييره)، يُعاد التحقق من نفس نطاق القائمة على الخادم. */
export async function assertConfirmerOrderScope(db: Db, orderId: string): Promise<void> {
  const [eligible] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, orderId), confirmerOrderScope())).limit(1)
  if (!eligible) throw new AppError('FORBIDDEN')
}
