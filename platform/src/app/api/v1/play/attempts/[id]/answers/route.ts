import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { stepAnswersSchema } from '@/server/play/exams/answer-schema'
import { submitExamSteps } from '@/server/services/play-exams.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ answers: stepAnswersSchema, finish: z.boolean().optional() })

/**
 * POST /api/v1/play/attempts/:id/answers — إجابات موضوع PLAY من المتصفح دفعةً واحدة (4 نوفمبر 2026).
 * المتصفح يصحّح التدريب فورًا كتطبيق الآيفون، ويحفظ كل بضع خطوات وعند الإنهاء؛ الخادم يعيد التصحيح بمفاتيحه.
 * كان كل جواب طلبًا مستقلًّا: الطلب الواحد هنا يحلّ محلّ 5 طلبات أو أكثر.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('STUDENT')
    const { id } = await ctx.params
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'play-exam-batch', subject: actor.userId, limit: 600, windowSeconds: 3600 })
    return jsonOk(await submitExamSteps(db, actor, id, parsed.data.answers, { finish: parsed.data.finish }))
  } catch (err) {
    return jsonError(err)
  }
}
