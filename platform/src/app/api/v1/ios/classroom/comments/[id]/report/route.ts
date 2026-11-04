import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { iosReportComment } from '@/server/services/ios-classroom.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ reason: z.string().trim().max(500).nullish() })

/** POST /api/v1/ios/classroom/comments/:id/report — بلاغ عن تعليق: تذكرة للمشرف وإشعار لأستاذ المنشور (Apple 1.2) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { id } = await ctx.params
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'body' })
    await checkRateLimit(db, { scope: 'ios-class-report', subject: actor.userId, limit: 20, windowSeconds: 60 * 60 })
    const data = await iosReportComment(db, actor, id, parsed.data.reason ?? null)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
