/**
 * الحصص المباشرة داخل المنصة عبر Zoom Meeting SDK (16 نوفمبر 2026): التوقيع، ختم الرمز، مسار الانضمام،
 * صفحة الحصة المستقلة وسياستها الأمنية.
 */
import { createHmac } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import nextConfig from '../next.config'
import { buildLiveRoomCsp, isLiveRoomPath, LIVE_ROOM_PERMISSIONS_POLICY, liveRoomPath } from '@/lib/live-room'
import { middleware } from '@/middleware'
import type { DatabaseHandle } from '@/server/db/connect'
import { appSettings, auditLogs, courseEnrollments, courses, groups, liveSessions, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { LIVE_ROOM_BOOT_JS, renderLiveRoomError, renderLiveRoomHtml } from '@/server/lib/live-room-html'
import { seal, unseal } from '@/server/lib/secret-box'
import {
  clearZoomSdkCredentials,
  getZoomSdkCredentials,
  getZoomSdkView,
  isPlainPasscode,
  meetingSdkSignature,
  normalizeMeetingNumber,
  saveZoomSdkCredentials,
  ZOOM_SDK_VERSION,
  ZOOM_SETTINGS_KEY,
  zoomMeetingFromUrl
} from '@/server/lib/zoom'
import {
  createLiveSession,
  getLiveAdmin,
  inPlatformZoomTarget,
  joinInfo,
  packJoinSecret,
  unpackJoinSecret,
  updateLiveSession,
  zoomRoomConfig
} from '@/server/services/live.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

const CREDS = { sdkKey: 'AbCdEfGhIj0123456789', sdkSecret: 'S3cr3tS3cr3tS3cr3tS3cr3tS3cr3t99' }
const UUID = '0b6f5c1e-3c1a-4b8f-9e0a-1f2d3c4b5a69'

function decodeJwt(token: string) {
  const [h, p, sig] = token.split('.')
  const json = (s: string) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
  return { header: json(h!), payload: json(p!), sig: sig!, signingInput: `${h}.${p}` }
}

function hmac(secret: string, input: string) {
  return createHmac('sha256', secret).update(input).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

async function expectCode(fn: () => Promise<unknown>, code: string) {
  await expect(fn()).rejects.toSatisfy((e) => e instanceof AppError && e.code === code)
}

describe('Zoom: التوقيع ورقم الاجتماع والرمز (دوال نقية)', () => {
  it('توقيع SDK: HS256 بالسرّ، دور مشارك، رقم الاجتماع، iat متأخر 30 ثانية، وصلاحية محصورة بين نصف ساعة و48 ساعة', () => {
    const now = Date.UTC(2026, 10, 23, 15, 0, 0)
    const t = meetingSdkSignature(CREDS, '845 1234 5678', { nowMs: now, ttlSeconds: 3 * 3600 })
    const { header, payload, sig, signingInput } = decodeJwt(t)
    expect(header).toEqual({ alg: 'HS256', typ: 'JWT' })
    expect(sig).toBe(hmac(CREDS.sdkSecret, signingInput))
    expect(payload).toMatchObject({ appKey: CREDS.sdkKey, sdkKey: CREDS.sdkKey, mn: 84512345678, role: 0 })
    expect(payload.iat).toBe(now / 1000 - 30)
    expect(payload.exp - payload.iat).toBe(3 * 3600)
    expect(payload.tokenExp).toBe(payload.exp)
    // السرّ لا يظهر في التوقيع
    expect(t).not.toContain(CREDS.sdkSecret)
    const short = decodeJwt(meetingSdkSignature(CREDS, '84512345678', { nowMs: now, ttlSeconds: 10 })).payload
    expect(short.exp - short.iat).toBe(30 * 60)
    const long = decodeJwt(meetingSdkSignature(CREDS, '84512345678', { nowMs: now, ttlSeconds: 999 * 3600 })).payload
    expect(long.exp - long.iat).toBe(48 * 3600)
    expect(() => meetingSdkSignature(CREDS, '12ab')).toThrow(AppError)
  })

  it('رقم الاجتماع يُقبل بالمسافات والشرطات والأرقام العربية، ويُرفض غير ذلك', () => {
    expect(normalizeMeetingNumber('845 1234 5678')).toBe('84512345678')
    expect(normalizeMeetingNumber('845-1234-5678')).toBe('84512345678')
    expect(normalizeMeetingNumber('٨٤٥١٢٣٤٥٦٧٨')).toBe('84512345678')
    expect(normalizeMeetingNumber('123456789')).toBe('123456789')
    expect(normalizeMeetingNumber('12345678')).toBeNull()
    expect(normalizeMeetingNumber('abc')).toBeNull()
    expect(normalizeMeetingNumber(null)).toBeNull()
  })

  it('الرمز الصريح حتى 10 خانات؛ pwd المشفّر في رابط الدعوة ليس رمزًا صريحًا', () => {
    expect(isPlainPasscode('a1B2c3')).toBe(true)
    expect(isPlainPasscode('123@_-*')).toBe(true)
    expect(isPlainPasscode('UjJQTENnamVFMEpQN2tVUHRHZmY4Zz09')).toBe(false)
    expect(isPlainPasscode('abc.1')).toBe(false)
    expect(isPlainPasscode('')).toBe(false)
    expect(zoomMeetingFromUrl('https://us05web.zoom.us/j/84512345678?pwd=abc')).toEqual({ meetingNumber: '84512345678', pwd: 'abc' })
    expect(zoomMeetingFromUrl('https://zoom.us/wc/join/123456789')).toEqual({ meetingNumber: '123456789', pwd: null })
    expect(zoomMeetingFromUrl('https://evil.example/j/84512345678?pwd=abc')).toEqual({ meetingNumber: null, pwd: null })
    expect(zoomMeetingFromUrl('not a url')).toEqual({ meetingNumber: null, pwd: null })
  })

  it('ما يُختم: بلا رمز يبقى الرابط الصريح نفسه (الصيغة القديمة)، ومع الرمز JSON مختوم', () => {
    process.env.SESSION_SECRET ??= 'test-session-secret'
    const legacy = packJoinSecret({ url: 'https://zoom.us/j/123456789', passcode: null })!
    expect(unseal(legacy, 'live')).toBe('https://zoom.us/j/123456789')
    expect(unpackJoinSecret(legacy)).toEqual({ url: 'https://zoom.us/j/123456789', passcode: null })
    const v2 = packJoinSecret({ url: null, passcode: 'k9X2' })!
    expect(v2).not.toContain('k9X2')
    expect(unpackJoinSecret(v2)).toEqual({ url: null, passcode: 'k9X2' })
    expect(packJoinSecret({ url: null, passcode: null })).toBeNull()
    expect(unpackJoinSecret(null)).toEqual({ url: null, passcode: null })
    expect(unpackJoinSecret(seal('{broken', 'live'))).toEqual({ url: null, passcode: null })
  })
})

describe('صفحة الحصة: HTML مستقل وسياسة أمنية خاصة', () => {
  const cfg = {
    sessionId: UUID,
    title: 'مراجعة </script><img src=x onerror=alert(1)>',
    courseTitle: 'دورة "البكالوريا"',
    coursePath: '/student/courses/bac-ar',
    sdkVersion: ZOOM_SDK_VERSION,
    cdn: 'https://source.zoom.us',
    lang: 'fr-FR',
    signature: 'a.b.c',
    meetingNumber: '84512345678',
    passcode: 'k9X2',
    userName: 'تلميذ </script>'
  }

  it('يحمّل مكتبة Zoom بالنسخة المثبّتة، ويضع الإعداد في وسم JSON آمن لا يُغلق السكربت', () => {
    const html = renderLiveRoomHtml(cfg)
    expect(html).toContain(`https://source.zoom.us/zoom-meeting-${ZOOM_SDK_VERSION}.min.js`)
    expect(html).toContain(`https://source.zoom.us/${ZOOM_SDK_VERSION}/lib/vendor/react.min.js`)
    expect(html).toContain('<html lang="ar" dir="rtl">')
    // لا وسم مُدرج من العنوان أو الاسم
    expect(html).not.toContain('<img src=x')
    expect(html.match(/<\/script>/g)!.length).toBe(html.match(/<script/g)!.length)
    const json = /<script type="application\/json" id="mdz-cfg">([^<]*)<\/script>/.exec(html)![1]!
    expect(JSON.parse(json)).toMatchObject({ meetingNumber: '84512345678', passcode: 'k9X2', signature: 'a.b.c', userName: 'تلميذ </script>' })
  })

  it('الشيفرة المضمّنة لا تعرض رقم الاجتماع ولا الرمز ولا الدعوة، والمغادرة تعود إلى الدورة', () => {
    expect(LIVE_ROOM_BOOT_JS).toContain("meetingInfo: ['topic', 'host']")
    expect(LIVE_ROOM_BOOT_JS).toContain('disableInvite: true')
    expect(LIVE_ROOM_BOOT_JS).toContain('disableRecord: true')
    expect(LIVE_ROOM_BOOT_JS).toContain('passWord: cfg.passcode')
    expect(LIVE_ROOM_BOOT_JS).not.toMatch(/sdkSecret|appSecret/)
    expect(LIVE_ROOM_BOOT_JS).toContain('new URL(cfg.coursePath, location.origin)')
  })

  it('صفحة الخطأ عربية ومهرَّبة', () => {
    expect(renderLiveRoomError('COURSE_NOT_ENROLLED')).toContain('لمشتركي الدورة فقط')
    expect(renderLiveRoomError('X', '/student"><script>')).not.toContain('"><script>')
  })

  it('CSP خاصة بمسار الحصة وحده: Zoom وWebAssembly وwss، ولا إطار للصفحة داخل مواقع أخرى', () => {
    const csp = buildLiveRoomCsp()
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).toContain('wss://*.zoom.us')
    expect(csp).toContain("worker-src 'self' blob:")
    expect(csp).toContain("frame-ancestors 'none'")
    expect(csp).not.toContain('nonce-')
    expect(isLiveRoomPath(liveRoomPath(UUID))).toBe(true)
    expect(isLiveRoomPath(`/student/live/${UUID}/x`)).toBe(false)
    expect(isLiveRoomPath('/student/live/abc')).toBe(false)
  })

  it('الوسيط يعطي صفحة الحصة سياستها، وبقية الصفحات تبقى بالـnonce الصارم', () => {
    const req = (path: string) => new NextRequest(`https://madrasadz.com${path}`, { headers: { cookie: 'madrasa_session=s' } })
    expect(middleware(req(liveRoomPath(UUID))).headers.get('content-security-policy')).toBe(buildLiveRoomCsp())
    const other = middleware(req('/student')).headers.get('content-security-policy')!
    expect(other).toContain("'nonce-")
    expect(other).not.toContain('zoom.us')
    expect(other).toContain("'strict-dynamic'")
    // بلا جلسة: إلى الدخول ثم العودة إلى الحصة
    const anon = middleware(new NextRequest(`https://madrasadz.com${liveRoomPath(UUID)}`))
    expect(anon.headers.get('location')).toContain('/login')
  })

  it('الميكروفون مسموح في صفحة الحصة وحدها (next.config يطابق src/lib/live-room)', async () => {
    const rules = await nextConfig.headers!()
    const general = rules.find((r) => r.source === '/(.*)')!.headers.find((h) => h.key === 'Permissions-Policy')!.value
    expect(general).toContain('microphone=()')
    const idxGeneral = rules.findIndex((r) => r.source === '/(.*)')
    const idxLive = rules.findIndex((r) => r.source === '/student/live/:id')
    expect(idxLive).toBeGreaterThan(idxGeneral)
    expect(rules[idxLive]!.headers.find((h) => h.key === 'Permissions-Policy')!.value).toBe(LIVE_ROOM_PERMISSIONS_POLICY)
  })
})

describe('الحصة داخل المنصة: الإعداد والانضمام', () => {
  let h: DatabaseHandle
  let admin: Actor
  let student: Actor
  let outsider: Actor
  let courseId: string

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= 'test-session-secret'
    h = await setupDb()
    admin = await makeAdmin(h.db)
    const teacher = await makeTeacher(h.db, admin, 'أستاذ Zoom')
    student = await makeStudent(h.db, 'تلميذة الحصة')
    outsider = await makeStudent(h.db, 'تلميذ خارجي')
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
    const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج Zoom' }).returning()
    const [c] = await h.db
      .insert(courses)
      .values({ slug: 'bac-arabic-zoom', title: 'دورة Zoom', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 5900 })
      .returning()
    courseId = c!.id
    await h.db.insert(courseEnrollments).values({ courseId, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 })
  })

  afterAll(async () => {
    await h.close()
  })

  async function joinAudits(sessionId: string) {
    return h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'live.join'), eq(auditLogs.entityId, sessionId)))
  }

  it('اعتمادات SDK تُحفظ مختومة، ولا يُعرض منها إلا آخر 4 أحرف؛ وتُرفض القيم الغريبة', async () => {
    await expectCode(() => saveZoomSdkCredentials(h.db, { sdkKey: 'short', sdkSecret: CREDS.sdkSecret }), 'VALIDATION')
    await expectCode(() => saveZoomSdkCredentials(h.db, { sdkKey: CREDS.sdkKey, sdkSecret: 'bad secret with spaces!!' }), 'VALIDATION')
    await saveZoomSdkCredentials(h.db, CREDS)
    const [row] = await h.db.select().from(appSettings).where(eq(appSettings.key, ZOOM_SETTINGS_KEY))
    expect(JSON.stringify(row!.value)).not.toContain(CREDS.sdkSecret)
    expect(JSON.stringify(row!.value)).not.toContain(CREDS.sdkKey)
    expect(await getZoomSdkCredentials(h.db)).toEqual(CREDS)
    expect(await getZoomSdkView(h.db)).toMatchObject({ sdkKeyHint: '6789', secretHint: '3t99', usable: true })
    await clearZoomSdkCredentials(h.db)
    expect(await getZoomSdkCredentials(h.db)).toBeNull()
  })

  it('حصة برقم اجتماع ورمز ودون رابط: يُبنى رابط احتياطي، ولا يظهر الرمز صريحًا في القاعدة', async () => {
    await expectCode(() => createLiveSession(h.db, admin, { courseId, title: 'رمز خاطئ', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', providerMeetingId: '845 1234 5678', passcode: 'UjJQTENnamVFMEpQN2tVUHRHZmY4Zz09' }), 'VALIDATION')
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة داخل المنصة', startsAt: new Date(Date.now() + 5 * 60_000), durationMinutes: 60, provider: 'ZOOM', providerMeetingId: '845 1234 5678', passcode: 'k9X2' })
    const [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(row!.providerMeetingId).toBe('84512345678')
    expect(JSON.stringify(row)).not.toContain('k9X2')
    expect(unpackJoinSecret(row!.joinUrlSealed)).toEqual({ url: 'https://zoom.us/j/84512345678?pwd=k9X2', passcode: 'k9X2' })
    expect(inPlatformZoomTarget(row!)).toEqual({ meetingNumber: '84512345678', passcode: 'k9X2' })
    const adminView = await getLiveAdmin(h.db, admin, s.id)
    expect(adminView).toMatchObject({ passcode: 'k9X2', inPlatform: true, hasJoinUrl: true })
  })

  it('بلا اعتمادات SDK: الرابط الخارجي كما كان ويُسجَّل الحضور؛ ومعها: صفحة الحصة داخل المنصة دون تسجيل مسبق', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة الانضمام', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', providerMeetingId: '84512345679', passcode: 'pass1' })
    const ext = await joinInfo(h.db, student, s.id)
    expect(ext).toMatchObject({ inPlatform: false, url: 'https://zoom.us/j/84512345679?pwd=pass1' })
    expect(await joinAudits(s.id)).toHaveLength(1)

    await saveZoomSdkCredentials(h.db, CREDS)
    const inside = await joinInfo(h.db, student, s.id)
    expect(inside).toMatchObject({ inPlatform: true, url: liveRoomPath(s.id) })
    expect(inside.url).not.toContain('pass1')
    // الحضور يُسجَّل حين تُفتح الصفحة فعلًا، لا عند طلب الرابط
    expect(await joinAudits(s.id)).toHaveLength(1)

    const cfg = await zoomRoomConfig(h.db, student, s.id)
    expect(cfg).toMatchObject({ meetingNumber: '84512345679', passcode: 'pass1', userName: 'تلميذة الحصة', coursePath: '/student/courses/bac-arabic-zoom', sdkVersion: ZOOM_SDK_VERSION, courseTitle: 'دورة Zoom' })
    const { payload, sig, signingInput } = decodeJwt(cfg.signature)
    expect(sig).toBe(hmac(CREDS.sdkSecret, signingInput))
    expect(payload).toMatchObject({ mn: 84512345679, role: 0, sdkKey: CREDS.sdkKey })
    // التوقيع صالح حتى ما بعد نهاية النافذة
    expect(payload.exp * 1000).toBeGreaterThan(s.startsAt.getTime() + 90 * 60_000)
    const audits = await joinAudits(s.id)
    expect(audits).toHaveLength(2)
    expect(audits.some((a) => (a.newValue as { via?: string }).via === 'zoom-sdk')).toBe(true)
    await clearZoomSdkCredentials(h.db)
  })

  it('صفحة الحصة لا تُفتح لغير المشترك ولا خارج النافذة ولا لحصة بلا رمز صريح', async () => {
    await saveZoomSdkCredentials(h.db, CREDS)
    const s = await createLiveSession(h.db, admin, { courseId, title: 'حصة محمية', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', providerMeetingId: '84512345670', passcode: 'abc123' })
    await expectCode(() => zoomRoomConfig(h.db, outsider, s.id), 'COURSE_NOT_ENROLLED')
    const later = await createLiveSession(h.db, admin, { courseId, title: 'حصة لاحقة', startsAt: new Date(Date.now() + 5 * 3600_000), provider: 'ZOOM', providerMeetingId: '84512345671', passcode: 'abc123' })
    await expectCode(() => zoomRoomConfig(h.db, student, later.id), 'LIVE_NOT_OPEN')
    // رابط دعوة بـpwd مشفّر وحده: لا دخول من المنصة، بل الرابط الخارجي
    const encrypted = await createLiveSession(h.db, admin, { courseId, title: 'رابط مشفّر', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', joinUrl: 'https://us05web.zoom.us/j/84512345672?pwd=UjJQTENnamVFMEpQN2tVUHRHZmY4Zz09' })
    await expectCode(() => zoomRoomConfig(h.db, student, encrypted.id), 'LIVE_NOT_OPEN')
    expect(await joinInfo(h.db, student, encrypted.id)).toMatchObject({ inPlatform: false })
    // Google Meet لا يدخل المنصة مهما كان
    const meet = await createLiveSession(h.db, admin, { courseId, title: 'Meet', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'MEET', joinUrl: 'https://meet.google.com/abc-defg-hij', passcode: 'abc' })
    expect(await joinInfo(h.db, student, meet.id)).toMatchObject({ inPlatform: false, url: 'https://meet.google.com/abc-defg-hij' })
    await clearZoomSdkCredentials(h.db)
  })

  it('التعديل: تغيير الرمز يعيد بناء الرابط الاحتياطي، والرابط اليدوي يبقى، وتفريغ الرمز يزيله', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'تعديل', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', providerMeetingId: '84512345673', passcode: 'old1' })
    await updateLiveSession(h.db, admin, s.id, { passcode: 'new2' })
    let [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(unpackJoinSecret(row!.joinUrlSealed)).toEqual({ url: 'https://zoom.us/j/84512345673?pwd=new2', passcode: 'new2' })

    await updateLiveSession(h.db, admin, s.id, { joinUrl: 'https://us05web.zoom.us/j/84512345673?pwd=ENCRYPTEDvalue123456' })
    ;[row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(unpackJoinSecret(row!.joinUrlSealed)).toEqual({ url: 'https://us05web.zoom.us/j/84512345673?pwd=ENCRYPTEDvalue123456', passcode: 'new2' })
    expect(inPlatformZoomTarget(row!)).toEqual({ meetingNumber: '84512345673', passcode: 'new2' })

    // تغيير الرمز لا يمسّ رابطًا أدخله المشرف بيده
    await updateLiveSession(h.db, admin, s.id, { passcode: 'third3' })
    ;[row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(unpackJoinSecret(row!.joinUrlSealed).url).toBe('https://us05web.zoom.us/j/84512345673?pwd=ENCRYPTEDvalue123456')

    await updateLiveSession(h.db, admin, s.id, { passcode: null })
    ;[row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(unpackJoinSecret(row!.joinUrlSealed)).toEqual({ url: 'https://us05web.zoom.us/j/84512345673?pwd=ENCRYPTEDvalue123456', passcode: null })
    // الصيغة القديمة نفسها حين لا رمز
    expect(unseal(row!.joinUrlSealed!, 'live')).toBe('https://us05web.zoom.us/j/84512345673?pwd=ENCRYPTEDvalue123456')
    expect(inPlatformZoomTarget(row!)).toBeNull()

    const audits = await h.db.select().from(auditLogs).where(and(eq(auditLogs.action, 'live.update'), eq(auditLogs.entityId, s.id)))
    expect(JSON.stringify(audits.map((a) => a.newValue))).not.toMatch(/old1|new2|third3/)
  })

  it('رابط احتياطي بُني من الرمز: يُزال مع الرمز ولا يبقى بالرمز القديم', async () => {
    const s = await createLiveSession(h.db, admin, { courseId, title: 'إزالة', startsAt: new Date(Date.now() + 5 * 60_000), provider: 'ZOOM', providerMeetingId: '84512345674', passcode: 'gone1' })
    await updateLiveSession(h.db, admin, s.id, { passcode: null })
    const [row] = await h.db.select().from(liveSessions).where(eq(liveSessions.id, s.id))
    expect(row!.joinUrlSealed).toBeNull()
  })
})
