/**
 * حفظ استهلاك الذكاء الاصطناعي في `ai_usage_logs` وإحصاؤه للوحة الإدارة.
 * المغسلة تُركَّب مرة عند أول قاعدة بيانات؛ الإدراج غير متزامن ولا يوقف النداء.
 */
import { and, desc, gte, sql } from 'drizzle-orm'
import { setAiUsageSink, type AiUsageEvent } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { aiUsageLogs } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const asUuid = (v: string | null | undefined): string | null => (v && UUID_RE.test(v) ? v : null)

export async function saveAiUsage(db: Db, e: AiUsageEvent): Promise<void> {
  await db.insert(aiUsageLogs).values({
    provider: e.provider.slice(0, 40),
    model: e.model.slice(0, 80),
    task: e.task.slice(0, 60),
    workspaceId: asUuid(e.workspaceId),
    userId: asUuid(e.userId),
    entityType: e.entityType?.slice(0, 40) ?? null,
    entityId: asUuid(e.entityId),
    inputTokens: e.inputTokens,
    outputTokens: e.outputTokens,
    costUsd: String(e.costUsd),
    durationMs: e.durationMs,
    ok: e.ok,
    error: e.error?.slice(0, 500) ?? null
  })
}

let installedFor: WeakRef<object> | null = null

/** يربط المغسلة بقاعدة البيانات (idempotent لنفس القاعدة) */
export function installAiUsageSink(db: Db): void {
  if (installedFor?.deref() === db) return
  installedFor = new WeakRef(db as unknown as object)
  setAiUsageSink((e) => {
    void saveAiUsage(db, e).catch((err) => console.error('[ai] usage log failed', err))
  })
}

export interface AiUsageSummary {
  calls: number
  failed: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  byTask: { task: string; calls: number; costUsd: number }[]
  byDay: { day: string; calls: number; costUsd: number }[]
}

/** ملخّص آخر N يوماً (للمشرف) */
export async function aiUsageSummary(db: Db, actor: Actor, days = 30): Promise<AiUsageSummary> {
  assertRole(actor, 'SUPER_ADMIN')
  const since = new Date(Date.now() - days * 86_400_000)
  const where = and(gte(aiUsageLogs.createdAt, since))
  const [[tot], byTask, byDay] = await Promise.all([
    db.select({ calls: sql<number>`count(*)::int`, failed: sql<number>`count(*) filter (where not ${aiUsageLogs.ok})::int`, inputTokens: sql<number>`coalesce(sum(${aiUsageLogs.inputTokens}),0)::int`, outputTokens: sql<number>`coalesce(sum(${aiUsageLogs.outputTokens}),0)::int`, costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}),0)::float` }).from(aiUsageLogs).where(where),
    db.select({ task: aiUsageLogs.task, calls: sql<number>`count(*)::int`, costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}),0)::float` }).from(aiUsageLogs).where(where).groupBy(aiUsageLogs.task).orderBy(desc(sql`count(*)`)),
    db.select({ day: sql<string>`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`, calls: sql<number>`count(*)::int`, costUsd: sql<number>`coalesce(sum(${aiUsageLogs.costUsd}),0)::float` }).from(aiUsageLogs).where(where).groupBy(sql`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`).orderBy(desc(sql`to_char(${aiUsageLogs.createdAt}, 'YYYY-MM-DD')`)).limit(31)
  ])
  return { calls: tot?.calls ?? 0, failed: tot?.failed ?? 0, inputTokens: tot?.inputTokens ?? 0, outputTokens: tot?.outputTokens ?? 0, costUsd: Number(tot?.costUsd ?? 0), byTask: byTask.map((x) => ({ ...x, costUsd: Number(x.costUsd) })), byDay: byDay.map((x) => ({ ...x, costUsd: Number(x.costUsd) })) }
}
