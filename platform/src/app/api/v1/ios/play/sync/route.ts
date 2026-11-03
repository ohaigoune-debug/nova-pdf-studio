import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { syncOfflineAttempt } from '@/server/services/play-exams.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../_respond'

export const dynamic = 'force-dynamic'

const answer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mcq'), choice: z.number().int().min(0).max(50) }),
  z.object({ type: z.literal('multi'), choices: z.array(z.number().int().min(0).max(50)).max(50) }),
  z.object({ type: z.literal('fill_blank'), blanks: z.array(z.string().max(200)).max(50) }),
  z.object({ type: z.literal('ordering'), order: z.array(z.number().int().min(0).max(100)).max(100) }),
  z.object({ type: z.literal('matching'), pairs: z.array(z.number().int().min(-1).max(100)).max(100) }),
  z.object({ type: z.literal('portrait'), choice: z.number().int().min(0).max(50) }),
  z.object({ type: z.literal('numeric'), value: z.number().finite() }),
  z.object({ type: z.literal('short_text'), text: z.string().max(500) })
])
const schema = z.object({ setId: z.string().uuid(), answers: z.record(z.string().max(120), answer) })

/**
 * POST /api/v1/ios/play/sync — محاولة PLAY أُنجزت في التطبيق تُرفع ويُعاد تصحيحها في الخادم.
 * يشترط ترويسة X-Madrasadz-Client: ios (ترويسة مخصّصة لا يرسلها متصفح عبر نطاق آخر بلا CORS، فلا CSRF بالكوكي).
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveIosActor(db, req)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    await checkRateLimit(db, { scope: 'ios-play-sync', subject: actor.userId, limit: 120, windowSeconds: 3600 })
    const data = await syncOfflineAttempt(db, actor, { setUuid: parsed.data.setId, answers: parsed.data.answers })
    const res = NextResponse.json({ ok: true, data })
    res.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
