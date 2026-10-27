/**
 * Client playback policy, not a substitute for server-side access/device checks.
 * A blocked instance is terminal. A new page/server check creates a new instance;
 * there is deliberately no method that merely dismisses a denial and resumes.
 */
export const HEARTBEAT_MAX_FAILURES = 4
export const HEARTBEAT_INTERVAL_MS = 15_000
export const REQUEST_TIMEOUT_MS = 10_000

export type HeartbeatBlockReason = 'devices' | 'connection' | 'access'

export interface HeartbeatDecision {
  blocked: boolean
  reason: HeartbeatBlockReason | null
  message?: string
}

export type HeartbeatResponse = { ok: true } | { ok: false; code?: string; message?: string }

const ACCESS_ERRORS = new Set(['AUTH_REQUIRED', 'FORBIDDEN', 'UNAUTHORIZED', 'SESSION_EXPIRED', 'CONTENT_NOT_FOUND', 'FILE_NOT_FOUND'])

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function shortText(value: unknown, maximum: number): string | undefined {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  return text ? text.slice(0, maximum) : undefined
}

/**
 * A JSON body cannot turn an HTTP failure into a successful heartbeat. Missing or
 * malformed JSON is a transient failure; an explicit 401/403 is an access denial
 * even when an intermediary removed/replaced the server's JSON body.
 */
export function parseHeartbeatResponse(status: number, payload: unknown): HeartbeatResponse {
  const body = record(payload)
  if (Number.isInteger(status) && status >= 200 && status < 300 && body?.ok === true) return { ok: true }
  const error = record(body?.error)
  const code = shortText(error?.code, 80)
  const message = shortText(error?.message, 500)
  if (status === 401) return { ok: false, code: 'AUTH_REQUIRED' }
  // Gateways can map a rate/device rejection to 403. Keep an explicit device
  // denial terminal without ever accepting ok:true on an HTTP failure.
  if (status === 403 && body?.ok === false && code === 'MEDIA_TOO_MANY_DEVICES') return { ok: false, code, ...(message ? { message } : {}) }
  if (status === 403) return { ok: false, code: 'FORBIDDEN' }
  // This is untrusted plain text. React callers must render it as text, never HTML.
  return { ok: false, ...(code ? { code } : {}), ...(message ? { message } : {}) }
}

export class HeartbeatGuard {
  private failureCount = 0
  private terminalReason: HeartbeatBlockReason | null = null
  private terminalMessage: string | undefined

  get failures(): number { return this.failureCount }
  get blockedReason(): HeartbeatBlockReason | null { return this.terminalReason }
  get blocked(): boolean { return this.terminalReason !== null }

  private decision(): HeartbeatDecision {
    return {
      blocked: this.blocked,
      reason: this.terminalReason,
      ...(this.terminalMessage ? { message: this.terminalMessage } : {})
    }
  }

  recordSuccess(): HeartbeatDecision {
    if (this.blocked) return this.decision()
    this.failureCount = 0
    return this.decision()
  }

  recordFailure(code?: string, message?: string): HeartbeatDecision {
    if (this.blocked) return this.decision()
    this.failureCount = Math.min(HEARTBEAT_MAX_FAILURES, this.failureCount + 1)
    if (code === 'MEDIA_TOO_MANY_DEVICES') this.terminalReason = 'devices'
    else if (code && ACCESS_ERRORS.has(code)) this.terminalReason = 'access'
    else if (this.failureCount >= HEARTBEAT_MAX_FAILURES) this.terminalReason = 'connection'
    if (this.blocked) this.terminalMessage = shortText(message, 500)
    return this.decision()
  }
}
