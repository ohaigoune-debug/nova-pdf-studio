import { and, count, desc, eq, gt, gte, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { activityLogs, appSettings, auditLogs, content, files, jobs, sessions, users } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'

export async function storageStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const [f] = await db
    .select({ n: count(), bytes: sql<number>`coalesce(sum(${files.sizeBytes}),0)::bigint` })
    .from(files)
    .where(isNull(files.deletedAt))
  const byBucket = await db
    .select({ bucket: files.bucket, n: count(), bytes: sql<number>`coalesce(sum(${files.sizeBytes}),0)::bigint` })
    .from(files)
    .where(isNull(files.deletedAt))
    .groupBy(files.bucket)
  const [c] = await db.select({ n: count() }).from(content).where(isNull(content.deletedAt))
  return { files: f?.n ?? 0, bytes: Number(f?.bytes ?? 0), byBucket: byBucket.map((b) => ({ ...b, bytes: Number(b.bytes) })), content: c?.n ?? 0 }
}

export async function securityStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const dayAgo = new Date(Date.now() - 24 * 3600_000)
  const [activeSessions] = await db.select({ n: count() }).from(sessions).where(and(isNull(sessions.revokedAt), gt(sessions.expiresAt, new Date())))
  const [logins24h] = await db.select({ n: count() }).from(activityLogs).where(and(eq(activityLogs.event, 'auth.login'), gte(activityLogs.createdAt, dayAgo)))
  const [disabled] = await db.select({ n: count() }).from(users).where(eq(users.status, 'DISABLED'))
  const [admins] = await db.select({ n: count() }).from(users).where(and(eq(users.role, 'SUPER_ADMIN'), eq(users.status, 'ACTIVE')))
  const sensitive = await db
    .select({ id: auditLogs.id, action: auditLogs.action, entityType: auditLogs.entityType, createdAt: auditLogs.createdAt })
    .from(auditLogs)
    .where(sql`${auditLogs.action} in ('user.status','teacher.create','enrollment.reactivate','attendance.excuse','attendance.manual')`)
    .orderBy(desc(auditLogs.createdAt))
    .limit(20)
  return { activeSessions: activeSessions?.n ?? 0, logins24h: logins24h?.n ?? 0, disabledUsers: disabled?.n ?? 0, admins: admins?.n ?? 0, sensitive }
}

export async function aiStats(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  const byStatus = await db.select({ status: jobs.status, n: count() }).from(jobs).groupBy(jobs.status)
  const [settings] = await db.select().from(appSettings).where(eq(appSettings.key, 'ai')).limit(1)
  return {
    provider: process.env.AI_PROVIDER ?? 'mock',
    configured: Boolean(process.env.AI_API_KEY),
    jobs: Object.fromEntries(byStatus.map((b) => [b.status, b.n])) as Record<string, number>,
    settings: (settings?.value as Record<string, unknown> | undefined) ?? null
  }
}

export async function listSettings(db: Db, actor: Actor) {
  assertRole(actor, 'SUPER_ADMIN')
  return db.select().from(appSettings).orderBy(appSettings.key)
}
