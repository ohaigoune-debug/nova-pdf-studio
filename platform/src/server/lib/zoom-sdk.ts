/**
 * Zoom Meeting SDK (الويب): دخول الحصة المباشرة داخل المنصة بدل فتح تطبيق Zoom (22 نوفمبر 2026).
 *
 * المفتاحان من تطبيق «General App» في marketplace.zoom.us (Features ← Embed ← Meeting SDK):
 *   ZOOM_SDK_CLIENT_ID و ZOOM_SDK_CLIENT_SECRET في ‎.env‎ الخادم (لا في GitHub).
 * بلا المفتاحين: تبقى الحصص تُفتح بالرابط في تطبيق Zoom كما كانت.
 *
 * التوقيع JWT بـ HS256 بالسر (https://developers.zoom.us/docs/meeting-sdk/auth/):
 * appKey (= sdkKey) و mn و role و iat و exp و tokenExp، والصلاحية بين 30 دقيقة و48 ساعة.
 * الاجتماعات المنشأة من حساب صاحب التطبيق تُدخل دون مراجعة Zoom.
 */
import { createHmac } from 'node:crypto'

export interface ZoomSdkKeys {
  clientId: string
  clientSecret: string
}

export function zoomSdkKeys(env: NodeJS.ProcessEnv = process.env): ZoomSdkKeys | null {
  const clientId = env.ZOOM_SDK_CLIENT_ID?.trim()
  const clientSecret = env.ZOOM_SDK_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

export function zoomSdkConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return zoomSdkKeys(env) !== null
}

/**
 * رقم الاجتماع من رابط انضمام Zoom: ‎/j/123…‎ أو ‎/w/‎ أو ‎/s/‎ أو ‎/wc/join/‎.
 * يقبل نطاقات zoom.us و zoom.com وما تحتهما فقط؛ وإلا null (رابط شخصي ‎/my/…‎ لا رقم فيه).
 */
export function zoomMeetingNumber(joinUrl: string | null | undefined, fallbackId?: string | null): string | null {
  const fromId = fallbackId?.replace(/[\s-]/g, '')
  if (fromId && /^\d{9,12}$/.test(fromId)) return fromId
  if (!joinUrl) return null
  let u: URL
  try {
    u = new URL(joinUrl)
  } catch {
    return null
  }
  const host = u.hostname.toLowerCase()
  if (!(host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com'))) return null
  const m = /\/(?:j|w|s|wc(?:\/join)?)\/(\d{9,12})(?:\/|$)/.exec(u.pathname)
  return m ? m[1]! : null
}

const b64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')

/** توقيع الدخول: role 0 = مشارك (تلميذ)، 1 = مضيف. صالح ساعتين من الآن. */
export function zoomSdkSignature(keys: ZoomSdkKeys, meetingNumber: string, role: 0 | 1, now: Date = new Date()): string {
  const iat = Math.floor(now.getTime() / 1000) - 30
  const exp = iat + 2 * 60 * 60
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ appKey: keys.clientId, sdkKey: keys.clientId, mn: meetingNumber, role, iat, exp, tokenExp: exp }))
  const sig = createHmac('sha256', keys.clientSecret).update(`${header}.${payload}`).digest('base64url')
  return `${header}.${payload}.${sig}`
}
