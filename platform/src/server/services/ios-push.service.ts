/**
 * إشعارات المنصة على الآيفون (Build 15): ردّ الدعم على تذكرة، تغيّر حالة الطلب، الواجبات والتذكيرات…
 * الإشعار نفسه الذي يظهر في الموقع، يُرسل لأجهزة التلميذ عبر Apple — مع مرشّح: لا شيء عن السعر أو الدفع أو الشراء
 * يصل إلى التطبيق (قرار المالك)، ولا روابط لوحة الإدارة.
 */
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { iosPushDevices } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { apnsConfigFromEnv, sendApns, type ApnsEnvironment, type ApnsMessage } from '@/server/lib/apns'
import { AppError } from '@/server/lib/errors'

export function isApnsConfigured(): boolean {
  return apnsConfigFromEnv() !== null
}

const TOKEN_RE = /^[0-9a-f]{64,200}$/

export async function registerIosDevice(db: Db, actor: Actor, input: { token: string; environment: ApnsEnvironment }) {
  const token = input.token.trim().toLowerCase()
  if (!TOKEN_RE.test(token)) throw new AppError('VALIDATION', { field: 'token' })
  const environment: ApnsEnvironment = input.environment === 'sandbox' ? 'sandbox' : 'production'
  // الجهاز نفسه قد ينتقل إلى حساب آخر (خروج ثم دخول بحساب الأخ): الرمز يتبع آخر من سجّله
  await db
    .insert(iosPushDevices)
    .values({ userId: actor.userId, token, environment })
    .onConflictDoUpdate({ target: iosPushDevices.token, set: { userId: actor.userId, environment, failures: 0, updatedAt: new Date() } })
  return { registered: true }
}

export async function removeIosDevice(db: Db, actor: Actor, token: string) {
  const rows = await db
    .delete(iosPushDevices)
    .where(and(eq(iosPushDevices.userId, actor.userId), eq(iosPushDevices.token, token.trim().toLowerCase())))
    .returning({ id: iosPushDevices.id })
  return { removed: rows.length > 0 }
}

/** ما لا يُرسل إلى الآيفون أبدًا: كلام عن السعر أو الدفع أو الشراء، وروابط لوحات الإدارة والأساتذة */
// كلمات كاملة (مع و/ف/ب/ل وال في أولها): «دفعة البكالوريا» و«اشترك» لا تُحجب، و«بالدفع» و«اشترِ» تُحجب
const L = '\\u0621-\\u064A'
const BANNED = new RegExp(`(?<![${L}])[وفبل]?(?:ال)?(?:دج|دينار|دنانير|سعر|سعره|سعرها|أسعار|اسعار|دفع|ادفع|شراء|اشتر|اشتري|اشتروا|خصم|تخفيض|تخفيضات|تخفيضا)(?![${L}])|DZD|CCP|baridi|بريدي ?موب|عرض خاص`, 'iu')
const plain = (s: string) => s.replace(/[ً-ْـ]/g, '')
export function iosPushAllowed(n: { title: string; body?: string | null; link?: string | null }): boolean {
  if (BANNED.test(plain(`${n.title} ${n.body ?? ''}`))) return false
  const link = n.link ?? ''
  if (/^\/(admin|teacher|confirm|partner|pos)(\/|$)/.test(link)) return false
  return true
}

export interface IosPushSummary {
  sent: number
  removed: number
  failed: number
  skipped: number
}

/** يرسل لكل أجهزة التلميذ؛ الرمز غير الصالح يُحذف فورًا، والفشل المتكرر (≥ 5) يُحذف أيضًا */
export async function sendApnsToUser(db: Db, userId: string, message: ApnsMessage): Promise<IosPushSummary> {
  const out: IosPushSummary = { sent: 0, removed: 0, failed: 0, skipped: 0 }
  const cfg = apnsConfigFromEnv()
  if (!cfg) return out
  if (!iosPushAllowed({ title: message.title, body: message.body, link: message.link })) {
    out.skipped++
    return out
  }
  const devices = await db.select().from(iosPushDevices).where(eq(iosPushDevices.userId, userId))
  for (const d of devices) {
    let r: { status: number; invalid: boolean }
    try {
      r = await sendApns(d.token, d.environment === 'sandbox' ? 'sandbox' : 'production', message, cfg)
    } catch {
      r = { status: 0, invalid: false }
    }
    if (r.status === 200) {
      out.sent++
      await db.update(iosPushDevices).set({ lastUsedAt: new Date(), failures: 0 }).where(eq(iosPushDevices.id, d.id))
    } else if (r.invalid) {
      out.removed++
      await db.delete(iosPushDevices).where(eq(iosPushDevices.id, d.id))
    } else {
      out.failed++
      if (d.failures + 1 >= 5) await db.delete(iosPushDevices).where(eq(iosPushDevices.id, d.id))
      else await db.update(iosPushDevices).set({ failures: sql`${iosPushDevices.failures} + 1` }).where(eq(iosPushDevices.id, d.id))
    }
  }
  return out
}
