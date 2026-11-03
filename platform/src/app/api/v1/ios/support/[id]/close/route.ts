import { NextResponse, type NextRequest } from 'next/server'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { iosCloseTicket } from '@/server/services/ios-account.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../../_respond'

export const dynamic = 'force-dynamic'

/** POST /api/v1/ios/support/:id/close — التلميذ يغلق تذكرته بعد حلّ مشكلته */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { id } = await ctx.params
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const data = await iosCloseTicket(db, actor, id)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
