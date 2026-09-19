import { and, eq, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { jobs } from '@/server/db/schema'
import { AppError, isPermanentJobError } from '@/server/lib/errors'

/**
 * طابور مهام خلفية على جدول `jobs` (بلا Redis): تُدرج المهمة داخل نفس المعاملة
 * التي تنشئ الكيان، ثم يلتقطها العامل (داخل العملية، أو عبر /api/v1/jobs/run من Cron، أو `npm run jobs:worker`).
 */
export const JOB_TYPES = ['AI_EVALUATE_SUBMISSION', 'AI_BATCH_COLLECT', 'AI_TEACHER_INSIGHTS', 'AI_GENERATE_EXERCISES', 'AI_ANALYZE_STUDENT', 'REPORT_EXPORT', 'CLEANUP', 'PUSH_DISPATCH'] as const
export type JobType = (typeof JOB_TYPES)[number]

export type JobRow = typeof jobs.$inferSelect

export interface EnqueueInput {
  type: JobType
  payload: Record<string, unknown>
  workspaceId?: string | null
  maxAttempts?: number
  runAfter?: Date
}

export async function enqueueJob(db: Db, input: EnqueueInput): Promise<JobRow> {
  const [row] = await db
    .insert(jobs)
    .values({ type: input.type, payload: input.payload, workspaceId: input.workspaceId ?? null, maxAttempts: input.maxAttempts ?? 3, runAfter: input.runAfter ?? new Date() })
    .returning()
  if (!row) throw new AppError('INTERNAL')
  return row
}

/** يلتقط مهمة واحدة جاهزة ويقفلها (SKIP LOCKED يسمح بعدة عمّال بأمان) */
export async function claimNextJob(db: Db, now: Date = new Date()): Promise<JobRow | null> {
  const [row] = await db
    .update(jobs)
    .set({ status: 'PROCESSING', startedAt: now, attempts: sql`${jobs.attempts} + 1` })
    .where(
      eq(
        jobs.id,
        sql`(select j.id from ${jobs} j where j.status = 'QUEUED' and j.run_after <= ${now} order by j.run_after asc limit 1 for update skip locked)`
      )
    )
    .returning()
  return row ?? null
}

export async function completeJob(db: Db, id: string, result: Record<string, unknown> | null): Promise<void> {
  await db.update(jobs).set({ status: 'COMPLETED', finishedAt: new Date(), result, error: null }).where(eq(jobs.id, id))
}

/** فشل: إعادة جدولة بتراجع أسّي ما دامت المحاولات لم تُستنفد، وإلا FAILED نهائياً. الخطأ النهائي لا يُعاد أبداً. */
export async function failJob(db: Db, job: JobRow, err: unknown): Promise<'RETRY' | 'FAILED'> {
  const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000)
  if (!isPermanentJobError(err) && job.attempts < job.maxAttempts) {
    const delayMs = Math.min(10 * 60_000, 15_000 * 2 ** (job.attempts - 1))
    await db.update(jobs).set({ status: 'QUEUED', runAfter: new Date(Date.now() + delayMs), error: message }).where(eq(jobs.id, job.id))
    return 'RETRY'
  }
  await db.update(jobs).set({ status: 'FAILED', finishedAt: new Date(), error: message }).where(eq(jobs.id, job.id))
  return 'FAILED'
}

/** أقرب موعد لمهمة مؤجلة (إعادة محاولة، استطلاع دفعة) ليوقظ العامل الداخلي نفسه عنده */
export async function nextRunAfter(db: Db): Promise<Date | null> {
  const [r] = await db.select({ runAfter: jobs.runAfter }).from(jobs).where(eq(jobs.status, 'QUEUED')).orderBy(jobs.runAfter).limit(1)
  return r?.runAfter ?? null
}

export async function countQueued(db: Db, now: Date = new Date()): Promise<number> {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(jobs).where(and(eq(jobs.status, 'QUEUED'), lte(jobs.runAfter, now)))
  return r?.n ?? 0
}
