/**
 * صفحة الحصة المباشرة داخل المنصة (Zoom Meeting SDK) — /student/live/<id>.
 *
 * صفحة HTML مستقلة (لا تخطيط المنصة ولا React الخاص بها) بسياسة CSP وPermissions-Policy خاصة بها:
 * الميكروفون والكاميرا مسموحان هنا وحدهما. الوسيط (middleware) يتأكد من كوكي الجلسة ويعطي المسار
 * السياسة نفسها؛ الصلاحية الحقيقية تُفحص هنا في الخادم (zoomRoomConfig).
 */
import { buildLiveRoomCsp, LIVE_ROOM_PERMISSIONS_POLICY } from '@/lib/live-room'
import { homeFor } from '@/lib/role-home'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { renderLiveRoomError, renderLiveRoomHtml } from '@/server/lib/live-room-html'
import { zoomRoomConfig } from '@/server/services/live.service'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store, private',
      'content-security-policy': buildLiveRoomCsp(),
      'permissions-policy': LIVE_ROOM_PERMISSIONS_POLICY,
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin'
    }
  })
}

/** تحويل بمسار نسبي (خلف Cloudflare/Caddy لا نثق بأصل req.url الداخلي) */
function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { location, 'cache-control': 'no-store' } })
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { id } = await params
  const actor = await getCurrentActor()
  if (!actor) return redirect(`/login?next=${encodeURIComponent(`/student/live/${id}`)}`)
  if (actor.role !== 'STUDENT') return redirect(homeFor(actor.role))
  if (!UUID_RE.test(id)) return html(renderLiveRoomError('LIVE_NOT_FOUND'), 404)
  try {
    const cfg = await zoomRoomConfig(await getDb(), actor, id)
    return html(renderLiveRoomHtml(cfg))
  } catch (e) {
    if (!isAppError(e)) throw e
    const status = e.code === 'LIVE_NOT_FOUND' ? 404 : e.code === 'COURSE_NOT_ENROLLED' ? 403 : 409
    return html(renderLiveRoomError(e.code), status)
  }
}
