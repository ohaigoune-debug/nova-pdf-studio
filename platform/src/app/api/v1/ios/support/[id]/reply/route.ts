import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { iosReplyTicket } from '@/server/services/ios-account.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ body: z.string().trim().min(2).max(5000) })

/** POST /api/v1/ios/support/:id/reply — ردّ التلميذ على تذكرته (60 ردًّا في الساعة كالموقع) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { id } = await ctx.params
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'body' })
    await checkRateLimit(db, { scope: 'support-reply', subject: actor.userId, limit: 60, windowSeconds: 60 * 60 })
    const data = await iosReplyTicket(db, actor, id, parsed.data.body)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
