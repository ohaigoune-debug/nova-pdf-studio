import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getCurrentActor } from '@/server/auth/current-user'
import { redirectPath } from '@/server/lib/relative-redirect'
import { zoomSdkKeys } from '@/server/lib/zoom-sdk'
import { ZOOM_STATE_COOKIE, zoomAuthorizeUrl } from '@/server/services/zoom-oauth.service'

export const dynamic = 'force-dynamic'

/**
 * «ربط حساب Zoom» (المشرف): رمز state عشوائي في كعكة قصيرة (10 دقائق) ثم التحويل إلى صفحة إذن Zoom.
 * العودة إلى /api/v1/zoom/callback تتحقق من الـstate نفسه.
 */
export async function GET() {
  const actor = await getCurrentActor()
  if (!actor || actor.role !== 'SUPER_ADMIN') return redirectPath('/login')
  const keys = zoomSdkKeys()
  if (!keys) return redirectPath('/admin/live?zoom=keys')
  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(zoomAuthorizeUrl(keys, state))
  res.cookies.set(ZOOM_STATE_COOKIE, state, { maxAge: 600, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/v1/zoom', httpOnly: true })
  return res
}
