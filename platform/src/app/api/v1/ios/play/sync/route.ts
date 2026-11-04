import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { stepAnswersSchema } from '@/server/play/exams/answer-schema'
import { syncOfflineAttempt } from '@/server/services/play-exams.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError, resolveIosActor } from '../../_respond'

export const dynamic = 'force-dynamic'

const schema = z.object({ setId: z.string().uuid(), answers: stepAnswersSchema })

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
