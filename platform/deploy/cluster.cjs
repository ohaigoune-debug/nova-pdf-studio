/**
 * عدّة عمليات من خادم Next.js (الوضع المستقل) تتقاسم المنفذ نفسه عبر Node cluster.
 * عملية Node واحدة لا تستعمل عمليًّا إلّا نواة واحدة للصفحات مهما كبر الخادم.
 *
 *   WEB_CONCURRENCY=4 node cluster.cjs      (1 أو غير محدَّد ⇐ server.js كما هو تمامًا)
 *
 * لا حالة مشتركة في الذاكرة يعتمد عليها التطبيق: الجلسات وحدود المحاولات في القاعدة، والمهامّ تُحجز بـ
 * FOR UPDATE SKIP LOCKED. الهجرات لا تُشغَّل من هنا (AUTO_MIGRATE=0 في الإنتاج).
 */
const cluster = require('node:cluster')
const path = require('node:path')

const n = Math.max(1, Math.min(16, Number(process.env.WEB_CONCURRENCY || 1) || 1))
const entry = path.join(process.cwd(), 'server.js')

if (n === 1 || !cluster.isPrimary) {
  require(entry)
} else {
  console.log(`[cluster] ${n} عمليات على المنفذ ${process.env.PORT || 3000}`)
  for (let i = 0; i < n; i++) cluster.fork()
  let stopping = false
  cluster.on('exit', (w, code, signal) => {
    if (stopping) return
    console.error(`[cluster] توقّفت العملية ${w.process.pid} (${signal || code}) — تُعاد`)
    setTimeout(() => cluster.fork(), 1000)
  })
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      stopping = true
      for (const id in cluster.workers) cluster.workers[id]?.process.kill(sig)
      setTimeout(() => process.exit(0), 8000).unref()
    })
  }
}
