import { desc, eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { studentTimeline } from '@/server/db/schema'
import type { TimelineType } from '@/server/db/schema/enums'

export interface TimelineInput {
  studentId: string
  workspaceId?: string | null
  type: TimelineType
  title: string
  meta?: Record<string, unknown>
  occurredAt?: Date
}

export async function addTimeline(db: Db, input: TimelineInput): Promise<void> {
  await db.insert(studentTimeline).values({
    studentId: input.studentId,
    workspaceId: input.workspaceId ?? null,
    type: input.type,
    title: input.title,
    meta: input.meta ?? {},
    occurredAt: input.occurredAt ?? new Date()
  })
}

export async function addTimelineMany(db: Db, inputs: TimelineInput[]): Promise<void> {
  if (inputs.length === 0) return
  await db.insert(studentTimeline).values(
    inputs.map((i) => ({
      studentId: i.studentId,
      workspaceId: i.workspaceId ?? null,
      type: i.type,
      title: i.title,
      meta: i.meta ?? {},
      occurredAt: i.occurredAt ?? new Date()
    }))
  )
}

export async function listTimeline(db: Db, studentId: string, limit = 50) {
  return db
    .select()
    .from(studentTimeline)
    .where(eq(studentTimeline.studentId, studentId))
    .orderBy(desc(studentTimeline.occurredAt))
    .limit(limit)
}
