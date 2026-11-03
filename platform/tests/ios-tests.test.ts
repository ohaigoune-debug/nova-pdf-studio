/**
 * بنك الفروض والاختبارات في التطبيق (Build 14): الفصل ← السنة ← المادة ← القائمة، والنسخة التفاعلية في PLAY.
 */
import { eq, inArray } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import { levels, playExamSets, resources, streams, students, subjects } from '@/server/db/schema'
import { readExamSetFile, validateExamSet } from '@/server/play/exams/engine'
import type { ExamSetDocument } from '@/server/play/exams/types'
import { setPlayProfile } from '@/server/services/play.service'
import { upsertResource } from '@/server/services/resources.service'
import { GET as testsRoute } from '@/app/api/v1/ios/tests/route'
import { GET as paperRoute } from '@/app/api/v1/ios/papers/[id]/route'
import { makeStudent, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let cookie: string
let l2: string
let arabic: string
let hw1: string
let t2: string
let setUuid: string

const get = async (query: string) => {
  const res = await testsRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/tests${query}`, { headers: { cookie } }))
  return { status: res.status, body: await res.json() }
}

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  await seedCurriculum(h.db)
  const all = await h.db.select({ id: levels.id, code: levels.code }).from(levels)
  l2 = all.find((l) => l.code === '2AS')!.id
  const l3 = all.find((l) => l.code === '3AS')!.id
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  const sci = (await h.db.select({ id: streams.id }).from(streams).where(eq(streams.code, 'SCI')))[0]!.id

  const s = await makeStudent(h.db, 'تلميذة الفروض')
  await h.db.update(students).set({ levelId: l2, streamId: sci }).where(eq(students.id, s.studentId!))
  await setPlayProfile(h.db, s, { gradeCode: '2AS', streamCode: 'SCI' })
  cookie = `${SESSION_COOKIE}=${(await createSession(h.db, { userId: s.userId })).token}`

  const common = { sourceCode: 'dzexams', subjectId: arabic, isOfficial: false, accessLevel: 'PUBLIC' as const, status: 'PUBLISHED' as const }
  const sol = await upsertResource(h.db, { ...common, levelId: l2, ref: 'https://cdn.test/hw1', part: 'correction', type: 'SOLUTION', title: 'تصحيح الفرض الأول', fileUrl: 'https://cdn.test/hw1-corrige.pdf' })
  hw1 = (await upsertResource(h.db, { ...common, levelId: l2, ref: 'https://cdn.test/hw1', type: 'HOMEWORK', title: 'الفرض الأول في اللغة العربية — الثانية ثانوي', fileUrl: 'https://cdn.test/hw1.pdf', hasSolution: true, solutionResourceId: sol.id })).id
  t2 = (await upsertResource(h.db, { ...common, levelId: l2, ref: 'https://cdn.test/t2', type: 'TEST', title: 'اختبار الفصل الثاني في اللغة العربية', fileUrl: 'https://cdn.test/t2.pdf' })).id
  const other = (await upsertResource(h.db, { ...common, levelId: l3, ref: 'https://cdn.test/hw3', type: 'HOMEWORK', title: 'فرض الثالثة ثانوي', fileUrl: 'https://cdn.test/hw3.pdf' })).id
  await h.db.update(resources).set({ schoolTerm: 1, academicYear: 2025 }).where(inArray(resources.id, [hw1, other, sol.id]))
  await h.db.update(resources).set({ schoolTerm: 2 }).where(eq(resources.id, t2))

  // نسخة تفاعلية معتمدة لفرض الفصل الأول (نفس ملف اختبارات PLAY)
  const { doc } = readExamSetFile('content/play-exams/sets/2AS/AR/ar-2as-t1-sci-03.json')
  const approved: ExamSetDocument = structuredClone(doc)
  approved.set_id = 'ios-tests-devoir-1'
  approved.status = 'APPROVED'
  approved.source.verified = true
  for (const step of approved.steps) if (step.type !== 'essay_builder') step.review_status = 'approved'
  expect(validateExamSet(approved).publishable).toBe(true)
  const [row] = await h.db
    .insert(playExamSets)
    .values({ kind: 'DEVOIR', gradeCode: '2AS', streamCodes: doc.source.streams, subjectCode: 'AR', year: 2025, term: 1, paper: null, scoreTotal: 20, stepCount: doc.steps.length, setId: approved.set_id, title: 'الفرض الأول — تفاعلي', status: 'APPROVED', publishable: true, checksum: 'ios-tests', document: approved })
    .returning()
  setUuid = row!.id
})
afterAll(async () => h.close())

describe('بنك الفروض والاختبارات', () => {
  it('الفصول بأعدادها لسنة التلميذ، وسنته أولًا', async () => {
    const { status, body } = await get('')
    expect(status).toBe(200)
    expect(body.data.terms).toEqual([{ term: 1, count: 1 }, { term: 2, count: 1 }, { term: 3, count: 0 }])
    expect(body.data.myLevelId).toBe(l2)
    expect(body.data.levels[0]).toMatchObject({ id: l2, code: '2AS' })
    expect(body.data.subjects).toEqual([])
  })

  it('الفصل ← السنة ← المادة ← القائمة مع النسخة التفاعلية للفصل نفسه', async () => {
    const subjectsStep = (await get(`?term=1&level=${l2}`)).body.data
    expect(subjectsStep.subjects).toEqual([expect.objectContaining({ id: arabic, count: 1 })])
    const t1 = (await get(`?term=1&level=${l2}&subject=${arabic}`)).body.data
    expect(t1.papers.map((p: { id: string }) => p.id)).toEqual([hw1])
    expect(t1.papers[0]).toMatchObject({ hasSolution: true, hasFile: true })
    expect(t1.interactive).toEqual([expect.objectContaining({ id: setUuid, kind: 'DEVOIR' })])
    const t2list = (await get(`?term=2&level=${l2}&subject=${arabic}`)).body.data
    expect(t2list.papers.map((p: { id: string }) => p.id)).toEqual([t2])
    expect(t2list.interactive).toEqual([])
    expect((await get('?term=4')).status).toBe(422)
    expect((await get('?level=x')).status).toBe(422)
  })

  it('صفحة الموضوع: الموضوع والحلّ و«العبه تفاعليًا»', async () => {
    const res = await paperRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/papers/${hw1}`, { headers: { cookie } }), { params: Promise.resolve({ id: hw1 }) })
    const { data } = await res.json()
    expect(data).toMatchObject({ term: 1, year: 2025, paper: { url: 'https://cdn.test/hw1.pdf', inApp: false }, solution: { url: 'https://cdn.test/hw1-corrige.pdf', inApp: false }, play: { id: setUuid } })
    const noPlay = await paperRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/papers/${t2}`, { headers: { cookie } }), { params: Promise.resolve({ id: t2 }) })
    expect((await noPlay.json()).data).toMatchObject({ play: null, solution: null })
    expect((await paperRoute(new NextRequest('https://madrasadz.com/api/v1/ios/papers/nope'), { params: Promise.resolve({ id: 'nope' }) })).status).toBe(404)
  })
})
