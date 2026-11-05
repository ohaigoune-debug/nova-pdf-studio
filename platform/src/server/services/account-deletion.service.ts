/**
 * حذف حساب التلميذ بطلب منه (شرط Google Play لكل تطبيق فيه إنشاء حساب).
 *
 * لا يُمحى الصفّ نفسه: الحضور والواجبات والعلامات مربوطة بمفاتيح أجنبية لا تُحذف تتابعاً،
 * وهي سجلّ فوج الأستاذ. فتُمحى كل بيانات الهوية ويبقى الأثر مجهول الهويّة:
 * لا بريد ولا اسم ولا هاتف ولا ولاية ولا مدرسة، ولا دخول بعدها أبداً.
 */
import { randomBytes } from 'node:crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { hasUsablePassword, hashPassword, verifyPassword } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import type { Db } from '@/server/db/connect'
import { groupStudents, oauthIdentities, oauthTickets, passwordResets, profiles, pushSubscriptions, students, users } from '@/server/db/schema'
import { revokeAppleToken } from '@/server/auth/oauth-tokens'
import { writeActivity } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export const DELETED_NAME = 'حساب محذوف'

/** عنوان لا يُستقبل عليه بريد (نطاق .invalid محجوز) ولا يتكرّر، فيبقى قيد التفرّد سليماً */
export function deletedEmail(userId: string): string {
  return `deleted-${userId}@deleted.invalid`
}

/** كلمة التأكيد لحساب أُنشئ بـ Google أو Apple ولا كلمة سر له */
export const DELETE_CONFIRM_WORD = 'حذف'

/** هل يُطلب لحذف الحساب كلمة السر (true) أم كلمة التأكيد «حذف» (false)؟ */
export async function deletionNeedsPassword(db: Db, userId: string): Promise<boolean> {
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  return row ? hasUsablePassword(row.passwordHash) : true
}

/** secret: كلمة السر، أو «حذف» لحساب بلا كلمة سر (Google / Apple) */
export async function deleteOwnAccount(db: Db, userId: string, secret: string): Promise<void> {
  const rows = await db.select({ role: users.role, passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row) throw new AppError('INVALID_CREDENTIALS')
  const confirmed = hasUsablePassword(row.passwordHash) ? verifyPassword(secret, row.passwordHash) : secret.trim() === DELETE_CONFIRM_WORD
  if (!confirmed) throw new AppError('INVALID_CREDENTIALS')
  // الأستاذ والمشرف والمساعد يديرون بيانات غيرهم: حذف حساباتهم عبر الإدارة لا بزرّ
  if (row.role !== 'STUDENT') throw new AppError('FORBIDDEN')
  const appleTokens = (
    await db.select({ refreshToken: oauthIdentities.refreshToken }).from(oauthIdentities).where(and(eq(oauthIdentities.userId, userId), eq(oauthIdentities.provider, 'APPLE')))
  )
    .map((r) => r.refreshToken)
    .filter((t): t is string => Boolean(t))

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
    // فكّ ربط Google وApple: الدخول بهما بعد الحذف ينشئ حسابًا جديدًا لا يعود إلى هذا
    await tx.delete(oauthIdentities).where(eq(oauthIdentities.userId, userId))
    await tx.delete(oauthTickets).where(eq(oauthTickets.userId, userId))
    await revokeAllSessions(tx, userId)
    await writeActivity(tx, { userId, event: 'auth.account.delete' })
  })
  // شرط Apple: إلغاء إذن «الدخول بـ Apple» عند حذف الحساب. فشل الشبكة لا يُرجع الحذف.
  for (const token of appleTokens) await revokeAppleToken(token)
}
