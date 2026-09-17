import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { AppError } from './errors'

/**
 * رمز حضور موقّع وقصير العمر. لا يحتوي بيانات شخصية.
 * الصيغة: base64url(payload JSON) . base64url(HMAC-SHA256)
 */
export interface QrPayload {
  v: 1
  sid: string // student id
  gid: string // group id
  iat: number // seconds
  exp: number // seconds
  n: string // nonce
}

function secret(): string {
  const s = process.env.QR_TOKEN_SECRET
  if (!s || s.length < 8) throw new Error('QR_TOKEN_SECRET is not configured')
  return s
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

export function issueQrToken(params: { studentId: string; groupId: string; ttlSeconds?: number; now?: Date }): {
  token: string
  payload: QrPayload
} {
  const ttl = params.ttlSeconds ?? Number(process.env.QR_TOKEN_TTL_SECONDS ?? 60)
  const nowSec = Math.floor((params.now ?? new Date()).getTime() / 1000)
  const payload: QrPayload = {
    v: 1,
    sid: params.studentId,
    gid: params.groupId,
    iat: nowSec,
    exp: nowSec + ttl,
    n: randomBytes(12).toString('base64url')
  }
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
  return { token: `${body}.${sign(body)}`, payload }
}

/** يتحقق من التوقيع والصلاحية فقط؛ فحص nonce والجلسة يتم في الخدمة. */
export function verifyQrToken(token: string, now: Date = new Date()): QrPayload {
  const trimmed = token.trim()
  const dot = trimmed.lastIndexOf('.')
  if (dot <= 0) throw new AppError('QR_INVALID')
  const body = trimmed.slice(0, dot)
  const sig = trimmed.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError('QR_INVALID')

  let payload: QrPayload
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as QrPayload
  } catch {
    throw new AppError('QR_INVALID')
  }
  if (payload.v !== 1 || !payload.sid || !payload.gid || !payload.n) throw new AppError('QR_INVALID')
  const nowSec = Math.floor(now.getTime() / 1000)
  if (payload.exp < nowSec) throw new AppError('QR_EXPIRED')
  if (payload.iat > nowSec + 30) throw new AppError('QR_INVALID')
  return payload
}
