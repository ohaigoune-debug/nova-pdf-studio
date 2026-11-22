/** «ربط Zoom» وبدء الحصة كمضيف من المنصة (المرحلة الثانية، 22 نوفمبر 2026) — Zoom وهمي */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, courses, groups, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createLiveSession, zoomHostJoin } from '@/server/services/live.service'
import { ZOOM_OAUTH_KEY, connectZoomWithCode, disconnectZoom, zoomAuthorizeUrl, zoomHostZak, zoomOAuthStatus, zoomRedirectUri } from '@/server/services/zoom-oauth.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

/** Zoom وهمي: رموز متتالية، تجديد يُبطل القديم، ZAK لرمز الوصول الصالح فقط */
function fakeZoom() {
  const log: string[] = []
  let n = 0
  const validRefresh = new Set<string>()
  const validAccess = new Set<string>()
  const issue = () => {
    n += 1
    validAccess.add(`acc${n}`)
    validRefresh.add(`ref${n}`)
    return { access_token: `acc${n}`, refresh_token: `ref${n}`, expires_in: 3600, scope: 'user:read:zak' }
  }
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    if (url === 'https://zoom.us/oauth/token') {
      expect(String((init?.headers as Record<string, string>).Authorization)).toMatch(/^Basic /)
      const p = new URLSearchParams(String(init?.body))
      log.push(`token:${p.get('grant_type')}`)
      if (p.get('grant_type') === 'authorization_code') {
        expect(p.get('redirect_uri')).toBe(zoomRedirectUri())
        return p.get('code') === 'good-code' ? json(200, issue()) : json(400, { reason: 'Invalid authorization code', error: 'invalid_grant' })
      }
      const r = p.get('refresh_token') ?? ''
      if (!validRefresh.has(r)) return json(400, { reason: 'Invalid Token!', error: 'invalid_grant' })
      validRefresh.delete(r)
      return json(200, issue())
    }
    if (url === 'https://api.zoom.us/v2/users/me/zak') {
      const tok = String((init?.headers as Record<string, string>).Authorization).replace('Bearer ', '')
      log.push(`zak:${tok}`)
      return validAccess.has(tok) ? json(200, { token: `zak-${tok}` }) : json(401, { code: 124, message: 'Invalid access token.' })
    }
    if (url.startsWith('https://zoom.us/oauth/revoke')) {
      log.push('revoke')
      return json(200, { status: 'success' })
    }
    throw new Error(`unexpected ${url}`)
  }) as typeof fetch
  return { fetchImpl, log, revokeAccess: (t: string) => validAccess.delete(t), revokeAllRefresh: () => validRefresh.clear() }
}

describe('ربط Zoom وبدء الحصة كمضيف', () => {
  let h: DatabaseHandle
  let admin: Actor
  let student: Actor
  let sessionId = ''
  const zoom = fakeZoom()
  const saved = { id: process.env.ZOOM_SDK_CLIENT_ID, secret: process.env.ZOOM_SDK_CLIENT_SECRET, app: process.env.APP_URL }
  const t0 = new Date('2026-11-22T10:00:00Z')

  beforeAll(async () => {
    process.env.ZOOM_SDK_CLIENT_ID = 'hostClientId'
    process.env.ZOOM_SDK_CLIENT_SECRET = 'hostClientSecret'
    process.env.APP_URL = 'https://madrasadz.com'
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ المضيف')
    student = await makeStudent(h.db, 'تلميذ')
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
    const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج' }).returning()
    const [c] = await h.db.insert(courses).values({ slug: 'dawra-host', title: 'دورة', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 0 }).returning()
    sessionId = (await createLiveSession(h.db, admin, { courseId: c!.id, title: 'حصة المضيف', startsAt: new Date(t0.getTime() + 3600_000), provider: 'ZOOM', joinUrl: 'https://us06web.zoom.us/j/81234567890?pwd=x', meetingPasscode: 'abc123' })).id
  })

  afterAll(async () => {
    for (const [k, v] of [['ZOOM_SDK_CLIENT_ID', saved.id], ['ZOOM_SDK_CLIENT_SECRET', saved.secret], ['APP_URL', saved.app]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await h.close()
  })

  it('رابط الإذن ورابط العودة', () => {
    expect(zoomRedirectUri('https://madrasadz.com/x')).toBe('https://madrasadz.com/api/v1/zoom/callback')
    expect(zoomRedirectUri('http://localhost:3000')).toBe('https://madrasadz.com/api/v1/zoom/callback')
    const u = new URL(zoomAuthorizeUrl({ clientId: 'cid', clientSecret: 's' }, 'st4te', 'https://madrasadz.com/api/v1/zoom/callback'))
    expect(u.origin + u.pathname).toBe('https://zoom.us/oauth/authorize')
    expect(Object.fromEntries(u.searchParams)).toEqual({ response_type: 'code', client_id: 'cid', redirect_uri: 'https://madrasadz.com/api/v1/zoom/callback', state: 'st4te' })
    expect(u.toString()).not.toContain('s=')
  })

  it('قبل الربط: لا بدء من المنصة', async () => {
    expect(await zoomOAuthStatus(h.db)).toMatchObject({ configured: true, connected: false, needsReconnect: false })
    await expect(zoomHostJoin(h.db, admin, sessionId, { now: t0, fetchImpl: zoom.fetchImpl })).rejects.toMatchObject({ code: 'ZOOM_NOT_CONNECTED' })
  })

  it('الربط للمشرف وحده، ورمز خاطئ لا يحفظ شيئًا', async () => {
    await expect(connectZoomWithCode(h.db, student, 'good-code', { fetchImpl: zoom.fetchImpl, now: t0 })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(connectZoomWithCode(h.db, admin, 'bad-code', { fetchImpl: zoom.fetchImpl, now: t0 })).rejects.toMatchObject({ code: 'ZOOM_AUTH_FAILED' })
    expect((await zoomOAuthStatus(h.db)).connected).toBe(false)
  })

  it('الربط يحفظ الرمزين مختومين (لا نصّ صريح في القاعدة)', async () => {
    await connectZoomWithCode(h.db, admin, 'good-code', { fetchImpl: zoom.fetchImpl, now: t0 })
    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, ZOOM_OAUTH_KEY))
    const raw = JSON.stringify(row!.value)
    expect(raw).not.toContain('acc1')
    expect(raw).not.toContain('ref1')
    expect(await zoomOAuthStatus(h.db)).toMatchObject({ connected: true, needsReconnect: false, connectedAt: t0.toISOString() })
  })

  it('بدء الحصة: توقيع المضيف (role=1) ومفتاح ZAK والرمز، للمشرف وحده', async () => {
    await expect(zoomHostJoin(h.db, student, sessionId, { now: t0, fetchImpl: zoom.fetchImpl })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const j = await zoomHostJoin(h.db, admin, sessionId, { now: t0, fetchImpl: zoom.fetchImpl })
    expect(j).toMatchObject({ zak: 'zak-acc1', meetingNumber: '81234567890', passcode: 'abc123', leaveUrl: `/admin/live/${sessionId}`, sdkKey: 'hostClientId' })
    expect(JSON.parse(Buffer.from(j.signature.split('.')[1]!, 'base64url').toString())).toMatchObject({ role: 1, mn: '81234567890' })
    expect(JSON.stringify(j)).not.toContain('hostClientSecret')
  })

  it('رمز الوصول المنتهي يُجدَّد، ورمز التجديد الجديد يحلّ محلّ القديم', async () => {
    const later = new Date(t0.getTime() + 2 * 3600_000)
    expect(await zoomHostZak(h.db, { now: later, fetchImpl: zoom.fetchImpl })).toBe('zak-acc2')
    // تجديد ثانٍ لا ينجح إلا برمز التجديد الجديد (ref2) — القديم ref1 أُبطل
    const later2 = new Date(later.getTime() + 2 * 3600_000)
    expect(await zoomHostZak(h.db, { now: later2, fetchImpl: zoom.fetchImpl })).toBe('zak-acc3')
  })

  it('رمز وصول أُلغي قبل موعده ⇒ تجديد مرة واحدة ثم ZAK', async () => {
    const t = new Date(t0.getTime() + 4 * 3600_000 + 60_000)
    zoom.revokeAccess('acc3')
    expect(await zoomHostZak(h.db, { now: t, fetchImpl: zoom.fetchImpl })).toBe('zak-acc4')
  })

  it('انقطاع الاتصال بـ Zoom: رسالة واضحة ولا يُطلب إعادة الربط', async () => {
    const offline = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    await expect(zoomHostZak(h.db, { now: new Date(t0.getTime() + 9 * 3600_000), fetchImpl: offline })).rejects.toMatchObject({ code: 'ZOOM_UNREACHABLE' })
    expect(await zoomOAuthStatus(h.db)).toMatchObject({ connected: true, needsReconnect: false })
  })

  it('رمز التجديد مرفوض (فُصل التطبيق من Zoom) ⇒ «أعد الربط»', async () => {
    zoom.revokeAllRefresh()
    const t = new Date(t0.getTime() + 10 * 3600_000)
    await expect(zoomHostZak(h.db, { now: t, fetchImpl: zoom.fetchImpl })).rejects.toMatchObject({ code: 'ZOOM_AUTH_FAILED' })
    expect(await zoomOAuthStatus(h.db)).toMatchObject({ connected: false, needsReconnect: true })
  })

  it('الفصل يحذف الرمزين ويلغيهما عند Zoom', async () => {
    await connectZoomWithCode(h.db, admin, 'good-code', { fetchImpl: zoom.fetchImpl, now: t0 })
    expect((await zoomOAuthStatus(h.db)).connected).toBe(true)
    await disconnectZoom(h.db, admin, zoom.fetchImpl)
    expect(await zoomOAuthStatus(h.db)).toMatchObject({ connected: false, needsReconnect: false })
    expect(zoom.log).toContain('revoke')
  })
})
