import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { RATE_LIMITS, checkRateLimit } from '@/server/lib/rate-limit'
import { scanAttendanceToken } from '@/server/services/attendance.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ classSessionId: z.string().uuid(), token: z.string().min(10), scannerSessionId: z.string().uuid().nullish() })

/** POST /api/v1/attendance/scan — للأجهزة/التطبيقات (نفس الخدمة التي يستعملها الويب) */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const db = await getDb()
    await checkRateLimit(db, { scope: 'scan', subject: actor.userId, ...RATE_LIMITS.scan })
    const r = await scanAttendanceToken(db, actor, parsed.data)
    return jsonOk(r)
  } catch (err) {
    return jsonError(err)
  }
}
