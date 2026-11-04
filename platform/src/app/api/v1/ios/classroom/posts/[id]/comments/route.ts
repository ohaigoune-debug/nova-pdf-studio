import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { iosAddComment } from '@/server/services/ios-classroom.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ body: z.string().trim().min(1).max(1500) })

/** POST /api/v1/ios/classroom/posts/:id/comments — تعليق التلميذ على منشور (كالموقع) */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const { id } = await ctx.params
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) throw new AppError('VALIDATION', { field: 'body' })
    // الحدّ نفسه في الموقع: 20 تعليقًا في الدقيقة
    await checkRateLimit(db, { scope: 'class-comment', subject: actor.userId, limit: 20, windowSeconds: 60 })
    const data = await iosAddComment(db, actor, id, parsed.data.body)
    return iosNoStore(NextResponse.json({ ok: true, data }))
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
