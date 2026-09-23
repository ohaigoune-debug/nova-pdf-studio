/**
 * حذف حساب التلميذ بطلب منه (شرط Google Play لكل تطبيق فيه إنشاء حساب).
 *
 * لا يُمحى الصفّ نفسه: الحضور والواجبات والعلامات مربوطة بمفاتيح أجنبية لا تُحذف تتابعاً،
 * وهي سجلّ فوج الأستاذ. فتُمحى كل بيانات الهوية ويبقى الأثر مجهول الهويّة:
 * لا بريد ولا اسم ولا هاتف ولا ولاية ولا مدرسة، ولا دخول بعدها أبداً.
 */
import { randomBytes } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { hashPassword, verifyPassword } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import type { Db } from '@/server/db/connect'
import { groupStudents, passwordResets, profiles, pushSubscriptions, students, users } from '@/server/db/schema'
import { writeActivity } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export const DELETED_NAME = 'حساب محذوف'

/** عنوان لا يُستقبل عليه بريد (نطاق .invalid محجوز) ولا يتكرّر، فيبقى قيد التفرّد سليماً */
export function deletedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`
}

export async function deleteOwnAccount(db: Db, userId: string, password: string): Promise<void> {
  const rows = await db.select({ role: users.role, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row || !verifyPassword(password, row.passwordHash)) throw new AppError('INVALID_CREDENTIALS')
  // الأستاذ والمشرف والمساعد يديرون بيانات غيرهم: حذف حساباتهم عبر الإدارة لا بزرّ
  if (row.role !== 'STUDENT') throw new AppError('FORBIDDEN')

  await db.transaction(async (tx) => {
    const now = new Date()
    await tx
      .update(users)
      .set({ email: deletedEmail(userId), passwordHash: hashPassword(randomBytes(32).toString('hex')), status: 'DISABLED', emailVerifiedAt: null, deletedAt: now })
      .where(eq(users.id, userId))
    await tx.update(profiles).set({ fullName: DELETED_NAME, phone: null, avatarUrl: null }).where(eq(profiles.userId, userId))
    const st = await tx
      .update(students)
      .set({ wilayaId: null, schoolId: null, guardianPhone: null, birthDate: null })
      .where(eq(students.userId, userId))
      .returning({ id: students.id })
    if (st[0]) {
      // يغادر أفواجه فيتحرّر مكانه، وتبقى سجلّاته القديمة مجهولة الهويّة
      await tx
        .update(groupStudents)
        .set({ status: 'LEFT_GROUP', leftAt: now })
        .where(and(eq(groupStudents.studentId, st[0].id), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE', 'INACTIVE'])))
    }
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
    await tx.delete(passwordResets).where(eq(passwordResets.userId, userId))
    await revokeAllSessions(tx, userId)
    await writeActivity(tx, { userId, event: 'auth.account.delete' })
  })
}
