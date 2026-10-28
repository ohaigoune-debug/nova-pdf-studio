/** واجهة بيانات iOS v1 — نفس صلاحيات البوابة حرفيًا. PGlite في الذاكرة، وبيانات وهمية فقط. */
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { createContent } from '@/server/services/content.service'
import type { iosApiCourse, iosApiHome, iosApiLesson } from '@/server/services/ios-api.service'
import { createCourse, enrollStudent } from '@/server/services/courses.service'
import { uploadFile } from '@/server/services/files.service'
import { makeAdmin, makeStudent, makeTeacher, publishLegacyCourse, setupDb, workspaceIdOfTeacher } from './helpers'

const state: { db: unknown } = { db: null }

type Home = Awaited<ReturnType<typeof iosApiHome>>
type Course = Extract<Awaited<ReturnType<typeof iosApiCourse>>, { needsTerms: false }>
type Lesson = Awaited<ReturnType<typeof iosApiLesson>>
/** الرد كما يصل إلى التطبيق: كل الحقول ممكنة، والاختبار يقرأ ما يخص المسار */
type Data = Home & Course & Lesson & { needsTerms?: boolean }
vi.mock('@/server/db/client', () => ({ getDb: async () => state.db }))

let h: DatabaseHandle
let admin: Actor
let teacher: Actor
let student: Actor
let other: Actor
let course: Awaited<ReturnType<typeof createCourse>>
const slugs: Record<string, string> = {}

const routes = {
  capabilities: () => import('@/app/api/v1/ios/capabilities/route'),
  home: () => import('@/app/api/v1/ios/home/route'),
  course: () => import('@/app/api/v1/ios/courses/[slug]/route'),
  lesson: () => import('@/app/api/v1/ios/lessons/[slug]/route')
}

async function cookieFor(actor: Actor | null) {
  if (!actor) return undefined
  const s = await createSession(h.db, { userId: actor.userId })
  return `${SESSION_COOKIE}=${s.token}`
}

async function call(kind: 'home' | 'course' | 'lesson', actor: Actor | null, slug = '') {
  const cookie = await cookieFor(actor)
  const req = new NextRequest(`https://madrasadz.com/api/v1/ios/${kind}${slug ? '/' + encodeURIComponent(slug) : ''}`, { headers: cookie ? { cookie } : {} })
  const mod = await routes[kind]()
  const res = kind === 'home' ? await (mod as typeof import('@/app/api/v1/ios/home/route')).GET(req) : await (mod as typeof import('@/app/api/v1/ios/lessons/[slug]/route')).GET(req, { params: Promise.resolve({ slug: encodeURIComponent(slug) }) })
  const text = await res.text()
  return { status: res.status, headers: res.headers, text, body: JSON.parse(text) as { ok: boolean; data: Data; error?: { code: string; reason?: string } } }
}

function expectPrivate(r: { headers: Headers; text: string }) {
  expect(r.headers.get('cache-control')).toBe('private, no-store')
  expect(r.headers.get('access-control-allow-origin')).toBeNull()
  expect(r.text).not.toMatch(/exp=|sig=|@test\.dz|\b0\d{9}\b|passwordHash/)
}

beforeAll(async () => {
  h = await setupDb()
  state.db = h.db
  admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin)
  student = await makeStudent(h.db)
  other = await makeStudent(h.db)
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  course = await createCourse(h.db, admin, { title: 'دورة الواجهة', workspaceId, season: '2026/2027', priceDzd: 0 })
  await publishLegacyCourse(h.db, course.id)
  await enrollStudent(h.db, admin, { studentId: student.studentId!, courseId: course.id, source: 'MANUAL' })
  const group = [course.groupId]
  const add = async (key: string, input: Parameters<typeof createContent>[2]) => { slugs[key] = (await createContent(h.db, teacher, { publish: true, ...input })).slug }
  await add('public', { title: 'سلسلة الفروض — الثالثة ثانوي — علوم', type: 'LESSON', visibility: 'PUBLIC', body: 'عام' })
  await add('public2', { title: 'سلسلة الفروض — الثالثة ثانوي — آداب', type: 'LESSON', visibility: 'PUBLIC', body: 'عام' })
  await add('session2', { title: 'الحصة 2 — البلاغة', type: 'LESSON', visibility: 'GROUP_ONLY', groupIds: group, body: '# البلاغة\nنص' })
  await add('session1', { title: 'الحصة 1 — مدخل', type: 'LESSON', visibility: 'GROUP_ONLY', groupIds: group, body: 'مدخل' })
  await add('video', { title: 'شرح الحصة 1', type: 'VIDEO', visibility: 'GROUP_ONLY', groupIds: group, videoProvider: 'YOUTUBE', externalUrl: 'https://youtu.be/dQw4w9WgXcQ' })
  await add('homework', { title: 'الفرض الأول', type: 'LESSON', visibility: 'GROUP_ONLY', groupIds: group, body: 'فرض' })
  const file = await uploadFile(h.db, teacher, { originalName: 'test.pdf', mimeType: 'application/pdf', bytes: Buffer.from('%PDF-1.4 api') })
  await add('pdf', { title: 'اختبار الفصل الأول', type: 'PDF', visibility: 'GROUP_ONLY', groupIds: group, fileId: file.id, allowDownload: true })
  await createContent(h.db, teacher, { title: 'مسودة مخفية', type: 'LESSON', visibility: 'PUBLIC', publish: false })
})
afterEach(() => vi.unstubAllEnvs())
afterAll(async () => h?.close())

describe('capabilities', () => {
  it('عامة وغير مخزَّنة', async () => {
    const res = (await routes.capabilities()).GET()
    expect(res.headers.get('cache-control')).toBe('private, no-store')
    expect(await res.json()).toEqual({ ok: true, data: { apiVersion: 1, features: ['home', 'course', 'lesson'], minAppBuild: 1 } })
  })
})

describe('home', () => {
  it('الزائر: الدروس العامة مجمّعة، بلا دورات ولا أدوات ولا ترويسة حساب', async () => {
    const r = await call('home', null)
    expect(r.status).toBe(200)
    expectPrivate(r)
    expect(r.headers.get('x-madrasadz-account')).toBeNull()
    expect(r.body.data.account).toBeNull()
    expect(r.body.data.courses).toEqual([])
    expect(r.body.data.tools).toEqual([])
    const group = r.body.data.freeLessons.find((e) => e.kind === 'group')
    if (group?.kind !== 'group') throw new Error('expected a group')
    expect(group).toMatchObject({ heading: 'سلسلة الفروض', detail: 'الثالثة ثانوي' })
    expect(group.items.map((i) => i.label).sort()).toEqual(['آداب', 'علوم'])
    expect(r.text).not.toContain('مسودة مخفية')
    expect(r.text).not.toContain('الحصة 2')
  })

  it('التلميذ: دوراته وترويسة حسابه', async () => {
    const r = await call('home', student)
    expect(r.status).toBe(200)
    expectPrivate(r)
    expect(r.headers.get('x-madrasadz-account')).toBe(student.userId)
    expect(r.body.data.account).toEqual({ id: student.userId })
    expect(r.body.data.courses).toEqual([{ slug: course.slug, title: 'دورة الواجهة', teacherName: expect.any(String), season: '2026/2027', status: 'ACTIVE', accessEndsOn: null, termsAccepted: true }])
    expect(r.body.data.tools.map((t) => t.id)).toEqual(['play', 'practice', 'quizzes', 'exams'])
  })

  it('حسابات الطاقم: 403 بسبب ROLE', async () => {
    for (const actor of [teacher, admin]) {
      const r = await call('home', actor)
      expect(r.status).toBe(403)
      expect(r.body.error).toMatchObject({ code: 'FORBIDDEN', reason: 'ROLE' })
    }
  })

  it('بوابة الهاتف: 403 بسبب PHONE_VERIFICATION_REQUIRED قبل أي محتوى', async () => {
    vi.stubEnv('SMS_PROVIDER', 'webhook')
    vi.stubEnv('SMS_WEBHOOK_URL', 'https://sms.invalid/test')
    const r = await call('home', other)
    expect(r.status).toBe(403)
    expect(r.body.error).toMatchObject({ code: 'FORBIDDEN', reason: 'PHONE_VERIFICATION_REQUIRED' })
    expect(r.text).not.toContain('سلسلة')
  })
})

describe('courses/[slug]', () => {
  it('الأقسام بالترتيب وأرقام الحصص', async () => {
    const r = await call('course', student, course.slug)
    expect(r.status).toBe(200)
    expectPrivate(r)
    expect(r.headers.get('x-madrasadz-account')).toBe(student.userId)
    const data = r.body.data
    expect(data).toMatchObject({ needsTerms: false, course: { slug: course.slug, title: 'دورة الواجهة' }, webPath: `/ios/course/${encodeURIComponent(course.slug)}` })
    expect(data.sections.map((s) => s.id)).toEqual(['lessons', 'videos', 'homework', 'tests'])
    expect(data.sections[0]!.items.map((i) => [i.session, i.displayTitle])).toEqual([[1, 'مدخل'], [2, 'البلاغة']])
    expect(data.sections[1]!.items[0]).toMatchObject({ type: 'VIDEO', videoProvider: 'YOUTUBE', session: 1 })
    expect(data.sections[3]!.items[0]).toMatchObject({ title: 'اختبار الفصل الأول', type: 'PDF' })
  })

  it('الزائر 401، وتلميذ آخر لا يرى الدورة، والطاقم 403', async () => {
    expect((await call('course', null, course.slug)).body.error).toMatchObject({ code: 'AUTH_REQUIRED' })
    expect((await call('course', null, course.slug)).status).toBe(401)
    const r = await call('course', other, course.slug)
    expect(r.status).toBe(404)
    expect(r.body.error?.code).toBe('COURSE_NOT_FOUND')
    expect((await call('course', teacher, course.slug)).body.error).toMatchObject({ code: 'FORBIDDEN', reason: 'ROLE' })
  })

  it('الشروط تبقى في الويب', async () => {
    const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
    const terms = await createCourse(h.db, admin, { title: 'دورة بشروط', workspaceId, season: '2026/2027', termsText: 'شروط' })
    await publishLegacyCourse(h.db, terms.id)
    await enrollStudent(h.db, admin, { studentId: student.studentId!, courseId: terms.id, source: 'MANUAL' })
    const r = await call('course', student, terms.slug)
    expect(r.body.data).toEqual({ needsTerms: true, course: { slug: terms.slug, title: 'دورة بشروط' }, webPath: `/ios/course/${encodeURIComponent(terms.slug)}` })
  })
})

describe('lessons/[slug]', () => {
  it('درس عام للزائر، ودرس الدورة للمسجّل فقط', async () => {
    const pub = await call('lesson', null, slugs.public!)
    expect(pub.status).toBe(200)
    expect(pub.body.data.lesson).toMatchObject({ type: 'LESSON', bodyMarkdown: 'عام', media: { kind: 'none' } })
    expect(pub.body.data.viewer).toBeNull()
    expect((await call('lesson', null, slugs.session2!)).status).toBe(404)
    expect((await call('lesson', other, slugs.session2!)).status).toBe(404)
    const own = await call('lesson', student, slugs.session2!)
    expect(own.status).toBe(200)
    expectPrivate(own)
    expect(own.headers.get('x-madrasadz-account')).toBe(student.userId)
    expect(own.body.data.lesson).toMatchObject({ title: 'الحصة 2 — البلاغة', bodyMarkdown: '# البلاغة\nنص', webPath: `/ios/lesson/${encodeURIComponent(slugs.session2!)}` })
  })

  it('الوسائط: يوتيوب بمعرّفه، وPDF بمعرّف المحتوى دون رابط ملف', async () => {
    const video = await call('lesson', student, slugs.video!)
    expect(video.body.data.lesson.media).toEqual({ kind: 'youtube', youtubeId: 'dQw4w9WgXcQ', contentId: expect.any(String) })
    expect(video.body.data.viewer).toEqual({ name: expect.any(String), code: student.userId.slice(0, 8) })
    expect(JSON.stringify(video.body)).not.toContain('@')
    const pdf = await call('lesson', student, slugs.pdf!)
    expect(pdf.body.data.lesson.media).toMatchObject({ kind: 'pdf', allowDownload: true, contentId: expect.any(String) })
    expectPrivate(pdf)
    expect(pdf.text).not.toMatch(/storage|signed|\/api\/v1\/media/)
  })

  it('الطاقم 403 ROLE، والانتهاء يحجب درس الدورة ولا يحجب العام', async () => {
    expect((await call('lesson', teacher, slugs.public!)).body.error).toMatchObject({ code: 'FORBIDDEN', reason: 'ROLE' })
    await h.db.update(courseEnrollments).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(courseEnrollments.courseId, course.id))
    expect((await call('lesson', student, slugs.session1!)).status).toBe(404)
    expect((await call('lesson', student, slugs.public!)).status).toBe(200)
    const home = await call('home', student)
    expect(home.body.data.courses.find((c) => c.slug === course.slug)?.status).toBe('ENDED')
    expect((await call('course', student, course.slug)).body.error?.code).toBe('COURSE_NOT_ENROLLED')
    await h.db.update(profiles).set({ phoneVerifiedAt: new Date() }).where(eq(profiles.userId, student.userId))
  })
})
