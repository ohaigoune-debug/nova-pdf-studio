import { randomBytes } from 'node:crypto'
import { and, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { levels, otpCodes, passwordResets, profiles, streams, students, users } from '@/server/db/schema'
import { hashPassword, isStrongEnough, verifyPassword } from '@/server/auth/password'
import { createSession, revokeAllSessions, revokeSession } from '@/server/auth/session'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError } from '@/server/lib/errors'
import { getMailer } from '@/server/lib/mailer'

export interface RegisterInput {
  /** اختياري (قرار المالك 10 نوفمبر 2026): من سجّل بلا بريد يدخل برقم هاتفه. الفارغ = لا بريد. */
  email?: string | null
  password: string
  fullName: string
  phone?: string | null
  /** هاتف وليّ الأمر: يختار التلميذ بينه وبين هاتفه عند شراء دورة */
  guardianPhone?: string | null
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
  // لا يُكتب بريد وهمي أبدًا: الغائب يُخزَّن NULL (القيد الفريد يسمح بعدة NULL)
  const email = input.email?.trim().toLowerCase() || null
  // بلا بريد يصير الهاتف هو المعرّف الوحيد للدخول والاستعادة
  if (!email && !input.phone) throw new AppError('VALIDATION', { field: 'phone' })
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')

  if (email) {
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
    if (existing.length > 0) throw new AppError('EMAIL_TAKEN')
  }
  if (input.phone) {
    /**
     * رقم مؤكَّد (برمز SMS) هو المعرّف الوحيد لحساب بلا بريد ⇒ لا يتقاسمه حسابان، وإلا تعذّرت استعادة كلمة السر بالهاتف
     * (الاستعادة ترفض الرقم المشترك). الرقم غير المؤكَّد لا يحجز شيئًا: من كتب رقم غيره لا يمنع صاحبه من التسجيل،
     * ومن لم يكمل تسجيله الأول يعيده. حسابان ببريدين يتقاسمان رقمًا: كما كان قبل هذا التغيير.
     */
    const holders = await db
      .select({ email: users.email })
      .from(profiles)
      .innerJoin(users, eq(users.id, profiles.userId))
      .where(and(eq(profiles.phone, input.phone), isNotNull(profiles.phoneVerifiedAt), isNull(users.deletedAt)))
      .limit(20)
    if (holders.some((h) => !email || !h.email)) throw new AppError('PHONE_TAKEN')
  }
  // الشعبة إلزامية للثانوي (رموز المستويات …AS): تحدّد الكتب والدورات المسموح بطلبها
  if (input.levelId) {
    const [lv] = await db.select({ code: levels.code }).from(levels).where(eq(levels.id, input.levelId)).limit(1)
    if (!lv) throw new AppError('VALIDATION', { field: 'levelId' })
    if (/AS$/i.test(lv.code) && !input.streamId) throw new AppError('VALIDATION', { field: 'streamId' })
  }
  if (input.streamId) {
    const [st] = await db.select({ id: streams.id }).from(streams).where(eq(streams.id, input.streamId)).limit(1)
    if (!st) throw new AppError('VALIDATION', { field: 'streamId' })
  }

  // التجزئة قبل فتح المعاملة: scrypt غير المتزامن ينتظر خيوط libuv (4)، ولو انتظر داخل المعاملة لبقي
  // اتصال من المجمّع (10) محجوزاً خاملاً طوال الانتظار، فتستنزف موجة تسجيلات كل الاتصالات.
  const passwordHash = await hashPassword(input.password)
  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, role: 'STUDENT', lastLoginAt: new Date() })
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
        streamId: input.streamId ?? null,
        guardianPhone: input.guardianPhone ?? null
      })
      .returning({ id: students.id })
    await writeActivity(tx, { userId: user.id, event: 'auth.register' })
    return { userId: user.id, studentId: student?.id ?? null }
  })

  const session = await createSession(db, { userId: result.userId, ...meta })
  return { ...result, session }
}

/** رقم هاتف جزائري (05/06/07) بصيغه الشائعة (ومنها الأرقام الهندية ٠-٩ كما يقبلها تسجيل التطبيق)، أو null */
export function loginPhone(raw: string): string | null {
  const p = raw.replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[\s\-().]/g, '').replace(/^\+?213/, '0')
  return /^0[5-7]\d{8}$/.test(p) ? p : null
}

/**
 * هوية قفل محاولات الدخول: الرقم بعد توحيده (فلا تُفتح عدّادات جديدة بكتابة الرقم نفسه بصيغ مختلفة)، أو البريد.
 * المفتاح بصمة (sha256)، لا الهوية نفسها. الحدّان متساويان (RATE_LIMITS.loginPhone = loginEmail).
 */
export function loginIdentity(raw: string): { scope: 'login-phone' | 'login-email'; subject: string } {
  const ident = raw.trim()
  const phone = ident.includes('@') ? null : loginPhone(ident)
  return phone ? { scope: 'login-phone', subject: sha256(phone) } : { scope: 'login-email', subject: sha256(ident.toLowerCase()) }
}

/**
 * الدخول بالبريد أو بالهاتف (قرار المالك 2 نوفمبر 2026: حسابات المدارس والشركاء تُرسَل لهم برقم وكلمة سر).
 * بالهاتف: كل حساب يحمل هذا الرقم في ملفه، ويُقبل منها الذي تطابق كلمة سرّه. من أكّد الرقم يُفحص أولًا:
 * الحساب المسجَّل بالهاتف وحده لا طريق آخر له، فلا تزيحه حسابات غير مؤكَّدة كُتب فيها رقمه.
 */
export async function login(db: Db, input: { email: string; password: string }, meta: RequestMeta = {}) {
  const ident = input.email.trim()
  const phone = ident.includes('@') ? null : loginPhone(ident)
  const cols = { id: users.id, passwordHash: users.passwordHash, status: users.status, role: users.role, deletedAt: users.deletedAt }
  const candidates = phone
    ? await db.select(cols).from(users).innerJoin(profiles, eq(profiles.userId, users.id)).where(and(eq(profiles.phone, phone), isNull(users.deletedAt))).orderBy(sql`${profiles.phoneVerifiedAt} is null`, desc(users.lastLoginAt)).limit(5)
    : await db.select(cols).from(users).where(eq(users.email, ident.toLowerCase())).limit(1)
  // نُشغّل التحقق حتى عند غياب المستخدم لتقليل فرق التوقيت
  if (candidates.length === 0) await verifyPassword(input.password, await DUMMY_HASH)
  // بالتتابع ويتوقف عند أول تطابق — كما كان find المتزامن: العدد نفسه من حسابات scrypt
  let user: (typeof candidates)[number] | undefined
  for (const c of candidates) {
    if (await verifyPassword(input.password, c.passwordHash)) {
      user = c
      break
    }
  }
  if (!user || user.deletedAt) throw new AppError('INVALID_CREDENTIALS')
  if (user.status !== 'ACTIVE') throw new AppError('ACCOUNT_DISABLED')

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await writeActivity(db, { userId: user.id, event: 'auth.login' })
  const session = await createSession(db, { userId: user.id, ...meta })
  // رقم يحمله أكثر من حساب: من يدخل بحسابه لا يُصفَّر له عدّاد الرقم، وإلا خمّن به كلمة سر الحساب الآخر بلا قفل
  return { userId: user.id, role: user.role, session, sharedIdentity: candidates.length > 1 }
}

export async function logout(db: Db, token: string): Promise<void> {
  await revokeSession(db, token)
}

const RESET_TTL_MS = 30 * 60 * 1000

/**
 * طلب إعادة تعيين كلمة السر: يُرسل رابطاً برمز عشوائي (يُخزَّن مجزّأً) صالحاً 30 دقيقة.
 * لا يكشف وجود البريد: النتيجة واحدة دائماً. الحدّ من المحاولات يتم في طبقة الـAction.
 * الحساب المسجَّل بالهاتف وحده لا بريد له فلا يطابقه أي عنوان: نفس الرد ولا رسالة، واستعادته بالهاتف (phone-recovery).
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
    await tx.update(users).set({ passwordHash: await hashPassword(newPassword) }).where(eq(users.id, row.userId))
    await tx.update(passwordResets).set({ usedAt: now }).where(eq(passwordResets.id, row.id))
    await revokeAllSessions(tx, row.userId)
    await invalidatePhoneRecoveryCodes(tx, row.userId, now)
    await writeActivity(tx, { userId: row.userId, event: 'auth.reset.done' })
  })
  return { userId: row.userId }
}

/** يغيّر كلمة السر ويُنهي كل الجلسات: من سرق كلمة السر القديمة لا تبقى له جلسة مفتوحة */
export async function changePassword(db: Db, userId: string, current: string, next: string): Promise<void> {
  if (!isStrongEnough(next)) throw new AppError('WEAK_PASSWORD')
  const rows = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, userId)).limit(1)
  const row = rows[0]
  if (!row || !(await verifyPassword(current, row.passwordHash))) throw new AppError('INVALID_CREDENTIALS')
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, userId))
    await revokeAllSessions(tx, userId)
    await invalidatePhoneRecoveryCodes(tx, userId, new Date())
    await writeActivity(tx, { userId, event: 'auth.password.change' })
  })
}

/** تغيير السر عبر مسار آخر يُسقط رموز استعادة الهاتف التي صدرت قبله. */
async function invalidatePhoneRecoveryCodes(db: Db, userId: string, now: Date): Promise<void> {
  await db.update(otpCodes).set({ consumedAt: now }).where(and(eq(otpCodes.userId, userId), eq(otpCodes.purpose, 'RECOVER'), isNull(otpCodes.consumedAt)))
}

// Promise يُحسب مرة عند تحميل الوحدة ويُنتظر عند الاستعمال
const DUMMY_HASH: Promise<string> = hashPassword('dummy-password-for-timing')
