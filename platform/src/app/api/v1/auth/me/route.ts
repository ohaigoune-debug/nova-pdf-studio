import { requireActor } from '@/server/auth/current-user'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const actor = await requireActor()
    return jsonOk({ userId: actor.userId, role: actor.role, fullName: actor.fullName, email: actor.email, studentId: actor.studentId, teacherId: actor.teacherId })
  } catch (err) {
    return jsonError(err)
  }
}
