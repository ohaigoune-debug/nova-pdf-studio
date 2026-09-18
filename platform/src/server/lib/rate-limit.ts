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

export const RATE_LIMITS = {
  loginIp: { limit: 20, windowSeconds: 15 * 60 },
  loginEmail: { limit: 8, windowSeconds: 15 * 60 },
  registerIp: { limit: 10, windowSeconds: 60 * 60 },
  activateCode: { limit: 10, windowSeconds: 10 * 60 },
  scan: { limit: 240, windowSeconds: 60 },
  passwordReset: { limit: 5, windowSeconds: 60 * 60 },
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

/** يُستدعى بعد نجاح العملية لإعادة العدّاد (مثلاً بعد دخول ناجح) */
export async function resetRateLimit(db: Db, scope: string, subject: string): Promise<void> {
  await db.delete(rateLimits).where(eq(rateLimits.key, rateKey(scope, subject)))
}

/** تنظيف النوافذ المنتهية (يُستدعى من مهمة الصيانة) */
export async function purgeRateLimits(db: Db, olderThan: Date): Promise<number> {
  const rows = await db.delete(rateLimits).where(and(lt(rateLimits.windowStart, olderThan))).returning({ key: rateLimits.key })
  return rows.length
}
