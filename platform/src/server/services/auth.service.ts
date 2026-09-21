import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { passwordResets, profiles, students, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough, verifyPassword } from '@/server/auth/password'
import { createSession, revokeAllSessions, revokeSession } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { getMailer } from '@/server/lib/mailer'

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

const RESET_TTL_MS = 30 * 60 * 1000

/**
 * طلب إعادة تعيين كلمة السر: يُرسل رابطاً برمز عشوائي (يُخزَّن مجزّأً) صالحاً 30 دقيقة.
 * لا يكشف وجود البريد: النتيجة واحدة دائماً. الحدّ من المحاولات يتم في طبقة الـAction.
 */
export async function requestPasswordReset(db: Db, email: string, meta: RequestMeta = {}, now: Date = new Date()): Promise<{ sent: boolean }> {
  const normalized = email.trim().toLowerCase()
  const [user] = await db.select({ id: users.id, status: users.status, deletedAt: users.deletedAt }).from(users).where(eq(users.email, normalized)).limit(1)
  if (!user || user.deletedAt || user.status !== 'ACTIVE') return { sent: false }
  const token = randomBytes(32).toString('base64url')
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: sha256(token), expiresAt: new Date(now.getTime() + RESET_TTL_MS), requestedIp: meta.ip ?? null })
  await writeActivity(db, { userId: user.id, event: 'auth.reset.request' })
  const base = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  const link = `${base}/reset-password?token=${token}`
  try {
    await getMailer().send({
      to: normalized,
      subject: 'إعادة تعيين كلمة السر — مدرسة',
      text: `مرحباً،\n\nطُلب إعادة تعيين كلمة سر حسابك. افتح الرابط التالي خلال 30 دقيقة:\n${link}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة؛ كلمة سرك لم تتغيّر.`,
      html: `<p dir="rtl">مرحباً،</p><p dir="rtl">طُلب إعادة تعيين كلمة سر حسابك. افتح الرابط التالي خلال 30 دقيقة:</p><p><a href="${link}">${link}</a></p><p dir="rtl">إن لم تطلب ذلك فتجاهل هذه الرسالة؛ كلمة سرك لم تتغيّر.</p>`
    })
  } catch (err) {
    console.error('[mail] password reset send failed', err)
    return { sent: false }
  }
  return { sent: true }
}

/** يتحقق من الرمز (مجزّأ، غير منتهٍ، غير مستعمل) ويرجع المستخدم */
export async function verifyPasswordResetToken(db: Db, token: string, now: Date = new Date()) {
  if (!token || token.length < 20) throw new AppError('RESET_TOKEN_INVALID')
  const [row] = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, sha256(token))).limit(1)
  if (!row || row.usedAt) throw new AppError('RESET_TOKEN_INVALID')
  if (row.expiresAt < now) throw new AppError('RESET_TOKEN_EXPIRED')
  return row
}

/** يضبط كلمة سر جديدة، يعلّم الرمز مستعملاً، ويُنهي كل الجلسات القديمة */
export async function resetPassword(db: Db, token: string, newPassword: string, now: Date = new Date()): Promise<{ userId: string }> {
  if (!isStrongEnough(newPassword)) throw new AppError('WEAK_PASSWORD')
  const row = await verifyPasswordResetToken(db, token, now)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(newPassword) }).where(eq(users.id, row.userId))
    await tx.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, row.id))
    await revokeAllSessions(tx, row.userId)
    await writeActivity(tx, { userId: row.userId, event: 'auth.reset.done' })
  })
  return { userId: row.userId }
}

/** يغيّر كلمة السر ويُنهي كل الجلسات: من سرق كلمة السر القديمة لا تبقى له جلسة مفتوحة */
export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  if (!isStrongEnough(next)) throw new AppError('WEAK_PASSWORD')
  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row || !verifyPassword(current, row.passwordHash)) throw new AppError('INVALID_CREDENTIALS')
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: hashPassword(next) }).where(eq(users.id, userId))
    await revokeAllSessions(tx, userId)
    await writeActivity(tx, { userId, event: 'auth.password.change' })
  })
}

const DUMMY_HASH = hashPassword('dummy-password-for-timing')
