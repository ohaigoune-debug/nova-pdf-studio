/**
 * سقف يومي عام لرسائل رمز التحقق (OTP): كل رسالة SuiviSMS تُدفع، والحدود لكل هاتف/IP
 * لا تمنع استنزاف الرصيد بأرقام كثيرة مختلفة. العدّاد صف واحد في rate_limits بنافذة يومية.
 *   SMS_DAILY_CAP في .env يغيّر السقف (الافتراضي 1000)؛ 0 يعطّله.
 * تنبيه المشرف (داخلي + تيليغرام) مرة واحدة عند 80% ومرة عند بلوغ السقف، في اليوم.
 */
import type { Db } from '@/server/db/connect'
import { AppError } from './errors'
import { checkRateLimit } from './rate-limit'

export const SMS_BUDGET_SCOPE = 'sms-daily'
const DAY_S = 24 * 60 * 60
const DEFAULT_CAP = 1000

export function smsDailyCap(): number {
  const raw = process.env.SMS_DAILY_CAP
  if (raw == null || raw.trim() === '') return DEFAULT_CAP
  const n = Number(raw)
  return Number.isInteger(n) && n >= 0 ? n : DEFAULT_CAP
}

export type SmsBudgetAlert = 'warn' | null

/**
 * يحجز رسالة من الميزانية اليومية داخل معاملة طلب الرمز (فيُلغى الحجز إن فشلت المعاملة).
 * يرمي RATE_LIMITED عند بلوغ السقف. يُرجع 'warn' للطلب الذي بلغ 80% بالضبط.
 */
export async function reserveSmsBudget(tx: Db, now: Date = new Date()): Promise<SmsBudgetAlert> {
  const cap = smsDailyCap()
  if (cap === 0) return null
  const { remaining } = await checkRateLimit(tx, { scope: SMS_BUDGET_SCOPE, subject: 'all', limit: cap, windowSeconds: DAY_S }, now)
  const used = cap - remaining
  return used === Math.ceil(cap * 0.8) ? 'warn' : null
}

export const isSmsBudgetExhausted = (e: unknown): boolean =>
  e instanceof AppError && e.code === 'RATE_LIMITED' && (e.details as { scope?: string } | undefined)?.scope === SMS_BUDGET_SCOPE

/** تنبيه المشرف، مرة واحدة لكل نوع في اليوم (مفتاح منفصل خارج المعاملة). لا يُفشل طلب الرمز أبداً. */
export async function alertSmsBudget(db: Db, kind: 'warn' | 'exhausted', now: Date = new Date()): Promise<void> {
  try {
    await checkRateLimit(db, { scope: `sms-daily-alert-${kind}`, subject: 'all', limit: 1, windowSeconds: DAY_S }, now)
  } catch {
    return // نُبّه اليوم من قبل
  }
  try {
    const cap = smsDailyCap()
    const { notifyAdmins } = await import('@/server/services/order-status.service')
    await notifyAdmins(db, kind === 'warn'
      ? { title: `⚠️ رسائل التحقق: استُهلك 80% من سقف اليوم (${cap})`, body: 'إن كان الإقبال حقيقياً فارفع SMS_DAILY_CAP في .env ثم أعد تشغيل التطبيق. إن لم يكن، فهذه محاولة استنزاف للرصيد.', link: '/admin' }
      : { title: `⛔ رسائل التحقق متوقفة: بلغ سقف اليوم (${cap})`, body: 'لن تُرسل رموز جديدة حتى منتصف الليل (UTC). ارفع SMS_DAILY_CAP في .env وأعد تشغيل التطبيق إن كان الإقبال حقيقياً.', link: '/admin' })
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') console.error('[sms-budget] alert failed:', e instanceof Error ? e.message : e)
  }
}
