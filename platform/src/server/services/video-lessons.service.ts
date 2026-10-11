/**
 * «الفيديوهات والقنوات» بالدرس: الذكاء الاصطناعي يسمّي الدرس الذي يشرحه كل فيديو من قنوات الأساتذة
 * («الدوال»، «إعراب البدل»، «الصور البيانية»…) بأسماء المنهاج، فيجتمع كل من شرح الدرس نفسه في بطاقة واحدة.
 * القنوات تبقى خياراً ثانياً للتلميذ. لا يُحذف شيء ولا يُغيَّر عنوان: يُضاف الدرس فقط (lesson_key/lesson_title).
 */
import { and, asc, desc, eq, inArray, isNotNull, isNull, or, sql, type SQL } from 'drizzle-orm'
import { aiFailureReason } from '@/server/ai/failure'
import { getAiProvider } from '@/server/ai/provider'
import { lessonKeyOf } from '@/server/ai/shared'
import type { GroupVideoLessonsInput } from '@/server/ai/types'
import { withAiTask } from '@/server/ai/usage'
import type { Db } from '@/server/db/connect'
import { curriculumNodes, educators, levels, resources, subjects } from '@/server/db/schema'
import { enqueueJob, failStaleJob, pendingJobOfType, updateJobProgress, type JobRow } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, isPermanentJobError } from '@/server/lib/errors'
import { levelLabel } from '@/lib/levels'
import { notify } from './notifications.service'

export { lessonKeyOf }

/** فيديوهات في كل طلب للذكاء الاصطناعي */
const CHUNK = 60
/** آلاف الفيديوهات تأخذ ساعة أو أكثر؛ بعد أربع ساعات في PROCESSING تُعدّ منقطعة */
const STALE_AFTER_MS = 4 * 60 * 60_000

const directoryVideos = (): SQL => and(isNull(resources.deletedAt), eq(resources.status, 'PUBLISHED'), eq(resources.accessLevel, 'PUBLIC'), eq(resources.type, 'VIDEO'), isNotNull(resources.educatorId))!

/** الفيديو بلا مستوى يظهر لكل المستويات؛ مع مستوى: فيديوهاته + غير المحدَّدة */
const levelScope = (levelId?: string | null): SQL | undefined => (levelId ? or(eq(resources.levelId, levelId), isNull(resources.levelId)) : undefined)

export interface OrganizeReport {
  subjects: number
  videos: number
  assigned: number
  lessons: number
  aiError: string | null
}

/**
 * يرتّب فيديوهات مادة (أو كل المواد) بالدرس. يُعاد تشغيله بأمان: الأسماء المعتمدة سلفاً تُمرَّر للنموذج ليعيدها كما هي،
 * فتبقى الدروس ثابتة بين الجولات. بلا مزوّد ذكاء اصطناعي: مطابقة حتمية بأسماء المنهاج ومحور التنظيم السابق.
 */
export async function organizeVideoLessons(db: Db, opts: { subjectId?: string | null; onlyMissing?: boolean; onProgress?: (done: number, total: number) => Promise<void> | void } = {}): Promise<OrganizeReport> {
  const subjectRows = await db
    .selectDistinct({ id: subjects.id, name: subjects.nameAr })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .where(and(directoryVideos(), opts.subjectId ? eq(resources.subjectId, opts.subjectId) : undefined))
  const provider = getAiProvider()
  const report: OrganizeReport = { subjects: subjectRows.length, videos: 0, assigned: 0, lessons: 0, aiError: null }
  const levelIdByCode = new Map((await db.select({ id: levels.id, code: levels.code }).from(levels)).map((l) => [l.code, l.id]))
  const allLessons = new Set<string>()
  let done = 0
  const totalVideos = (
    await db
      .select({ n: sql<number>`count(*)::int` })
      .from(resources)
      .where(and(directoryVideos(), opts.subjectId ? eq(resources.subjectId, opts.subjectId) : undefined, opts.onlyMissing ? isNull(resources.lessonKey) : undefined))
  )[0]?.n ?? 0

  for (const subject of subjectRows) {
    const videos = await db
      .select({ id: resources.id, title: resources.title, topic: sql<string | null>`${resources.metadata}->>'topic'`, levelId: resources.levelId, levelCode: levels.code, channel: educators.name })
      .from(resources)
      .leftJoin(levels, eq(levels.id, resources.levelId))
      .leftJoin(educators, eq(educators.id, resources.educatorId))
      .where(and(directoryVideos(), eq(resources.subjectId, subject.id), opts.onlyMissing ? isNull(resources.lessonKey) : undefined))
      .orderBy(asc(resources.createdAt), asc(resources.id))
    if (!videos.length) continue
    report.videos += videos.length
    // الأسماء المعتمدة: دروس المنهاج للمادة ثم ما سُمّي في جولات سابقة
    const nodeTitles = (
      await db
        .selectDistinct({ title: curriculumNodes.title })
        .from(curriculumNodes)
        .where(and(eq(curriculumNodes.subjectId, subject.id), inArray(curriculumNodes.kind, ['LESSON', 'CHAPTER'])))
        .limit(400)
    ).map((r) => r.title)
    const prior = (await db.selectDistinct({ title: resources.lessonTitle }).from(resources).where(and(directoryVideos(), eq(resources.subjectId, subject.id), isNotNull(resources.lessonTitle)))).map((r) => r.title!)
    const known: string[] = []
    const seenKeys = new Set<string>()
    const remember = (t: string) => {
      const k = lessonKeyOf(t)
      if (!k || seenKeys.has(k)) return
      seenKeys.add(k)
      known.push(t)
    }
    for (const t of [...prior, ...nodeTitles]) remember(t)

    for (let i = 0; i < videos.length; i += CHUNK) {
      const slice = videos.slice(i, i + CHUNK)
      const input: GroupVideoLessonsInput = { subject: subject.name, knownLessons: known, items: slice.map((v, n) => ({ id: `v${n + 1}`, title: v.title, topic: v.topic, channel: v.channel, level: v.levelCode })) }
      let assigned: { id: string; lesson: string | null; level: string | null }[] = []
      if (provider.groupVideoLessons) {
        try {
          assigned = (await withAiTask({ task: 'video_lessons_group', userId: null, entityType: 'subject', entityId: subject.id }, () => provider.groupVideoLessons!(input))).items
        } catch (err) {
          report.aiError = aiFailureReason(err)
          if (isPermanentJobError(err)) break
        }
      }
      for (let n = 0; n < slice.length; n++) {
        const v = slice[n]!
        const a = assigned.find((x) => x.id === `v${n + 1}`)
        const lesson = a?.lesson?.trim() || null
        if (!lesson) continue
        const key = lessonKeyOf(lesson)
        if (!key) continue
        remember(lesson)
        const canonical = known.find((k) => lessonKeyOf(k) === key) ?? lesson
        const levelId = !v.levelId && a?.level ? (levelIdByCode.get(a.level) ?? null) : null
        await db
          .update(resources)
          .set({ lessonKey: key, lessonTitle: canonical, ...(levelId ? { levelId } : {}), updatedAt: new Date() })
          .where(eq(resources.id, v.id))
        report.assigned++
        allLessons.add(`${subject.id}|${key}`)
      }
      done += slice.length
      await opts.onProgress?.(done, totalVideos)
    }
  }
  report.lessons = allLessons.size
  return report
}

/** من لوحة الإدارة أو بعد مزامنة قناة: مهمة خلفية واحدة لكل مادة (أو للكل) */
export async function requestVideoLessonsOrganize(db: Db, actor: Actor | null, input: { subjectId?: string | null; onlyMissing?: boolean } = {}): Promise<{ jobId: string; reused: boolean }> {
  if (actor) assertRole(actor, 'SUPER_ADMIN')
  const pending = await pendingJobOfType(db, 'YT_ORGANIZE_LESSONS', null)
  // مهمة انقطعت بإعادة تشغيل الخادم لا تحجب طلباً جديداً (والجديد يكمل ما بقي بلا درس فقط)
  if (pending && !(await failStaleJob(db, pending, STALE_AFTER_MS))) return { jobId: pending.id, reused: true }
  const job = await enqueueJob(db, { type: 'YT_ORGANIZE_LESSONS', payload: { subjectId: input.subjectId ?? null, onlyMissing: input.onlyMissing ?? false, userId: actor?.userId ?? null }, workspaceId: null, maxAttempts: 2 })
  if (actor) await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'videos.organize_lessons', entityType: 'job', entityId: job.id, newValue: { subjectId: input.subjectId ?? null } })
  return { jobId: job.id, reused: false }
}

export async function runOrganizeLessonsJob(db: Db, job: JobRow): Promise<Record<string, unknown>> {
  const subjectId = typeof job.payload.subjectId === 'string' ? job.payload.subjectId : null
  const userId = typeof job.payload.userId === 'string' ? job.payload.userId : null
  const r = await organizeVideoLessons(db, { subjectId, onlyMissing: job.payload.onlyMissing === true, onProgress: (d, t) => updateJobProgress(db, job.id, { totalItems: t, processedItems: d }) })
  if (userId) await notify(db, { userId, workspaceId: null, type: 'SYSTEM', title: 'رُتّبت الفيديوهات بالدرس', body: `${r.assigned} فيديو من ${r.videos} في ${r.lessons} درساً${r.aiError ? ` — تنبيه: ${r.aiError}` : ''}.`, link: '/videos' })
  return { ...r }
}

/* ───────────── العرض ───────────── */

export interface VideoLessonCard {
  key: string
  title: string
  subject: { slug: string; name: string }
  videos: number
  channels: { id: string; name: string; thumbnail: string | null }[]
  thumbnail: string | null
  levels: string[]
}

/** دروس فيها شروح، مع القنوات التي شرحتها — الأكثر شرحاً أولاً */
export async function listVideoLessons(db: Db, f: { subjectSlug?: string | null; levelId?: string | null; q?: string | null } = {}): Promise<{ lessons: VideoLessonCard[]; unsorted: number }> {
  const q = f.q?.trim().slice(0, 60) ?? ''
  const base = and(directoryVideos(), f.subjectSlug ? eq(subjects.slug, f.subjectSlug) : undefined, levelScope(f.levelId))
  const rows = await db
    .select({
      key: resources.lessonKey,
      title: sql<string>`min(${resources.lessonTitle})`,
      subjectSlug: subjects.slug,
      subjectName: subjects.nameAr,
      videos: sql<number>`count(*)::int`,
      channelIds: sql<string[]>`array_agg(distinct ${resources.educatorId}::text)`,
      levelCodes: sql<(string | null)[]>`array_agg(distinct ${levels.code})`,
      thumbnail: sql<string | null>`(array_agg(${resources.thumbnailUrl} order by ${resources.createdAt} desc))[1]`
    })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .where(and(base, isNotNull(resources.lessonKey), q.length >= 2 ? sql`${resources.lessonTitle} ilike ${`%${q.replace(/[%_\\]/g, '\\$&')}%`}` : undefined))
    .groupBy(resources.lessonKey, subjects.slug, subjects.nameAr, subjects.sortOrder)
    .orderBy(desc(sql`count(distinct ${resources.educatorId})`), desc(sql`count(*)`), asc(sql`min(${resources.lessonTitle})`))
    .limit(300)
  const ids = [...new Set(rows.flatMap((r) => r.channelIds ?? []))].filter(Boolean)
  const chans = ids.length ? await db.select({ id: educators.id, name: educators.name, thumbnail: educators.channelThumbnail }).from(educators).where(inArray(educators.id, ids)) : []
  const byId = new Map(chans.map((c) => [c.id, c]))
  const [un] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .where(and(base, isNull(resources.lessonKey)))
  return {
    lessons: rows.map((r) => ({
      key: r.key!,
      title: r.title,
      subject: { slug: r.subjectSlug!, name: r.subjectName },
      videos: r.videos,
      channels: (r.channelIds ?? []).map((id) => byId.get(id)).filter((c): c is { id: string; name: string; thumbnail: string | null } => Boolean(c)),
      thumbnail: r.thumbnail,
      levels: (r.levelCodes ?? []).filter((c): c is string => Boolean(c)).map((c) => levelLabel(c) ?? c)
    })),
    unsorted: un?.n ?? 0
  }
}

export interface LessonVideos {
  title: string
  subject: { slug: string; name: string }
  channels: { id: string; name: string; thumbnail: string | null; videos: { id: string; title: string; thumbnail: string | null; level: string | null }[] }[]
  total: number
}

/** كل من شرح الدرس: الفيديوهات مجمّعة بالقناة */
export async function listLessonVideos(db: Db, f: { subjectSlug: string; lessonKey: string; levelId?: string | null }): Promise<LessonVideos> {
  const rows = await db
    .select({ id: resources.id, title: resources.title, thumbnail: resources.thumbnailUrl, lessonTitle: resources.lessonTitle, levelCode: levels.code, subjectSlug: subjects.slug, subjectName: subjects.nameAr, educatorId: educators.id, educatorName: educators.name, educatorThumb: educators.channelThumbnail })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .innerJoin(educators, eq(educators.id, resources.educatorId))
    .leftJoin(levels, eq(levels.id, resources.levelId))
    .where(and(directoryVideos(), eq(subjects.slug, f.subjectSlug), eq(resources.lessonKey, f.lessonKey), levelScope(f.levelId)))
    .orderBy(asc(educators.name), desc(resources.createdAt))
    .limit(300)
  if (!rows.length) throw new AppError('NOT_FOUND')
  const channels = new Map<string, LessonVideos['channels'][number]>()
  for (const r of rows) {
    const c = channels.get(r.educatorId) ?? { id: r.educatorId, name: r.educatorName, thumbnail: r.educatorThumb, videos: [] }
    c.videos.push({ id: r.id, title: r.title, thumbnail: r.thumbnail, level: r.levelCode ? (levelLabel(r.levelCode) ?? r.levelCode) : null })
    channels.set(r.educatorId, c)
  }
  return { title: rows[0]!.lessonTitle ?? '', subject: { slug: rows[0]!.subjectSlug!, name: rows[0]!.subjectName }, channels: [...channels.values()].sort((a, b) => b.videos.length - a.videos.length), total: rows.length }
}

/** شروح الدرس نفسه من قنوات أخرى (لصفحة الفيديو) */
export async function sameLessonVideos(db: Db, videoId: string, limit = 8): Promise<{ id: string; title: string; thumbnail: string | null; channel: string }[]> {
  const [v] = await db.select({ key: resources.lessonKey, subjectId: resources.subjectId, educatorId: resources.educatorId }).from(resources).where(eq(resources.id, videoId)).limit(1)
  if (!v?.key || !v.subjectId) return []
  return db
    .select({ id: resources.id, title: resources.title, thumbnail: resources.thumbnailUrl, channel: educators.name })
    .from(resources)
    .innerJoin(educators, eq(educators.id, resources.educatorId))
    .where(and(directoryVideos(), eq(resources.lessonKey, v.key), eq(resources.subjectId, v.subjectId), v.educatorId ? sql`${resources.educatorId} <> ${v.educatorId}` : undefined))
    .orderBy(desc(resources.createdAt))
    .limit(limit)
}

/** شرائح المواد التي فيها فيديوهات (ضمن المستوى) */
export async function videoSubjects(db: Db, levelId?: string | null): Promise<{ slug: string; name: string; n: number }[]> {
  const rows = await db
    .select({ slug: subjects.slug, name: subjects.nameAr, n: sql<number>`count(*)::int` })
    .from(resources)
    .innerJoin(subjects, eq(subjects.id, resources.subjectId))
    .where(and(directoryVideos(), levelScope(levelId)))
    .groupBy(subjects.slug, subjects.nameAr, subjects.sortOrder)
    .orderBy(asc(subjects.sortOrder))
  return rows.map((r) => ({ slug: r.slug!, name: r.name, n: r.n }))
}
