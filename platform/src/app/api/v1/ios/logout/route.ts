import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { assertIosOrigin, iosNoStore, logoutIosSession } from '@/server/services/ios-session.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

/** Revoke the server session before clearing its WebKit cookie. Missing/cross-origin Origin is rejected. */
export async function POST(req: NextRequest) {
  try {
    assertIosOrigin(req)
    const result = await logoutIosSession(await getDb(), req.cookies.get(SESSION_COOKIE)?.value)
    const response = jsonOk(result)
    response.cookies.set(SESSION_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
      expires: new Date(0)
    })
    return iosNoStore(response)
  } catch (err) {
    return iosNoStore(jsonError(err))
  }
}
