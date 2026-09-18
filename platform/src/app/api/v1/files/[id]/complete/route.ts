import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { completeUpload } from '@/server/services/files.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../../_lib'

export const dynamic = 'force-dynamic'

/** POST /api/v1/files/:id/complete — يتحقق من وجود الكائن في التخزين ويعلّمه READY */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const { id } = await ctx.params
    const f = await completeUpload(await getDb(), actor, id)
    return jsonOk({ id: f.id, name: f.originalName, size: f.sizeBytes, status: f.status })
  } catch (err) {
    return jsonError(err)
  }
}
