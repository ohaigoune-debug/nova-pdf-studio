/**
 * عامل مستقل (للنشر خارج Next): `npm run jobs:worker`
 * يستعمل نفس قاعدة البيانات ونفس المعالجات. يُوقف بـ SIGINT/SIGTERM.
 */
import { createDatabase } from '@/server/db/connect'
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
    const s = await processQueuedJobs(handle.db, { limit: 20 })
    if (s.processed > 0) console.log(`[jobs] processed=${s.processed} completed=${s.completed} retried=${s.retried} failed=${s.failed}`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
