import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { listSessions, startSession } from '@/server/services/class-sessions.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

/** GET /api/v1/teacher/sessions?status=OPEN&groupId=… */
export async function GET(req: Request) {
  try {
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const sp = new URL(req.url).searchParams
    const status = sp.get('status')
    const rows = await listSessions(await getDb(), actor, {
      status: status ? status.split(',') : undefined,
      groupId: sp.get('groupId') ?? undefined,
      limit: Number(sp.get('limit') ?? 50)
    })
    return jsonOk(rows)
  } catch (err) {
    return jsonError(err)
  }
}

const startSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string().trim().optional(),
  topic: z.string().trim().optional(),
  lateAfterMinutes: z.number().int().min(0).max(120).optional()
})

/** POST /api/v1/teacher/sessions — "بدء الحصة" */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const parsed = startSchema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const s = await startSession(await getDb(), actor, {
      groupId: parsed.data.groupId,
      title: parsed.data.title ?? null,
      topic: parsed.data.topic ?? null,
      lateAfterMinutes: parsed.data.lateAfterMinutes ?? null
    })
    return jsonOk(s, { status: 201 })
  } catch (err) {
    return jsonError(err)
  }
}
