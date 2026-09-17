import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { listSessionAttendance } from '@/server/services/attendance.service'
import { jsonError, jsonOk } from '../../../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/teacher/sessions/:id/attendance */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const { id } = await ctx.params
    return jsonOk(await listSessionAttendance(await getDb(), actor, id))
  } catch (err) {
    return jsonError(err)
  }
}
