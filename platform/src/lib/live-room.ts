/**
 * صفحة الحصة المباشرة داخل المنصة (Zoom Meeting SDK، عرض Client View) — ثوابت آمنة للحافة (middleware).
 *
 * صفحات المنصة كلها تعمل بسياسة CSP صارمة (nonce + strict-dynamic). مكتبة Zoom للويب لا تعمل بها:
 * تحتاج 'unsafe-eval' (WebAssembly) و'unsafe-inline' وعمّالًا من blob: واتصالات wss بخوادم Zoom.
 * لذلك تُعطى هذه الصفحة وحدها سياسة خاصة بها، وهي صفحة HTML مستقلة لا تحمل أي سكربت من المنصة
 * سوى إعداد الانضمام، فلا يتّسع سطح الهجوم على بقية الموقع. المصادر مأخوذة من توثيق Zoom
 * (Meeting SDK for web → Content Security Policy header).
 */

/** /student/live/<uuid> */
export const LIVE_ROOM_PATH_RE = /^\/student\/live\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isLiveRoomPath(pathname: string): boolean {
  return LIVE_ROOM_PATH_RE.test(pathname)
}

export function liveRoomPath(sessionId: string): string {
  return `/student/live/${sessionId}`
}

const ZOOM_HOSTS = 'https://zoom.us https://*.zoom.us https://zoom.com https://*.zoom.com'

export function buildLiveRoomCsp(): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${ZOOM_HOSTS} https://dmogdx0jrul3u.cloudfront.net blob:`,
    `style-src 'self' 'unsafe-inline' ${ZOOM_HOSTS}`,
    `font-src 'self' data: https:`,
    `img-src 'self' data: blob: https:`,
    `media-src 'self' blob: https:`,
    `connect-src 'self' ${ZOOM_HOSTS} wss://*.zoom.us wss://*.zoom.com`,
    `worker-src 'self' blob:`,
    `frame-src 'self' ${ZOOM_HOSTS}`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`
  ].join('; ')
}

/** الميكروفون والكاميرا مسموحان في صفحة الحصة وحدها (بقية الموقع: microphone=()) */
export const LIVE_ROOM_PERMISSIONS_POLICY = 'camera=(self), microphone=(self), display-capture=(self), fullscreen=(self), geolocation=()'
