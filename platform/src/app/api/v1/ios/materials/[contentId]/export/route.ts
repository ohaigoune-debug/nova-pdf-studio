import type { NextRequest } from 'next/server'
import { resolveActor, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { exportIosPdf } from '@/server/services/ios-file-export.service'
import { iosNoStore } from '@/server/services/ios-session.service'
import { jsonError } from '../../../../_lib'

export const dynamic = 'force-dynamic'

/** An explicit, authorized share/export operation; the ordinary media viewer is unchanged. */
export async function GET(req: NextRequest, context: { params: Promise<{ contentId: string }> }) {
  try {
    const db = await getDb()
    const cookie = req.cookies.get(SESSION_COOKIE)?.value
    const actor = await resolveActor(db, cookie)
    if (!actor) throw new AppError('AUTH_REQUIRED')
    const { contentId } = await context.params
    const result = await exportIosPdf(db, actor, contentId)
    const current = await resolveActor(db, cookie)
    if (!current || current.userId !== result.accountId) throw new AppError('AUTH_REQUIRED')
    return iosNoStore(new Response(new Uint8Array(result.bytes), { headers: {
      'Content-Type': 'application/pdf',
      'Content-Length': String(result.bytes.length),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(result.filename)}`,
      'X-Content-Type-Options': 'nosniff',
      'X-Madrasadz-Account': result.accountId
    } }))
  } catch (error) {
    return iosNoStore(jsonError(error))
  }
}
