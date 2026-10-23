/**
 * أفواج التلميذ التي يحقّ له الوصول إلى محتواها الآن.
 *
 * الدورة = فوج خلفي، وعضوية الفوج تبقى قائمة إلى أن تمرّ مهمة إنهاء الاشتراكات (مرة يوميًا).
 * لذلك لا تكفي عضوية الفوج وحدها: إن كان للفوج دورة واشتراك التلميذ فيها غير نشط أو انتهى
 * تاريخه، يُستبعد الفوج عند كل طلب (درس، ملف، وسائط، مورد). الأفواج العادية (بلا دورة) لا تتأثر.
 */
import { and, eq, inArray, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { groupStudents } from '@/server/db/schema'

/** حالات العضوية التي تُبقي المحتوى مرئيًا (الموقوف يرى الدروس لكنه لا يحضر) */
export const CONTENT_MEMBERSHIP_STATUSES = ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'] as const

/** شرط SQL: لا دورة على هذا الفوج اشتراكُ التلميذ فيها غير نشط أو منتهٍ */
export function noExpiredCourseOn(groupIdCol: SQL | typeof groupStudents.groupId, studentId: string): SQL {
  return sql`not exists (
    select 1 from courses c
    join course_enrollments ce on ce.course_id = c.id and ce.student_id = ${studentId}
    where c.group_id = ${groupIdCol}
      and (ce.status <> 'ACTIVE' or (ce.expires_at is not null and ce.expires_at <= now()))
  )`
}

/** معرّفات الأفواج التي يصل التلميذ إلى محتواها الآن */
export async function reachableGroupIds(db: Db, studentId: string, statuses: readonly string[] = CONTENT_MEMBERSHIP_STATUSES): Promise<string[]> {
  const rows = await db
    .select({ groupId: groupStudents.groupId })
    .from(groupStudents)
    .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, [...statuses]), noExpiredCourseOn(groupStudents.groupId, studentId)))
  return rows.map((r) => r.groupId)
}
