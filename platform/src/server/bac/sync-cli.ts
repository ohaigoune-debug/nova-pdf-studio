/**
 * تشغيل الزاحف من سطر الأوامر (scripts/bac-sync.sh):
 *   --dry            تجربة بلا كتابة: مادة واحدة وثلاثة مواضيع، ويطبع ما وجده
 *   --refresh        يعيد زيارة المواضيع المحفوظة
 *   --subject=arabe  مادة واحدة (تتكرّر)
 */
import { createDatabase } from '@/server/db/connect'
import { syncBacExams } from './sync'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const subjects = args.filter((a) => a.startsWith('--subject=')).map((a) => a.slice(10))

async function main() {
  const handle = dry ? null : await createDatabase(process.env.DATABASE_URL!)
  try {
    const r = await syncBacExams(handle?.db ?? null, {
      dry,
      refresh: args.includes('--refresh'),
      subjects: subjects.length ? subjects : dry ? ['arabe'] : undefined,
      maxExams: dry ? 3 : undefined,
      maxPagesPerListing: dry ? 1 : undefined,
      log: (l) => console.log(l)
    })
    if (r.found === 0) process.exitCode = 2
  } finally {
    await handle?.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
