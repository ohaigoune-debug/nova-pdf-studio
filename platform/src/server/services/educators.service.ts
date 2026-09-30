/**
 * دليل الأساتذة (قنوات يوتيوب): ترشيحات من دليل الأستاذ تُحلّ إلى قنوات حقيقية بـ YouTube API،
 * يعتمدها المشرف بنفسه (لا اعتماد آلي)، ثم تُزامَن فيديوهات القناة إلى المكتبة الموحّدة
 * مع تنظيف العناوين وتصنيف الصفّ بالذكاء الاصطناعي. الفيديو يبقى على يوتيوب؛ المصدر مذكور دائماً.
 */
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { getAiProvider } from '@/server/ai/provider'
import type { OrganizedLesson } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { contentSources, educationStages, educatorSubjects, educators, levels, resources, subjects, type ChannelCandidate, type EducatorRow } from '@/server/db/schema'
import { enqueueJob, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid, isPermanentJobError, PermanentJobError } from '@/server/lib/errors'
import { fetchPlaylistItems, getChannels, searchChannels, youtubeThumbnail, YouTubeQuotaError, type ChannelInfo } from '@/server/lib/youtube'
import { notify } from './notifications.service'
import { upsertResource } from './resources.service'

/** فيديوهات تُجلب من القناة في المزامنة الواحدة (الأحدث أولاً كما تعطيها قائمة الرفع) */
export const MAX_VIDEOS_PER_CHANNEL = 300
const CHUNK = 40

export interface EducatorView extends EducatorRow {
  subjects: { id: string; code: string; nameAr: string; rank: number }[]
  videos: number
}

const youtubeKey = () => process.env.YOUTUBE_API_KEY || process.env.GOOGLE_API_KEY || ''

export async function listEducators(db: Db, actor: Actor): Promise<{ educators: EducatorView[]; hasApiKey: boolean; pendingResolve: boolean }> {
  assertRole(actor, 'SUPER_ADMIN')
  const rows = await db.select().from(educators).orderBy(asc(educators.createdAt))
  const links = await db
    .select({ educatorId: educatorSubjects.educatorId, id: subjects.id, code: subjects.code, nameAr: subjects.nameAr, rank: educatorSubjects.rank })
    .from(educatorSubjects)
    .innerJoin(subjects, eq(subjects.id, educatorSubjects.subjectId))
    .orderBy(asc(educatorSubjects.rank))
  const vids = await db.select({ educatorId: resources.educatorId, n: count() }).from(resources).where(and(isNull(resources.deletedAt), sql`${resources.educatorId} is not null`)).groupBy(resources.educatorId)
  const nVideos = new Map(vids.map((v) => [v.educatorId, v.n]))
  const bySubject = new Map<string, EducatorView['subjects']>()
  for (const l of links) bySubject.set(l.educatorId, [...(bySubject.get(l.educatorId) ?? []), { id: l.id, code: l.code, nameAr: l.nameAr, rank: l.rank }])
  return {
    educators: rows.map((r) => ({ ...r, subjects: bySubject.get(r.id) ?? [], videos: nVideos.get(r.id) ?? 0 })),
    hasApiKey: Boolean(youtubeKey()),
    pendingResolve: Boolean(await pendingJobOfType(db, 'YT_RESOLVE_EDUCATORS', null))
  }
}

/* ------------------------------ الحلّ إلى قنوات ------------------------------ */

export async function requestEducatorResolve(db: Db, actor: Actor): Promise<{ jobId: string; reused: boolean; toResolve: number }> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!youtubeKey()) throw new AppError('YOUTUBE_KEY_MISSING')
  const pending = await pendingJobOfType(db, 'YT_RESOLVE_EDUCATORS', null)
  const [c] = await db.select({ n: count() }).from(educators).where(and(eq(educators.status, 'SUGGESTED'), isNull(educators.resolvedAt)))
  const n = c?.n ?? 0
  if (pending) return { jobId: pending.id, reused: true, toResolve: n }
  const job = await enqueueJob(db, { type: 'YT_RESOLVE_EDUCATORS', payload: { userId: actor.userId }, workspaceId: null, maxAttempts: 1 })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'educators.resolve', entityType: 'job', entityId: job.id, newValue: { toResolve: n } })
  return { jobId: job.id, reused: false, toResolve: n }
}

const asCandidate = (c: ChannelInfo): ChannelCandidate => ({ channelId: c.channelId, title: c.title, description: c.description.slice(0, 300), thumbnail: c.thumbnail, handle: c.handle, subscriberCount: c.subscriberCount, videoCount: c.videoCount })

/** بحث عن قناة لكل مرشّح لم يُحلّ بعد؛ يتوقّف عند نفاد الحصة ويكمل غداً (ما حُلّ لا يُعاد) */
export async function runResolveEducatorsJob(db: Db, job: JobRow, opts: { fetch?: typeof fetch } = {}): Promise<Record<string, unknown>> {
  const apiKey = youtubeKey()
  if (!apiKey) throw new PermanentJobError('YOUTUBE_KEY_MISSING')
  const userId = typeof job.payload.userId === 'string' ? job.payload.userId : null
  const todo = await db.select().from(educators).where(and(eq(educators.status, 'SUGGESTED'), isNull(educators.resolvedAt))).orderBy(asc(educators.createdAt))
  const firstSubject = new Map<string, string>()
  for (const l of await db.select({ educatorId: educatorSubjects.educatorId, nameAr: subjects.nameAr, rank: educatorSubjects.rank }).from(educatorSubjects).innerJoin(subjects, eq(subjects.id, educatorSubjects.subjectId)).orderBy(asc(educatorSubjects.rank))) {
    if (!firstSubject.has(l.educatorId)) firstSubject.set(l.educatorId, l.nameAr)
  }
  let resolved = 0
  let quota = false
  let failed = 0
  await updateJobProgress(db, job.id, { totalItems: todo.length, processedItems: 0 })
  for (const e of todo) {
    try {
      // الاسم مع المادة يميّز الأستاذ عن مشابهي الاسم؛ لا يُصدَّق إلا ما يختاره المشرف
      const found = await searchChannels(`${e.name} ${firstSubject.get(e.id) ?? ''}`.trim(), { apiKey, fetchImpl: opts.fetch, max: 5 })
      await db.update(educators).set({ candidates: found.map(asCandidate), resolvedAt: new Date(), lastError: null, updatedAt: new Date() }).where(eq(educators.id, e.id))
      resolved++
    } catch (err) {
      if (err instanceof YouTubeQuotaError) {
        quota = true
        break
      }
      failed++
      await db.update(educators).set({ lastError: err instanceof Error ? err.message : String(err), updatedAt: new Date() }).where(eq(educators.id, e.id))
    }
    await updateJobProgress(db, job.id, { processedItems: resolved + failed, failedItems: failed })
  }
  if (userId) {
    await notify(db, {
      userId,
      workspaceId: null,
      type: 'SYSTEM',
      title: quota ? 'توقّف البحث عن القنوات: نفدت حصة يوتيوب اليومية' : 'انتهى البحث عن قنوات الأساتذة',
      body: `${resolved} أستاذاً وُجدت له قنوات مرشّحة${failed ? `، ${failed} تعذّر البحث عنهم` : ''}${quota ? `، ${todo.length - resolved - failed} ينتظرون الغد` : ''}. اختر القناة الصحيحة لكل أستاذ واعتمده.`,
      link: '/admin/educators'
    })
  }
  return { resolved, failed, quota, remaining: todo.length - resolved - failed }
}

/* ------------------------------ الاعتماد والمزامنة ------------------------------ */

export async function approveEducator(db: Db, actor: Actor, educatorId: string, channelId: string): Promise<{ jobId: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(educatorId, 'NOT_FOUND')
  const [e] = await db.select().from(educators).where(eq(educators.id, educatorId)).limit(1)
  if (!e) throw new AppError('NOT_FOUND')
  const c = e.candidates.find((x) => x.channelId === channelId)
  if (!c) throw new AppError('VALIDATION', { field: 'channelId' })
  const [taken] = await db.select({ id: educators.id, name: educators.name }).from(educators).where(and(eq(educators.youtubeChannelId, channelId), sql`${educators.id} <> ${educatorId}`)).limit(1)
  if (taken) throw new AppError('CHANNEL_ALREADY_LINKED', { name: taken.name })
  await db
    .update(educators)
    .set({ status: 'APPROVED', youtubeChannelId: c.channelId, channelTitle: c.title, channelHandle: c.handle ?? null, channelThumbnail: c.thumbnail, subscriberCount: c.subscriberCount ?? null, videoCount: c.videoCount ?? null, lastError: null, updatedAt: new Date() })
    .where(eq(educators.id, educatorId))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'educators.approve', entityType: 'educator', entityId: educatorId, oldValue: { status: e.status }, newValue: { status: 'APPROVED', channelId, channelTitle: c.title } })
  return requestChannelSync(db, actor, educatorId)
}

export async function rejectEducator(db: Db, actor: Actor, educatorId: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(educatorId, 'NOT_FOUND')
  const [e] = await db.select({ status: educators.status }).from(educators).where(eq(educators.id, educatorId)).limit(1)
  if (!e) throw new AppError('NOT_FOUND')
  await db.update(educators).set({ status: 'REJECTED', updatedAt: new Date() }).where(eq(educators.id, educatorId))
  // فيديوهاته تُؤرشف لا تُحذف: يمكن الرجوع
  await db.update(resources).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(and(eq(resources.educatorId, educatorId), eq(resources.status, 'PUBLISHED')))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'educators.reject', entityType: 'educator', entityId: educatorId, oldValue: { status: e.status }, newValue: { status: 'REJECTED' } })
}

/** إرجاع مرفوض أو معتمد إلى الترشيح (يفكّ القناة ويؤرشف فيديوهاته) */
export async function resetEducator(db: Db, actor: Actor, educatorId: string): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(educatorId, 'NOT_FOUND')
  await db.update(educators).set({ status: 'SUGGESTED', youtubeChannelId: null, channelTitle: null, channelHandle: null, channelThumbnail: null, uploadsPlaylistId: null, syncedAt: null, updatedAt: new Date() }).where(eq(educators.id, educatorId))
  await db.update(resources).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(and(eq(resources.educatorId, educatorId), eq(resources.status, 'PUBLISHED')))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'educators.reset', entityType: 'educator', entityId: educatorId })
}

export async function requestChannelSync(db: Db, actor: Actor, educatorId: string): Promise<{ jobId: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  assertUuid(educatorId, 'NOT_FOUND')
  const [e] = await db.select({ status: educators.status, channel: educators.youtubeChannelId }).from(educators).where(eq(educators.id, educatorId)).limit(1)
  if (!e || e.status !== 'APPROVED' || !e.channel) throw new AppError('NOT_FOUND')
  const job = await enqueueJob(db, { type: 'YT_SYNC_CHANNEL', payload: { educatorId, userId: actor.userId }, workspaceId: null, maxAttempts: 2 })
  return { jobId: job.id }
}

const gradeIds = async (db: Db) => new Map((await db.select({ id: levels.id, code: levels.code }).from(levels)).map((l) => [l.code, l.id]))

/** فيديوهات القناة المعتمدة ← المكتبة الموحّدة، بعناوين نظيفة وصفّ مصنّف حين يدلّ عليه العنوان */
export async function runSyncChannelJob(db: Db, job: JobRow, opts: { fetch?: typeof fetch } = {}): Promise<Record<string, unknown>> {
  const educatorId = String(job.payload.educatorId ?? '')
  const userId = typeof job.payload.userId === 'string' ? job.payload.userId : null
  assertUuid(educatorId, 'NOT_FOUND')
  const apiKey = youtubeKey()
  if (!apiKey) throw new PermanentJobError('YOUTUBE_KEY_MISSING')
  const [e] = await db.select().from(educators).where(eq(educators.id, educatorId)).limit(1)
  if (!e || e.status !== 'APPROVED' || !e.youtubeChannelId) throw new PermanentJobError('educator not approved')
  const fail = async (msg: string) => {
    await db.update(educators).set({ lastError: msg, updatedAt: new Date() }).where(eq(educators.id, educatorId))
  }
  const [subj] = await db.select({ id: subjects.id, nameAr: subjects.nameAr }).from(educatorSubjects).innerJoin(subjects, eq(subjects.id, educatorSubjects.subjectId)).where(eq(educatorSubjects.educatorId, educatorId)).orderBy(asc(educatorSubjects.rank)).limit(1)
  const [stage] = e.stageId ? await db.select({ id: educationStages.id, code: educationStages.code }).from(educationStages).where(eq(educationStages.id, e.stageId)).limit(1) : []

  let uploads = e.uploadsPlaylistId
  try {
    if (!uploads) {
      const [info] = await getChannels([e.youtubeChannelId], { apiKey, fetchImpl: opts.fetch })
      uploads = info?.uploadsPlaylistId ?? null
      if (info) await db.update(educators).set({ uploadsPlaylistId: uploads, subscriberCount: info.subscriberCount, videoCount: info.videoCount, channelTitle: info.title || e.channelTitle, channelThumbnail: info.thumbnail ?? e.channelThumbnail }).where(eq(educators.id, educatorId))
    }
    if (!uploads) throw new PermanentJobError('channel has no uploads playlist')
  } catch (err) {
    await fail(err instanceof Error ? err.message : String(err))
    throw err
  }
  let items: Awaited<ReturnType<typeof fetchPlaylistItems>>
  try {
    items = await fetchPlaylistItems(uploads, { apiKey, max: MAX_VIDEOS_PER_CHANNEL, fetchImpl: opts.fetch })
  } catch (err) {
    await fail(err instanceof Error ? err.message : String(err))
    throw err
  }
  await updateJobProgress(db, job.id, { totalItems: items.length, processedItems: 0 })

  // التنظيف والتصنيف تحسين لا شرط: إن فشل الذكاء الاصطناعي تُحفظ الفيديوهات بعناوينها الأصلية
  const provider = getAiProvider()
  const organized = new Map<string, OrganizedLesson>()
  let aiError: string | null = null
  if (provider.organizeLessons && provider.name !== 'mock') {
    for (let i = 0; i < items.length; i += CHUNK) {
      const slice = items.slice(i, i + CHUNK)
      try {
        const out = await provider.organizeLessons({ subject: subj?.nameAr ?? null, playlistTitle: e.channelTitle, levelName: null, streamName: null, items: slice })
        for (const l of out.lessons) organized.set(l.youtubeId, l)
      } catch (err) {
        aiError = aiFailureReason(err)
        if (isPermanentJobError(err)) break
      }
      await updateJobProgress(db, job.id, { processedItems: Math.min(items.length, i + CHUNK), progress: { phase: 'classify' } })
    }
  }
  const grades = await gradeIds(db)
  let created = 0
  const seen: string[] = []
  for (const it of items) {
    const o = organized.get(it.youtubeId)
    const levelId = o?.level ? (grades.get(o.level) ?? null) : null
    const r = await upsertResource(db, {
      sourceCode: 'youtube',
      ref: it.youtubeId,
      type: 'VIDEO',
      title: (o?.title || it.title).slice(0, 200),
      description: (o?.summary || it.description || '').slice(0, 1000) || null,
      stageId: stage?.id ?? null,
      levelId,
      subjectId: subj?.id ?? null,
      sourceUrl: `https://www.youtube.com/watch?v=${it.youtubeId}`,
      sourceRef: it.youtubeId,
      originalAuthor: e.channelTitle ?? e.name,
      thumbnailUrl: youtubeThumbnail(it.youtubeId),
      youtubeVideoId: it.youtubeId,
      youtubeChannelId: e.youtubeChannelId,
      educatorId,
      accessLevel: 'PUBLIC',
      status: 'PUBLISHED',
      language: 'ar',
      metadata: { topic: o?.topic ?? null, originalTitle: it.title, classifiedBy: o ? provider.name : null }
    })
    if (r.created) created++
    seen.push(r.id)
  }
  // ما اختفى من القناة يُؤرشف (لا يُحذف)
  if (seen.length) await db.update(resources).set({ status: 'ARCHIVED', updatedAt: new Date() }).where(and(eq(resources.educatorId, educatorId), eq(resources.status, 'PUBLISHED'), sql`${resources.id} not in (${sql.join(seen.map((id) => sql`${id}`), sql`, `)})`))
  await db.update(educators).set({ syncedAt: new Date(), lastError: aiError, updatedAt: new Date() }).where(eq(educators.id, educatorId))
  if (userId) await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title: `زُومنت قناة ${e.channelTitle ?? e.name}`, body: `${items.length} فيديو (${created} جديد)${organized.size ? `، صُنّف ${organized.size} بالذكاء الاصطناعي` : aiError ? `، بلا تصنيف: ${aiError}` : ''}.`, link: '/admin/educators' })
  return { videos: items.length, created, classified: organized.size, aiError }
}

/* ------------------------------ العرض العام ------------------------------ */

export interface VideoFilter {
  subject?: string | null
  level?: string | null
  educator?: string | null
}

export async function listDirectoryVideos(db: Db, f: VideoFilter = {}, limit = 60) {
  const where = and(
    isNull(resources.deletedAt),
    eq(resources.status, 'PUBLISHED'),
    eq(resources.accessLevel, 'PUBLIC'),
    eq(resources.type, 'VIDEO'),
    sql`${resources.educatorId} is not null`,
    f.subject ? eq(subjects.slug, f.subject) : undefined,
    f.level ? eq(levels.slug, f.level) : undefined,
    f.educator ? eq(resources.educatorId, f.educator) : undefined
  )
  const base = () =>
    db
      .select({
        id: resources.id,
        title: resources.title,
        description: resources.description,
        youtubeId: resources.youtubeVideoId,
        thumbnail: resources.thumbnailUrl,
        topic: sql<string | null>`${resources.metadata}->>'topic'`,
        subject: { slug: subjects.slug, nameAr: subjects.nameAr },
        level: { slug: levels.slug, nameAr: levels.nameAr },
        educator: { id: educators.id, name: educators.name, channelTitle: educators.channelTitle, thumbnail: educators.channelThumbnail },
        attribution: contentSources.attribution,
        createdAt: resources.createdAt
      })
      .from(resources)
      .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
      .leftJoin(subjects, eq(subjects.id, resources.subjectId))
      .leftJoin(levels, eq(levels.id, resources.levelId))
      .leftJoin(educators, eq(educators.id, resources.educatorId))
  const [videos, subjectRows, levelRows, educatorRows] = await Promise.all([
    base().where(where).orderBy(desc(resources.createdAt)).limit(limit),
    db
      .select({ slug: subjects.slug, nameAr: subjects.nameAr, n: count() })
      .from(resources)
      .innerJoin(subjects, eq(subjects.id, resources.subjectId))
      .where(and(isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.type, 'VIDEO'), sql`${resources.educatorId} is not null`))
      .groupBy(subjects.slug, subjects.nameAr, subjects.sortOrder)
      .orderBy(subjects.sortOrder),
    db
      .select({ slug: levels.slug, nameAr: levels.nameAr, n: count() })
      .from(resources)
      .innerJoin(levels, eq(levels.id, resources.levelId))
      .innerJoin(subjects, eq(subjects.id, resources.subjectId))
      .where(and(isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.type, 'VIDEO'), sql`${resources.educatorId} is not null`, f.subject ? eq(subjects.slug, f.subject) : undefined))
      .groupBy(levels.slug, levels.nameAr, levels.sortOrder)
      .orderBy(levels.sortOrder),
    db
      .select({ id: educators.id, name: educators.name, channelTitle: educators.channelTitle, thumbnail: educators.channelThumbnail, n: count() })
      .from(resources)
      .innerJoin(educators, eq(educators.id, resources.educatorId))
      .innerJoin(subjects, eq(subjects.id, resources.subjectId))
      .where(and(isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.type, 'VIDEO'), f.subject ? eq(subjects.slug, f.subject) : undefined))
      .groupBy(educators.id, educators.name, educators.channelTitle, educators.channelThumbnail)
      .orderBy(desc(count()))
  ])
  return { videos, subjects: subjectRows.map((s) => ({ slug: s.slug!, nameAr: s.nameAr, n: s.n })), levels: levelRows.map((l) => ({ slug: l.slug!, nameAr: l.nameAr, n: l.n })), educators: educatorRows }
}

export async function getDirectoryVideo(db: Db, id: string) {
  assertUuid(id, 'NOT_FOUND')
  const [v] = await db
    .select({
      id: resources.id,
      title: resources.title,
      description: resources.description,
      youtubeId: resources.youtubeVideoId,
      topic: sql<string | null>`${resources.metadata}->>'topic'`,
      sourceUrl: resources.sourceUrl,
      subject: { slug: subjects.slug, nameAr: subjects.nameAr },
      level: { slug: levels.slug, nameAr: levels.nameAr },
      educator: { id: educators.id, name: educators.name, channelTitle: educators.channelTitle, channelId: educators.youtubeChannelId, thumbnail: educators.channelThumbnail },
      attribution: contentSources.attribution
    })
    .from(resources)
    .innerJoin(contentSources, eq(contentSources.id, resources.sourceId))
    .leftJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .leftJoin(educators, eq(educators.id, resources.educatorId))
    .where(and(eq(resources.id, id), isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.accessLevel, 'PUBLIC'), eq(resources.type, 'VIDEO')))
    .limit(1)
  if (!v || !v.youtubeId) throw new AppError('NOT_FOUND')
  const more = v.educator?.id
    ? await db
        .select({ id: resources.id, title: resources.title, thumbnail: resources.thumbnailUrl })
        .from(resources)
        .where(and(eq(resources.educatorId, v.educator.id), eq(resources.status, 'PUBLISHED'), isNull(resources.deletedAt), inArray(resources.type, ['VIDEO']), sql`${resources.id} <> ${id}`))
        .orderBy(desc(resources.createdAt))
        .limit(8)
    : []
  return { ...v, more }
}
