import type { NextRequest } from 'next/server'
import { iosTicket } from '@/server/services/ios-account.service'
import { iosApiGet } from '../../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/support/:id — المحادثة كاملة (بلا الملاحظات الداخلية؛ الطاقم يظهر «فريق مدرسة») */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  return iosApiGet(req, (db, actor) => iosTicket(db, actor, id))
}
