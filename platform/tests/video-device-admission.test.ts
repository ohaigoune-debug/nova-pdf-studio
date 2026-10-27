import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { mediaViews } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { saveBunnyCredentials, embedToken } from '@/server/lib/bunny'
import { AppError } from '@/server/lib/errors'
import { createContent } from '@/server/services/content.service'
import { BUNNY_EMBED_TTL_SECONDS, bunnyEmbedForViewer, recordMediaHeartbeat } from '@/server/services/media.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

const VIDEO = 'aa11bb22-1234-4123-8123-112233445566'
const TOKEN_KEY = 'isolated-test-bunny-token-key-0123456789'
const NOW = Date.parse('2026-10-27T10:00:00Z')
const DEVICE_WINDOW_MS = 10 * 60_000
let h: DatabaseHandle
let teacher: Actor
let contentId: string

beforeAll(async () => {
  vi.stubEnv('MEDIA_MAX_DEVICES', '2')
  h = await setupDb()
  teacher = await makeTeacher(h.db, await makeAdmin(h.db))
  await saveBunnyCredentials(h.db, {
    libraryId: '54321', apiKey: 'isolated-test-bunny-api-key-0123456789',
    tokenAuthKey: TOKEN_KEY, cdnHostname: 'isolated-test.b-cdn.net'
  })
  const item = await createContent(h.db, teacher, {
    type: 'VIDEO', title: 'مقطع اختبار حد الأجهزة', videoProvider: 'BUNNY',
    bunnyVideoId: VIDEO, visibility: 'STUDENTS_ONLY', publish: true
  })
  contentId = item.id
})

afterAll(async () => { vi.unstubAllEnvs(); await h.close() })

async function addDevice(actor: Actor, ip: string | null, key: string, at = NOW) {
  await h.db.insert(mediaViews).values({
    workspaceId: teacher.workspaceId, contentId, userId: actor.userId,
    studentId: actor.studentId, viewerKey: key, ip,
    startedAt: new Date(at), lastSeenAt: new Date(at)
  })
}

function embed(actor: Actor, ip?: string | null, viewerKey?: string, now = NOW) {
  return bunnyEmbedForViewer(h.db, actor, contentId, now, { ip, viewerKey })
}

async function limited(promise: Promise<unknown>) {
  await expect(promise).rejects.toSatisfy((error) => error instanceof AppError && error.code === 'MEDIA_TOO_MANY_DEVICES')
}

describe('Bunny token admission and shared observed-IP limit', () => {
  it('issues a five-minute token with documented inline and no-remote-player options', async () => {
    const actor = await makeStudent(h.db)
    const result = await embed(actor, '10.21.0.1')
    expect(BUNNY_EMBED_TTL_SECONDS).toBe(300)
    expect(result.expires).toBe(Math.floor(NOW / 1000) + 300)
    const url = new URL(result.url)
    expect(url.searchParams.get('expires')).toBe(String(result.expires))
    expect(url.searchParams.get('token')).toBe(embedToken(TOKEN_KEY, VIDEO, result.expires))
    expect(url.searchParams.get('playsinline')).toBe('true')
    expect(url.searchParams.get('disableIosPlayer')).toBe('true')
    expect(url.searchParams.get('disableAirPlay')).toBe('true')
    expect(url.searchParams.get('chromecast')).toBe('false')
  })

  it('refuses a third observed IP before returning a signed embed', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.1.1', 'existing-device-a')
    await addDevice(actor, '10.21.1.2', 'existing-device-b')
    await limited(embed(actor, '10.21.1.3'))
  })

  it('allows an existing IP at the limit, without trusting the supplied viewer key', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.2.1', 'existing-device-a')
    await addDevice(actor, '10.21.2.2', 'existing-device-b')
    expect((await embed(actor, '10.21.2.1', 'new-tab-key')).url).toContain('/embed/54321/')
    await limited(embed(actor, '10.21.2.3', 'existing-device-a'))
  })

  it('does not bypass a full limit when request IP/context is missing', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.3.1', 'existing-device-a')
    await addDevice(actor, '10.21.3.2', 'existing-device-b')
    await limited(embed(actor))
    await limited(bunnyEmbedForViewer(h.db, actor, contentId, NOW))
  })

  it('counts unknown IP conservatively and allows it only if it is already active', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, null, 'existing-unknown-ip')
    await addDevice(actor, '10.21.4.2', 'existing-known-ip')
    expect((await embed(actor)).url).toContain('/embed/54321/')
    await limited(embed(actor, '10.21.4.3'))
  })

  it('uses the same strict ten-minute window for embed admission and heartbeat', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.5.1', 'old-device-a', NOW - DEVICE_WINDOW_MS)
    await addDevice(actor, '10.21.5.2', 'old-device-b', NOW - DEVICE_WINDOW_MS)
    expect((await embed(actor, '10.21.5.3')).url).toContain('/embed/54321/')
    await expect(recordMediaHeartbeat(h.db, actor, {
      contentId, viewerKey: 'new-device-c', ip: '10.21.5.3',
      now: new Date(NOW), position: 0, delta: 0
    })).resolves.toMatchObject({ first: false })
  })

  it('keeps device sets scoped to the authenticated account', async () => {
    const other = await makeStudent(h.db)
    const actor = await makeStudent(h.db)
    await addDevice(other, '10.21.6.1', 'other-device-a')
    await addDevice(other, '10.21.6.2', 'other-device-b')
    expect((await embed(actor, '10.21.6.3')).url).toContain('/embed/54321/')
  })

  it('does not let a copied viewerKey replace another IP in heartbeat admission', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.7.1', 'existing-device-a')
    await addDevice(actor, '10.21.7.2', 'existing-device-b')
    await limited(recordMediaHeartbeat(h.db, actor, {
      contentId, viewerKey: 'existing-device-a', ip: '10.21.7.3',
      now: new Date(NOW), position: 0, delta: 0
    }))
  })

  it('applies the shared limit to heartbeats that have no IP metadata', async () => {
    const actor = await makeStudent(h.db)
    await addDevice(actor, '10.21.8.1', 'existing-device-a')
    await addDevice(actor, '10.21.8.2', 'existing-device-b')
    await limited(recordMediaHeartbeat(h.db, actor, {
      contentId, viewerKey: 'new-unknown-device', now: new Date(NOW), position: 0, delta: 0
    }))
  })

  it('preserves publication/access checks before device admission', async () => {
    const actor = await makeStudent(h.db)
    const hidden = await createContent(h.db, teacher, {
      type: 'VIDEO', title: 'غير منشور', videoProvider: 'BUNNY',
      bunnyVideoId: VIDEO, visibility: 'STUDENTS_ONLY', publish: false
    })
    await expect(bunnyEmbedForViewer(h.db, actor, hidden.id, NOW, { ip: '10.21.9.1' }))
      .rejects.toSatisfy((error) => error instanceof AppError && error.code === 'CONTENT_NOT_FOUND')
  })
})
