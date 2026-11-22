/** الحصص داخل المنصة بـ Zoom Meeting SDK (22 نوفمبر 2026) */
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, courses, groups, liveSessions, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { zoomMeetingNumber, zoomSdkConfigured, zoomSdkSignature } from '@/server/lib/zoom-sdk'
import { createLiveSession, getLiveAdmin, joinLiveWeb, updateLiveSession, zoomEmbedJoin } from '@/server/services/live.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

const KEYS = { clientId: 'testClientId123', clientSecret: 'testSecret456' }

describe('رقم الاجتماع من رابط Zoom', () => {
  it('روابط Zoom الشائعة، ومعرّف مكتوب، ولا شيء من غير Zoom', () => {
    expect(zoomMeetingNumber('https://us02web.zoom.us/j/81234567890?pwd=abcDEF.1')).toBe('81234567890')
    expect(zoomMeetingNumber('https://zoom.us/w/912345678?tk=x')).toBe('912345678')
    expect(zoomMeetingNumber('https://app.zoom.us/wc/join/81234567890')).toBe('81234567890')
    expect(zoomMeetingNumber('https://zoom.us/s/81234567890')).toBe('81234567890')
    expect(zoomMeetingNumber('https://us06web.zoom.us/my/prof.haigoune')).toBeNull()
    expect(zoomMeetingNumber('https://evil.example.com/j/81234567890')).toBeNull()
    expect(zoomMeetingNumber('https://zoom.us.evil.com/j/81234567890')).toBeNull()
    expect(zoomMeetingNumber('ليس رابطًا')).toBeNull()
    expect(zoomMeetingNumber(null, '812 3456 7890')).toBe('81234567890')
  })
})

describe('توقيع الدخول (JWT HS256)', () => {
  it('الحقول التي يطلبها Zoom، صالح ساعتين، وموقّع بالسر', () => {
    const now = new Date('2026-11-22T10:00:00Z')
    const jwt = zoomSdkSignature(KEYS, '81234567890', 0, now)
    const [h, p, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(h!, 'base64url').toString())).toEqual({ alg: 'HS256', typ: 'JWT' })
    const payload = JSON.parse(Buffer.from(p!, 'base64url').toString())
    expect(payload).toMatchObject({ appKey: KEYS.clientId, sdkKey: KEYS.clientId, mn: '81234567890', role: 0 })
    expect(payload.exp - payload.iat).toBe(7200)
    expect(payload.tokenExp).toBe(payload.exp)
    expect(payload.iat).toBeLessThanOrEqual(now.getTime() / 1000)
    expect(sig).toBe(createHmac('sha256', KEYS.clientSecret).update(`${h}.${p}`).digest('base64url'))
    expect(JSON.stringify(payload)).not.toContain(KEYS.clientSecret)
  })

  it('المفتاحان من بيئة الخادم، وبدونهما لا دخول من المنصة', () => {
    expect(zoomSdkConfigured({ ZOOM_SDK_CLIENT_ID: 'a', ZOOM_SDK_CLIENT_SECRET: 'b' } as unknown as NodeJS.ProcessEnv)).toBe(true)
    expect(zoomSdkConfigured({ ZOOM_SDK_CLIENT_ID: 'a' } as unknown as NodeJS.ProcessEnv)).toBe(false)
    expect(zoomSdkConfigured({} as unknown as NodeJS.ProcessEnv)).toBe(false)
  })
})

describe('دخول التلميذ داخل المنصة', () => {
  let h: DatabaseHandle
  let admin: Actor
  let student: Actor
  let outsider: Actor
  let sessionId = ''
  let meetSessionId = ''
  const saved = { id: process.env.ZOOM_SDK_CLIENT_ID, secret: process.env.ZOOM_SDK_CLIENT_SECRET }

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ زووم')
    student = await makeStudent(h.db, 'سارة بن علي')
    outsider = await makeStudent(h.db, 'تلميذ آخر')
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
    const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج زووم' }).returning()
    const [c] = await h.db.insert(courses).values({ slug: 'dawra-zoom', title: 'دورة زووم', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 0 }).returning()
    await h.db.insert(courseEnrollments).values({ courseId: c!.id, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 })
    const soon = new Date(Date.now() + 5 * 60_000)
    sessionId = (await createLiveSession(h.db, admin, { courseId: c!.id, title: 'إعراب الجمل', startsAt: soon, provider: 'ZOOM', joinUrl: 'https://us02web.zoom.us/j/81234567890?pwd=enc', meetingPasscode: ' 4Kx9z ' })).id
    meetSessionId = (await createLiveSession(h.db, admin, { courseId: c!.id, title: 'حصة Meet', startsAt: soon, provider: 'MEET', joinUrl: 'https://meet.google.com/abc-defg-hij' })).id
  })

  afterEach(() => {
    process.env.ZOOM_SDK_CLIENT_ID = saved.id
    process.env.ZOOM_SDK_CLIENT_SECRET = saved.secret
    if (saved.id === undefined) delete process.env.ZOOM_SDK_CLIENT_ID
    if (saved.secret === undefined) delete process.env.ZOOM_SDK_CLIENT_SECRET
  })

  afterAll(async () => {
    await h.close()
  })

  const configure = () => {
    process.env.ZOOM_SDK_CLIENT_ID = KEYS.clientId
    process.env.ZOOM_SDK_CLIENT_SECRET = KEYS.clientSecret
  }

  it('الرمز يُحفظ مشفّرًا ولا يظهر في أي عرض', async () => {
    const [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, sessionId))
    expect(row!.meetingPasscodeSealed).toBeTruthy()
    expect(row!.meetingPasscodeSealed).not.toContain('4Kx9z')
    const view = await getLiveAdmin(h.db, admin, sessionId)
    expect(view.hasPasscode).toBe(true)
    expect(JSON.stringify(view)).not.toContain('4Kx9z')
  })

  it('بلا مفتاحَي Zoom: الرابط في التطبيق كما كان، ولا دخول من المنصة', async () => {
    delete process.env.ZOOM_SDK_CLIENT_ID
    delete process.env.ZOOM_SDK_CLIENT_SECRET
    expect((await joinLiveWeb(h.db, student, sessionId)).embedPath).toBeNull()
    await expect(zoomEmbedJoin(h.db, student, sessionId)).rejects.toMatchObject({ code: 'LIVE_EMBED_UNAVAILABLE' })
  })

  it('بالمفتاحين: زرّ «انضمّ» يفتح /live/…، والتوقيع باسم التلميذ ورقم الاجتماع ورمزه', async () => {
    configure()
    expect((await joinLiveWeb(h.db, student, sessionId)).embedPath).toBe(`/live/${sessionId}`)
    const j = await zoomEmbedJoin(h.db, student, sessionId)
    expect(j).toMatchObject({ meetingNumber: '81234567890', passcode: '4Kx9z', userName: 'سارة بن علي', sdkKey: KEYS.clientId, leaveUrl: '/student/courses/dawra-zoom', title: 'إعراب الجمل' })
    expect(j.fallbackUrl).toContain('zoom.us/j/81234567890')
    const payload = JSON.parse(Buffer.from(j.signature.split('.')[1]!, 'base64url').toString())
    expect(payload).toMatchObject({ mn: '81234567890', role: 0 })
    expect(JSON.stringify(j)).not.toContain(KEYS.clientSecret)
  })

  it('غير المشترك، وحصة غير Zoom: لا دخول من المنصة', async () => {
    configure()
    await expect(zoomEmbedJoin(h.db, outsider, sessionId)).rejects.toMatchObject({ code: 'COURSE_NOT_ENROLLED' })
    expect((await joinLiveWeb(h.db, student, meetSessionId)).embedPath).toBeNull()
    await expect(zoomEmbedJoin(h.db, student, meetSessionId)).rejects.toMatchObject({ code: 'LIVE_EMBED_UNAVAILABLE' })
  })

  it('تعديل الحصة دون رمز لا يمحوه، وإفراغه صراحة يمحوه', async () => {
    configure()
    await updateLiveSession(h.db, admin, sessionId, { title: 'إعراب الجمل 2' })
    expect((await zoomEmbedJoin(h.db, student, sessionId)).passcode).toBe('4Kx9z')
    await updateLiveSession(h.db, admin, sessionId, { meetingPasscode: null })
    expect((await zoomEmbedJoin(h.db, student, sessionId)).passcode).toBe('')
  })
})
