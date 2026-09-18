import { createCipheriv, createECDH, createPrivateKey, hkdfSync, randomBytes, sign } from 'node:crypto'

/**
 * Web Push بلا مكتبات خارجية:
 *  - تشفير الحمولة وفق RFC 8291 (aes128gcm / RFC 8188)
 *  - توقيع VAPID وفق RFC 8292 (JWT ES256)
 * المفاتيح من البيئة: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT (mailto:…)
 */

export const b64u = {
  encode: (b: Buffer | Uint8Array) => Buffer.from(b).toString('base64url'),
  decode: (s: string) => Buffer.from(s, 'base64url')
}

export interface PushKeys {
  p256dh: string
  auth: string
}

export interface VapidConfig {
  publicKey: string
  privateKey: string
  subject: string
}

/** يولّد زوج مفاتيح VAPID (P-256) بصيغة base64url الخام */
export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  return { publicKey: b64u.encode(ecdh.getPublicKey()), privateKey: b64u.encode(ecdh.getPrivateKey()) }
}

/** تشفير حمولة الإشعار لمشترك (RFC 8291). `opts` للاختبار بمتجهات ثابتة فقط. */
export function encryptPayload(plaintext: Buffer, keys: PushKeys, opts: { salt?: Buffer; localPrivateKey?: Buffer } = {}): Buffer {
  const uaPublic = b64u.decode(keys.p256dh)
  const authSecret = b64u.decode(keys.auth)
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error('invalid subscription keys')
  const ecdh = createECDH('prime256v1')
  if (opts.localPrivateKey) ecdh.setPrivateKey(opts.localPrivateKey)
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const sharedSecret = ecdh.computeSecret(uaPublic)
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), uaPublic, asPublic])
  const ikm = Buffer.from(hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32))
  const salt = opts.salt ?? randomBytes(16)
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12))
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const padded = Buffer.concat([plaintext, Buffer.from([2])]) // سجل أخير واحد بلا حشو إضافي
  const body = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()])
  const rs = Buffer.alloc(4)
  rs.writeUInt32BE(4096)
  const header = Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic])
  return Buffer.concat([header, body])
}

function jwkFromRaw(publicKey: string, privateKey?: string) {
  const pub = b64u.decode(publicKey)
  if (pub.length !== 65 || pub[0] !== 4) throw new Error('invalid VAPID public key')
  const jwk: Record<string, string> = { kty: 'EC', crv: 'P-256', x: b64u.encode(pub.subarray(1, 33)), y: b64u.encode(pub.subarray(33, 65)) }
  if (privateKey) jwk.d = privateKey
  return jwk
}

/** JWT ES256 لـ VAPID: aud = أصل خادم الدفع، exp ≤ 24 ساعة */
export function vapidJwt(cfg: VapidConfig, audience: string, now: Date = new Date()): string {
  const header = b64u.encode(Buffer.from(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64u.encode(Buffer.from(JSON.stringify({ aud: audience, exp: Math.floor(now.getTime() / 1000) + 12 * 3600, sub: cfg.subject })))
  const input = `${header}.${claims}`
  const key = createPrivateKey({ key: jwkFromRaw(cfg.publicKey, cfg.privateKey), format: 'jwk' })
  const sig = sign('sha256', Buffer.from(input), { key, dsaEncoding: 'ieee-p1363' })
  return `${input}.${b64u.encode(sig)}`
}

export function vapidConfigFromEnv(): VapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) return null
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT ?? 'mailto:admin@example.com' }
}

export type PushTransport = (url: string, init: { method: string; headers: Record<string, string>; body: Uint8Array }) => Promise<{ status: number }>

const fetchTransport: PushTransport = async (url, init) => {
  const res = await fetch(url, { method: init.method, headers: init.headers, body: init.body as unknown as BodyInit })
  return { status: res.status }
}
let transport: PushTransport = fetchTransport

/** للاختبارات: استبدال النقل الشبكي */
export function setPushTransportForTests(t: PushTransport | null) {
  transport = t ?? fetchTransport
}

export interface PushMessage {
  title: string
  body?: string | null
  url?: string | null
  tag?: string | null
}

/**
 * يرسل إشعاراً لمشترك واحد. يعيد حالة HTTP: 201/200 نجاح، 404/410 اشتراك ملغى (يُحذف)، غير ذلك فشل مؤقت.
 */
export async function sendWebPush(sub: { endpoint: string } & PushKeys, message: PushMessage, cfg: VapidConfig, ttlSeconds = 24 * 3600): Promise<number> {
  const audience = new URL(sub.endpoint).origin
  const jwt = vapidJwt(cfg, audience)
  const payload = encryptPayload(Buffer.from(JSON.stringify(message), 'utf8'), sub)
  const { status } = await transport(sub.endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/octet-stream',
      'content-encoding': 'aes128gcm',
      'content-length': String(payload.length),
      ttl: String(ttlSeconds),
      urgency: 'normal',
      authorization: `vapid t=${jwt}, k=${cfg.publicKey}`
    },
    body: new Uint8Array(payload)
  })
  return status
}
