/**
 * استيراد بكالوريات DzExams من لوحة الإدارة: مهمة خلفية في المسار البطيء تُظهر تقدّمها
 * (المادة الحالية، المواضيع، الروابط المباشرة، الأخطاء) وتُبلغ المدير عند انتهائها.
 * روابط فقط — لا يُنزَّل ولا يُخزَّن أي ملف — والمصدر مذكور في كل صف.
 */
import { desc, sql } from 'drizzle-orm'
import { syncBacExams, type SyncProgress, type SyncReport } from '@/server/bac/sync'
import type { Db } from '@/server/db/connect'
import { bacExams } from '@/server/db/schema'
import { enqueueJob, failStaleJob, latestJobOfType, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { notify } from './notifications.service'

export type BacSyncMode = 'all' | 'refresh' | 'trial'

/** مهمة بقيت «قيد التنفيذ» أكثر من هذا فقد قُطعت بإعادة تشغيل الخادم */
const STALE_AFTER_MS = 3 * 60 * 60_000
/** كتابة التقدّم في القاعدة كل بضع ثوانٍ لا مع كل صفحة */
const PROGRESS_EVERY_MS = 3000

export interface BacSyncStatus {
  job: (Pick<JobRow, 'id' | 'status' | 'startedAt' | 'finishedAt' | 'error' | 'createdAt'> & { mode: BacSyncMode; progress: Partial<SyncProgress>; logs: string[]; result: SyncReport | null }) | null
  saved: number
  withDirectLink: number
  subjects: number
  lastFetchedAt: Date | null
  inlineWorker: boolean
}

export async function requestBacSync(db: Db, actor: Actor, input: { mode: BacSyncMode; subjects?: string[] }): Promise<{ jobId: string; reused: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  const pending = await pendingJobOfType(db, 'BAC_SYNC', null)
  // مقطوعة بإعادة تشغيل؟ تُعلَّم فاشلة ويُسمح بتشغيل جديد (الزحف تراكمي: ما حُفظ لا يُزار ثانية)
  if (pending && !(await failStaleJob(db, pending, STALE_AFTER_MS))) return { jobId: pending.id, reused: true }
  const subjects = (input.subjects ?? []).map((s) => s.trim().toLowerCase()).filter((s) => /^[a-z0-9-]{2,40}$/.test(s))
  const job = await enqueueJob(db, {
    type: 'BAC_SYNC',
    payload: { mode: input.mode, subjects, userId: actor.userId },
    workspaceId: null,
    // الإعادة التلقائية بلا معنى هنا: المدير يعيد التشغيل بنفسه بعد قراءة السجل
    maxAttempts: 1
  })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'bac.sync.request', entityType: 'job', entityId: job.id, newValue: { mode: input.mode, subjects } })
  return { jobId: job.id, reused: false }
}

export async function runBacSyncJob(db: Db, job: JobRow, opts: { fetch?: typeof fetch; delayMs?: number } = {}): Promise<Record<string, unknown>> {
  const mode = (job.payload.mode === 'refresh' || job.payload.mode === 'trial' ? job.payload.mode : 'all') as BacSyncMode
  const subjects = Array.isArray(job.payload.subjects) ? job.payload.subjects.map(String) : []
  const userId = typeof job.payload.userId === 'string' ? job.payload.userId : null
  const logs: string[] = []
  let lastWrite = 0
  let lastProgress: Partial<SyncProgress> = {}
  const flush = async (force = false) => {
    if (!force && Date.now() - lastWrite < PROGRESS_EVERY_MS) return
    lastWrite = Date.now()
    const p = lastProgress
    await updateJobProgress(db, job.id, {
      progress: { ...p, mode },
      // إجمالي المواد معروف من البداية، والمواضيع تُكتشف مادةً مادة
      totalItems: p.subjects ?? null,
      processedItems: p.phase === 'done' ? (p.subjects ?? 0) : Math.max(0, (p.subjectIndex ?? 1) - 1),
      failedItems: p.errors ?? 0,
      logs
    })
  }
  const report = await syncBacExams(mode === 'trial' ? null : db, {
    fetch: opts.fetch,
    // BAC_SYNC_DELAY_MS للاختبارات فقط؛ الافتراضي ثانية ونيّف بين الطلبات
    delayMs: opts.delayMs ?? (process.env.BAC_SYNC_DELAY_MS ? Number(process.env.BAC_SYNC_DELAY_MS) : undefined),
    dry: mode === 'trial',
    refresh: mode === 'refresh',
    subjects: subjects.length ? subjects : mode === 'trial' ? ['arabe'] : undefined,
    maxExams: mode === 'trial' ? 5 : undefined,
    maxPagesPerListing: mode === 'trial' ? 1 : undefined,
    log: (line) => {
      logs.push(line)
      if (logs.length > 200) logs.splice(0, logs.length - 200)
    },
    onProgress: async (p) => {
      lastProgress = p
      await flush(p.phase === 'done')
    }
  })
  await flush(true)
  if (userId) {
    const title = mode === 'trial' ? 'انتهت تجربة جلب DzExams' : 'اكتمل جلب بكالوريات DzExams'
    const body =
      report.found === 0
        ? `لم يُعثر على مواضيع (أخطاء: ${report.errors}). راجع سجلّ المهمة في «المنهاج والمكتبة».`
        : `${report.found} موضوعاً في ${report.subjects} مادة${mode === 'trial' ? ' (بلا حفظ)' : `، حُفظ ${report.saved} منها ${report.withDirectLink} برابط مباشر`}${report.errors ? `، أخطاء ${report.errors}` : ''}.`
    await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title, body, link: '/admin/curriculum' })
  }
  return { ...report, mode }
}

/** حالة الاستيراد للوحة الإدارة: آخر مهمة وإحصاء المحفوظ */
export async function bacSyncStatus(db: Db, actor: Actor): Promise<BacSyncStatus> {
  assertRole(actor, 'SUPER_ADMIN')
  const [job, [counts], subjectRows] = await Promise.all([
    latestJobOfType(db, 'BAC_SYNC', null),
    db
      .select({
        saved: sql<number>`count(*)::int`,
        withDirectLink: sql<number>`count(*) filter (where ${bacExams.examUrl} is not null or ${bacExams.correctionUrl} is not null)::int`,
        lastFetchedAt: sql<Date | null>`max(${bacExams.fetchedAt})`
      })
      .from(bacExams),
    db.selectDistinct({ slug: bacExams.subjectSlug }).from(bacExams).orderBy(desc(bacExams.subjectSlug))
  ])
  if (job) await failStaleJob(db, job, STALE_AFTER_MS)
  const fresh = job ? await latestJobOfType(db, 'BAC_SYNC', null) : null
  return {
    job: fresh
      ? {
          id: fresh.id,
          status: fresh.status,
          startedAt: fresh.startedAt,
          finishedAt: fresh.finishedAt,
          error: fresh.error,
          createdAt: fresh.createdAt,
          mode: (fresh.payload.mode as BacSyncMode) ?? 'all',
          progress: (fresh.progress ?? {}) as Partial<SyncProgress>,
          logs: Array.isArray(fresh.logs) ? fresh.logs : [],
          result: (fresh.result as SyncReport | null) ?? null
        }
      : null,
    saved: counts?.saved ?? 0,
    withDirectLink: counts?.withDirectLink ?? 0,
    subjects: subjectRows.length,
    lastFetchedAt: counts?.lastFetchedAt ? new Date(counts.lastFetchedAt) : null,
    inlineWorker: process.env.JOBS_INLINE_WORKER !== '0'
  }
}
