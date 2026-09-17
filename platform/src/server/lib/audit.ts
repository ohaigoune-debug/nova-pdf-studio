import type { Db } from '@/server/db/client'
import { activityLogs, auditLogs } from '@/server/db/schema'

export interface AuditEntry {
  actorUserId: string | null
  workspaceId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ip?: string | null
}

export async function writeAudit(db: Db, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actorUserId: entry.actorUserId,
    workspaceId: entry.workspaceId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    oldValue: entry.oldValue ?? null,
    newValue: entry.newValue ?? null,
    ip: entry.ip ?? null
  })
}

export async function writeActivity(
  db: Db,
  entry: { userId: string | null; workspaceId?: string | null; event: string; meta?: Record<string, unknown> }
): Promise<void> {
  await db.insert(activityLogs).values({
    userId: entry.userId,
    workspaceId: entry.workspaceId ?? null,
    event: entry.event,
    meta: entry.meta ?? {}
  })
}
