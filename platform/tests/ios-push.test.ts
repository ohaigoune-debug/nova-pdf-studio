/**
 * إشعارات المنصة على الآيفون عبر Apple (Build 15، 3 نوفمبر 2026): تسجيل الجهاز، الإرسال، والمرشّح
 * (لا سعر ولا دفع ولا شراء يصل إلى التطبيق).
 */
import { generateKeyPairSync, verify } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { iosPushDevices, notifications } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { apnsPayload, setApnsTransportForTests, type ApnsTransport } from '@/server/lib/apns'
import { b64u } from '@/server/lib/web-push'
import { iosPushAllowed } from '@/server/services/ios-push.service'
import { notify } from '@/server/services/notifications.service'
import { runPushDispatchJob } from '@/server/services/push.service'
import { DELETE as unregisterRoute, POST as registerRoute } from '@/app/api/v1/ios/push/route'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let student: Actor
let cookie: string
const token = 'ab'.repeat(32)
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()

type Sent = Parameters<ApnsTransport>[0]
let sent: Sent[] = []
let reply: { status: number; reason?: string } = { status: 200 }

const req = (method: 'POST' | 'DELETE', body: unknown, ios = true) =>
  new NextRequest('https://madrasadz.com/api/v1/ios/push', { method, headers: { 'content-type': 'application/json', cookie, ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify(body) })

async function dispatch(input: { title: string; body?: string; link?: string }) {
  await notify(h.db, { userId: student.userId, type: 'SYSTEM', ...input })
  const [n] = await h.db.select({ id: notifications.id }).from(notifications).where(eq(notifications.title, input.title))
  return runPushDispatchJob(h.db, { notificationIds: [n!.id] })
}

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  student = await makeStudent(h.db, 'أمينة')
  cookie = `${SESSION_COOKIE}=${(await createSession(h.db, { userId: student.userId })).token}`
  process.env.APNS_KEY_ID = 'ABC123DEFG'
  process.env.APNS_TEAM_ID = 'TEAM123456'
  process.env.APNS_PRIVATE_KEY = pem.replace(/\n/g, '\\n')
  setApnsTransportForTests(async (r) => {
    sent.push(r)
    return reply
  })
})
afterEach(() => {
  sent = []
  reply = { status: 200 }
})
afterAll(async () => {
  setApnsTransportForTests(null)
  delete process.env.APNS_KEY_ID
  delete process.env.APNS_TEAM_ID
  delete process.env.APNS_PRIVATE_KEY
  await h?.close()
})

describe('تسجيل جهاز الآيفون', () => {
  it('يتطلّب ترويسة التطبيق والدخول ورمزًا صحيحًا', async () => {
    expect((await registerRoute(req('POST', { token }, false))).status).toBe(403)
    expect((await registerRoute(req('POST', { token: 'xyz' }))).status).toBe(422)
    const res = await registerRoute(req('POST', { token: token.toUpperCase(), environment: 'production' }))
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ registered: true, active: true })
    const rows = await h.db.select().from(iosPushDevices).where(eq(iosPushDevices.userId, student.userId))
    expect(rows.map((r) => r.token)).toEqual([token])
  })
})

describe('الإرسال عبر Apple', () => {
  it('ردّ الدعم يصل إلى الجهاز بتوقيع صحيح ورابط الشاشة', async () => {
    const r = await dispatch({ title: 'ردّ على تذكرتك #7', body: 'الكتاب عند شركة التوصيل', link: '/student/support/abc' })
    expect(r).toMatchObject({ ios: { sent: 1, removed: 0, failed: 0, skipped: 0 } })
    expect(sent).toHaveLength(1)
    const s = sent[0]!
    expect(s.host).toBe('api.push.apple.com')
    expect(s.path).toBe(`/3/device/${token}`)
    expect(s.headers['apns-topic']).toBe('com.madrasadz.student')
    expect(s.headers['apns-push-type']).toBe('alert')
    const jwt = s.headers.authorization!.replace('bearer ', '')
    const [hd, cl, sig] = jwt.split('.')
    expect(JSON.parse(Buffer.from(b64u.decode(hd!)).toString())).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' })
    expect(JSON.parse(Buffer.from(b64u.decode(cl!)).toString()).iss).toBe('TEAM123456')
    expect(verify('sha256', Buffer.from(`${hd}.${cl}`), { key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(b64u.decode(sig!)))).toBe(true)
    const body = JSON.parse(s.body)
    expect(body).toMatchObject({ aps: { alert: { title: 'ردّ على تذكرتك #7', body: 'الكتاب عند شركة التوصيل' }, sound: 'default', 'thread-id': 'SYSTEM' }, link: '/student/support/abc' })
  })

  it('إشعار فيه سعر أو دفع لا يُرسل إلى الآيفون (ويبقى في الموقع)', async () => {
    const r = await dispatch({ title: 'عرض خاص على الدورات', body: 'الدورة بـ 2000 دج فقط' })
    expect(r).toMatchObject({ ios: { sent: 0, skipped: 1 } })
    expect(sent).toHaveLength(0)
  })

  it('الرمز الملغى (410) يُحذف', async () => {
    reply = { status: 410, reason: 'Unregistered' }
    const r = await dispatch({ title: 'تذكير: حصة الرياضيات بعد ساعة' })
    expect(r).toMatchObject({ ios: { removed: 1 } })
    expect(await h.db.select().from(iosPushDevices)).toEqual([])
  })

  it('الخروج يحذف الجهاز', async () => {
    await registerRoute(req('POST', { token }))
    const res = await unregisterRoute(req('DELETE', { token }))
    expect((await res.json()).data).toEqual({ removed: true })
    expect(await h.db.select().from(iosPushDevices)).toEqual([])
  })
})

describe('مرشّح الإشعارات', () => {
  it('يحجب السعر والدفع والشراء ولوحات الإدارة فقط', () => {
    for (const ok of ['دفعة البكالوريا 2027: جدول المراجعة', 'اشترك في حصة المراجعة المباشرة', 'نتيجة فرضك: 15/20', 'عرض الحلول متاح الآن']) expect(iosPushAllowed({ title: ok }), ok).toBe(true)
    for (const bad of ['ادفع الآن', 'الدفع عند الاستلام', 'بالدفع الإلكتروني', 'اشترِ الدورة', 'خصم 20% اليوم', 'السعر الجديد', '1500 DZD', 'تخفيضات نهاية الأسبوع']) expect(iosPushAllowed({ title: bad }), bad).toBe(false)
    expect(iosPushAllowed({ title: 'تذكرة جديدة', link: '/admin/support/1' })).toBe(false)
    expect(apnsPayload({ title: 'x'.repeat(500), body: 'y'.repeat(2000) }).length).toBeLessThan(4096)
  })
})
