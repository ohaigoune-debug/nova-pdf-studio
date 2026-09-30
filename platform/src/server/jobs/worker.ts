/**
 * عامل مستقل (للنشر خارج Next): `npm run jobs:worker`
 * يستعمل نفس قاعدة البيانات ونفس المعالجات. يُوقف بـ SIGINT/SIGTERM.
 */
import { createDatabase } from '@/server/db/connect'
import { ensureMaintenanceJobs } from '@/server/services/maintenance.service'
import { processQueuedJobs } from './runner'

async function main() {
  const handle = await createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')
  const intervalMs = Number(process.env.JOBS_POLL_MS ?? 5000)
  let stopped = false
  const stop = async () => {
    stopped = true
    await handle.close()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  console.log(`[jobs] worker started (poll ${intervalMs}ms)`)
  while (!stopped) {
    await ensureMaintenanceJobs(handle.db)
    const s = await processQueuedJobs(handle.db, { limit: 20 })
    // المسار البطيء أيضاً (مهمة واحدة في الدورة)
    const slow = await processQueuedJobs(handle.db, { limit: 1, lane: 'slow' })
    const processed = s.processed + slow.processed
    if (processed > 0) console.log(`[jobs] processed=${processed} completed=${s.completed + slow.completed} retried=${s.retried + slow.retried} failed=${s.failed + slow.failed}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
