import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import type { PlayStudentAnswer } from '@/server/play/question-types'
import { submitPlayAnswers } from '@/server/services/play.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../../../_lib'

export const dynamic = 'force-dynamic'

const key = z.string().min(1).max(8)
const answer = z.discriminatedUnion('type', [
  z.object({ type: z.literal('MCQ'), key }),
  z.object({ type: z.literal('FILL_BLANK'), blanks: z.array(z.string().max(200)).max(20) }),
  z.object({ type: z.literal('MATCHING'), matches: z.record(key, key) }),
  z.object({ type: z.literal('ORDERING'), order: z.array(key).max(10) })
])
const schema = z.object({ answers: z.array(z.object({ questionId: z.string().uuid(), answer: answer.nullable(), timeMs: z.number().int().min(0).max(3_600_000).nullable().optional() })).min(1).max(60) })

/**
 * POST /api/v1/play/sessions/:id/answers — إجابات جولة بطاقات PLAY من المتصفح دفعةً واحدة (4 نوفمبر 2026).
 * المتصفح يصحّح فورًا كتطبيق الآيفون ويحفظ كل بضع بطاقات وفي آخر الجولة؛ الخادم يعيد التصحيح ويحسب النقاط.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('STUDENT')
    const { id } = await ctx.params
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'play-card-batch', subject: actor.userId, limit: 600, windowSeconds: 3600 })
    const items = parsed.data.answers.map((a) => ({ questionId: a.questionId, answer: a.answer as PlayStudentAnswer | null, timeMs: a.timeMs ?? null }))
    return jsonOk(await submitPlayAnswers(db, actor, id, items))
  } catch (err) {
    return jsonError(err)
  }
}
