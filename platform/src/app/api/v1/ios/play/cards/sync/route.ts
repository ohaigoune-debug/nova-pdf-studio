import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { CARD_ROUND_MAX, syncCardRound } from '@/server/services/play-cards.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { iosApiError } from '../../../_respond'

export const dynamic = 'force-dynamic'

const key = z.string().min(1).max(8)
const answer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MCQ'), key }),
  z.object({ type: z.literal('FILL_BLANK'), blanks: z.array(z.string().max(200)).max(20) }),
  z.object({ type: z.literal('MATCHING'), matches: z.record(key, key) }),
  z.object({ type: z.literal('ORDERING'), order: z.array(key).max(10) })
])
const schema = z.object({
  lessonId: z.string().uuid(),
  answers: z.array(z.object({ questionId: z.string().uuid(), answer, timeMs: z.number().int().min(0).max(3_600_000).nullable().optional() })).min(1).max(CARD_ROUND_MAX)
})

/**
 * POST /api/v1/ios/play/cards/sync — جولة بطاقات أُنجزت في التطبيق تُرفع، ويعيد الخادم تصحيحها ويحسب XP كما في الموقع.
 * يشترط ترويسة X-Madrasadz-Client: ios (لا يرسلها متصفح عبر نطاق آخر بلا CORS، فلا CSRF بالكوكي).
 */
export async function POST(req: NextRequest) {
  try {
    if (req.headers.get('x-madrasadz-client') !== 'ios') throw new AppError('FORBIDDEN')
    const db = await getDb()
    const actor = await resolveActor(db, req.cookies.get(SESSION_COOKIE)?.value)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    await checkRateLimit(db, { scope: 'ios-play-cards', subject: actor.userId, limit: 120, windowSeconds: 3600 })
    const data = await syncCardRound(db, actor, { lessonId: parsed.data.lessonId, answers: parsed.data.answers.map((a) => ({ questionId: a.questionId, answer: a.answer, timeMs: a.timeMs ?? null })) })
    const res = NextResponse.json({ ok: true, data })
    res.headers.set('X-Madrasadz-Account', actor.userId)
    return iosNoStore(res)
  } catch (err) {
    return iosNoStore(iosApiError(err))
  }
}
