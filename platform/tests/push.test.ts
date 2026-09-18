import { createDecipheriv, createECDH, createPublicKey, hkdfSync, verify } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { jobs, pushSubscriptions } from '@/server/db/schema'
import { processQueuedJobs } from '@/server/jobs/runner'
import type { Actor } from '@/server/lib/actor'
import { AppError } from '@/server/lib/errors'
import { b64u, encryptPayload, generateVapidKeys, sendWebPush, setPushTransportForTests, vapidJwt } from '@/server/lib/web-push'
import { notify } from '@/server/services/notifications.service'
import { listPushSubscriptions, removePushSubscription, savePushSubscription, sendPushToUser } from '@/server/services/push.service'
import { makeAdmin, makeStudent, setupDb } from './helpers'

/** فكّ تشفير جانب المتصفح (RFC 8291) — للاختبار فقط */
function decryptPayload(body: Buffer, uaPrivate: Buffer, authSecret: Buffer): Buffer {
  const salt = body.subarray(0, 16)
  const idlen = body[20]!
  const asPublic = body.subarray(21, 21 + idlen)
  const ciphertext = body.subarray(21 + idlen)
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(uaPrivate)
  const uaPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(asPublic)
  const ikm = Buffer.from(hkdfSync('sha256', shared, authSecret, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]), 32))
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12))
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(ciphertext.subarray(ciphertext.length - 16))
  const plain = Buffer.concat([d.update(ciphertext.subarray(0, ciphertext.length - 16)), d.final()])
  return plain.subarray(0, plain.length - 1) // إزالة فاصل الحشو 0x02
}

describe('Web Push — التشفير والتوقيع', () => {
  it('يطابق متجه RFC 8291 (الملحق A) بالضبط', () => {
    const uaPrivate = b64u.decode('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94')
    const uaPublic = 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
    const auth = 'BTBZMqHH6r4Tts7J_aSIgg'
    const asPrivate = b64u.decode('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')
    const salt = b64u.decode('DGv6ra1nlYgDCS1FRnbzlw')
    const out = encryptPayload(Buffer.from('When I grow up, I want to be a watermelon'), { p256dh: uaPublic, auth }, { salt, localPrivateKey: asPrivate })
    expect(b64u.encode(out)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
    )
    expect(decryptPayload(out, uaPrivate, b64u.decode(auth)).toString()).toBe('When I grow up, I want to be a watermelon')
  })

  it('جولة كاملة بمفاتيح عشوائية وحمولة عربية', () => {
    const ua = createECDH('prime256v1')
    ua.generateKeys()
    const auth = Buffer.from('0123456789abcdef')
    const msg = Buffer.from(JSON.stringify({ title: 'واجب جديد: تحليل نص', body: 'آخر أجل غداً' }))
    const out = encryptPayload(msg, { p256dh: b64u.encode(ua.getPublicKey()), auth: b64u.encode(auth) })
    expect(out.length).toBe(16 + 4 + 1 + 65 + msg.length + 1 + 16)
    expect(decryptPayload(out, ua.getPrivateKey(), auth).toString()).toBe(msg.toString())
    expect(() => encryptPayload(msg, { p256dh: 'short', auth: 'x' })).toThrow()
  })

  it('JWT VAPID صالح التوقيع (ES256) بادعاءات صحيحة', () => {
    const keys = generateVapidKeys()
    const now = new Date('2026-09-18T12:00:00Z')
    const jwt = vapidJwt({ ...keys, subject: 'mailto:admin@madrasa.dz' }, 'https://fcm.googleapis.com', now)
    const [h, c, s] = jwt.split('.')
    expect(JSON.parse(b64u.decode(h!).toString())).toEqual({ typ: 'JWT', alg: 'ES256' })
    const claims = JSON.parse(b64u.decode(c!).toString())
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:admin@madrasa.dz')
    expect(claims.exp).toBe(Math.floor(now.getTime() / 1000) + 12 * 3600)
    const pub = b64u.decode(keys.publicKey)
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: b64u.encode(pub.subarray(1, 33)), y: b64u.encode(pub.subarray(33)) }, format: 'jwk' })
    expect(verify('sha256', Buffer.from(`${h}.${c}`), { key, dsaEncoding: 'ieee-p1363' }, b64u.decode(s!))).toBe(true)
    expect(b64u.decode(s!).length).toBe(64)
  })

  it('sendWebPush يرسل الترويسات الصحيحة إلى نقطة الاشتراك', async () => {
    const keys = generateVapidKeys()
    const ua = createECDH('prime256v1')
    ua.generateKeys()
    let captured: { url: string; headers: Record<string, string>; body: Uint8Array } | null = null
    setPushTransportForTests(async (url, init) => {
      captured = { url, headers: init.headers, body: init.body }
      return { status: 201 }
    })
    const status = await sendWebPush({ endpoint: 'https://push.example.com/send/abc', p256dh: b64u.encode(ua.getPublicKey()), auth: b64u.encode(Buffer.alloc(16, 7)) }, { title: 'مرحباً' }, { ...keys, subject: 'mailto:x@y.z' })
    expect(status).toBe(201)
    expect(captured!.url).toBe('https://push.example.com/send/abc')
    expect(captured!.headers['content-encoding']).toBe('aes128gcm')
    expect(captured!.headers.authorization).toMatch(new RegExp(`^vapid t=[^,]+, k=${keys.publicKey}$`))
    expect(captured!.headers.ttl).toBe('86400')
    expect(decryptPayload(Buffer.from(captured!.body), ua.getPrivateKey(), Buffer.alloc(16, 7)).toString()).toBe(JSON.stringify({ title: 'مرحباً' }))
    setPushTransportForTests(null)
  })
})

describe('Web Push — الاشتراكات والإرسال عبر المهام', () => {
  let h: DatabaseHandle
  let admin: Actor
  let s1: Actor
  let s2: Actor
  const ua = createECDH('prime256v1')
  ua.generateKeys()
  const keys = { p256dh: b64u.encode(ua.getPublicKey()), auth: b64u.encode(Buffer.alloc(16, 1)) }
  const sent: { url: string; body: Uint8Array }[] = []
  let statusFor: (url: string) => number = () => 201

  beforeAll(async () => {
    h = await setupDb()
    admin = await makeAdmin(h.db)
    s1 = await makeStudent(h.db, 'طالب الدفع')
    s2 = await makeStudent(h.db, 'طالب آخر')
    const v = generateVapidKeys()
    process.env.VAPID_PUBLIC_KEY = v.publicKey
    process.env.VAPID_PRIVATE_KEY = v.privateKey
    setPushTransportForTests(async (url, init) => {
      sent.push({ url, body: init.body })
      return { status: statusFor(url) }
    })
  })

  afterAll(async () => {
    setPushTransportForTests(null)
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    await h.close()
  })

  it('حفظ الاشتراك: https فقط، upsert بنفس النقطة، وكل مستخدم يرى اشتراكاته فقط', async () => {
    await expect(savePushSubscription(h.db, s1, { endpoint: 'http://insecure.example/x', keys })).rejects.toSatisfy((e) => e instanceof AppError && e.code === 'VALIDATION')
    await savePushSubscription(h.db, s1, { endpoint: 'https://push.example.com/s1-a', keys, userAgent: 'Android' })
    await savePushSubscription(h.db, s1, { endpoint: 'https://push.example.com/s1-a', keys })
    await savePushSubscription(h.db, s1, { endpoint: 'https://push.example.com/s1-b', keys })
    await savePushSubscription(h.db, s2, { endpoint: 'https://push.example.com/s2', keys })
    expect(await listPushSubscriptions(h.db, s1)).toHaveLength(2)
    expect(await listPushSubscriptions(h.db, s2)).toHaveLength(1)
    expect(await removePushSubscription(h.db, s2, 'https://push.example.com/s1-a')).toBe(false)
    expect(await listPushSubscriptions(h.db, s1)).toHaveLength(2)
  })

  it('الإشعار داخل التطبيق يُنشئ مهمة دفع واحدة، والعامل يرسل لكل أجهزة المستخدم بحمولة مشفّرة', async () => {
    sent.length = 0
    await notify(h.db, { userId: s1.userId, type: 'NEW_ASSIGNMENT', title: 'واجب جديد: تحليل نص', body: 'آخر أجل غداً', link: '/student/assignments/x' })
    const queued = await h.db.select().from(jobs).where(eq(jobs.type, 'PUSH_DISPATCH'))
    expect(queued).toHaveLength(1)
    const r = await processQueuedJobs(h.db)
    expect(r.completed).toBe(1)
    expect(sent.map((s) => s.url).sort()).toEqual(['https://push.example.com/s1-a', 'https://push.example.com/s1-b'])
    const plain = JSON.parse(decryptPayload(Buffer.from(sent[0]!.body), ua.getPrivateKey(), Buffer.alloc(16, 1)).toString())
    expect(plain).toMatchObject({ title: 'واجب جديد: تحليل نص', body: 'آخر أجل غداً', url: '/student/assignments/x', tag: 'NEW_ASSIGNMENT' })
    const [done] = await h.db.select().from(jobs).where(eq(jobs.type, 'PUSH_DISPATCH'))
    expect(done?.result).toMatchObject({ sent: 2, removed: 0, failed: 0, notifications: 1 })
    const subs = await h.db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, s1.userId))
    expect(subs.every((s) => s.lastUsedAt !== null)).toBe(true)
  })

  it('410 يحذف الاشتراك الملغى، والفشل المتكرر يحذفه بعد 5 مرات', async () => {
    statusFor = (url) => (url.endsWith('s1-b') ? 410 : 201)
    let r = await sendPushToUser(h.db, s1.userId, { title: 'x' })
    expect(r).toEqual({ sent: 1, removed: 1, failed: 0 })
    expect(await listPushSubscriptions(h.db, s1)).toHaveLength(1)
    statusFor = () => 500
    for (let i = 0; i < 4; i++) r = await sendPushToUser(h.db, s1.userId, { title: 'x' })
    expect(r).toEqual({ sent: 0, removed: 0, failed: 1 })
    expect(await listPushSubscriptions(h.db, s1)).toHaveLength(1)
    r = await sendPushToUser(h.db, s1.userId, { title: 'x' })
    expect(r.failed).toBe(1)
    expect(await listPushSubscriptions(h.db, s1)).toHaveLength(0)
    statusFor = () => 201
  })

  it('بلا مفاتيح VAPID لا تُنشأ مهام دفع ولا يُرسل شيء', async () => {
    const pub = process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PUBLIC_KEY
    const before = (await h.db.select().from(jobs).where(eq(jobs.type, 'PUSH_DISPATCH'))).length
    await notify(h.db, { userId: s2.userId, type: 'SYSTEM', title: 'بلا دفع' })
    expect((await h.db.select().from(jobs).where(eq(jobs.type, 'PUSH_DISPATCH'))).length).toBe(before)
    expect(await sendPushToUser(h.db, s2.userId, { title: 'x' })).toEqual({ sent: 0, removed: 0, failed: 0 })
    process.env.VAPID_PUBLIC_KEY = pub
    expect(admin.role).toBe('SUPER_ADMIN')
  })
})
