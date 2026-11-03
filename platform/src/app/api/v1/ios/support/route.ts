import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { IOS_SUPPORT_KINDS, iosOpenTicket, iosTickets } from '@/server/services/ios-account.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, iosApiGet, resolveIosActor } from '../_respond'

export const dynamic = 'force-dynamic'

/** GET /api/v1/ios/support — تذاكر التلميذ (الأحدث نشاطًا أولًا) */
export async function GET(req: NextRequest) {
  return iosApiGet(req, (db, actor) => iosTickets(db, actor))
}

const schema = z.object({
  kind: z.enum(IOS_SUPPORT_KINDS),
  subject: z.string().trim().min(3).max(200),
  body: z.string().trim().min(2).max(5000),
  orderId: z.string().uuid().nullish()
})

/** POST /api/v1/ios/support — فتح تذكرة (نفس openTicketAction في الموقع وحدوده: 10 تذاكر في الساعة) */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION', { field: String(parsed.error.issues[0]?.path[0] ?? 'body') })
    await checkRateLimit(db, { scope: 'support-open', subject: actor.userId, limit: 10, windowSeconds: 60 * 60 })
    const data = await iosOpenTicket(db, actor, parsed.data)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
