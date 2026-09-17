import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { notifications } from '@/server/db/schema'
import type { NotificationType } from '@/server/db/schema/enums'

export interface NotifyInput {
  userId: string
  workspaceId?: string | null
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  meta?: Record<string, unknown>
}

export async function notify(db: Db, input: NotifyInput): Promise<void> {
  await db.insert(notifications).values({
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
    meta: input.meta ?? {}
  })
}

export async function notifyMany(db: Db, inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return
  await db.insert(notifications).values(
    inputs.map((i) => ({
      userId: i.userId,
      workspaceId: i.workspaceId ?? null,
      type: i.type,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null,
      meta: i.meta ?? {}
    }))
  )
}

export async function listNotifications(db: Db, userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function unreadCount(db: Db, userId: string): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
  return rows[0]?.n ?? 0
}

export async function markAllRead(db: Db, userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}

export async function markRead(db: Db, userId: string, id: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.id, id)))
}
