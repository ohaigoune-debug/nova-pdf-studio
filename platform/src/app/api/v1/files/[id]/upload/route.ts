import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { receiveUploadStream, verifyUploadSignature } from '@/server/services/files.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../../_lib'

export const dynamic = 'force-dynamic'

/** PUT /api/v1/files/:id/upload?exp&sig — رفع تياري عبر الخادم (عند غياب S3) بلا تحميل الملف كله في الذاكرة */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('TEACHER', 'SUPER_ADMIN')
    const { id } = await ctx.params
    const url = new URL(req.url)
    if (!verifyUploadSignature(id, actor.userId, url.searchParams.get('exp'), url.searchParams.get('sig'))) throw new AppError('FILE_NOT_FOUND')
    const r = await receiveUploadStream(await getDb(), actor, id, req.body)
    return jsonOk(r)
  } catch (err) {
    return jsonError(err)
  }
}
