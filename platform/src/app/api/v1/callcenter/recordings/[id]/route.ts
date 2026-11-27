import { requireRole } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { readRecording } from '@/server/services/call-center.service'
import { jsonError } from '../../../_lib'

export const dynamic = 'force-dynamic'

/** الرسالة الصوتية لمكالمة واردة: للمشرف وموظف التأكيد وحدهما (كوكي الجلسة) */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireRole('SUPER_ADMIN', 'CONFIRMER')
    const { id } = await ctx.params
    const r = await readRecording(await getDb(), actor, id)
    return new Response(new Uint8Array(r.bytes), { headers: { 'content-type': r.mime, 'cache-control': 'private, no-store', 'content-length': String(r.bytes.length) } })
  } catch (e) {
    return jsonError(e)
  }
}
