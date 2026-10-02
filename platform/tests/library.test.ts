import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { curriculumNodes, levels, subjects } from '@/server/db/schema'
import { seedCurriculum } from '@/server/db/seed-curriculum'
import type { Actor } from '@/server/lib/actor'
import { createContent } from '@/server/services/content.service'
import { librarySearch, librarySections, publicQuestion, resourceHref, subjectHub, subjectsOverview } from '@/server/services/library.service'
import { createBankQuestion } from '@/server/services/question-bank.service'
import { upsertResource } from '@/server/services/resources.service'
import { makeAdmin, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let arabic: string
let math: string
let l3: string
let l2: string
let nodeId: string
let publicQ: string

beforeAll(async () => {
  h = await setupDb()
  await seedCurriculum(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  arabic = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'ARABIC')))[0]!.id
  math = (await h.db.select({ id: subjects.id }).from(subjects).where(eq(subjects.code, 'MATH')))[0]!.id
  l3 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '3AS')))[0]!.id
  l2 = (await h.db.select({ id: levels.id }).from(levels).where(eq(levels.code, '2AS')))[0]!.id
  nodeId = (await h.db.insert(curriculumNodes).values({ subjectId: arabic, levelId: l3, kind: 'UNIT', title: 'البلاغة', slug: 'bal-lib', sortOrder: 1 }).returning())[0]!.id
  await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'lesson-1', title: 'درس الاستعارة المكنية والتصريحية', description: 'شرح الاستعارة بأنواعها مع أمثلة', type: 'LESSON', subjectId: arabic, levelId: l3, curriculumNodeId: nodeId, sourceUrl: 'https://madrasadz.com/l/1' })
  await upsertResource(h.db, { sourceCode: 'dzexams', ref: 'https://www.dzexams.com/ar/bac/2023/arabe', title: 'بكالوريا 2023 اللغة العربية — آداب', type: 'EXAM', subjectId: arabic, levelId: l3, examYear: 2023, isOfficial: true, fileUrl: 'https://www.dzexams.com/f/2023-ar.pdf' })
  await upsertResource(h.db, { sourceCode: 'dzexams', ref: 'https://www.dzexams.com/ar/2as/arabe/devoir1', title: 'فرض الفصل الأول في الاستعارة', type: 'HOMEWORK', subjectId: arabic, levelId: l2 })
  await upsertResource(h.db, { sourceCode: 'youtube', ref: 'yt-1', title: 'الاحتمالات الشرطية — شرح', type: 'VIDEO', subjectId: math, levelId: l3, youtubeVideoId: 'abc123' })
  await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'draft-1', title: 'مسودة عن الاستعارة', type: 'LESSON', subjectId: arabic, levelId: l3, status: 'DRAFT' })
  await upsertResource(h.db, { sourceCode: 'madrasadz', ref: 'premium-1', title: 'استعارة للمشتركين فقط', type: 'SUMMARY', subjectId: arabic, levelId: l3, accessLevel: 'PREMIUM' })
  publicQ = (await createBankQuestion(h.db, teacher, { kind: 'EXERCISE', type: 'OPEN', title: 'تمرين الاستعارة', body: 'استخرج الاستعارة المكنية من النصّ وبيّن أثرها.', solution: 'الاستعارة في «ابتسم الصبح».', subjectId: arabic, levelId: l3, curriculumNodeId: nodeId, visibility: 'PUBLIC', points: 4 })).id
  await createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'سؤال فرعي عن الاستعارة', points: 2, parentId: publicQ, sortOrder: 0 })
  await createBankQuestion(h.db, teacher, { type: 'OPEN', body: 'سؤال خاص عن الاستعارة', subjectId: arabic, levelId: l3, points: 1 })
  await createContent(h.db, teacher, { type: 'VIDEO', title: 'الاستعارة في شعر المتنبي', externalUrl: 'https://www.youtube.com/watch?v=zzzzzzzzzzz', videoProvider: 'YOUTUBE', visibility: 'PUBLIC', publish: true })
})

afterAll(async () => {
  await h.close()
})

describe('المكتبة الموحّدة — المرحلة 9', () => {
  it('البحث يجمع الموارد العامة المنشورة والبنك العام ومحتوى الأكاديمية، ويخفي المسودات والخاص والمدفوع', async () => {
    const r = await librarySearch(h.db, { q: 'الاستعارة' })
    const titles = r.hits.map((x) => x.title)
    expect(titles).toContain('درس الاستعارة المكنية والتصريحية')
    expect(titles).toContain('فرض الفصل الأول في الاستعارة')
    expect(titles).toContain('تمرين الاستعارة')
    expect(titles).toContain('الاستعارة في شعر المتنبي')
    expect(titles).not.toContain('مسودة عن الاستعارة')
    expect(titles).not.toContain('استعارة للمشتركين فقط')
    expect(titles.some((t) => t.includes('خاص'))).toBe(false)
    const lesson = r.hits.find((x) => x.title.startsWith('درس'))!
    expect(lesson).toMatchObject({ kind: 'RESOURCE', typeLabel: 'درس', subjectName: 'اللغة العربية', external: true, href: 'https://madrasadz.com/l/1', source: 'منصة مدرسة' })
    expect(r.hits.find((x) => x.kind === 'QUESTION')).toMatchObject({ href: `/library/q/${publicQ}`, typeLabel: 'تمرين من البنك', external: false })
    expect(r.hits.find((x) => x.kind === 'CONTENT')).toMatchObject({ typeLabel: 'درس مرئي', external: false })
    // قيود: الصف والقسم
    expect((await librarySearch(h.db, { q: 'الاستعارة', levelId: l2 })).hits.map((x) => x.title)).toEqual(['فرض الفصل الأول في الاستعارة'])
    expect((await librarySearch(h.db, { q: 'الاستعارة', section: 'exercises' })).hits.map((x) => x.kind).sort()).toEqual(['QUESTION', 'RESOURCE'])
    expect((await librarySearch(h.db, { q: 'الاستعارة', section: 'exams' })).hits).toEqual([])
    // سنة البكالوريا والرسمي أولاً
    const bac = await librarySearch(h.db, { q: 'بكالوريا 2023' })
    expect(bac.hits[0]).toMatchObject({ title: 'بكالوريا 2023 اللغة العربية — آداب', official: true, year: 2023, external: true, href: 'https://www.dzexams.com/f/2023-ar.pdf' })
    expect((await librarySearch(h.db, { q: 'x' })).hits).toEqual([])
  })

  it('الأقسام والمواد بالأعداد، وروابط الموارد', async () => {
    const s = await librarySections(h.db)
    expect(Object.fromEntries(s.sections.map((x) => [x.key, x.count]))).toEqual({ lessons: 1, exercises: 1, exams: 1, videos: 1, other: 0 })
    expect(s).toMatchObject({ questions: 1, officialExams: 1, total: 4 })
    expect((await librarySections(h.db, { subjectId: math })).sections.find((x) => x.key === 'videos')!.count).toBe(1)
    const subs = await subjectsOverview(h.db)
    expect(subs.find((x) => x.id === arabic)).toMatchObject({ resources: 3, questions: 1, videos: 0 })
    expect(subs.find((x) => x.id === math)).toMatchObject({ resources: 1, questions: 0, videos: 1 })
    expect(resourceHref({ id: 'r1', type: 'VIDEO', educatorId: 'e1', fileUrl: null, sourceUrl: null, youtubeVideoId: 'x' })).toEqual({ href: '/videos/r1', external: false })
    expect(resourceHref({ id: 'r1', type: 'VIDEO', educatorId: null, fileUrl: null, sourceUrl: null, youtubeVideoId: 'x' })).toEqual({ href: 'https://www.youtube.com/watch?v=x', external: true })
    expect(resourceHref({ id: 'r1', type: 'LESSON', educatorId: null, fileUrl: null, sourceUrl: null, youtubeVideoId: null })).toEqual({ href: '#', external: false })
  })

  it('مركز المادة: الصفوف، الدروس بالأعداد، أحدث الموارد، والسؤال العام', async () => {
    const hub = await subjectHub(h.db, 'arabic')
    expect(hub.subject.name).toBe('اللغة العربية')
    expect(hub.levels.map((l) => l.count)).toEqual([1, 2])
    expect(hub.questions).toBe(1)
    expect(hub.examYears).toEqual([2023])
    expect(hub.latest.lessons.map((x) => x.title)).toEqual(['درس الاستعارة المكنية والتصريحية'])
    expect(hub.latest.exams[0]).toMatchObject({ official: true, year: 2023 })
    expect(hub.lessons).toEqual([])
    const l3hub = await subjectHub(h.db, 'arabic', { levelId: l3 })
    expect(l3hub.lessons).toEqual(expect.arrayContaining([{ id: nodeId, title: 'البلاغة', kind: 'UNIT', parentId: null, count: 1 }])) // شجرة 3AS مزروعة إلى جانب الوحدة المُنشأة
    expect(l3hub.latest.exercises).toEqual([])
    await expect(subjectHub(h.db, 'nope')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const q = await publicQuestion(h.db, publicQ)
    expect(q.q.title).toBe('تمرين الاستعارة')
    expect(q.children).toHaveLength(1)
    expect(q.nodeTitle).toBe('البلاغة')
    const priv = (await librarySearch(h.db, { q: 'الاستعارة', kinds: ['QUESTION'] })).hits
    expect(priv).toHaveLength(1)
  })
})
