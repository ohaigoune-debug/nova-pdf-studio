import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { issueAttendanceToken } from '@/server/services/attendance.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/student/attendance-token?groupId=… → رمز موقّع قصير العمر */
export async function GET(req: Request) {
  try {
    const actor = await requireRole('STUDENT')
    const groupId = new URL(req.url).searchParams.get('groupId')
    if (!groupId) throw new AppError('VALIDATION', { field: 'groupId' })
    const r = await issueAttendanceToken(await getDb(), actor, groupId)
    return jsonOk({ token: r.token, expiresAt: r.expiresAt.toISOString(), groupName: r.groupName }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return jsonError(err)
  }
}
