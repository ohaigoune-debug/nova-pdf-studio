import { runFileImportJob } from '@/server/services/file-import.service'
import { runGenerateQuizJob } from '@/server/services/quiz-generate.service'
import type { Db } from '@/server/db/connect'
import { runAiBatchCollectJob, runAiEvaluationJob, runAnalyzeStudentJob, runGenerateExercisesJob, runTeacherInsightsJob } from '@/server/services/ai.service'
import { runCleanupJob } from '@/server/services/maintenance.service'
import { runPushDispatchJob } from '@/server/services/push.service'
import { runReportJob } from '@/server/services/reports.service'
import { claimNextJob, completeJob, failJob, nextRunAfter, type JobRow, type JobType } from './queue'

type Handler = (db: Db, job: JobRow) => Promise<Record<string, unknown> | null>

const handlers: Record<JobType, Handler> = {
  AI_EVALUATE_SUBMISSION: (db, job) => runAiEvaluationJob(db, String(job.payload.evaluationId ?? '')),
  AI_BATCH_COLLECT: (db, job) => runAiBatchCollectJob(db, job.payload),
  AI_TEACHER_INSIGHTS: (db, job) => runTeacherInsightsJob(db, String(job.payload.workspaceId ?? ''), String(job.payload.userId ?? '')),
  AI_GENERATE_EXERCISES: (db, job) => runGenerateExercisesJob(db, job.payload, { lastAttempt: job.attempts >= job.maxAttempts }),
  AI_GENERATE_QUIZ: (db, job) => runGenerateQuizJob(db, job.payload, { lastAttempt: job.attempts >= job.maxAttempts }),
  AI_IMPORT_FILES: (db, job) => runFileImportJob(db, job.payload),
  AI_ANALYZE_STUDENT: (db, job) => runAnalyzeStudentJob(db, job.payload),
  REPORT_EXPORT: (db, job) => runReportJob(db, job.payload),
  CLEANUP: async (db) => ({ ...(await runCleanupJob(db)) }),
  PUSH_DISPATCH: (db, job) => runPushDispatchJob(db, job.payload)
}

export interface RunSummary {
  processed: number
  completed: number
  retried: number
  failed: number
}

/** ينفّذ المهام الجاهزة واحدة تلو الأخرى حتى الحدّ أو حتى يفرغ الطابور */
export async function processQueuedJobs(db: Db, opts: { limit?: number; now?: Date } = {}): Promise<RunSummary> {
  const limit = opts.limit ?? 10
  const summary: RunSummary = { processed: 0, completed: 0, retried: 0, failed: 0 }
  for (let i = 0; i < limit; i++) {
    const job = await claimNextJob(db, opts.now ?? new Date())
    if (!job) break
    summary.processed++
    const handler = handlers[job.type as JobType]
    try {
      if (!handler) throw new Error(`unknown job type ${job.type}`)
      const result = await handler(db, job)
      await completeJob(db, job.id, result)
      summary.completed++
    } catch (err) {
      const outcome = await failJob(db, job, err)
      if (outcome === 'RETRY') summary.retried++
      else summary.failed++
    }
  }
  return summary
}

let running = false
let again = false
let wake: ReturnType<typeof setTimeout> | null = null

/** المهام المؤجلة (تراجع الإعادة، استطلاع الدفعات) توقظ العامل الداخلي في موعدها بدل انتظار إدراج جديد */
async function armWake(db: Db, getDb: () => Promise<Db>): Promise<void> {
  const next = await nextRunAfter(db)
  if (!next) return
  if (wake) clearTimeout(wake)
  const delay = Math.min(15 * 60_000, Math.max(1000, next.getTime() - Date.now()))
  wake = setTimeout(() => {
    wake = null
    kickWorker(getDb)
  }, delay)
  wake.unref?.()
}

/**
 * عامل داخل عملية الخادم: يُستدعى بعد أي إدراج مهمة، بلا انتظار.
 * إن كان يعمل بالفعل يُعلَّم لدورة إضافية بعد انتهائه. آمن عند وجود Cron خارجي أيضاً.
 */
export function kickWorker(getDb: () => Promise<Db>): void {
  if (process.env.JOBS_INLINE_WORKER === '0') return
  if (running) {
    again = true
    return
  }
  running = true
  setTimeout(async () => {
    try {
      const db = await getDb()
      do {
        again = false
        await processQueuedJobs(db, { limit: 20 })
      } while (again)
      await armWake(db, getDb)
    } catch (err) {
      console.error('[jobs] worker error', err)
    } finally {
      running = false
    }
  }, 0)
}
