import { resolveActor } from '@/server/auth/session'
import type { Db } from '@/server/db/connect'
import { AppError, assertUuid } from '@/server/lib/errors'
import { logout } from './auth.service'
import { phoneGateFor } from './phone-gate.service'

export interface IosSessionSnapshot {
  authenticated: true
  /** Existing account identifier; a local-data namespace, never an access credential. */
  user: { id: string; role: 'STUDENT' }
  requiresPhoneVerification: boolean
}

/** Resolve the same HttpOnly browser session used by the website, without returning credentials or contact data. */
export async function iosSessionSnapshot(db: Db, cookieToken: string | null | undefined): Promise<IosSessionSnapshot> {
  const actor = await resolveActor(db, cookieToken)
  if (!actor) throw new AppError('AUTH_REQUIRED')
  if (actor.role !== 'STUDENT' || !actor.studentId) throw new AppError('FORBIDDEN')
  assertUuid(actor.userId, 'FORBIDDEN')
  const gate = await phoneGateFor(db, actor.userId)
  return {
    authenticated: true,
    user: { id: actor.userId, role: 'STUDENT' },
    requiresPhoneVerification: gate.required
  }
}

/**
 * Cookie-authenticated native mutations require an explicit, exact configured origin.
 * Request Host, forwarded headers, User-Agent and an "iOS" flag are not trusted inputs.
 * Native URLSession must send Origin, just like the same-origin website does.
 */
export function assertIosOrigin(req: Pick<Request, 'headers'>): void {
  const configured = process.env.APP_URL || 'https://madrasadz.com'
  let trusted: URL
  try {
    trusted = new URL(configured)
  } catch {
    throw new AppError('FORBIDDEN')
  }
  const localDebug = process.env.NODE_ENV !== 'production'
    && trusted.protocol === 'http:'
    && ['localhost', '127.0.0.1', '[::1]'].includes(trusted.hostname)
  if ((trusted.protocol !== 'https:' && !localDebug) || trusted.username || trusted.password) throw new AppError('FORBIDDEN')
  if (req.headers.get('origin') !== trusted.origin) throw new AppError('FORBIDDEN')
}

/** Revoke only the browser session being signed out. Idempotent for an absent/expired/revoked session. */
export async function logoutIosSession(db: Db, cookieToken: string | null | undefined): Promise<{ loggedOut: true }> {
  if (cookieToken) await logout(db, cookieToken)
  return { loggedOut: true }
}

/** Successes and errors must never be cached by WebKit or a shared intermediary. */
export function iosNoStore<T extends Response>(response: T): T {
  response.headers.set('Cache-Control', 'private, no-store')
  response.headers.set('Pragma', 'no-cache')
  response.headers.set('Vary', 'Cookie')
  return response
}
