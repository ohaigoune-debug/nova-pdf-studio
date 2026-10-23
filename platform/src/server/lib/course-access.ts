/**
 * أفواج التلميذ التي يحقّ له الوصول إلى محتواها الآن.
 *
 * الدورة = فوج خلفي. للوصول نمطان يحدّدهما إعداد `course_access.mode` في جدول settings:
 *   - `legacy` (الافتراضي عند غياب الإعداد، وهو سلوك ما قبل هذه الدفعة + حماية الانتهاء): عضوية الفوج تكفي
 *     ما لم يوجد اشتراك غير نشط أو منتهي التاريخ. لا أحد يفقد وصولًا كان له.
 *   - `strict`: يلزم اشتراك ACTIVE غير منتهٍ عند كل طلب؛ العضوية وحدها (قديمة أو عبر رمز) لا تفتح شيئًا.
 *
 * ترتيب الانتقال (docs/ACADEMY_2027_HANDOFF.md §4-د): النشر بنمط legacy → ترحيل العضويات القديمة إلى اشتراكات
 * صريحة والتحقق منها (`runCourseAccessMigration`) → تفعيل strict. التفعيل يُرفض آليًا إن بقيت عضوية بلا اشتراك.
 * الأفواج العادية (بلا دورة) لا تتأثر في النمطين.
 */
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings, groupStudents } from '@/server/db/schema'

/** حالات العضوية التي تُبقي المحتوى مرئيًا (الموقوف يرى الدروس لكنه لا يحضر) */
export const CONTENT_MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'] as const

export const COURSE_ACCESS_MODE_KEY = 'course_access.mode'
export type CourseAccessMode = 'legacy' | 'strict'

export async function getCourseAccessMode(db: Db): Promise<CourseAccessMode> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, COURSE_ACCESS_MODE_KEY)).limit(1)
  return row?.value === 'strict' ? 'strict' : 'legacy'
}

export async function setCourseAccessMode(db: Db, mode: CourseAccessMode): Promise<void> {
  const now = new Date()
  await db
    .insert(appSettings)
    .values({ key: COURSE_ACCESS_MODE_KEY, value: mode, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: mode, updatedAt: now } })
}

/**
 * شرط SQL يُقيَّم في الاستعلام نفسه (يقرأ النمط من settings): الفوج ليس لدورة، أو للتلميذ فيها
 * اشتراك صالح — بحسب النمط. مشترك بين الدرس والوسائط والملفات والمهارات والموارد.
 */
export function hasCourseAccessOn(groupIdCol: SQL | typeof groupStudents.groupId, studentId: string): SQL {
  return sql`not exists (
    select 1 from courses c
    where c.group_id = ${groupIdCol} and c.deleted_at is null
      and (
        -- في النمطين: اشتراك موجود لكنه ملغى/منتهٍ أو مضى تاريخه ⇒ لا وصول
        exists (
          select 1 from course_enrollments ce
          where ce.course_id = c.id and ce.student_id = ${studentId}
            and (ce.status <> 'ACTIVE' or (ce.expires_at is not null and ce.expires_at <= now()))
        )
        or (
          -- strict فقط: لا اشتراك نشط ⇒ لا وصول
          coalesce((select s.value #>> '{}' from settings s where s.key = ${COURSE_ACCESS_MODE_KEY}), 'legacy') = 'strict'
          and not exists (
            select 1 from course_enrollments ce
            where ce.course_id = c.id and ce.student_id = ${studentId}
              and ce.status = 'ACTIVE' and (ce.expires_at is null or ce.expires_at > now())
          )
        )
      )
  )`
}

/** معرّفات الأفواج التي يصل التلميذ إلى محتواها الآن */
export async function reachableGroupIds(db: Db, studentId: string, statuses: readonly string[] = CONTENT_MEMBERSHIP_STATUSES): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupStudents.groupId })
    .from(groupStudents)
    .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, [...statuses]), hasCourseAccessOn(groupStudents.groupId, studentId)))
  return rows.map((r) => r.groupId)
}
