/**
 * ملكية رقم الهاتف (قرار المالك 11 نوفمبر 2026): «الرقم الموثَّق لحساب واحد، والرقم يُفتح به حساب واحد فقط».
 * كل مسار يعلّم هاتف ملف «مؤكَّدًا» يمرّ من هنا: قفل على الرقم داخل المعاملة ثم فحص ثم كتابة،
 * فلا ينجح تأكيدان متزامنان للرقم نفسه. الرقم غير المؤكَّد لا يحجز شيئًا.
 * البيانات القديمة لا تُمسّ: لا قيد فريد ولا تعديل لصفوف سابقة — القاعدة للتأكيدات الجديدة.
 */
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { profiles, users } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'

/** قفل استشاري على الرقم حتى نهاية المعاملة (لا صفّ يُكتب): يُستدعى داخل معاملة فقط. */
export async function lockPhone(tx: Db, phone: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`phone-verified:${phone}`}, 0))`)
}

/** هل يحمل حساب (غير محذوف) هذا الرقم مؤكَّدًا؟ `exceptUserId` يستثني صاحب الطلب نفسه. */
export async function isPhoneVerifiedElsewhere(db: Db, phone: string, exceptUserId?: string | null): Promise<boolean> {
  const [holder] = await db
    .select({ id: users.id })
    .from(profiles)
    .innerJoin(users, eq(users.id, profiles.userId))
    .where(and(eq(profiles.phone, phone), isNotNull(profiles.phoneVerifiedAt), isNull(users.deletedAt), exceptUserId ? ne(users.id, exceptUserId) : undefined))
    .limit(1)
  return Boolean(holder)
}

/**
 * يكتب الرقم مؤكَّدًا في ملف الحساب، إلا إن كان مؤكَّدًا لحساب آخر ⇒ PHONE_TAKEN ولا يتغيّر شيء.
 * `onlyIfUnverified`: لا يكتب إلا إن كان الملف ما زال يحمل هذا الرقم غير مؤكَّد (المكالمة الفائتة) — يرجع false إن تغيّر.
 */
export async function claimVerifiedPhone(db: Db, input: { userId: string; phone: string; at: Date; onlyIfUnverified?: boolean }): Promise<boolean> {
  return db.transaction(async (tx) => {
    await lockPhone(tx, input.phone)
    if (await isPhoneVerifiedElsewhere(tx, input.phone, input.userId)) throw new AppError('PHONE_TAKEN')
    const rows = await tx
      .update(profiles)
      .set({ phone: input.phone, phoneVerifiedAt: input.at, updatedAt: new Date() })
      .where(and(eq(profiles.userId, input.userId), input.onlyIfUnverified ? and(eq(profiles.phone, input.phone), isNull(profiles.phoneVerifiedAt)) : undefined))
      .returning({ userId: profiles.userId })
    return rows.length > 0
  })
}
