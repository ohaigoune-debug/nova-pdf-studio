import { z } from 'zod'
import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { createUploadTicket } from '@/server/services/files.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ name: z.string().trim().min(1).max(200), mime: z.string().trim().min(3).max(100), size: z.number().int().positive() })

/** POST /api/v1/files/upload-ticket — يحجز ملفاً ويعطي رابط رفع (S3 مباشر أو تيار عبر الخادم) */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) throw new AppError('VALIDATION')
    const t = await createUploadTicket(await getDb(), actor, { originalName: parsed.data.name, mimeType: parsed.data.mime, sizeBytes: parsed.data.size })
    return jsonOk(t, { status: 201 })
  } catch (err) {
    return jsonError(err)
  }
}
