/**
 * الوصول الشامل للتلاميذ المسجّلين بكود (قرار المالك 2026-10-24).
 *   npx tsx scripts/academy/grant-full-access.ts --dry-run                 → محاكاة: لا كتابة
 *   npx tsx scripts/academy/grant-full-access.ts                           → منح حتى 2027-07-31
 *   npx tsx scripts/academy/grant-full-access.ts --until=2027-08-31        → تاريخ آخر
 * idempotent. يُشغَّل يدوياً بموافقة المالك وبعد نسخة احتياطية.
 */
import { createDatabase } from '@/server/db/connect'
import { grantFullAccessToCodeStudents } from '@/server/services/full-access.service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const untilArg = process.argv.find((a) => a.startsWith('--until='))?.slice('--until='.length)
  const until = untilArg ? new Date(`${untilArg}T22:59:59Z`) : undefined
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL غير محدّد')
  const handle = await createDatabase(url, { migrate: false })
  try {
    const r = await grantFullAccessToCodeStudents(handle.db, null, { dryRun, until })
    console.log(`${dryRun ? 'محاكاة' : 'تنفيذ'} — حتى ${r.until.slice(0, 10)}`)
    console.log(`تلاميذ مسجّلون بكود: ${r.candidates} (جدد: ${r.newlyFlagged}) · دورات منشورة: ${r.courses} · اشتراكات ${dryRun ? 'ستُنشأ' : 'أُنشئت'}: ${r.enrollmentsCreated}`)
  } finally {
    await handle.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
