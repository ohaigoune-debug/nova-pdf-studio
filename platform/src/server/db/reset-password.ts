/**
 * إعادة تعيين كلمة سر حساب من الخادم — حين تُنسى ولا يصل بريد الاستعادة
 * (حساب المالك خاصة: لا أحد فوقه ليعيدها له).
 *   RESET_EMAIL=… RESET_PASSWORD=… npx tsx src/server/db/reset-password.ts
 * تُنهى كل جلسات الحساب: من كان داخلاً بكلمة السر القديمة يخرج.
 */
import { eq } from 'drizzle-orm'
import { hashPassword } from '@/server/auth/password'
import { revokeAllSessions } from '@/server/auth/session'
import { createDatabase, type Db } from './connect'
import { users } from './schema'

/** حساب المالك يملك المنصة كلها، فحدّه أعلى من حدّ الطلاب (8) */
const MIN_ADMIN_PASSWORD = 12
const MIN_PASSWORD = 8

export interface ResetResult {
  userId: string
  role: string
}

export async function resetUserPassword(db: Db, rawEmail: string, password: string): Promise<ResetResult> {
  const email = rawEmail.trim().toLowerCase()
  const [row] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.email, email)).limit(1)
  if (!row) throw new Error(`لا حساب بهذا البريد: ${email}`)

  const min = row.role === 'SUPER_ADMIN' ? MIN_ADMIN_PASSWORD : MIN_PASSWORD
  if (password.length < min) throw new Error(`كلمة السر قصيرة — ${min} حرفاً على الأقل لهذا الحساب`)

  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, row.id))
    await revokeAllSessions(tx, row.id)
  })
  return { userId: row.id, role: row.role }
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
