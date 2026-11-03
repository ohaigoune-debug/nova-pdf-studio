/**
 * بنك البكالوريات السابقة في تطبيق الآيفون (3 نوفمبر 2026): مجاني، بالمرشّحات، وروابط الموضوع والحلّ.
 */
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { levels, streams, students, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { upsertResource } from '@/server/services/resources.service'
import { GET as listRoute } from '@/app/api/v1/ios/bac/route'
import { GET as paperRoute } from '@/app/api/v1/ios/bac/[id]/route'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let sci: string
let lit: string
let withSolution: string
let plainHttp: string

const get = (url: string) => listRoute(new NextRequest(url))
const paper = (id: string, cookie?: string) => paperRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/bac/${id}`, cookie ? { headers: { cookie } } : undefined), { params: Promise.resolve({ id }) })

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  await seedCurriculum(h.db)
  const [l3] = await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS'))
  sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id
  lit = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'LIT')))[0]!.id
  const [ar] = await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC'))
  const common = { sourceCode: 'dzexams', levelId: l3!.id, subjectId: ar?.id ?? null, isOfficial: true, accessLevel: 'PUBLIC' as const, status: 'PUBLISHED' as const, examSession: 'NORMAL' }
  const sol = await upsertResource(h.db, { ...common, streamId: lit, ref: 'https://www.dzexams.com/ar/annales/A2024', part: 'correction', type: 'SOLUTION', title: 'تصحيح العربية آداب 2024', fileUrl: 'https://cdn.test/ar-2024-corrige.pdf', examYear: 2024 })
  withSolution = (await upsertResource(h.db, { ...common, streamId: lit, ref: 'https://www.dzexams.com/ar/annales/A2024', type: 'EXAM', title: 'موضوع العربية آداب وفلسفة — بكالوريا 2024', fileUrl: 'https://cdn.test/ar-2024.pdf', examYear: 2024, hasSolution: true, solutionResourceId: sol.id })).id
  plainHttp = (await upsertResource(h.db, { ...common, streamId: sci, ref: 'https://www.dzexams.com/ar/annales/A2021', type: 'EXAM', title: 'موضوع العربية علوم تجريبية — بكالوريا 2021', fileUrl: 'http://old.test/ar-2021.pdf', examYear: 2021 })).id
})
afterAll(async () => h.close())

describe('بنك البكالوريات في التطبيق', () => {
  it('القائمة مجانية بلا حساب، الأحدث أولًا، مع المرشّحات', async () => {
    const res = await get('https://madrasadz.com/api/v1/ios/bac')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const { data } = await res.json()
    expect(data.items.map((i: { id: string }) => i.id)).toEqual([withSolution, plainHttp])
    expect(data.items[0]).toMatchObject({ year: 2024, hasPaper: true, hasSolution: true, official: true })
    expect(data.facets.years.map((y: { year: number }) => y.year)).toEqual([2024, 2021])
    expect(data.myStreamId).toBeNull()
    const lit2024 = await (await get(`https://madrasadz.com/api/v1/ios/bac?stream=${lit}&year=2024`)).json()
    expect(lit2024.data.items.map((i: { id: string }) => i.id)).toEqual([withSolution])
    expect((await get('https://madrasadz.com/api/v1/ios/bac?year=20x4')).status).toBe(422)
    expect((await get('https://madrasadz.com/api/v1/ios/bac?stream=abc')).status).toBe(422)
  })

  it('شعبة التلميذ تُقترح حين يكون مسجّلًا', async () => {
    const s = await makeStudent(h.db, 'تلميذ البكالوريا')
    await h.db.update(students).set({ streamId: lit }).where(eq(students.id, s.studentId!))
    const token = (await createSession(h.db, { userId: s.userId })).token
    const res = await listRoute(new NextRequest('https://madrasadz.com/api/v1/ios/bac', { headers: { cookie: `${SESSION_COOKIE}=${token}` } }))
    expect((await res.json()).data.myStreamId).toBe(lit)
  })

  it('الموضوع: رابط الموضوع والحلّ؛ رابط http غير آمن لا يُعطى', async () => {
    const a = (await (await paper(withSolution)).json()).data
    expect(a).toMatchObject({ title: 'موضوع العربية آداب وفلسفة — بكالوريا 2024', year: 2024, paper: { url: 'https://cdn.test/ar-2024.pdf', inApp: false }, solution: { url: 'https://cdn.test/ar-2024-corrige.pdf', inApp: false } })
    const b = (await (await paper(plainHttp)).json()).data
    expect(b).toMatchObject({ paper: null, solution: null })
    expect((await paper('00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect((await paper('not-an-id')).status).toBe(404)
  })
})
