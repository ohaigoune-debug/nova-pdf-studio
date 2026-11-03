import type { NextRequest } from 'next/server'
import { iosOrders } from '@/server/services/ios-account.service'
import { iosApiGet } from '../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/orders — «طلباتي»: حالة الطلبات ومراحلها ورقم التتبّع فقط (بلا أسعار ولا دفع ولا إلغاء) */
export async function GET(req: NextRequest) {
  return iosApiGet(req, (db, actor) => iosOrders(db, actor))
}
