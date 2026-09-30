import { and, desc, eq, lte, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { jobs } from '@/server/db/schema'
import { AppError, isPermanentJobError } from '@/server/lib/errors'

/**
 * طابور مهام خلفية على جدول `jobs` (بلا Redis): تُدرج المهمة داخل نفس المعاملة
 * التي تنشئ الكيان، ثم يلتقطها العامل (داخل العملية، أو عبر /api/v1/jobs/run من Cron، أو `npm run jobs:worker`).
 */
export const JOB_TYPES = ['AI_EVALUATE_SUBMISSION', 'AI_BATCH_COLLECT', 'AI_TEACHER_INSIGHTS', 'AI_GENERATE_EXERCISES', 'AI_GENERATE_QUIZ', 'AI_IMPORT_FILES', 'AI_ANALYZE_STUDENT', 'AI_ORGANIZE_CONTENT', 'BAC_SYNC', 'REPORT_EXPORT', 'CLEANUP', 'PUSH_DISPATCH'] as const
export type JobType = (typeof JOB_TYPES)[number]

/**
 * مساران: المهام الطويلة (زحف يستغرق دقائق طويلة) لها مسار «بطيء» خاص كي لا تحجز
 * تصحيح الواجبات وتوليد الاختبارات خلفها. المسار البطيء يعمل في العامل الداخلي فقط
 * (طلب Cron الخارجي محدود بدقيقة واحدة).
 */
export const SLOW_JOB_TYPES: readonly JobType[] = ['BAC_SYNC']
export type JobLane = 'default' | 'slow'
export const laneOf = (type: string): JobLane => ((SLOW_JOB_TYPES as readonly string[]).includes(type) ? 'slow' : 'default')

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
export async function claimNextJob(db: Db, now: Date = new Date(), lane: JobLane = 'default'): Promise<JobRow | null> {
  const slow = sql.join(
    SLOW_JOB_TYPES.map((t) => sql`${t}`),
    sql`, `
  )
  const laneFilter = lane === 'slow' ? sql`and j.type in (${slow})` : sql`and j.type not in (${slow})`
  const [row] = await db
    .update(jobs)
    .set({ status: 'PROCESSING', startedAt: now, attempts: sql`${jobs.attempts} + 1` })
    .where(
      eq(
        jobs.id,
        sql`(select j.id from ${jobs} j where j.status = 'QUEUED' and j.run_after <= ${now} ${laneFilter} order by j.run_after asc limit 1 for update skip locked)`
      )
    )
    .returning()
  return row ?? null
}

export const MAX_JOB_LOG_LINES = 80

/** تقدّم مهمة طويلة أثناء تنفيذها (يُكتب على دفعات لا مع كل عنصر) */
export async function updateJobProgress(
  db: Db,
  id: string,
  patch: { progress?: Record<string, unknown>; totalItems?: number | null; processedItems?: number; failedItems?: number; logs?: string[] }
): Promise<void> {
  await db
    .update(jobs)
    .set({ ...patch, logs: patch.logs ? patch.logs.slice(-MAX_JOB_LOG_LINES) : undefined, updatedAt: new Date() })
    .where(eq(jobs.id, id))
}

/** آخر مهمة من نوع (لمساحة عمل إن حُدّدت) — للصفحات التي تعرض حالة استيراد أو تنظيم */
export async function latestJobOfType(db: Db, type: JobType, workspaceId?: string | null): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, type), workspaceId === undefined ? undefined : workspaceId === null ? sql`${jobs.workspaceId} is null` : eq(jobs.workspaceId, workspaceId)))
    .orderBy(desc(jobs.createdAt))
    .limit(1)
  return row ?? null
}

/** مهمة معلّقة (في الانتظار أو قيد التنفيذ) من نوع، لمنع تشغيل نسختين معاً */
export async function pendingJobOfType(db: Db, type: JobType, workspaceId?: string | null): Promise<JobRow | null> {
  const [row] = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.type, type), sql`${jobs.status} in ('QUEUED','PROCESSING')`, workspaceId === undefined ? undefined : workspaceId === null ? sql`${jobs.workspaceId} is null` : eq(jobs.workspaceId, workspaceId)))
    .orderBy(desc(jobs.createdAt))
    .limit(1)
  return row ?? null
}

/** مهمة بقيت PROCESSING بعد إعادة تشغيل الخادم: تُعلَّم فاشلة كي يُعاد تشغيلها بوعي */
export async function failStaleJob(db: Db, job: JobRow, maxAgeMs: number, now: Date = new Date()): Promise<boolean> {
  if (job.status !== 'PROCESSING' || !job.startedAt || now.getTime() - job.startedAt.getTime() < maxAgeMs) return false
  await db.update(jobs).set({ status: 'FAILED', finishedAt: now, error: 'interrupted (server restarted during the job)' }).where(and(eq(jobs.id, job.id), eq(jobs.status, 'PROCESSING')))
  return true
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
