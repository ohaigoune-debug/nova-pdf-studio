/**
 * رابط فيديو Bunny قصير العمر (الموجة أ · المشكلة 6 في تقرير التشخيص):
 *  - رابط الموقع خمس دقائق بدل ساعتين، فرابط منسوخ من الصفحة لا يفتح بعد دقائق.
 *  - المشغّل يجدّده عبر النبضة، ولا يحصل على رابط جديد إلا جهاز اجتاز قاعدة «جهاز واحد».
 *  - تطبيق الآيفون المنشور يبقى على ساعتين (يطلب الرابط مرة ولا يجدّده).
 *  - المشاهدة التي بدأت لا تُقطع عند انتهاء الرابط.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { AppError } from '@/server/lib/errors'
import { embedToken, saveBunnyCredentials } from '@/server/lib/bunny'
import { BUNNY_EMBED_APP_TTL_SECONDS, BUNNY_EMBED_TTL_SECONDS, EMBED_REFRESH_BEFORE_SECONDS } from '@/lib/media-embed'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

const KEY = 'test-token-auth-key-0123456789'
const VIDEO = '0f3a1c2e-1111-4222-8333-444455556666'

let h: DatabaseHandle
let student: Awaited<ReturnType<typeof makeStudent>>
let bunnyId: string
let youtubeId: string

beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'test-session-secret'
  h = await setupDb()
  await saveBunnyCredentials(h.db, { libraryId: '424242', apiKey: 'api-key-abcdefghijklmnop-1234', tokenAuthKey: KEY, cdnHostname: 'vz-test.b-cdn.net' })
  const { createContent } = await import('@/server/services/content.service')
  const admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  bunnyId = (await createContent(h.db, teacher, { type: 'VIDEO', title: 'درس Bunny', visibility: 'STUDENTS_ONLY', videoProvider: 'BUNNY', bunnyVideoId: VIDEO, publish: true })).id
  youtubeId = (await createContent(h.db, teacher, { type: 'VIDEO', title: 'درس يوتيوب', visibility: 'STUDENTS_ONLY', videoProvider: 'YOUTUBE', externalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', publish: true })).id
})
afterAll(async () => {
  await h.close()
})

describe('Bunny embed lifetime', () => {
  it('the website link lives five minutes, the published iPhone app keeps two hours', async () => {
    const { bunnyEmbedForViewer } = await import('@/server/services/media.service')
    const now = 1_700_000_000_000
    expect(BUNNY_EMBED_TTL_SECONDS).toBe(300)
    const web = await bunnyEmbedForViewer(h.db, student, bunnyId, now)
    expect(web.expires).toBe(1_700_000_000 + 300)
    expect(web.url).toContain(`token=${embedToken(KEY, VIDEO, web.expires)}`)
    const app = await bunnyEmbedForViewer(h.db, student, bunnyId, now, { ttlSeconds: BUNNY_EMBED_APP_TTL_SECONDS })
    expect(app.expires).toBe(1_700_000_000 + 2 * 3600)
    // المشغّل يجدّد قبل الانتهاء بوقت يكفي نبضتين على الأقل (كل 45 ثانية)
    expect(EMBED_REFRESH_BEFORE_SECONDS).toBeGreaterThanOrEqual(90)
    expect(EMBED_REFRESH_BEFORE_SECONDS).toBeLessThan(BUNNY_EMBED_TTL_SECONDS)
  })

  it('the iPhone player route asks for the two-hour link', () => {
    const route = readFileSync(join(process.cwd(), 'src', 'app', 'api', 'v1', 'ios', 'media', '[contentId]', 'player', 'route.ts'), 'utf8')
    expect(route).toContain('{ ttlSeconds: BUNNY_EMBED_APP_TTL_SECONDS }')
  })
})

describe('heartbeat refresh', () => {
  it('returns a fresh signed link only when asked, for a Bunny video', async () => {
    const { recordMediaHeartbeat } = await import('@/server/services/media.service')
    const t0 = new Date('2026-11-12T08:00:00Z')
    const plain = await recordMediaHeartbeat(h.db, student, { contentId: bunnyId, viewerKey: 'device-a-000001', position: 0, delta: 0, ip: '10.0.0.1', now: t0 })
    expect('embed' in plain).toBe(false)
    const later = new Date(t0.getTime() + 4 * 60_000)
    const r = await recordMediaHeartbeat(h.db, student, { contentId: bunnyId, viewerKey: 'device-a-000001', position: 240, delta: 45, ip: '10.0.0.1', now: later, refreshEmbed: true })
    expect(r.embed).toBeDefined()
    const exp = Math.floor(later.getTime() / 1000) + BUNNY_EMBED_TTL_SECONDS
    expect(r.embed?.expires).toBe(exp)
    expect(r.embed?.url).toContain(`/embed/424242/${VIDEO}?`)
    expect(r.embed?.url).toContain(`token=${embedToken(KEY, VIDEO, exp)}`)
    // المشاهدة نفسها ما زالت تُحتسب
    expect(r.secondsWatched).toBe(45)
  })

  it('a second device is refused before any fresh link is signed', async () => {
    const { recordMediaHeartbeat } = await import('@/server/services/media.service')
    const t = new Date('2026-11-12T08:05:00Z')
    await expect(
      recordMediaHeartbeat(h.db, student, { contentId: bunnyId, viewerKey: 'device-b-000002', position: 0, delta: 0, ip: '10.0.0.2', now: t, refreshEmbed: true })
    ).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'MEDIA_TOO_MANY_DEVICES')
  })

  it('a non-Bunny video gets no link even when asked', async () => {
    const { recordMediaHeartbeat } = await import('@/server/services/media.service')
    const t = new Date('2026-11-12T08:06:00Z')
    const r = await recordMediaHeartbeat(h.db, student, { contentId: youtubeId, viewerKey: 'device-a-000001', position: 0, delta: 0, ip: '10.0.0.1', now: t, refreshEmbed: true })
    expect('embed' in r).toBe(false)
  })
})

describe('player behaviour (source)', () => {
  const source = readFileSync(join(process.cwd(), 'src', 'components', 'domain', 'secure-video-player.tsx'), 'utf8')

  it('a playing frame is never cut when its link expires', () => {
    // كان: if (expires && Date.now() / 1000 >= expires) setExpired(true) — يزيل الإطار أثناء المشاهدة
    expect(source).not.toMatch(/if \(expires && Date\.now\(\) \/ 1000 >= expires\)/)
    expect(source).toContain('!frameLoaded.current && Date.now() / 1000 >= exp')
    expect(source).toContain('frameLoaded.current = true')
  })

  it('the frame is mounted with the latest link, and a loaded frame is never reloaded', () => {
    expect(source).toContain('src={frameSrc}')
    expect(source).toContain('if (!frameLoaded.current) setFrameSrc(fresh.url)')
    // رفع الحجب يطلب رابطًا جديدًا قبل إعادة تركيب الإطار
    expect(source).toContain('const result = await heartbeat(true)')
  })
})
