import { and, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { notifications, pushSubscriptions } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { sendWebPush, vapidConfigFromEnv, type PushMessage } from '@/server/lib/web-push'

/**
 * اشتراكات إشعارات الدفع وإرسالها. الإرسال يتم داخل مهمة PUSH_DISPATCH فقط (لا HTTP داخل المعاملات).
 */
export function isPushConfigured(): boolean {
  return vapidConfigFromEnv() !== null
}

export function pushPublicKey(): string | null {
  return vapidConfigFromEnv()?.publicKey ?? null
}

export interface SubscriptionInput {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string | null
}

export async function savePushSubscription(db: Db, actor: Actor, input: SubscriptionInput) {
  let origin: string
  try {
    const u = new URL(input.endpoint)
    if (u.protocol !== 'https:') throw new Error('insecure')
    origin = u.origin
  } catch {
    throw new AppError('VALIDATION', { field: 'endpoint' })
  }
  if (!input.keys?.p256dh || !input.keys?.auth) throw new AppError('VALIDATION', { field: 'keys' })
  const [row] = await db
    .insert(pushSubscriptions)
    .values({ userId: actor.userId, endpoint: input.endpoint, p256dh: input.keys.p256dh, auth: input.keys.auth, userAgent: input.userAgent?.slice(0, 300) ?? null })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: actor.userId, p256dh: input.keys.p256dh, auth: input.keys.auth, failures: 0, updatedAt: new Date() } })
    .returning({ id: pushSubscriptions.id })
  return { id: row?.id ?? null, origin }
}

export async function removePushSubscription(db: Db, actor: Actor, endpoint: string): Promise<boolean> {
  const rows = await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, actor.userId), eq(pushSubscriptions.endpoint, endpoint))).returning({ id: pushSubscriptions.id })
  return rows.length > 0
}

export async function listPushSubscriptions(db: Db, actor: Actor) {
  return db
    .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint, userAgent: pushSubscriptions.userAgent, createdAt: pushSubscriptions.createdAt, lastUsedAt: pushSubscriptions.lastUsedAt })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, actor.userId))
}

export interface PushSummary {
  sent: number
  removed: number
  failed: number
}

/** يرسل لكل أجهزة المستخدم؛ الاشتراكات الملغاة (404/410) تُحذف، والفشل المتكرر (≥ 5) يُحذف أيضاً */
export async function sendPushToUser(db: Db, userId: string, message: PushMessage): Promise<PushSummary> {
  const cfg = vapidConfigFromEnv()
  const out: PushSummary = { sent: 0, removed: 0, failed: 0 }
  if (!cfg) return out
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId))
  for (const s of subs) {
    let status: number
    try {
      status = await sendWebPush({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, message, cfg)
    } catch {
      status = 0
    }
    if (status === 200 || status === 201 || status === 202) {
      out.sent++
      await db.update(pushSubscriptions).set({ lastUsedAt: new Date(), failures: 0 }).where(eq(pushSubscriptions.id, s.id))
    } else if (status === 404 || status === 410) {
      out.removed++
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
    } else {
      out.failed++
      if (s.failures + 1 >= 5) await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id))
      else await db.update(pushSubscriptions).set({ failures: sql`${pushSubscriptions.failures} + 1` }).where(eq(pushSubscriptions.id, s.id))
    }
  }
  return out
}

/** معالج مهمة PUSH_DISPATCH: يرسل الإشعارات المذكورة في الحمولة لأصحابها */
export async function runPushDispatchJob(db: Db, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  const ids = Array.isArray(payload.notificationIds) ? payload.notificationIds.filter((x): x is string => typeof x === 'string').slice(0, 500) : []
  if (ids.length === 0 || !isPushConfigured()) return { sent: 0, skipped: true }
  const rows = await db.select().from(notifications).where(inArray(notifications.id, ids))
  const total: PushSummary = { sent: 0, removed: 0, failed: 0 }
  for (const n of rows) {
    const r = await sendPushToUser(db, n.userId, { title: n.title, body: n.body, url: n.link ?? '/', tag: n.type })
    total.sent += r.sent
    total.removed += r.removed
    total.failed += r.failed
  }
  return { ...total, notifications: rows.length }
}
