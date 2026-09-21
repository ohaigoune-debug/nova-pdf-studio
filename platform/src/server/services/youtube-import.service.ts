/**
 * استيراد قائمة تشغيل يوتيوب دروساً في المنصة.
 * الفيديو يبقى على يوتيوب (لا رفع ولا تخزين)، والمنصة تحفظ معرّفه وعنوانه وملخّصه
 * فتُعرض داخل التطبيق بمشغّل بلا اقتراحات خارجية.
 * الترتيب البيداغوجي والعناوين العربية يتكفّل بها مزوّد الذكاء الاصطناعي إن كان مفعّلاً؛
 * بدونه يُستورد الترتيب كما هو على يوتيوب.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { getAiProvider } from '@/server/ai/provider'
import type { OrganizedLesson } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { content, levels, streams } from '@/server/db/schema'
import type { Visibility } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { fetchPlaylistItems, parsePlaylistId, type FetchPlaylistOptions, type PlaylistItem } from '@/server/lib/youtube'
import { createContent } from './content.service'

export interface ImportPlaylistInput {
  /** رابط القائمة أو معرّفها */
  url: string
  levelId?: string | null
  streamId?: string | null
  visibility: Visibility
  groupIds?: string[]
  /** نشر فوري أم تركها مسودّة يراجعها الأستاذ */
  publish?: boolean
  /** تنظيم بالذكاء الاصطناعي: عناوين عربية، ملخّصات، محاور، ترتيب */
  organize?: boolean
  /** حدّ أعلى لما يُستورد في المرّة الواحدة */
  max?: number
}

export interface ImportPlaylistResult {
  playlistId: string
  found: number
  imported: number
  /** فيديوهات موجودة سلفاً في مكتبة الأستاذ: لا تُضاعَف */
  skipped: number
  organizedBy: string | null
  titles: string[]
}

const MAX_PER_IMPORT = 100

/** أسماء المستوى والشعبة تُعطى للنموذج ليضبط مستوى الشرح */
async function referenceNames(db: Db, levelId?: string | null, streamId?: string | null) {
  const [level] = levelId ? await db.select({ name: levels.nameAr }).from(levels).where(eq(levels.id, levelId)).limit(1) : []
  const [stream] = streamId ? await db.select({ name: streams.nameAr }).from(streams).where(eq(streams.id, streamId)).limit(1) : []
  return { levelName: level?.name ?? null, streamName: stream?.name ?? null }
}

/** ما سبق استيراده في نفس مساحة الأستاذ (المحذوف لا يُحتسب فيُستورد من جديد) */
async function existingIds(db: Db, workspaceId: string | null, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const scope = workspaceId ? eq(content.workspaceId, workspaceId) : isNull(content.workspaceId)
  const rows = await db
    .select({ youtubeId: content.youtubeId })
    .from(content)
    .where(and(scope, isNull(content.deletedAt), inArray(content.youtubeId, ids)))
  return new Set(rows.map((r) => r.youtubeId).filter((v): v is string => Boolean(v)))
}

async function organize(items: PlaylistItem[], levelName: string | null, streamName: string | null): Promise<{ lessons: OrganizedLesson[]; by: string | null }> {
  const provider = getAiProvider()
  if (!provider.organizeLessons) return { lessons: fallback(items), by: null }
  try {
    const out = await provider.organizeLessons({ playlistTitle: null, levelName, streamName, items })
    return { lessons: out.lessons, by: provider.name }
  } catch (err) {
    // التنظيم تحسين لا شرط: فشله لا يمنع الأستاذ من استيراد دروسه
    console.error('[youtube-import] organize failed', err)
    return { lessons: fallback(items), by: null }
  }
}

const fallback = (items: PlaylistItem[]): OrganizedLesson[] => items.map((i, n) => ({ youtubeId: i.youtubeId, title: i.title, summary: '', topic: null, order: n + 1 }))

export async function importPlaylist(db: Db, actor: Actor, input: ImportPlaylistInput, fetchOpts: FetchPlaylistOptions = {}): Promise<ImportPlaylistResult> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const playlistId = parsePlaylistId(input.url)
  if (!playlistId) throw new AppError('INVALID_PLAYLIST_URL')

  const max = Math.max(1, Math.min(input.max ?? MAX_PER_IMPORT, MAX_PER_IMPORT))
  let items: PlaylistItem[]
  try {
    items = await fetchPlaylistItems(playlistId, { apiKey: process.env.YOUTUBE_API_KEY, max, ...fetchOpts })
  } catch (err) {
    console.error('[youtube-import] fetch failed', err)
    throw new AppError('PLAYLIST_FETCH_FAILED')
  }
  if (items.length === 0) throw new AppError('PLAYLIST_EMPTY')

  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : null
  const known = await existingIds(db, workspaceId, items.map((i) => i.youtubeId))
  const fresh = items.filter((i) => !known.has(i.youtubeId))
  if (fresh.length === 0) {
    return { playlistId, found: items.length, imported: 0, skipped: items.length, organizedBy: null, titles: [] }
  }

  const { levelName, streamName } = await referenceNames(db, input.levelId, input.streamId)
  const { lessons, by } = input.organize ? await organize(fresh, levelName, streamName) : { lessons: fallback(fresh), by: null }

  // الإدراج متتابع لا متوازٍ: الترتيب البيداغوجي هو ترتيب الإنشاء الذي تُعرض به الدروس
  const titles: string[] = []
  for (const lesson of lessons) {
    const row = await createContent(db, actor, {
      type: 'VIDEO',
      title: lesson.title,
      summary: lesson.summary || null,
      externalUrl: `https://www.youtube.com/watch?v=${lesson.youtubeId}`,
      videoProvider: 'YOUTUBE',
      levelId: input.levelId ?? null,
      streamId: input.streamId ?? null,
      topic: lesson.topic,
      visibility: input.visibility,
      groupIds: input.groupIds ?? [],
      publish: input.publish ?? false
    })
    titles.push(row.title)
  }

  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId,
    action: 'content.import_playlist',
    entityType: 'content',
    // لا entityId: معرّف القائمة ليس UUID، والسجل يحمله في القيمة
    newValue: { playlistId, imported: titles.length, skipped: items.length - fresh.length, organizedBy: by }
  })

  return { playlistId, found: items.length, imported: titles.length, skipped: items.length - fresh.length, organizedBy: by, titles }
}
