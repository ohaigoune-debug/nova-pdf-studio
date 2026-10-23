/**
 * إجراء الانتقال إلى الوصول الصارم لأفواج الدورات (course_access.mode: legacy → strict) دون فقد وصول.
 *
 * الترتيب الصحيح:
 *   1. النشر بالنمط الافتراضي legacy (لا يفقد أحد وصولًا كان له).
 *   2. npx tsx scripts/academy/backfill-enrollments.ts --dry-run      → محاكاة: اتصال بلا هجرات + معاملة للقراءة فقط
 *   3. npx tsx scripts/academy/backfill-enrollments.ts                → إدراج ذرّي للاشتراكات الناقصة (idempotent)
 *   4. npx tsx scripts/academy/backfill-enrollments.ts --enable-strict → إدراج ما استجدّ + تحقق (المتبقي = 0) + تفعيل strict
 *
 * لا يعدّل أي اشتراك موجود، ولا حالة أي عضوية. يُشغَّل يدويًا بموافقة المالك وبعد نسخة احتياطية.
 */
import { createDatabase } from '@/server/db/connect'
import { runCourseAccessMigration } from '@/server/services/courses.service'

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const enableStrict = process.argv.includes('--enable-strict')
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL غير محدّد')
  // بلا هجرات: أداة صيانة لا تغيّر المخطط، والمحاكاة لا تكتب شيئًا
  const handle = await createDatabase(url, { migrate: false })
  try {
    const r = await runCourseAccessMigration(handle.db, null, { dryRun, enableStrict })
    console.log(`النمط الحالي: ${r.mode}`)
    for (const c of r.candidates) console.log(`${dryRun ? 'سيُدرج' : 'أُدرج'}: ${c.courseTitle} ← ${c.studentId} (${c.membershipStatus})`)
    console.log(`${r.candidates.length} عضوية بلا اشتراك — ${dryRun ? 'محاكاة بلا كتابة' : `أُدرج ${r.created} اشتراكًا`} — المتبقي: ${r.remaining}`)
    if (enableStrict) console.log(r.strictEnabled ? 'تم تفعيل النمط الصارم (strict).' : `لم يُفعَّل النمط الصارم: بقيت ${r.remaining} عضوية بلا اشتراك.`)
  } finally {
    await handle.close()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
