import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { getDb } from '@/server/db/client'
import { isAppError } from '@/server/lib/errors'
import { ZOOM_STATE_COOKIE, connectZoomWithCode } from '@/server/services/zoom-oauth.service'

export const dynamic = 'force-dynamic'

function sameState(a: string | undefined, b: string | null): boolean {
  if (!a || !b) return false
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/** العودة من Zoom بعد الإذن: التحقق من الـstate والمشرف، ثم تبادل الرمز وحفظه مختومًا */
export async function GET(req: NextRequest) {
  const back = (flag: string) => {
    const res = NextResponse.redirect(new URL(`/admin/live?zoom=${flag}`, req.url))
    res.cookies.set(ZOOM_STATE_COOKIE, '', { maxAge: 0, path: '/api/v1/zoom' })
    return res
  }
  const actor = await getCurrentActor()
  if (!actor || actor.role !== 'SUPER_ADMIN') return NextResponse.redirect(new URL('/login', req.url))
  const sp = req.nextUrl.searchParams
  if (!sameState(req.cookies.get(ZOOM_STATE_COOKIE)?.value, sp.get('state'))) return back('state')
  const code = sp.get('code')
  if (!code) return back('denied')
  try {
    await connectZoomWithCode(await getDb(), actor, code)
    return back('connected')
  } catch (e) {
    if (!isAppError(e)) console.error('[zoom] connect failed', e instanceof Error ? e.message : 'unknown')
    return back('failed')
  }
}
