/**
 * توافق العضويات القديمة على أفواج الدورات: ينشئ اشتراكًا صريحًا (MANUAL) لكل عضوية نشطة بلا سجل اشتراك،
 * لأن الوصول إلى محتوى الدورة صار يشترط اشتراكًا نشطًا عند كل طلب (lib/course-access.ts).
 *
 *   npx tsx scripts/academy/backfill-enrollments.ts --dry-run   → يعدّ ويطبع المرشّحين فقط، بلا كتابة
 *   npx tsx scripts/academy/backfill-enrollments.ts             → ينفّذ (idempotent)
 *
 * يُشغَّل مرة واحدة بعد نشر هذه الدفعة وبعد نسخة احتياطية، بموافقة المالك. لا يُشغَّل تلقائيًا.
 */
import { createDatabase } from '@/server/db/connect'
import { backfillCourseEnrollments } from '@/server/services/courses.service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL غير محدّد')
  const handle = await createDatabase(url)
  try {
    const r = await backfillCourseEnrollments(handle.db, null, { dryRun })
    for (const c of r.candidates) console.log(`${dryRun ? 'سيُفعَّل' : 'فُعِّل'}: ${c.courseTitle} ← ${c.studentId}`)
    console.log(`${r.candidates.length} عضوية بلا اشتراك — ${dryRun ? 'تجربة بلا كتابة' : `أُنشئ ${r.created} اشتراكًا`}`)
  } finally {
    await handle.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
