import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { LEAK_SCAN_MAX_BYTES, scanLeakedPdfFor } from '@/server/services/leak-trace.service'
import { assertSameOrigin, jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

/** POST /api/v1/admin/leak-scan — ملف PDF مسرَّب ← قرائن صاحبه (رمز النسخة، رمز الحساب، التاريخ). للمشرف العام وحده. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req)
    const actor = await requireRole('SUPER_ADMIN')
    if (Number(req.headers.get('content-length') ?? 0) > LEAK_SCAN_MAX_BYTES + 64 * 1024) throw new AppError('VALIDATION', { field: 'file' })
    const file = (await req.formData()).get('file')
    if (!(file instanceof File) || file.size === 0 || file.size > LEAK_SCAN_MAX_BYTES) throw new AppError('VALIDATION', { field: 'file' })
    return jsonOk(await scanLeakedPdfFor(await getDb(), actor, new Uint8Array(await file.arrayBuffer())))
  } catch (err) {
    return jsonError(err)
  }
}
