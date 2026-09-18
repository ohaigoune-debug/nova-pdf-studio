import { and, eq, isNotNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { jobs, passwordResets, qrNonces, sessions } from '@/server/db/schema'
import { enqueueJob } from '@/server/jobs/queue'
import { purgeRateLimits } from '@/server/lib/rate-limit'

/**
 * مهمة الصيانة الدورية (CLEANUP): تنظيف ما انتهى أجله بلا مساس بالبيانات التعليمية.
 * تُجدوَل تلقائياً من /api/v1/jobs/run أو العامل المستقل مرة كل 24 ساعة.
 */
export const CLEANUP_INTERVAL_MS = 24 * 3600_000

export interface CleanupSummary {
  sessions: number
  nonces: number
  resets: number
  rateLimits: number
  jobs: number
}

export async function runCleanupJob(db: Db, now: Date = new Date()): Promise<CleanupSummary> {
  const day = 86_400_000
  const s = await db
    .delete(sessions)
    .where(or(lt(sessions.expiresAt, new Date(now.getTime() - 7 * day)), and(isNotNull(sessions.revokedAt), lt(sessions.revokedAt, new Date(now.getTime() - 7 * day)))))
    .returning({ id: sessions.id })
  const n = await db.delete(qrNonces).where(lt(qrNonces.expiresAt, new Date(now.getTime() - day))).returning({ nonce: qrNonces.nonce })
  const r = await db.delete(passwordResets).where(lt(passwordResets.expiresAt, new Date(now.getTime() - day))).returning({ id: passwordResets.id })
  const rl = await purgeRateLimits(db, new Date(now.getTime() - day))
  const j = await db
    .delete(jobs)
    .where(and(sql`${jobs.status} in ('COMPLETED','FAILED')`, lt(jobs.createdAt, new Date(now.getTime() - 30 * day)), sql`${jobs.type} <> 'REPORT_EXPORT'`))
    .returning({ id: jobs.id })
  return { sessions: s.length, nonces: n.length, resets: r.length, rateLimits: rl, jobs: j.length }
}

/** يُدرج مهمة CLEANUP إن لم تُنفَّذ خلال آخر 24 ساعة ولم تكن في الطابور */
export async function ensureMaintenanceJobs(db: Db, now: Date = new Date()): Promise<boolean> {
  const [recent] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.type, 'CLEANUP'), or(sql`${jobs.status} in ('QUEUED','PROCESSING')`, sql`${jobs.createdAt} > ${new Date(now.getTime() - CLEANUP_INTERVAL_MS)}`)))
    .limit(1)
  if (recent) return false
  await enqueueJob(db, { type: 'CLEANUP', payload: {}, maxAttempts: 1, runAfter: now })
  return true
}
