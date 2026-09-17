import { NextResponse } from 'next/server'
import { errorMessage } from '@/i18n'
import { isAppError, toAppError } from '@/server/lib/errors'

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init)
}

export function jsonError(err: unknown) {
  const e = isAppError(err) ? err : toAppError(err)
  return NextResponse.json({ ok: false, error: { code: e.code, message: errorMessage(e.code) } }, { status: e.status })
}

/** حماية CSRF بسيطة للطلبات المتغيّرة القائمة على الكوكي */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get('origin')
  const host = req.headers.get('host')
  if (!origin) return // طلبات غير المتصفح (Bearer)
  const originHost = origin.replace(/^https?:\/\//, '')
  if (host && originHost !== host) {
    throw Object.assign(new Error('bad origin'), { name: 'AppError', code: 'FORBIDDEN', status: 403 })
  }
}
