import { and, count, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { setAiProviderForTests } from '@/server/ai/provider'
import type { AIProvider, OrganizeLessonsInput } from '@/server/ai/types'
import type { DatabaseHandle } from '@/server/db/connect'
import { educatorSubjects, educators, jobs, notifications, resources } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { seedEducators } from '@/server/db/seed-educators'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { approveEducator, getDirectoryVideo, listDirectoryVideos, listEducators, rejectEducator, requestEducatorResolve } from '@/server/services/educators.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let admin: Actor
let teacher: Actor

/** YouTube Data API مزيّف: بحث، قنوات، وقائمة رفع */
const YT = 'https://www.googleapis.com/youtube/v3/'
let quotaAfter = Infinity
let searches = 0
const fakeYouTube = (async (u: RequestInfo | URL) => {
  const url = new URL(String(u))
  const p = (k: string) => url.searchParams.get(k) ?? ''
  if (url.href.startsWith(`${YT}search`)) {
    searches++
    if (searches > quotaAfter) return new Response(JSON.stringify({ error: { errors: [{ reason: 'quotaExceeded' }] } }), { status: 403 })
    const q = p('q')
    const items = q.includes('حيقون') ? [{ snippet: { channelId: 'UChaigoun000000000000000' } }, { snippet: { channelId: 'UCother00000000000000000' } }] : q.includes('خالد') ? [{ snippet: { channelId: 'UCkhaled0000000000000000' } }] : []
    return Response.json({ items })
  }
  if (url.href.startsWith(`${YT}channels`)) {
    const ids = p('id').split(',')
    const all: Record<string, unknown> = {
      UChaigoun000000000000000: { id: 'UChaigoun000000000000000', snippet: { title: 'الأستاذ حيقون أسامة', description: 'أدب عربي بكالوريا', customUrl: '@haigoun', thumbnails: { medium: { url: 'https://yt3.example/h.jpg' } } }, statistics: { subscriberCount: '120000', videoCount: '340' }, contentDetails: { relatedPlaylists: { uploads: 'UUhaigoun000000000000000' } } },
      UCother00000000000000000: { id: 'UCother00000000000000000', snippet: { title: 'قناة أخرى', description: '' }, statistics: { subscriberCount: '10', videoCount: '2' }, contentDetails: { relatedPlaylists: { uploads: 'UUother00000000000000000' } } },
      UCkhaled0000000000000000: { id: 'UCkhaled0000000000000000', snippet: { title: 'الأستاذ خالد', description: '' }, statistics: {}, contentDetails: { relatedPlaylists: { uploads: 'UUkhaled0000000000000000' } } }
    }
    return Response.json({ items: ids.map((i) => all[i]).filter(Boolean) })
  }
  if (url.href.startsWith(`${YT}playlistItems`)) {
    if (p('playlistId') !== 'UUhaigoun000000000000000') return Response.json({ items: [] })
    return Response.json({
      items: [
        { snippet: { title: 'الحلقة 1 | الاستعارة المكنية - بكالوريا 2027', description: 'شرح', resourceId: { videoId: 'vid00000001' } } },
        { snippet: { title: 'Private video', description: '', resourceId: { videoId: 'vid00000002' } } },
        { snippet: { title: 'النثر العلمي المتأدب', description: '', resourceId: { videoId: 'vid00000003' } } }
      ]
    })
  }
  return new Response('not found', { status: 404 })
}) as typeof fetch

const organizer = {
  name: 'openai',
  model: 'x',
  async organizeLessons(input: OrganizeLessonsInput) {
    return { lessons: input.items.map((i, n) => ({ youtubeId: i.youtubeId, title: i.title.replace(/^الحلقة \d+ \| /, '').replace(/ - بكالوريا \d+$/, ''), summary: 'ملخّص', topic: 'البلاغة', level: /بكالوريا/.test(i.title) ? '3AS' : null, order: n + 1 })) }
  }
} as unknown as AIProvider

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  process.env.YOUTUBE_API_KEY = 'yt-test-key'
  vi.stubGlobal('fetch', fakeYouTube)
  setAiProviderForTests(organizer)
})

afterAll(async () => {
  vi.unstubAllGlobals()
  setAiProviderForTests(null)
  delete process.env.YOUTUBE_API_KEY
  await h.close()
})

const byName = async (name: string) => (await h.db.select().from(educators).where(eq(educators.name, name)))[0]!

describe('دليل الأساتذة (قنوات يوتيوب)', () => {
  it('الزرع من دليل الأستاذ لا يكرّر ويربط المواد بترتيبها', async () => {
    const a = await seedEducators(h.db)
    expect(a.added).toBe(46)
    expect((await seedEducators(h.db)).added).toBe(0)
    expect((await h.db.select({ n: count() }).from(educators))[0]!.n).toBe(46)
    const abbachi = await byName('الأستاذ عباشي')
    const subs = await h.db.select().from(educatorSubjects).where(eq(educatorSubjects.educatorId, abbachi.id))
    expect(subs).toHaveLength(3) // محاسبة، اقتصاد، قانون
    const list = await listEducators(h.db, admin)
    expect(list.educators.find((e) => e.name === 'الأستاذ حيقون أسامة')!.subjects.map((s) => s.code)).toEqual(['ARABIC'])
    await expect(listEducators(h.db, teacher)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('البحث عن القنوات: مرشّحات لكل أستاذ، يتوقّف عند نفاد الحصة ويكمل لاحقاً', async () => {
    quotaAfter = 2
    const r = await requestEducatorResolve(h.db, admin)
    expect(r.toResolve).toBe(46)
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, r.jobId))
    expect(j!.result).toMatchObject({ resolved: 2, quota: true, remaining: 44 })
    const hg = await byName('الأستاذ حيقون أسامة')
    expect(hg.candidates.map((c) => c.channelId)).toEqual(['UChaigoun000000000000000', 'UCother00000000000000000'])
    expect(hg.candidates[0]).toMatchObject({ title: 'الأستاذ حيقون أسامة', handle: '@haigoun', subscriberCount: 120000 })
    const n = await h.db.select().from(notifications).where(eq(notifications.userId, admin.userId))
    expect(n.some((x) => x.title.includes('نفدت حصة'))).toBe(true)
    // بحث ثانٍ: الباقون فقط (لا إعادة لمن حُلّ)
    quotaAfter = Infinity
    searches = 0
    const r2 = await requestEducatorResolve(h.db, admin)
    expect(r2.toResolve).toBe(44)
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    expect(searches).toBe(44)
    expect((await h.db.select({ n: count() }).from(educators).where(eq(educators.status, 'SUGGESTED')))[0]!.n).toBe(46)
  })

  it('الاعتماد بيد المشرف: يربط القناة ويزامن فيديوهاتها مصنّفةً، والمرفوض تُؤرشف فيديوهاته', async () => {
    const hg = await byName('الأستاذ حيقون أسامة')
    await expect(approveEducator(h.db, teacher, hg.id, 'UChaigoun000000000000000')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(approveEducator(h.db, admin, hg.id, 'UCnotacandidate000000000')).rejects.toMatchObject({ code: 'VALIDATION' })
    const { jobId } = await approveEducator(h.db, admin, hg.id, 'UChaigoun000000000000000')
    expect(await byName('الأستاذ حيقون أسامة')).toMatchObject({ status: 'APPROVED', youtubeChannelId: 'UChaigoun000000000000000', channelTitle: 'الأستاذ حيقون أسامة' })
    // القناة نفسها لا تُربط بأستاذ آخر
    const kh = await byName('الأستاذ خالد للغة العربية')
    await h.db.update(educators).set({ candidates: [{ channelId: 'UChaigoun000000000000000', title: 'x', description: '', thumbnail: null }] }).where(eq(educators.id, kh.id))
    await expect(approveEducator(h.db, admin, kh.id, 'UChaigoun000000000000000')).rejects.toMatchObject({ code: 'CHANNEL_ALREADY_LINKED' })

    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    const [j] = await h.db.select().from(jobs).where(eq(jobs.id, jobId))
    expect(j!.status).toBe('COMPLETED')
    // الفيديو الخاص أُسقط؛ الباقيان في المكتبة بعناوين نظيفة ومادة وصفّ حين دلّ العنوان
    expect(j!.result).toMatchObject({ videos: 2, created: 2, classified: 2 })
    const vids = await listDirectoryVideos(h.db, {})
    expect(vids.subjects).toEqual([{ slug: 'arabic', nameAr: 'اللغة العربية', n: 2 }])
    expect(vids.levels).toEqual([{ slug: '3as', nameAr: 'السنة الثالثة ثانوي', n: 1 }])
    const v1 = vids.videos.find((v) => v.youtubeId === 'vid00000001')!
    expect(v1).toMatchObject({ title: 'الاستعارة المكنية', topic: 'البلاغة', level: { slug: '3as' }, educator: { name: 'الأستاذ حيقون أسامة' }, attribution: 'المصدر: YouTube' })
    expect((await listDirectoryVideos(h.db, { level: '3as' })).videos).toHaveLength(1)
    const one = await getDirectoryVideo(h.db, v1.id)
    expect(one.more.map((m) => m.title)).toEqual(['النثر العلمي المتأدب'])
    expect(await byName('الأستاذ حيقون أسامة')).toMatchObject({ uploadsPlaylistId: 'UUhaigoun000000000000000', videoCount: 340 })

    // مزامنة ثانية: لا تكرار
    await processQueuedJobs(h.db, { limit: 5, lane: 'slow' })
    const { jobId: again } = await (await import('@/server/services/educators.service')).requestChannelSync(h.db, admin, hg.id)
    await processQueuedJobs(h.db, { limit: 1, lane: 'slow' })
    expect((await h.db.select().from(jobs).where(eq(jobs.id, again)))[0]!.result).toMatchObject({ videos: 2, created: 0 })
    expect((await h.db.select({ n: count() }).from(resources).where(eq(resources.educatorId, hg.id)))[0]!.n).toBe(2)

    await rejectEducator(h.db, admin, hg.id)
    expect((await listDirectoryVideos(h.db, {})).videos).toHaveLength(0)
    expect((await h.db.select({ n: count() }).from(resources).where(and(eq(resources.educatorId, hg.id), eq(resources.status, 'ARCHIVED'))))[0]!.n).toBe(2)
    await expect(getDirectoryVideo(h.db, v1.id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
