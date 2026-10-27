import { z } from 'zod'
import { requestMeta, requireActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { bunnyEmbedForViewer } from '@/server/services/media.service'
import { phoneGateFor } from '@/server/services/phone-gate.service'
import { jsonError, jsonOk } from '../../../_lib'

export const dynamic = 'force-dynamic'

const schema = z.object({ contentId: z.string().uuid(), viewerKey: z.string().min(8).max(64) }).strict()

/** Exact configured origin; neither browser JSON nor a supplied Host is trusted. */
function assertRefreshOrigin(req: Request): void {
  let trusted: URL
  try { trusted = new URL(process.env.APP_URL || 'https://madrasadz.com') }
  catch { throw new AppError('FORBIDDEN') }
  const localDebug = process.env.NODE_ENV !== 'production' && trusted.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(trusted.hostname)
  if ((trusted.protocol !== 'https:' && !localDebug) || trusted.username || trusted.password
    || req.headers.get('origin') !== trusted.origin) throw new AppError('FORBIDDEN')
}

function noStore<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Vary', 'Cookie, Origin')
  return response
}

/** Fresh, short-lived embed after checking the current account/content/device rules. */
export async function POST(req: Request) {
  try {
    assertRefreshOrigin(req)
    const actor = await requireActor()
    const db = await getDb()
    if (actor.role === 'STUDENT' && (await phoneGateFor(db, actor.userId)).required) throw new AppError('FORBIDDEN')
    await checkRateLimit(db, { scope: 'bunny-embed-refresh', subject: actor.userId, limit: 60, windowSeconds: 600 })
    const parsed = schema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) throw new AppError('VALIDATION')
    const meta = await requestMeta()
    const embed = await bunnyEmbedForViewer(db, actor, parsed.data.contentId, Date.now(), { ip: meta.ip, viewerKey: parsed.data.viewerKey })
    return noStore(jsonOk({ url: embed.url, expires: embed.expires }))
  } catch (error) {
    return noStore(jsonError(error))
  }
}
