import { kickJobsSoon } from '@/server/jobs/kick'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { closeSession } from '@/server/services/class-sessions.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../../../_lib'

export const dynamic = 'force-dynamic'

/** POST /api/v1/teacher/sessions/:id/close — "إنهاء الحصة" (غياب تلقائي + قاعدة التعليق) */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const { id } = await ctx.params
    const r = await closeSession(await getDb(), actor, id)
    kickJobsSoon()
    return jsonOk(r)
  } catch (err) {
    return jsonError(err)
  }
}
