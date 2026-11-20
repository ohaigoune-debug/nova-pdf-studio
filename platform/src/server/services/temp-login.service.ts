/**
 * التسجيل دون كلمة سر (قرار المالك 18 نوفمبر 2026) — للتلميذ الآتي من صفحة هبوط/إعلان:
 *  - عند التسجيل يأخذ «رمز دخول» من 6 أرقام صالحًا 7 أيام، يدخل به مع رقم هاتفه (مكان كلمة السر).
 *    الرمز يُخزَّن hash في password_hash كأي كلمة سر، ومختومًا في temp_code_sealed ليُعرض له في لافتة التذكير.
 *  - الأيام 1–4: لافتة زرقاء «أنشئ كلمة سرك»؛ من اليوم 5: لافتة برتقالية + إشعار؛ بعد اليوم 7: صفحة «أنشئ كلمة سرك»
 *    قبل المتابعة — اشتراكاته ودوراته كما هي (لا يُقفل شيء)، ورمز الدخول المؤقت لا يُقبل بعد انتهائه.
 *  - التذكير بالإشعار داخل المنصة (+ Push للتطبيق) — لا رسائل SMS للتذكير.
 *  - إنشاء كلمة السر لا يطلب الرمز القديم (الجلسة الحالية تكفي)، ويُبطل الرمز المؤقت والجلسات الأخرى.
 */
import { randomInt } from 'node:crypto'
import { and, eq, isNotNull, isNull, lte, ne, sql } from 'drizzle-orm'
import { hashPassword, isStrongEnough } from '@/server/auth/password'
import type { Db } from '@/server/db/connect'
import { sessions, users } from '@/server/db/schema'
import { writeActivity } from '@/server/lib/audit'
import { sha256 } from '@/server/lib/codes'
import { AppError, assertUuid } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { notifyMany } from './notifications.service'

export const TEMP_CODE_DAYS = 7
/** من هذا اليوم (بعد التسجيل) تصبح اللافتة تحذيرًا ويصل إشعار */
export const TEMP_WARN_FROM_DAY = 5
const DAY_MS = 86_400_000
const SEAL_PURPOSE = 'auth.temp-code'

/** رمز من 6 أرقام بلا أنماط سهلة التخمين (تكرار رقم واحد أو تسلسل) */
export function generateTempCode(): string {
  for (;;) {
    const c = String(randomInt(0, 1_000_000)).padStart(6, '0')
    if (/^(\d)\1{5}$/.test(c) || '0123456789'.includes(c) || '9876543210'.includes(c)) continue
    return c
  }
}

/** حقول الحساب الجديد دون كلمة سر */
export async function tempPasswordFields(now: Date = new Date()): Promise<{ code: string; passwordHash: string; tempPasswordUntil: Date; tempCodeSealed: string }> {
  const code = generateTempCode()
  return { code, passwordHash: await hashPassword(code), tempPasswordUntil: new Date(now.getTime() + TEMP_CODE_DAYS * DAY_MS), tempCodeSealed: seal(code, SEAL_PURPOSE) }
}

export type TempLoginStage = 'REMIND' | 'WARN' | 'EXPIRED'

export interface TempLoginState {
  code: string | null
  until: Date
  /** الأيام الكاملة المتبقية (0 = ينتهي اليوم) */
  daysLeft: number
  stage: TempLoginStage
}

export function tempStageOf(until: Date, now: Date = new Date()): { stage: TempLoginStage; daysLeft: number } {
  const left = until.getTime() - now.getTime()
  if (left <= 0) return { stage: 'EXPIRED', daysLeft: 0 }
  const daysLeft = Math.ceil(left / DAY_MS)
  // اليوم 5 من 7 = بقي يومان أو أقل
  return { stage: daysLeft <= TEMP_CODE_DAYS - TEMP_WARN_FROM_DAY ? 'WARN' : 'REMIND', daysLeft }
}

/** حالة الرمز المؤقت لحساب، أو null إن كانت له كلمة سر عادية */
export async function tempLoginState(db: Db, userId: string, now: Date = new Date()): Promise<TempLoginState | null> {
  assertUuid(userId, 'VALIDATION')
  const [u] = await db.select({ until: users.tempPasswordUntil, sealed: users.tempCodeSealed }).from(users).where(eq(users.id, userId)).limit(1)
  if (!u?.until) return null
  return { code: u.sealed ? unseal(u.sealed, SEAL_PURPOSE) : null, until: u.until, ...tempStageOf(u.until, now) }
}

/**
 * إنشاء كلمة السر الأولى لحساب سجّل دون كلمة سر: لا يُطلب الرمز القديم. يُبطل الرمز المؤقت
 * والجلسات الأخرى (من رأى الرمز على الشاشة لا تبقى له جلسة)، وتبقى الجلسة الحالية.
 */
export async function setFirstPassword(db: Db, input: { userId: string; password: string; keepToken?: string | null }): Promise<void> {
  assertUuid(input.userId, 'VALIDATION')
  if (!isStrongEnough(input.password)) throw new AppError('WEAK_PASSWORD')
  const [u] = await db.select({ until: users.tempPasswordUntil }).from(users).where(eq(users.id, input.userId)).limit(1)
  // من له كلمة سر عادية يغيّرها من «حسابي» بكلمته الحالية
  if (!u?.until) throw new AppError('FORBIDDEN')
  const passwordHash = await hashPassword(input.password)
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, tempPasswordUntil: null, tempCodeSealed: null, updatedAt: new Date() }).where(eq(users.id, input.userId))
    const now = new Date()
    await tx
      .update(sessions)
      .set({ revokedAt: now })
      .where(and(eq(sessions.userId, input.userId), isNull(sessions.revokedAt), input.keepToken ? ne(sessions.tokenHash, sha256(input.keepToken)) : sql`true`))
    await writeActivity(tx, { userId: input.userId, event: 'auth.password.first' })
  })
}

/** لوحة الإدارة: حسابات بلا كلمة سر بعد */
export async function tempPasswordStats(db: Db, now: Date = new Date()): Promise<{ total: number; warn: number; expired: number }> {
  const warnFrom = new Date(now.getTime() + (TEMP_CODE_DAYS - TEMP_WARN_FROM_DAY) * DAY_MS)
  const [r] = await db
    .select({
      total: sql<number>`count(*)::int`,
      warn: sql<number>`count(*) filter (where ${users.tempPasswordUntil} > ${now.toISOString()}::timestamptz and ${users.tempPasswordUntil} <= ${warnFrom.toISOString()}::timestamptz)::int`,
      expired: sql<number>`count(*) filter (where ${users.tempPasswordUntil} <= ${now.toISOString()}::timestamptz)::int`
    })
    .from(users)
    .where(and(isNotNull(users.tempPasswordUntil), isNull(users.deletedAt)))
  return { total: r?.total ?? 0, warn: r?.warn ?? 0, expired: r?.expired ?? 0 }
}

/**
 * مهمة دورية: إشعار (داخل المنصة + Push للتطبيق) مرة في اليوم 5، ومرة عند انتهاء الرمز. لا SMS.
 * temp_reminders يمنع التكرار، والتحديث المشروط يمنع إرسالين من تشغيلين متزامنين.
 */
export async function sendTempPasswordReminders(db: Db, now: Date = new Date()): Promise<{ warned: number; expired: number }> {
  const warnFrom = new Date(now.getTime() + (TEMP_CODE_DAYS - TEMP_WARN_FROM_DAY) * DAY_MS)
  const base = and(isNotNull(users.tempPasswordUntil), isNull(users.deletedAt), eq(users.status, 'ACTIVE'))
  const expired = await db
    .update(users)
    .set({ tempReminders: 2 })
    .where(and(base, lte(users.tempPasswordUntil, now), sql`${users.tempReminders} < 2`))
    .returning({ id: users.id })
  const warned = await db
    .update(users)
    .set({ tempReminders: 1 })
    .where(and(base, lte(users.tempPasswordUntil, warnFrom), sql`${users.tempPasswordUntil} > ${now.toISOString()}::timestamptz`, sql`${users.tempReminders} < 1`))
    .returning({ id: users.id })
  const link = '/student/password'
  await notifyMany(db, [
    ...warned.map((u) => ({ userId: u.id, workspaceId: null, type: 'SYSTEM' as const, title: 'أنشئ كلمة سرك: رمز دخولك ينتهي بعد يومين', body: 'كلمة سر من 8 أحرف تحفظ حسابك ودوراتك. تستغرق دقيقة.', link })),
    ...expired.map((u) => ({ userId: u.id, workspaceId: null, type: 'SYSTEM' as const, title: 'انتهى رمز الدخول المؤقت — أنشئ كلمة سرك', body: 'دوراتك محفوظة. أنشئ كلمة سرك لتتابع.', link }))
  ])
  return { warned: warned.length, expired: expired.length }
}
