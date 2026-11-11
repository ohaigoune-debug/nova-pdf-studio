/**
 * إعادة تعيين كلمة سر حساب من الخادم — حين تُنسى ولا يصل بريد الاستعادة
 * (حساب المالك خاصة: لا أحد فوقه ليعيدها له).
 *   RESET_EMAIL=… RESET_PASSWORD=… npx tsx src/server/db/reset-password.ts
 * RESET_EMAIL يقبل البريد أو رقم الهاتف المؤكَّد (حساب مسجَّل بالهاتف وحده).
 * تُنهى كل جلسات الحساب: من كان داخلاً بكلمة السر القديمة يخرج.
 */
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import { hashPassword } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import { createDatabase, type Db } from './connect'
import { profiles, users } from './schema'

/** حساب المالك يملك المنصة كلها، فحدّه أعلى من حدّ الطلاب (8) */
const MIN_ADMIN_PASSWORD = 12
const MIN_PASSWORD = 8

export interface ResetResult {
  userId: string
  role: string
}

/** رقم جزائري بعد توحيده (05/06/07، +213، فراغات وشُرط)، أو null */
function phoneOf(raw: string): string | null {
  const p = raw.replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')
  return /^0[5-7]\d{8}$/.test(p) ? p : null
}

/**
 * `identifier`: بريد الحساب، أو رقم هاتفه المؤكَّد (الحساب المسجَّل بالهاتف وحده لا بريد له).
 * بالهاتف: لا يُقبل إلا رقم مؤكَّد لحساب واحد بالضبط — الرقم غير المؤكَّد قد يكون كتبه غير صاحبه.
 */
export async function resetUserPassword(db: Db, identifier: string, password: string): Promise<ResetResult> {
  const ident = identifier.trim()
  const phone = ident.includes('@') ? null : phoneOf(ident)
  let row: { id: string; role: string } | undefined
  if (phone) {
    const holders = await db
      .select({ id: users.id, role: users.role })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(and(eq(profiles.phone, phone), isNotNull(profiles.phoneVerifiedAt), isNull(users.deletedAt)))
      .limit(2)
    if (holders.length === 0) throw new Error(`لا حساب أكّد هذا الرقم: ${phone} (الرقم غير المؤكَّد لا يُعتمد — استعمل بريد الحساب إن كان له بريد)`)
    if (holders.length > 1) throw new Error(`الرقم ${phone} مؤكَّد لأكثر من حساب (بيانات قديمة) — استعمل بريد الحساب المقصود`)
    row = holders[0]
  } else {
    const email = ident.toLowerCase()
    ;[row] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1)
    if (!row) throw new Error(`لا حساب بهذا البريد: ${email}`)
  }
  if (!row) throw new Error('لا حساب')
  const target = row

  const min = target.role === 'SUPER_ADMIN' ? MIN_ADMIN_PASSWORD : MIN_PASSWORD
  if (password.length < min) throw new Error(`كلمة السر قصيرة — ${min} حرفاً على الأقل لهذا الحساب`)

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password) }).where(eq(users.id, target.id))
    await revokeAllSessions(tx, target.id)
  })
  return { userId: target.id, role: target.role }
}

async function main() {
  const email = process.env.RESET_EMAIL
  const password = process.env.RESET_PASSWORD
  if (!email || !password) {
    console.error('✖ لا بد من RESET_EMAIL و RESET_PASSWORD')
    console.error('  الأسهل:  bash scripts/reset-password.sh you@example.com')
    process.exit(1)
  }
  const handle = await createDatabase(process.env.DATABASE_URL ?? 'pglite://./data/pglite')
  try {
    const r = await resetUserPassword(handle.db, email, password)
    console.log(`✔ غُيّرت كلمة سر ${email.trim().toLowerCase()} (${r.role})`)
    console.log('  أُنهيت جلساته القائمة — ادخل من جديد بكلمة السر الجديدة.')
  } finally {
    await handle.close()
  }
}

if (process.argv[1] && process.argv[1].endsWith('reset-password.ts')) {
  main().catch((err) => {
    console.error('✖', err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
