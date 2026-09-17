import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { profiles, students, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough, verifyPassword } from '@/server/auth/password'
import { createSession, revokeSession } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export interface RegisterInput {
  email: string
  password: string
  fullName: string
  phone?: string | null
  wilayaId?: string | null
  levelId?: string | null
  streamId?: string | null
}

export interface RequestMeta {
  userAgent?: string | null
  ip?: string | null
}

/** تسجيل حساب طالب جديد (نوع FREE حتى يستعمل كود فوج). */
export async function registerStudent(db: Db, input: RegisterInput, meta: RequestMeta = {}) {
  const email = input.email.trim().toLowerCase()
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing.length > 0) throw new AppError('EMAIL_TAKEN')

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash: hashPassword(input.password), role: 'STUDENT', lastLoginAt: new Date() })
      .returning({ id: users.id })
    if (!user) throw new AppError('INTERNAL')
    await tx.insert(profiles).values({ userId: user.id, fullName: input.fullName.trim(), phone: input.phone ?? null })
    const [student] = await tx
      .insert(students)
      .values({
        userId: user.id,
        studentType: 'FREE',
        wilayaId: input.wilayaId ?? null,
        levelId: input.levelId ?? null,
        streamId: input.streamId ?? null
      })
      .returning({ id: students.id })
    await writeActivity(tx, { userId: user.id, event: 'auth.register' })
    return { userId: user.id, studentId: student?.id ?? null }
  })

  const session = await createSession(db, { userId: result.userId, ...meta })
  return { ...result, session }
}

export async function login(db: Db, input: { email: string; password: string }, meta: RequestMeta = {}) {
  const email = input.email.trim().toLowerCase()
  const rows = await db
    .select({ id: users.id, passwordHash: users.passwordHash, status: users.status, role: users.role, deletedAt: users.deletedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)
  const user = rows[0]
  // نُشغّل التحقق حتى عند غياب المستخدم لتقليل فرق التوقيت
  const ok = user ? verifyPassword(input.password, user.passwordHash) : verifyPassword(input.password, DUMMY_HASH)
  if (!user || !ok || user.deletedAt) throw new AppError('INVALID_CREDENTIALS')
  if (user.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await writeActivity(db, { userId: user.id, event: 'auth.login' })
  const session = await createSession(db, { userId: user.id, ...meta })
  return { userId: user.id, role: user.role, session }
}

export async function logout(db: Db, token: string): Promise<void> {
  await revokeSession(db, token)
}

export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  if (!isStrongEnough(next)) throw new AppError('WEAK_PASSWORD')
  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row || !verifyPassword(current, row.passwordHash)) throw new AppError('INVALID_CREDENTIALS')
  await db.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, userId))
}

const DUMMY_HASH = hashPassword('dummy-password-for-timing')
