/**
 * تنظيم فيديوهات الأستاذ القائمة بالذكاء الاصطناعي: عناوين نظيفة، ملخّصات، ومحاور (وحدات).
 * الذكاء الاصطناعي يقترح فقط؛ لا يتغيّر درس إلا ما يختاره الأستاذ ويطبّقه بنفسه.
 * المدخل إلى النموذج: العناوين والملخّصات فقط — لا أسماء طلبة ولا بيانات شخصية.
 */
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { aiProviderInfo, getAiProvider } from '@/server/ai/provider'
import type { OrganizedLesson } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { content, jobs, levels, streams } from '@/server/db/schema'
import { enqueueJob, latestJobOfType, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid, isPermanentJobError } from '@/server/lib/errors'
import { workspaceSubject } from './ai.service'
import { updateContent } from './content.service'
import { notify } from './notifications.service'

/** فيديوهات في المهمة الواحدة (كل دفعة استدعاء واحد للنموذج) */
export const MAX_LESSONS_PER_JOB = 200
const CHUNK = 40

export interface OrganizeProposal {
  contentId: string
  current: { title: string; summary: string | null; topic: string | null }
  proposed: { title: string; summary: string | null; topic: string | null }
  /** يختلف عن الحالي في حقل واحد على الأقل */
  changed: boolean
}

export interface OrganizeResult {
  proposals: OrganizeProposal[]
  provider: string
  chunks: number
  /** ما طُبّق منها (بعد اختيار الأستاذ) */
  appliedIds?: string[]
  appliedAt?: string
}

async function videoLessons(db: Db, workspaceId: string, filter: { levelId?: string | null; streamId?: string | null }) {
  return db
    .select({ id: content.id, title: content.title, summary: content.summary, topic: content.topic, levelId: content.levelId, streamId: content.streamId })
    .from(content)
    .where(
      and(
        eq(content.workspaceId, workspaceId),
        eq(content.type, 'VIDEO'),
        isNull(content.deletedAt),
        filter.levelId ? eq(content.levelId, filter.levelId) : undefined,
        filter.streamId ? eq(content.streamId, filter.streamId) : undefined
      )
    )
    .orderBy(asc(content.createdAt))
    .limit(MAX_LESSONS_PER_JOB)
}

export async function requestContentOrganize(db: Db, actor: Actor, input: { levelId?: string | null; streamId?: string | null } = {}): Promise<{ jobId: string; reused: boolean; lessons: number }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  if (!aiProviderInfo().configured) throw new AppError('AI_UNAVAILABLE')
  if (input.levelId) assertUuid(input.levelId, 'VALIDATION')
  if (input.streamId) assertUuid(input.streamId, 'VALIDATION')
  const pending = await pendingJobOfType(db, 'AI_ORGANIZE_CONTENT', actor.workspaceId)
  if (pending) return { jobId: pending.id, reused: true, lessons: pending.totalItems ?? 0 }
  const lessons = await videoLessons(db, actor.workspaceId, input)
  if (lessons.length === 0) throw new AppError('NO_VIDEO_LESSONS')
  const job = await enqueueJob(db, {
    type: 'AI_ORGANIZE_CONTENT',
    payload: { workspaceId: actor.workspaceId, userId: actor.userId, levelId: input.levelId ?? null, streamId: input.streamId ?? null },
    workspaceId: actor.workspaceId,
    maxAttempts: 2
  })
  await updateJobProgress(db, job.id, { totalItems: lessons.length })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'content.organize.request', entityType: 'job', entityId: job.id, newValue: { lessons: lessons.length, levelId: input.levelId ?? null } })
  return { jobId: job.id, reused: false, lessons: lessons.length }
}

const same = (a: string | null | undefined, b: string | null | undefined) => (a ?? '').trim() === (b ?? '').trim()

export async function runOrganizeContentJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const workspaceId = String(job.payload.workspaceId ?? '')
  const userId = String(job.payload.userId ?? '')
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const levelId = typeof job.payload.levelId === 'string' ? job.payload.levelId : null
  const streamId = typeof job.payload.streamId === 'string' ? job.payload.streamId : null
  const lessons = await videoLessons(db, workspaceId, { levelId, streamId })
  const [level] = levelId ? await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, levelId)).limit(1) : []
  const [stream] = streamId ? await db.select({ n: streams.nameAr }).from(streams).where(eq(streams.id, streamId)).limit(1) : []
  const provider = getAiProvider()
  if (!provider.organizeLessons) throw new AppError('AI_UNAVAILABLE')
  const subject = await workspaceSubject(db, workspaceId)
  const lastAttempt = job.attempts >= job.maxAttempts

  const organized: OrganizedLesson[] = []
  const chunks = Math.ceil(lessons.length / CHUNK)
  for (let i = 0; i < lessons.length; i += CHUNK) {
    const slice = lessons.slice(i, i + CHUNK)
    try {
      // معرّف الدرس مفتاحاً (لا معرّف يوتيوب): درسان قد يشيران إلى الفيديو نفسه
      const out = await provider.organizeLessons({ subject, playlistTitle: null, levelName: level?.n ?? null, streamName: stream?.n ?? null, items: slice.map((l) => ({ youtubeId: l.id, title: l.title, description: [l.topic, l.summary].filter(Boolean).join(' — ') || null })) })
      organized.push(...out.lessons)
    } catch (e) {
      if (isPermanentJobError(e) || lastAttempt) await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'لم يُنظَّم الفيديوهات', body: aiFailureReason(e), link: '/teacher/content/organize' })
      throw e
    }
    await updateJobProgress(db, job.id, { totalItems: lessons.length, processedItems: Math.min(lessons.length, i + CHUNK), progress: { chunk: i / CHUNK + 1, chunks } })
  }
  const byId = new Map(organized.map((o) => [o.youtubeId, o]))
  const proposals: OrganizeProposal[] = lessons.map((l) => {
    const o = byId.get(l.id)
    const proposed = { title: (o?.title || l.title).trim().slice(0, 200), summary: o?.summary?.trim() || l.summary || null, topic: o?.topic?.trim() || l.topic || null }
    return { contentId: l.id, current: { title: l.title, summary: l.summary, topic: l.topic }, proposed, changed: !same(proposed.title, l.title) || !same(proposed.summary, l.summary) || !same(proposed.topic, l.topic) }
  })
  const changed = proposals.filter((p) => p.changed).length
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'اقتراحات تنظيم الفيديوهات جاهزة', body: `${changed} من ${proposals.length} درساً فيها تحسين مقترح — راجعها وطبّق ما تريد.`, link: '/teacher/content/organize' })
  const result: OrganizeResult = { proposals, provider: provider.name, chunks }
  return result as unknown as Record<string, unknown>
}

export interface OrganizeStatus {
  job: (Pick<JobRow, 'id' | 'status' | 'error' | 'createdAt' | 'finishedAt' | 'totalItems' | 'processedItems'> & { result: OrganizeResult | null }) | null
  videos: number
  aiConfigured: boolean
}

export async function contentOrganizeStatus(db: Db, actor: Actor): Promise<OrganizeStatus> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  const [job, all] = await Promise.all([latestJobOfType(db, 'AI_ORGANIZE_CONTENT', actor.workspaceId), videoLessons(db, actor.workspaceId, {})])
  return {
    job: job ? { id: job.id, status: job.status, error: job.error, createdAt: job.createdAt, finishedAt: job.finishedAt, totalItems: job.totalItems, processedItems: job.processedItems, result: (job.result as OrganizeResult | null) ?? null } : null,
    videos: all.length,
    aiConfigured: aiProviderInfo().configured
  }
}

/** يطبّق الاقتراحات المختارة على دروس الأستاذ نفسه فقط، ويسجّل ما طُبّق في المهمة */
export async function applyOrganizeProposals(db: Db, actor: Actor, jobId: string, contentIds: string[]): Promise<{ applied: number }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  assertUuid(jobId, 'NOT_FOUND')
  const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.type, 'AI_ORGANIZE_CONTENT'), eq(jobs.workspaceId, actor.workspaceId))).limit(1)
  if (!job || job.status !== 'COMPLETED') throw new AppError('NOT_FOUND')
  const result = job.result as OrganizeResult | null
  const wanted = new Set(contentIds)
  const picks = (result?.proposals ?? []).filter((p) => wanted.has(p.contentId) && p.changed)
  if (picks.length === 0) return { applied: 0 }
  // ما حُذف بعد التوليد لا يُلمس
  const alive = new Set((await db.select({ id: content.id }).from(content).where(and(inArray(content.id, picks.map((p) => p.contentId)), isNull(content.deletedAt)))).map((r) => r.id))
  let applied = 0
  for (const p of picks) {
    if (!alive.has(p.contentId)) continue
    await updateContent(db, actor, p.contentId, { title: p.proposed.title, summary: p.proposed.summary, topic: p.proposed.topic })
    applied++
  }
  const appliedIds = [...new Set([...(result?.appliedIds ?? []), ...picks.filter((p) => alive.has(p.contentId)).map((p) => p.contentId)])]
  await db.update(jobs).set({ result: { ...result, appliedIds, appliedAt: new Date().toISOString() } }).where(eq(jobs.id, job.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'content.organize.apply', entityType: 'job', entityId: job.id, newValue: { applied } })
  return { applied }
}
