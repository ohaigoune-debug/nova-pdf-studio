import { and, eq } from 'drizzle-orm'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle, Db } from '@/server/db/connect'
import { groupStudents, mediaViews, rateLimits } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { saveBunnyCredentials } from '@/server/lib/bunny'
import { createContent } from '@/server/services/content.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { POST } from '@/app/api/v1/media/bunny/refresh/route'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

const state = vi.hoisted(() => ({
  db: null as unknown as Db, actor: null as Actor | null,
  ip: '10.31.0.1' as string | null, phoneRequired: false
}))
vi.mock('@/server/db/client', () => ({ getDb: async () => state.db }))
vi.mock('@/server/auth/current-user', async () => {
  const { AppError } = await import('@/server/lib/errors')
  return {
    requireActor: async () => { if (!state.actor) throw new AppError('AUTH_REQUIRED'); return state.actor },
    requestMeta: async () => ({ ip: state.ip, userAgent: 'isolated-test-browser' })
  }
})
vi.mock('@/server/services/phone-gate.service', () => ({ phoneGateFor: async () => ({ required: state.phoneRequired }) }))

let h: DatabaseHandle
let teacher: Actor
let groupId: string
let contentId: string

beforeAll(async () => {
  h = await setupDb()
  state.db = h.db
  teacher = await makeTeacher(h.db, await makeAdmin(h.db))
  groupId = (await createGroup(h.db, teacher, { name: 'مجموعة اختبار التجديد' })).id
  contentId = (await createContent(h.db, teacher, {
    type: 'VIDEO', title: 'مقطع خاص لتجديد التضمين', videoProvider: 'BUNNY',
    bunnyVideoId: 'fa11bb22-1234-4123-8123-112233445566',
    visibility: 'GROUP_ONLY', groupIds: [groupId], publish: true
  })).id
  await saveBunnyCredentials(h.db, {
    libraryId: '10001', apiKey: 'local-test-bunny-api-key-0123456789',
    tokenAuthKey: 'local-test-bunny-token-key-0123456789', cdnHostname: 'local-test.b-cdn.net'
  })
})
beforeEach(async () => {
  vi.stubEnv('APP_URL', 'https://madrasadz.com')
  vi.stubEnv('MEDIA_MAX_DEVICES', '2')
  state.actor = await makeStudent(h.db)
  state.ip = '10.31.0.1'
  state.phoneRequired = false
  const codes = await generateCodes(h.db, teacher, { groupId, count: 1 })
  await redeemEnrollmentCode(h.db, state.actor, codes.codes[0]!.code)
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => { await h.close() })

function request(input: { origin?: string | null; body?: unknown; raw?: string; headers?: Record<string, string> } = {}) {
  const headers = new Headers({ 'content-type': 'application/json', ...input.headers })
  const origin = input.origin === undefined ? 'https://madrasadz.com' : input.origin
  if (origin !== null) headers.set('origin', origin)
  return new Request('https://madrasadz.com/api/v1/media/bunny/refresh', {
    method: 'POST', headers,
    body: input.raw ?? JSON.stringify(input.body ?? { contentId, viewerKey: 'local-viewer-key' })
  })
}

function expectNoStore(response: Response) {
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(response.headers.get('pragma')).toBe('no-cache')
  expect(response.headers.get('vary')).toBe('Cookie, Origin')
}
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status)
  expectNoStore(response)
  expect(await response.json()).toMatchObject({ ok: false, error: { code } })
}
async function activeIp(ip: string, key: string) {
  await h.db.insert(mediaViews).values({
    workspaceId: teacher.workspaceId, contentId, userId: state.actor!.userId,
    studentId: state.actor!.studentId, viewerKey: key, ip, lastSeenAt: new Date()
  })
}

describe('POST Bunny refresh uses current server permissions, not the browser account/IP', () => {
  it('returns only a fresh five-minute URL and expiry with no-store headers', async () => {
    const before = Math.floor(Date.now() / 1000)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expectNoStore(response)
    const body = await response.json()
    expect(body.ok).toBe(true)
    expect(Object.keys(body.data).sort()).toEqual(['expires', 'url'])
    expect(body.data.expires).toBeGreaterThanOrEqual(before + 300)
    expect(body.data.expires).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 300)
    expect(new URL(body.data.url).hostname).toBe('iframe.mediadelivery.net')
    expect(body.data).not.toHaveProperty('watermark')
  })

  it('requires an authenticated actor before issuing another token', async () => {
    state.actor = null
    await expectError(await POST(request()), 401, 'AUTH_REQUIRED')
  })

  it('rejects missing or cross-origin requests even if Host is spoofed', async () => {
    await expectError(await POST(request({ origin: null })), 403, 'FORBIDDEN')
    await expectError(await POST(request({ origin: 'https://evil.example', headers: { host: 'evil.example' } })), 403, 'FORBIDDEN')
    await expectError(await POST(request({ origin: 'https://madrasadz.com.evil.example' })), 403, 'FORBIDDEN')
  })

  it('does not accept an Origin path, null origin or alternate protocol', async () => {
    for (const origin of ['https://madrasadz.com/path', 'null', 'http://madrasadz.com']) {
      await expectError(await POST(request({ origin })), 403, 'FORBIDDEN')
    }
  })

  it('requires valid content UUID and bounded viewerKey, rejecting account/IP overrides', async () => {
    for (const body of [
      { contentId: 'wrong', viewerKey: 'local-viewer-key' },
      { contentId, viewerKey: 'short' },
      { contentId, viewerKey: 'a'.repeat(65) },
      { contentId, viewerKey: 'local-viewer-key', ip: '10.31.0.1' },
      { contentId, viewerKey: 'local-viewer-key', userId: teacher.userId }
    ]) await expectError(await POST(request({ body })), 422, 'VALIDATION')
    await expectError(await POST(request({ raw: '{broken-json' })), 422, 'VALIDATION')
  })

  it('rechecks the current target membership instead of trusting an old embed', async () => {
    const actor = state.actor!
    await h.db.update(groupStudents).set({ status: 'LEFT_GROUP', leftAt: new Date() })
      .where(and(eq(groupStudents.groupId, groupId), eq(groupStudents.studentId, actor.studentId!)))
    await expectError(await POST(request()), 404, 'CONTENT_NOT_FOUND')
  })

  it('refuses a different student who knows the content UUID', async () => {
    state.actor = await makeStudent(h.db)
    await expectError(await POST(request()), 404, 'CONTENT_NOT_FOUND')
  })

  it('does not bypass the existing student phone gate', async () => {
    state.phoneRequired = true
    await expectError(await POST(request()), 403, 'FORBIDDEN')
  })

  it('keeps teacher previews within their existing workspace permission', async () => {
    state.actor = teacher
    state.phoneRequired = true
    expect((await POST(request())).status).toBe(200)
  })

  it('rejects a new IP at the observed limit, even with a copied viewerKey', async () => {
    await activeIp('10.31.0.1', 'existing-device-a')
    await activeIp('10.31.0.2', 'existing-device-b')
    state.ip = '10.31.0.3'
    await expectError(await POST(request({ body: { contentId, viewerKey: 'existing-device-a' } })), 429, 'MEDIA_TOO_MANY_DEVICES')
  })

  it('allows the existing server-derived IP at the observed limit', async () => {
    await activeIp('10.31.0.1', 'existing-device-a')
    await activeIp('10.31.0.2', 'existing-device-b')
    expect((await POST(request())).status).toBe(200)
  })

  it('rate limits the authenticated account after sixty refreshes in ten minutes', async () => {
    const now = new Date()
    const windowStart = new Date(Math.floor(now.getTime() / 600_000) * 600_000)
    await h.db.insert(rateLimits).values({
      key: `bunny-embed-refresh:${state.actor!.userId}`, count: 60, windowStart, updatedAt: now
    })
    await expectError(await POST(request()), 429, 'RATE_LIMITED')
  })

  it('only permits explicit HTTP localhost configuration outside production', async () => {
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    expect((await POST(request({ origin: 'http://localhost:3000' }))).status).toBe(200)
    vi.stubEnv('NODE_ENV', 'production')
    await expectError(await POST(request({ origin: 'http://localhost:3000' })), 403, 'FORBIDDEN')
  })
})
