/**
 * POST /api/v1/play/attempts/:id/answers — إجابات PLAY من المتصفح دفعةً واحدة (4 نوفمبر 2026):
 * الدخول، نفس الأصل، والتحقق من الشكل؛ التصحيح نفسه مُختبر في play-exams-service.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { playExamSets } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { readExamSetFile } from '@/server/play/exams/engine'
import type { ExamSetDocument } from '@/server/play/exams/types'
import { startExamAttempt } from '@/server/services/play-exams.service'
import { setPlayProfile } from '@/server/services/play.service'
import { POST } from '@/app/api/v1/play/attempts/[id]/answers/route'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))
let current: Actor | null = null
// الصفحات تقرأ الكوكي عبر next/headers؛ هنا يكفي حساب الطلب (الموديول الأصلي server-only)
vi.mock('@/server/auth/current-user', async () => {
  const { AppError } = await import('@/server/lib/errors')
  return {
    requireRole: vi.fn(async () => {
      if (!current) throw new AppError('AUTH_REQUIRED')
      return current
    })
  }
})

let h: DatabaseHandle
let attemptId: string
let doc: ExamSetDocument

const call = (body: unknown, origin = 'https://madrasadz.com') =>
  POST(new Request(`https://madrasadz.com/api/v1/play/attempts/${attemptId}/answers`, { method: 'POST', headers: { 'content-type': 'application/json', host: 'madrasadz.com', origin }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: attemptId }) })

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  const { doc: d, checksum } = readExamSetFile('content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json')
  doc = structuredClone(d)
  doc.set_id = 'batch-route-test'
  doc.status = 'APPROVED'
  doc.source.verified = true
  for (const s of doc.steps) if (s.type !== 'essay_builder') s.review_status = 'approved'
  const [set] = await h.db.insert(playExamSets).values({ kind: 'TEST', gradeCode: '2AS', streamCodes: d.source.streams, subjectCode: 'AR', year: d.source.year, term: 1, paper: null, scoreTotal: 20, stepCount: d.steps.length, setId: doc.set_id, title: d.source.title, status: 'APPROVED', publishable: true, checksum: 'batch-' + checksum, document: doc }).returning()
  const s = await makeStudent(h.db, 'تلميذ الدفعات')
  await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: 'SCI' })
  attemptId = (await startExamAttempt(h.db, s, set!.id, 'PRACTICE')).attemptId
  current = s
})
afterAll(async () => h?.close())

describe('batch answers route', () => {
  it('refuses another origin, a signed-out visitor, and a malformed body', async () => {
    expect((await call({ answers: {} }, 'https://evil.example')).status).toBe(403)
    const me = current
    current = null
    expect((await call({ answers: {} })).status).toBe(401)
    current = me
    expect((await call({ answers: { s01: { type: 'mcq', choice: 'x' } } })).status).toBe(422)
  })

  it('saves several steps in one request and finishes', async () => {
    const st = doc.steps[0]!
    const a = st.answer.type === 'mcq' ? { type: 'mcq', choice: st.answer.correct } : null
    const res = await call({ answers: a ? { [st.id]: a } : {}, finish: true })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toMatchObject({ completed: true, saved: a ? 1 : 0 })
  })
})
