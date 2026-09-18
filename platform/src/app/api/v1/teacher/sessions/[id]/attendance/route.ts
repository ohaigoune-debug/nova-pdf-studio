import { requireRole } from '@/server/auth/current-user'
import { ATTENDANCE_STAFF_ROLES } from '@/server/lib/actor'
import { getDb } from '@/server/db/client'
import { listSessionAttendance } from '@/server/services/attendance.service'
import { jsonError, jsonOk } from '../../../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/teacher/sessions/:id/attendance */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole(...ATTENDANCE_STAFF_ROLES)
    const { id } = await ctx.params
    return jsonOk(await listSessionAttendance(await getDb(), actor, id))
  } catch (err) {
    return jsonError(err)
  }
}
