import { describe, expect, it } from 'vitest'
import { HEARTBEAT_INTERVAL_MS, HEARTBEAT_MAX_FAILURES, HeartbeatGuard, REQUEST_TIMEOUT_MS, parseHeartbeatResponse } from '@/lib/video-playback-guard'

describe('video heartbeat failure policy', () => {
  it('tolerates three transient failures, then blocks the fourth with a bounded counter', () => {
    const guard = new HeartbeatGuard()
    for (let failures = 1; failures <= 3; failures++) {
      expect(guard.recordFailure()).toEqual({ blocked: false, reason: null })
      expect(guard.failures).toBe(failures)
    }
    expect(guard.recordFailure()).toEqual({ blocked: true, reason: 'connection' })
    expect(guard.failures).toBe(4)
    for (let index = 0; index < 100; index++) guard.recordFailure('OTHER_ERROR')
    expect(guard.failures).toBe(4)
  })

  it('counts only consecutive transient failures and resets after an actual success', () => {
    const guard = new HeartbeatGuard()
    guard.recordFailure()
    guard.recordFailure()
    guard.recordFailure()
    expect(guard.recordSuccess()).toEqual({ blocked: false, reason: null })
    expect(guard.failures).toBe(0)
    for (let index = 0; index < 3; index++) expect(guard.recordFailure().blocked).toBe(false)
    expect(guard.recordFailure().blocked).toBe(true)
  })

  it('blocks a device-limit denial immediately and never resumes by receiving a later success', () => {
    const guard = new HeartbeatGuard()
    expect(guard.recordFailure('MEDIA_TOO_MANY_DEVICES', 'Device limit')).toEqual({ blocked: true, reason: 'devices', message: 'Device limit' })
    expect(guard.blockedReason).toBe('devices')
    expect(guard.failures).toBe(1)
    expect(guard.recordSuccess()).toEqual({ blocked: true, reason: 'devices', message: 'Device limit' })
    expect(guard.recordFailure('FORBIDDEN')).toEqual({ blocked: true, reason: 'devices', message: 'Device limit' })
    expect(guard.failures).toBe(1)
    expect(new HeartbeatGuard().blocked).toBe(false)
  })

  it.each(['AUTH_REQUIRED', 'FORBIDDEN', 'UNAUTHORIZED', 'SESSION_EXPIRED', 'CONTENT_NOT_FOUND', 'FILE_NOT_FOUND'])('blocks %s immediately instead of letting stale access play for another minute', (code) => {
    const guard = new HeartbeatGuard()
    expect(guard.recordFailure(code)).toEqual({ blocked: true, reason: 'access' })
    expect(guard.recordSuccess()).toEqual({ blocked: true, reason: 'access' })
  })

  it('does not let errors replace a terminal network failure or unbounded messages enter state', () => {
    const guard = new HeartbeatGuard()
    for (let index = 0; index < 4; index++) guard.recordFailure('UPSTREAM_FAILED', 'x'.repeat(900))
    expect(guard.recordFailure('MEDIA_TOO_MANY_DEVICES')).toEqual({ blocked: true, reason: 'connection', message: 'x'.repeat(500) })
  })

  it('defines a roughly-minute four-strike policy and a request timeout shorter than the interval', () => {
    expect(HEARTBEAT_MAX_FAILURES).toBe(4)
    expect(HEARTBEAT_INTERVAL_MS * HEARTBEAT_MAX_FAILURES).toBe(60_000)
    expect(REQUEST_TIMEOUT_MS).toBe(10_000)
    expect(REQUEST_TIMEOUT_MS).toBeLessThan(HEARTBEAT_INTERVAL_MS)
  })
})

describe('heartbeat response parsing', () => {
  it.each([200, 201, 299])('accepts an actual HTTP%d success with ok strictly true', (status) => {
    expect(parseHeartbeatResponse(status, { ok: true })).toEqual({ ok: true })
  })

  it.each([null, undefined, [], true, 1, 'ok', '<html>error</html>', {}, { ok: 'true' }, { ok: 1 }, { ok: false }])('treats malformed or non-success JSON %j as a transient failure', (payload) => {
    expect(parseHeartbeatResponse(200, payload)).toEqual({ ok: false })
  })

  it.each([0, 199, 300, 404, 429, 500, Number.NaN])('does not trust ok:true on HTTP status %s', (status) => {
    expect(parseHeartbeatResponse(status, { ok: true })).toEqual({ ok: false })
  })

  it.each([[401, 'AUTH_REQUIRED'], [403, 'FORBIDDEN']] as const)('turns HTTP%d into a concrete access denial even without JSON', (status, code) => {
    expect(parseHeartbeatResponse(status, null)).toEqual({ ok: false, code })
    expect(parseHeartbeatResponse(status, { ok: true })).toEqual({ ok: false, code })
  })

  it('preserves a concrete device denial and renders its description as bounded plain text', () => {
    const response = parseHeartbeatResponse(429, { ok: false, error: { code: 'MEDIA_TOO_MANY_DEVICES', message: '<b>Limit</b>' } })
    expect(response).toEqual({ ok: false, code: 'MEDIA_TOO_MANY_DEVICES', message: '<b>Limit</b>' })
    if (response.ok) throw new Error('Expected a heartbeat failure')
    expect(new HeartbeatGuard().recordFailure(response.code, response.message).reason).toBe('devices')
  })

  it('keeps a terminal device denial when a gateway maps it to 403', () => {
    expect(parseHeartbeatResponse(403, { ok: false, error: { code: 'MEDIA_TOO_MANY_DEVICES' } })).toEqual({ ok: false, code: 'MEDIA_TOO_MANY_DEVICES' })
    expect(parseHeartbeatResponse(403, { ok: true, error: { code: 'MEDIA_TOO_MANY_DEVICES' } })).toEqual({ ok: false, code: 'FORBIDDEN' })
  })

  it('ignores non-string error values and bounds server text', () => {
    expect(parseHeartbeatResponse(500, { error: { code: [], message: { text: 'error' } } })).toEqual({ ok: false })
    expect(parseHeartbeatResponse(500, { error: { code: 'x'.repeat(100), message: 'm'.repeat(900) } })).toEqual({ ok: false, code: 'x'.repeat(80), message: 'm'.repeat(500) })
  })
})
