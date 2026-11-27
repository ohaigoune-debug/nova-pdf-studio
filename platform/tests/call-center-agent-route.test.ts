/** واجهة الصندوق المحلي عبر HTTPS: الرمز، السحب، النتيجة، والمكالمة الواردة مع تسجيلها. PGlite فقط. */
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { ccInbound, ccTasks } from '@/server/db/schema'
import { saveCallCenterSettings, rotateAgentToken } from '@/server/services/call-center.service'
import { GET, POST } from '@/app/api/v1/callcenter/agent/[action]/route'
import { makeAdmin, setupDb, uniq } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let token = ''
const ctx = (action: string) => ({ params: Promise.resolve({ action }) })
const req = (path: string, init: RequestInit & { token?: string | null } = {}) => {
  const headers = new Headers(init.headers)
  if (init.token !== null) headers.set('authorization', `Bearer ${init.token ?? token}`)
  return new Request(`https://madrasadz.test/api/v1/callcenter/agent/${path}`, { ...init, headers })
}
const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } })

beforeAll(async () => {
  process.env.UPLOADS_DIR = mkdtempSync(join(tmpdir(), 'cc-route-'))
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2031-03-03T09:00:00Z')) // 10:00 بالجزائر
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  const admin = await makeAdmin(h.db)
  await saveCallCenterSettings(h.db, admin, { mode: 'test', testPhones: ['0550000009'] })
  token = (await rotateAgentToken(h.db, admin)).token
})
afterAll(async () => {
  vi.useRealTimers()
  await h?.close()
})

it('بلا رمز أو برمز خاطئ: 401، ومسار غير معروف: 404', async () => {
  expect((await GET(req('ping', { token: null }), ctx('ping'))).status).toBe(401)
  expect((await GET(req('ping', { token: 'cc_wrong' }), ctx('ping'))).status).toBe(401)
  expect((await POST(req('nope', json({})), ctx('nope'))).status).toBe(404)
})

it('ping: الشرائح وساعات الاتصال والنصوص، ويسجّل ظهور الجهاز', async () => {
  const res = await GET(req('ping?v=0.1'), ctx('ping'))
  expect(res.status).toBe(200)
  const body = await res.json()
  expect(body).toMatchObject({ ok: true, mode: 'test', outboundSims: [1, 2, 3], inboundSim: 4, callingHours: { start: 540, end: 1200, tz: 'Africa/Algiers' } })
  expect(body.scripts.SUSPENDED.digits).toEqual(['1', '2', '3'])
})

it('pull ثم report: المكالمة تُسحب مرة واحدة، والنتيجة تُطبَّق', async () => {
  const [task] = await h.db.insert(ccTasks).values({ kind: 'CALL', rule: 'SUSPENDED_CALL', dedupeKey: uniq('route'), target: 'ORDER', phone: '0550000009', script: 'SUSPENDED', runAfter: new Date('2031-03-03T08:00:00Z') }).returning()
  const pulled = await (await POST(req('pull', json({ limit: 3, sims: [{ slot: 1, ok: true, signal: 80 }, { slot: 2, ok: true }, { slot: 3, ok: true }] })), ctx('pull'))).json()
  expect(pulled.tasks).toHaveLength(1)
  expect(pulled.tasks[0]).toMatchObject({ id: task!.id, dial: '+213550000009', kind: 'CALL' })
  expect((await (await POST(req('pull', json({})), ctx('pull'))).json()).tasks).toHaveLength(0)
  expect((await POST(req('report', json({ taskId: task!.id, outcome: 'MAYBE' })), ctx('report'))).status).toBe(400)
  const rep = await (await POST(req('report', json({ taskId: task!.id, outcome: 'ANSWERED', digit: '1', durationSec: 20 })), ctx('report'))).json()
  expect(rep).toMatchObject({ ok: true, status: 'DONE', action: 'REDELIVER' })
})

it('inbound بملف صوتي (multipart)', async () => {
  const form = new FormData()
  form.set('phone', '0550000009')
  form.set('sim', '4')
  form.set('choice', '1')
  form.set('durationSec', '35')
  form.set('recording', new Blob([Buffer.from('RIFFfakewav')], { type: 'audio/wav' }), 'msg.wav')
  const res = await POST(req('inbound', { method: 'POST', body: form }), ctx('inbound'))
  expect(res.status).toBe(200)
  const body = await res.json()
  const [row] = await h.db.select().from(ccInbound).where(eq(ccInbound.id, body.id))
  expect(row).toMatchObject({ phone: '0550000009', choice: '1', simSlot: 4, durationSec: 35, recordingMime: 'audio/wav' })
  expect((await POST(req('inbound', json({ phone: 'x' })), ctx('inbound'))).status).toBe(400)
})
