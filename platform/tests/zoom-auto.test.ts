/** اجتماعات Zoom تُنشئها المنصة نفسها (22 نوفمبر 2026) — Zoom وهمي */
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courses, groups, liveSessions, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createLiveSession, getLiveAdmin, setLiveStatus, updateLiveSession, zoomEmbedJoin } from '@/server/services/live.service'
import { connectZoomWithCode, disconnectZoom, zoomOAuthStatus } from '@/server/services/zoom-oauth.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

interface Call {
  method: string
  url: string
  body: Record<string, unknown> | null
}

function fakeZoom(scope: string) {
  const calls: Call[] = []
  const state = { scope, createStatus: 201, nextId: 81234567890 }
  const json = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    if (url === 'https://zoom.us/oauth/token') return json(200, { access_token: 'acc', refresh_token: 'ref', expires_in: 3600, scope: state.scope })
    if (url.startsWith('https://zoom.us/oauth/revoke')) return json(200, {})
    calls.push({ method, url, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null })
    const hasCreate = state.scope.split(' ').includes('meeting:write:meeting')
    if (url === 'https://api.zoom.us/v2/users/me/meetings' && method === 'POST') {
      if (!hasCreate) return json(400, { code: 4711, message: 'Invalid access token, does not contain scopes:[meeting:write:meeting].' })
      if (state.createStatus !== 201) return json(state.createStatus, { message: 'boom' })
      const id = state.nextId++
      return json(201, { id, join_url: `https://us06web.zoom.us/j/${id}?pwd=enc`, password: 'Zx81q', start_url: 'https://zoom.us/s/secret-start' })
    }
    if (url.startsWith('https://api.zoom.us/v2/meetings/') && (method === 'PATCH' || method === 'DELETE')) return json(204)
    throw new Error(`unexpected ${method} ${url}`)
  }) as typeof fetch
  return { fetchImpl, calls, state }
}

describe('إنشاء اجتماع Zoom من المنصة', () => {
  let h: DatabaseHandle
  let admin: Actor
  let student: Actor
  let courseId = ''
  const zoom = fakeZoom('user:read:zak meeting:write:meeting meeting:update:meeting meeting:delete:meeting')
  const opts = { fetchImpl: zoom.fetchImpl }
  const saved = { id: process.env.ZOOM_SDK_CLIENT_ID, secret: process.env.ZOOM_SDK_CLIENT_SECRET }
  const soon = () => new Date(Date.now() + 5 * 60_000)

  beforeAll(async () => {
    process.env.ZOOM_SDK_CLIENT_ID = 'autoClientId'
    process.env.ZOOM_SDK_CLIENT_SECRET = 'autoClientSecret'
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ')
    student = await makeStudent(h.db, 'سارة')
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
    const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج' }).returning()
    const [c] = await h.db.insert(courses).values({ slug: 'dawra-auto', title: 'دورة الفصل الأوّل', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 0 }).returning()
    courseId = c!.id
    const { courseEnrollments } = await import('@/server/db/schema')
    await h.db.insert(courseEnrollments).values({ courseId, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 })
  })

  beforeEach(() => {
    zoom.calls.length = 0
  })

  afterAll(async () => {
    for (const [k, v] of [['ZOOM_SDK_CLIENT_ID', saved.id], ['ZOOM_SDK_CLIENT_SECRET', saved.secret]] as const) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
    await h.close()
  })

  it('بلا صلاحية الاجتماعات: لا إنشاء، ورسالة «أضف الصلاحيات ثم أعد الربط»، ولا حصة', async () => {
    zoom.state.scope = 'user:read:zak'
    await connectZoomWithCode(h.db, admin, 'code', opts)
    expect((await zoomOAuthStatus(h.db)).canCreateMeetings).toBe(false)
    await expect(createLiveSession(h.db, admin, { courseId, title: 'حصة', startsAt: soon(), provider: 'ZOOM', autoZoom: true }, opts)).rejects.toMatchObject({ code: 'ZOOM_SCOPE_MISSING' })
    expect(await h.db.select().from(liveSessions)).toHaveLength(0)
    await disconnectZoom(h.db, admin, zoom.fetchImpl)
  })

  it('بالصلاحيات: الحصة تُنشئ اجتماعها (الرابط ورقمه ورمزه)، والتلميذ يدخل به', async () => {
    zoom.state.scope = 'user:read:zak meeting:write:meeting meeting:update:meeting meeting:delete:meeting'
    await connectZoomWithCode(h.db, admin, 'code', opts)
    expect((await zoomOAuthStatus(h.db)).canCreateMeetings).toBe(true)
    const startsAt = new Date('2030-01-15T17:00:00.000Z')
    const s = await createLiveSession(h.db, admin, { courseId, title: 'إعراب الجمل', startsAt, durationMinutes: 90, provider: 'ZOOM', autoZoom: true }, opts)
    expect(zoom.calls).toHaveLength(1)
    expect(zoom.calls[0]!.body).toMatchObject({ topic: 'دورة الفصل الأوّل — إعراب الجمل', type: 2, start_time: '2030-01-15T17:00:00Z', duration: 90, timezone: 'Africa/Algiers', settings: { join_before_host: false, participant_video: false, mute_upon_entry: true } })
    expect(s).toMatchObject({ zoomAuto: true, providerMeetingId: '81234567890', hasJoinUrl: true, hasPasscode: true })
    const admin1 = await getLiveAdmin(h.db, admin, s.id)
    expect(admin1.joinUrl).toBe('https://us06web.zoom.us/j/81234567890?pwd=enc')
    expect(JSON.stringify(admin1)).not.toContain('secret-start')
    const live = await createLiveSession(h.db, admin, { courseId, title: 'حصة الآن', startsAt: soon(), provider: 'ZOOM', autoZoom: true }, opts)
    const j = await zoomEmbedJoin(h.db, student, live.id)
    expect(j).toMatchObject({ meetingNumber: '81234567891', passcode: 'Zx81q' })
  })

  it('تعديل العنوان أو الموعد يُحدَّث في Zoom، وتعديل الوصف وحده لا', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'أ', startsAt: new Date('2030-02-01T17:00:00Z'), provider: 'ZOOM', autoZoom: true }, opts)
    zoom.calls.length = 0
    await updateLiveSession(h.db, admin, s.id, { description: 'وصف فقط' }, opts)
    expect(zoom.calls).toHaveLength(0)
    await updateLiveSession(h.db, admin, s.id, { title: 'ب', startsAt: new Date('2030-02-01T18:30:00Z') }, opts)
    expect(zoom.calls).toHaveLength(1)
    expect(zoom.calls[0]).toMatchObject({ method: 'PATCH', url: `https://api.zoom.us/v2/meetings/${s.providerMeetingId}`, body: { topic: 'دورة الفصل الأوّل — ب', start_time: '2030-02-01T18:30:00Z' } })
  })

  it('إلغاء الحصة يحذف اجتماعها من Zoom (مرة واحدة)', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'ستُلغى', startsAt: new Date('2030-03-01T17:00:00Z'), provider: 'ZOOM', autoZoom: true }, opts)
    zoom.calls.length = 0
    await setLiveStatus(h.db, admin, s.id, 'CANCELLED', opts)
    await setLiveStatus(h.db, admin, s.id, 'CANCELLED', opts)
    expect(zoom.calls).toEqual([{ method: 'DELETE', url: `https://api.zoom.us/v2/meetings/${s.providerMeetingId}`, body: null }])
  })

  it('رابط ملصوق يدويًا: لا اتصال بـ Zoom، واستبدال رابط اجتماع المنصة يرفع إدارتها عنه', async () => {
    const manual = await createLiveSession(h.db, admin, { courseId, title: 'يدوي', startsAt: soon(), provider: 'ZOOM', autoZoom: true, joinUrl: 'https://zoom.us/j/99887766554' }, opts)
    expect(zoom.calls).toHaveLength(0)
    expect(manual.zoomAuto).toBe(false)
    const s = await createLiveSession(h.db, admin, { courseId, title: 'تلقائي', startsAt: new Date('2030-04-01T17:00:00Z'), provider: 'ZOOM', autoZoom: true }, opts)
    const after = await updateLiveSession(h.db, admin, s.id, { joinUrl: 'https://zoom.us/j/11223344556' }, opts)
    expect(after.zoomAuto).toBe(false)
  })

  it('رفض Zoom للإنشاء: رسالة واضحة ولا حصة نصف منشأة', async () => {
    const before = (await h.db.select().from(liveSessions)).length
    zoom.state.createStatus = 500
    await expect(createLiveSession(h.db, admin, { courseId, title: 'فشل', startsAt: soon(), provider: 'ZOOM', autoZoom: true }, opts)).rejects.toMatchObject({ code: 'ZOOM_MEETING_FAILED' })
    zoom.state.createStatus = 201
    expect(await h.db.select().from(liveSessions)).toHaveLength(before)
  })
})
