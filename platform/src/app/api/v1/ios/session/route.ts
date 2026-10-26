import type { NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import { iosNoStore, iosSessionSnapshot } from '@/server/services/ios-session.service'
import { jsonError, jsonOk } from '../../_lib'

export const dynamic = 'force-dynamic'

/** The native app reuses the website's cookie login; no Bearer token or private contact fields are returned. */
export async function GET(req: NextRequest) {
  try {
    const snapshot = await iosSessionSnapshot(await getDb(), req.cookies.get(SESSION_COOKIE)?.value)
    return iosNoStore(jsonOk(snapshot))
  } catch (err) {
    return iosNoStore(jsonError(err))
  }
}
