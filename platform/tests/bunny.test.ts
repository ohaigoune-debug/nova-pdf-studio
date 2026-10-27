import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { eq } from 'drizzle-orm'
import { AppError } from '@/server/lib/errors'
import { BUNNY_SETTINGS_KEY, embedExpired, embedToken, getBunnyCredentials, getBunnyCredentialsView, isBunnyVideoId, saveBunnyCredentials, signedEmbedUrl, testBunny, uploadUrl } from '@/server/lib/bunny'
import { setupDb } from './helpers'

const KEY = 'test-token-auth-key-0123456789'
const VIDEO = '0f3a1c2e-1111-4222-8333-444455556666'
const CREDS = { libraryId: '12345', tokenAuthKey: KEY }

let h: DatabaseHandle
beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'test-session-secret'
  h = await setupDb()
})
afterAll(async () => {
  await h.close()
})

describe('Bunny Stream: التوقيع النقي', () => {
  it('الرمز = sha256hex(المفتاح + معرّف الفيديو + الانتهاء)', () => {
    const expires = 1_800_000_000
    expect(embedToken(KEY, VIDEO, expires)).toBe(createHash('sha256').update(`${KEY}${VIDEO}${expires}`).digest('hex'))
  })

  it('رابط التضمين بالشكل المطلوب ومدّة الصلاحية محسوبة من now', () => {
    const now = 1_700_000_000_000
    const { url, expires } = signedEmbedUrl(CREDS, { videoId: VIDEO, expiresInSeconds: 7200, viewerLabel: 'abcd1234', now })
    expect(expires).toBe(1_700_000_000 + 7200)
    const u = new URL(url)
    expect(u.origin + u.pathname).toBe(`https://iframe.mediadelivery.net/embed/12345/${VIDEO}`)
    expect(u.searchParams.get('token')).toBe(embedToken(KEY, VIDEO, expires))
    expect(u.searchParams.get('expires')).toBe(String(expires))
    expect(u.searchParams.get('autoplay')).toBe('false')
    expect(u.searchParams.get('v')).toBe('abcd1234')
    // نفس المدخلات ⇒ نفس الرابط (حتمي)
    expect(signedEmbedUrl(CREDS, { videoId: VIDEO, expiresInSeconds: 7200, viewerLabel: 'abcd1234', now }).url).toBe(url)
  })

  it('الانتهاء يُحترم: الرابط يُعدّ منتهياً بعد expires ومفتوحاً قبله؛ والحدّ الأدنى دقيقة', () => {
    const now = 1_700_000_000_000
    const { expires } = signedEmbedUrl(CREDS, { videoId: VIDEO, expiresInSeconds: 60, now })
    expect(embedExpired(expires, now)).toBe(false)
    expect(embedExpired(expires, now + 59_000)).toBe(false)
    expect(embedExpired(expires, now + 60_000)).toBe(true)
    expect(signedEmbedUrl(CREDS, { videoId: VIDEO, expiresInSeconds: 5, now }).expires).toBe(1_700_000_000 + 60)
    // مفتاح مختلف ⇒ رمز مختلف
    expect(signedEmbedUrl({ libraryId: '12345', tokenAuthKey: 'other-key' }, { videoId: VIDEO, expiresInSeconds: 60, now }).url).not.toBe(signedEmbedUrl(CREDS, { videoId: VIDEO, expiresInSeconds: 60, now }).url)
  })

  it('يرفض معرّف فيديو غير صالح', () => {
    expect(isBunnyVideoId(VIDEO)).toBe(true)
    expect(isBunnyVideoId('not-a-guid')).toBe(false)
    expect(() => signedEmbedUrl(CREDS, { videoId: 'x', expiresInSeconds: 60 })).toThrow(AppError)
  })

  it('عنوان الرفع يشير إلى المكتبة والفيديو', () => {
    expect(uploadUrl({ libraryId: '7' }, VIDEO)).toBe(`https://video.bunnycdn.com/library/7/videos/${VIDEO}`)
  })
})

describe('Bunny Stream: الاعتمادات المختومة والاختبار', () => {
  it('تُحفظ مختومة (لا نصّ صريح في القاعدة) وتُفتح للخادم وتُعرض بآخر 4 أحرف فقط', async () => {
    await saveBunnyCredentials(h.db, { libraryId: '424242', apiKey: 'api-key-abcdefghijklmnop-1234', tokenAuthKey: KEY, cdnHostname: 'https://vz-test.b-cdn.net/' })
    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, BUNNY_SETTINGS_KEY))
    const raw = JSON.stringify(row?.value)
    expect(raw).not.toContain('api-key-abcdefghijklmnop-1234')
    expect(raw).not.toContain(KEY)
    const creds = await getBunnyCredentials(h.db)
    expect(creds).toEqual({ libraryId: '424242', apiKey: 'api-key-abcdefghijklmnop-1234', tokenAuthKey: KEY, cdnHostname: 'vz-test.b-cdn.net' })
    const view = await getBunnyCredentialsView(h.db)
    expect(view?.apiKeyHint).toBe('1234')
    expect(view?.tokenKeyHint).toBe(KEY.slice(-4))
    expect(view?.usable).toBe(true)
  })

  it('testBunny يرسل AccessKey إلى نقطة المكتبة ويترجم 401 إلى BUNNY_KEY_INVALID', async () => {
    const calls: { url: string; key: string | undefined }[] = []
    const okFetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), key: (init?.headers as Record<string, string>)?.AccessKey })
      return new Response(JSON.stringify({ totalItems: 3 }), { status: 200 })
    }) as typeof fetch
    const r = await testBunny({ libraryId: '424242', apiKey: 'k'.repeat(20) }, okFetch)
    expect(r.totalItems).toBe(3)
    expect(calls[0]?.url).toBe('https://video.bunnycdn.com/library/424242/videos?itemsPerPage=1')
    expect(calls[0]?.key).toBe('k'.repeat(20))
    const badFetch = (async () => new Response('', { status: 401 })) as typeof fetch
    await expect(testBunny({ libraryId: '1', apiKey: 'k'.repeat(20) }, badFetch)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'BUNNY_KEY_INVALID')
  })
})

describe('Bunny Stream: محتوى BUNNY والرابط الموقّع عبر media.service', () => {
  it('ينشئ محتوى BUNNY بمعرّف صالح فقط، ويسلّم رابطاً موقّعاً للمشاهد المخوّل دون الزائر على محتوى خاص', async () => {
    const { createContent } = await import('@/server/services/content.service')
    const { bunnyEmbedForViewer } = await import('@/server/services/media.service')
    const { makeAdmin, makeTeacher, makeStudent } = await import('./helpers')
    const admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin)
    const student = await makeStudent(h.db)
    await expect(createContent(h.db, teacher, { type: 'VIDEO', title: 'x', visibility: 'STUDENTS_ONLY', videoProvider: 'BUNNY', bunnyVideoId: 'bad' })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'VALIDATION')
    const c = await createContent(h.db, teacher, { type: 'VIDEO', title: 'درس Bunny', visibility: 'STUDENTS_ONLY', videoProvider: 'BUNNY', bunnyVideoId: VIDEO, publish: true })
    expect(c.videoProvider).toBe('BUNNY')
    expect(c.bunnyVideoId).toBe(VIDEO)
    const now = 1_700_000_000_000
    const embed = await bunnyEmbedForViewer(h.db, student, c.id, now)
    expect(embed.expires).toBe(1_700_000_000 + 300)
    expect(embed.url).toContain(`/embed/424242/${VIDEO}?`)
    expect(embed.url).toContain(`token=${embedToken(KEY, VIDEO, embed.expires)}`)
    expect(embed.watermark[0]).toBe(student.fullName)
    await expect(bunnyEmbedForViewer(h.db, null, c.id, now)).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'CONTENT_NOT_FOUND')
    const pub = await createContent(h.db, teacher, { type: 'VIDEO', title: 'عام', visibility: 'PUBLIC', videoProvider: 'BUNNY', bunnyVideoId: VIDEO, publish: true })
    const anon = await bunnyEmbedForViewer(h.db, null, pub.id, now)
    expect(anon.watermark[0]).toBe('madrasa · public')
  })
})
