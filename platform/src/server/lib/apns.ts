/**
 * إشعارات Apple (APNs) لتطبيق الآيفون، بمفتاح .p8 من حساب المطوّر (لا شهادات، ولا مكتبات خارجية):
 * JWT بتوقيع ES256 + HTTP/2 إلى api.push.apple.com. بلا المفاتيح الثلاثة لا يُرسل شيء ولا يُستعلم عن شيء.
 *
 *   APNS_KEY_ID      معرّف المفتاح (10 أحرف)
 *   APNS_TEAM_ID     معرّف الفريق (10 أحرف)
 *   APNS_PRIVATE_KEY محتوى ملف AuthKey_XXXX.p8 (كما هو، أو \n بدل الأسطر، أو base64)
 *   APNS_BUNDLE_ID   اختياري (com.madrasadz.student)
 */
import { createPrivateKey, sign } from 'node:crypto'
import http2 from 'node:http2'
import { b64u } from './web-push'

export interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: string
  bundleId: string
}

export type ApnsEnvironment = 'production' | 'sandbox'

function pemOf(raw: string): string {
  const v = raw.trim().replace(/\\n/g, '\n')
  if (v.includes('BEGIN PRIVATE KEY')) return v
  const decoded = Buffer.from(v, 'base64').toString('utf8')
  return decoded.includes('BEGIN PRIVATE KEY') ? decoded : `-----BEGIN PRIVATE KEY-----\n${v}\n-----END PRIVATE KEY-----\n`
}

export function apnsConfigFromEnv(): ApnsConfig | null {
  const keyId = process.env.APNS_KEY_ID?.trim()
  const teamId = process.env.APNS_TEAM_ID?.trim()
  const privateKey = process.env.APNS_PRIVATE_KEY
  if (!keyId || !teamId || !privateKey?.trim()) return null
  return { keyId, teamId, privateKey: pemOf(privateKey), bundleId: process.env.APNS_BUNDLE_ID?.trim() || 'com.madrasadz.student' }
}

/** رمز المصادقة: Apple تقبله حتى ساعة وترفض تجديده أكثر من مرة كل 20 دقيقة ⇒ يُعاد استعماله 40 دقيقة */
let cached: { key: string; token: string; at: number } | null = null
export function apnsJwt(cfg: ApnsConfig, now: Date = new Date()): string {
  const cacheKey = `${cfg.teamId}:${cfg.keyId}`
  if (cached && cached.key === cacheKey && now.getTime() - cached.at < 40 * 60_000 && now.getTime() >= cached.at) return cached.token
  const header = b64u.encode(Buffer.from(JSON.stringify({ alg: 'ES256', kid: cfg.keyId })))
  const claims = b64u.encode(Buffer.from(JSON.stringify({ iss: cfg.teamId, iat: Math.floor(now.getTime() / 1000) })))
  const input = `${header}.${claims}`
  const sig = sign('sha256', Buffer.from(input), { key: createPrivateKey(cfg.privateKey), dsaEncoding: 'ieee-p1363' })
  const token = `${input}.${b64u.encode(sig)}`
  cached = { key: cacheKey, token, at: now.getTime() }
  return token
}

export interface ApnsMessage {
  title: string
  body?: string | null
  /** مسار الإشعار في الموقع؛ التطبيق يفتح الشاشة المقابلة (تذكرة، طلباتي…) */
  link?: string | null
  /** تجميع الإشعارات في مركز الإشعارات */
  thread?: string | null
}

export type ApnsTransport = (req: { host: string; path: string; headers: Record<string, string>; body: string }) => Promise<{ status: number; reason?: string }>

const sessions = new Map<string, http2.ClientHttp2Session>()
function sessionFor(host: string): http2.ClientHttp2Session {
  const existing = sessions.get(host)
  if (existing && !existing.closed && !existing.destroyed) return existing
  const s = http2.connect(`https://${host}`)
  const drop = () => {
    if (sessions.get(host) === s) sessions.delete(host)
  }
  s.on('error', drop)
  s.on('close', drop)
  s.on('goaway', drop)
  // اتصال واحد يُعاد استعماله، ويُغلق بعد دقيقة بلا إرسال (لا يُبقي العملية حيّة)
  s.setTimeout(60_000, () => s.close())
  s.unref()
  sessions.set(host, s)
  return s
}

const http2Transport: ApnsTransport = (req) =>
  new Promise((resolve) => {
    let settled = false
    const done = (v: { status: number; reason?: string }) => {
      if (!settled) {
        settled = true
        resolve(v)
      }
    }
    try {
      const stream = sessionFor(req.host).request({ ':method': 'POST', ':path': req.path, ...req.headers })
      let status = 0
      let data = ''
      stream.setEncoding('utf8')
      stream.on('response', (h) => {
        status = Number(h[':status'] ?? 0)
      })
      stream.on('data', (chunk: string) => {
        if (data.length < 2000) data += chunk
      })
      stream.on('end', () => {
        let reason: string | undefined
        try {
          reason = data ? (JSON.parse(data) as { reason?: string }).reason : undefined
        } catch {
          reason = undefined
        }
        done({ status, reason })
      })
      stream.on('error', () => done({ status: 0 }))
      stream.setTimeout(10_000, () => {
        stream.close()
        done({ status: 0, reason: 'Timeout' })
      })
      stream.end(req.body)
    } catch {
      done({ status: 0 })
    }
  })

let transport: ApnsTransport = http2Transport

/** للاختبارات: استبدال النقل الشبكي */
export function setApnsTransportForTests(t: ApnsTransport | null) {
  transport = t ?? http2Transport
  cached = null
}

/** حمولة الإشعار (حدّ Apple 4 كيلوبايت: النص يُقصّ) */
export function apnsPayload(message: ApnsMessage): string {
  const alert: Record<string, string> = { title: message.title.slice(0, 120) }
  if (message.body) alert.body = message.body.slice(0, 400)
  return JSON.stringify({ aps: { alert, sound: 'default', ...(message.thread ? { 'thread-id': message.thread.slice(0, 60) } : {}) }, ...(message.link ? { link: message.link.slice(0, 300) } : {}) })
}

/** 200 نجاح؛ 410 أو BadDeviceToken/Unregistered ⇒ الرمز لم يعد صالحًا (يُحذف)؛ غير ذلك فشل مؤقت */
export async function sendApns(token: string, environment: ApnsEnvironment, message: ApnsMessage, cfg: ApnsConfig): Promise<{ status: number; reason?: string; invalid: boolean }> {
  const host = environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
  const res = await transport({
    host,
    path: `/3/device/${token}`,
    headers: {
      authorization: `bearer ${apnsJwt(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(Math.floor(Date.now() / 1000) + 24 * 3600),
      'content-type': 'application/json'
    },
    body: apnsPayload(message)
  })
  const invalid = res.status === 410 || (res.status === 400 && (res.reason === 'BadDeviceToken' || res.reason === 'DeviceTokenNotForTopic')) || res.reason === 'Unregistered'
  return { ...res, invalid }
}
