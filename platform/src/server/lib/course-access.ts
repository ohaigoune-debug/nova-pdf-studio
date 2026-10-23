/**
 * أفواج التلميذ التي يحقّ له الوصول إلى محتواها الآن.
 *
 * الدورة = فوج خلفي. عضوية الفوج وحدها لا تكفي للدورة: يلزم اشتراك نشط غير منتهٍ في
 * course_enrollments عند كل طلب (درس، ملف، وسائط، مورد). يُستبعد الفوج إذا كان لدورة و:
 *   - لا سجل اشتراك أصلًا (عضوية قديمة، أو عضوية عبر رمز انضمام قبل إغلاق هذا المسار)، أو
 *   - الاشتراك ≠ ACTIVE (منتهٍ/ملغى)، أو expires_at مضى ولم تمرّ مهمة الانتهاء بعد.
 * الأفواج العادية (بلا دورة) لا تتأثر.
 *
 * توافق العضويات القديمة: `backfillCourseEnrollments` في courses.service ينشئ اشتراكًا صريحًا
 * لكل عضوية نشطة على فوج دورة بلا اشتراك (يشغّله المشرف مرة واحدة بعد النشر).
 */
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { groupStudents } from '@/server/db/schema'

/** حالات العضوية التي تُبقي المحتوى مرئيًا (الموقوف يرى الدروس لكنه لا يحضر) */
export const CONTENT_MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'] as const

/** شرط SQL: الفوج ليس لدورة، أو للتلميذ فيها اشتراك نشط غير منتهٍ */
export function hasCourseAccessOn(groupIdCol: SQL | typeof groupStudents.groupId, studentId: string): SQL {
  return sql`not exists (
    select 1 from courses c
    where c.group_id = ${groupIdCol} and c.deleted_at is null
      and not exists (
        select 1 from course_enrollments ce
        where ce.course_id = c.id and ce.student_id = ${studentId}
          and ce.status = 'ACTIVE' and (ce.expires_at is null or ce.expires_at > now())
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
