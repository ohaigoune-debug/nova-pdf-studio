import { and, eq, lt, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { rateLimits } from '@/server/db/schema'
import { AppError } from './errors'

/**
 * حدّ محاولات بنافذة ثابتة مخزَّن في قاعدة البيانات (يعمل مع عدة نسخ من الخادم بلا Redis).
 * المفتاح لا يحوي بيانات حساسة صريحة: البريد يُجزَّأ قبل الاستعمال في المفتاح.
 */
export interface RateLimitRule {
  /** اسم المسار/العملية */
  scope: string
  /** معرّف الطرف: IP أو userId أو بريد مجزّأ */
  subject: string
  limit: number
  windowSeconds: number
}

/**
 * حدود العنوان (IP) سقف واسع لا قفل: شبكات الهاتف النقال في الجزائر تضع آلاف المشتركين خلف عناوين قليلة
 * (CGNAT)، فحدّ ضيّق على العنوان يحجب تلاميذ حقيقيين وقت الذروة (بعد منشور مثلًا). القفل الحقيقي على
 * الهوية: البريد أو رقم الهاتف في الدخول، ورقم الهاتف في التسجيل والاسترجاع، ورمز SMS يثبت ملكية الرقم.
 */
export const RATE_LIMITS = {
  loginIp: { limit: 1000, windowSeconds: 15 * 60 },
  loginEmail: { limit: 8, windowSeconds: 15 * 60 },
  /** الدخول برقم الهاتف: نفس قفل البريد، مفتاحه الرقم بعد توحيده */
  loginPhone: { limit: 8, windowSeconds: 15 * 60 },
  registerIp: { limit: 1000, windowSeconds: 60 * 60 },
  /** محاولات تسجيل بالرقم نفسه: تكرار يدلّ على عبث لا على تلميذ */
  registerPhone: { limit: 5, windowSeconds: 60 * 60 },
  activateCode: { limit: 10, windowSeconds: 10 * 60 },
  scan: { limit: 240, windowSeconds: 60 },
  /** لكل بريد أو رقم (هوية واحدة) */
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
  /** لكل عنوان: سقف واسع للسبب أعلاه */
  passwordResetIp: { limit: 100, windowSeconds: 60 * 60 },
  phoneResetVerifyIp: { limit: 300, windowSeconds: 10 * 60 },
  aiRequest: { limit: 60, windowSeconds: 60 * 60 }
} as const

export function rateKey(scope: string, subject: string): string {
  return `${scope}:${subject.slice(0, 120)}`
}

/** يزيد العدّاد ويرمي RATE_LIMITED عند تجاوز الحد. */
export async function checkRateLimit(db: Db, rule: RateLimitRule, now: Date = new Date()): Promise<{ remaining: number }> {
  const key = rateKey(rule.scope, rule.subject)
  const windowStart = new Date(Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000)
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1, updatedAt: now })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        // نافذة جديدة ⇒ إعادة العدّ، وإلا زيادة
        count: sql`case when ${rateLimits.windowStart} = ${windowStart} then ${rateLimits.count} + 1 else 1 end`,
        windowStart,
        updatedAt: now
      }
    })
    .returning({ count: rateLimits.count })
  const count = row?.count ?? 1
  if (count > rule.limit) throw new AppError('RATE_LIMITED', { scope: rule.scope })
  return { remaining: rule.limit - count }
}

/**
 * حدود التسجيل (الموقع وتطبيق آيفون معًا): سقف واسع للعنوان ثم قفل ضيّق على رقم الهاتف.
 * `phoneKey` بصمة الرقم بعد توحيده (sha256)، لا الرقم نفسه.
 */
export async function checkRegisterLimits(db: Db, input: { ip: string | null; phoneKey: string }, now: Date = new Date()): Promise<void> {
  await checkRateLimit(db, { scope: 'register-ip', subject: input.ip ?? 'unknown', ...RATE_LIMITS.registerIp }, now)
  await checkRateLimit(db, { scope: 'register-phone', subject: input.phoneKey, ...RATE_LIMITS.registerPhone }, now)
}

/** قراءة فقط: هل بلغ العدّاد حدّه في النافذة الحالية؟ (لا يزيده — للأقفال التي تُعدّ الإخفاقات وحدها) */
export async function isRateLimited(db: Db, rule: RateLimitRule, now: Date = new Date()): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / (rule.windowSeconds * 1000)) * rule.windowSeconds * 1000)
  const [row] = await db.select({ count: rateLimits.count, windowStart: rateLimits.windowStart }).from(rateLimits).where(eq(rateLimits.key, rateKey(rule.scope, rule.subject))).limit(1)
  return Boolean(row && row.windowStart.getTime() === windowStart.getTime() && row.count >= rule.limit)
}

/** يُستدعى بعد نجاح العملية لإعادة العدّاد (مثلاً بعد دخول ناجح) */
export async function resetRateLimit(db: Db, scope: string, subject: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, rateKey(scope, subject)))
}

/** تنظيف النوافذ المنتهية (يُستدعى من مهمة الصيانة) */
export async function purgeRateLimits(db: Db, olderThan: Date): Promise<number> {
  const rows = await db.delete(rateLimits).where(and(lt(rateLimits.windowStart, olderThan))).returning({ key: rateLimits.key })
  return rows.length
}
