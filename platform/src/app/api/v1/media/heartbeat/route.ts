import { z } from 'zod'
import { requestMeta, requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { recordMediaHeartbeat } from '@/server/services/media.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({
  contentId: z.string().uuid(),
  viewerKey: z.string().min(8).max(64),
  position: z.number().min(0).max(24 * 3600),
  delta: z.number().min(0).max(120),
  completed: z.boolean().optional()
})

/** POST /api/v1/media/heartbeat — نبضة مشاهدة (كل 15 ثانية أثناء التشغيل) + كشف تعدّد الأجهزة */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const actor = await requireActor()
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const meta = await requestMeta()
    const r = await recordMediaHeartbeat(await getDb(), actor, { ...parsed.data, ip: meta.ip, userAgent: meta.userAgent })
    return jsonOk(r)
  } catch (err) {
    return jsonError(err)
  }
}
