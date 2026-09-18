import { timingSafeEqual } from 'node:crypto'
import { getDb } from '@/server/db/client'
import { processQueuedJobs } from '@/server/jobs/runner'
import { AppError } from '@/server/lib/errors'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * POST /api/v1/jobs/run — يشغّل العامل دفعةً واحدة (لـ Cron خارجي: Vercel Cron، GitHub Actions، crontab).
 * محمي بسرّ CRON_SECRET في الترويسة x-cron-secret. لا يعمل بلا سرّ.
 */
export async function POST(req: Request) {
  try {
    if (!authorized(req)) throw new AppError('FORBIDDEN')
    const url = new URL(req.url)
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') ?? 20)))
    const summary = await processQueuedJobs(await getDb(), { limit })
    return jsonOk(summary)
  } catch (err) {
    return jsonError(err)
  }
}

export const GET = POST
