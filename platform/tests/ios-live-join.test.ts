/**
 * الحصص المباشرة في تطبيق الآيفون (Build 18، 21 نوفمبر 2026): صفحة الدورة ترسل id الحصة ونافذة الانضمام
 * دون الرابط نفسه، والرابط لا يُعطى إلا عبر POST /api/v1/ios/live/:id/join بقواعد زر «انضم» في الموقع.
 */
import { eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import type { DatabaseHandle } from '@/server/db/connect'
import { courseEnrollments, courses, groups, teachers } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { iosApiCourse } from '@/server/services/ios-api.service'
import { createLiveSession } from '@/server/services/live.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb, workspaceIdOfTeacher } from './helpers'

const state: { db: unknown } = { db: null }
vi.mock('@/server/db/client', () => ({ getDb: async () => state.db }))

let h: DatabaseHandle
let admin: Actor
let student: Actor
let outsider: Actor
let courseId: string
const slug = 'ios-live-course'
const JOIN_URL = 'https://zoom.us/j/987654321?pwd=ios-secret'
const ids = { soon: '', later: '' }

async function join(actor: Actor | null, id: string, opts: { client?: string | null } = {}) {
  const headers: Record<string, string> = {}
  if (opts.client !== null) headers['x-madrasadz-client'] = opts.client ?? 'ios'
  if (actor) headers.cookie = `${SESSION_COOKIE}=${(await createSession(h.db, { userId: actor.userId })).token}`
  const { POST } = await import('@/app/api/v1/ios/live/[id]/join/route')
  const res = await POST(new NextRequest(`https://madrasadz.com/api/v1/ios/live/${id}/join`, { method: 'POST', headers }), { params: Promise.resolve({ id }) })
  return { status: res.status, body: (await res.json()) as { ok: boolean; data?: { url: string; provider: string; title: string }; error?: { code: string } } }
}

beforeAll(async () => {
  process.env.SESSION_SECRET ??= 'test-session-secret'
  h = await setupDb()
  state.db = h.db
  admin = await makeAdmin(h.db)
  const teacher = await makeTeacher(h.db, admin, 'أستاذ البث')
  student = await makeStudent(h.db, 'تلميذ الآيفون')
  outsider = await makeStudent(h.db, 'تلميذ غير مشترك')
  const workspaceId = await workspaceIdOfTeacher(h.db, teacher)
  const [t] = await h.db.select({ id: teachers.id }).from(teachers).where(eq(teachers.workspaceId, workspaceId))
  const [g] = await h.db.insert(groups).values({ workspaceId, teacherId: t!.id, name: 'فوج البث' }).returning()
  const [c] = await h.db.insert(courses).values({ slug, title: 'دورة البث', workspaceId, groupId: g!.id, season: '2026/2027', status: 'PUBLISHED', priceDzd: 0 }).returning()
  courseId = c!.id
  await h.db.insert(courseEnrollments).values({ courseId, studentId: student.studentId!, status: 'ACTIVE', acceptedTermsAt: new Date(), acceptedTermsVersion: 1 })
  ids.soon = (await createLiveSession(h.db, admin, { courseId, title: 'حصة بعد 5 دقائق', startsAt: new Date(Date.now() + 5 * 60_000), durationMinutes: 60, provider: 'ZOOM', joinUrl: JOIN_URL })).id
  ids.later = (await createLiveSession(h.db, admin, { courseId, title: 'حصة الغد', startsAt: new Date(Date.now() + 26 * 3_600_000), durationMinutes: 90, provider: 'ZOOM', joinUrl: JOIN_URL })).id
})

afterAll(async () => {
  await h.close()
})

describe('الحصص المباشرة في الآيفون', () => {
  it('صفحة الدورة: id الحصة ونافذة الانضمام، دون رابط الانضمام', async () => {
    const r = await iosApiCourse(h.db, student, slug)
    if (r.needsTerms) throw new Error('شروط غير متوقعة')
    expect(r.upcoming.map((u) => u.id)).toEqual([ids.soon, ids.later])
    const soon = r.upcoming[0]!
    expect(soon).toMatchObject({ title: 'حصة بعد 5 دقائق', provider: 'ZOOM', durationMinutes: 60 })
    expect(new Date(soon.joinOpensAt!).getTime()).toBe(new Date(soon.startsAt!).getTime() - 15 * 60_000)
    expect(new Date(soon.joinClosesAt!).getTime()).toBeGreaterThan(new Date(soon.startsAt!).getTime() + 60 * 60_000)
    expect(JSON.stringify(r)).not.toContain('zoom.us')
  })

  it('الانضمام داخل النافذة يعطي الرابط؛ قبلها LIVE_NOT_OPEN', async () => {
    const ok = await join(student, ids.soon)
    expect(ok.status).toBe(200)
    expect(ok.body.data).toEqual({ url: JOIN_URL, provider: 'ZOOM', title: 'حصة بعد 5 دقائق' })
    const early = await join(student, ids.later)
    expect(early.body.ok).toBe(false)
    expect(early.body.error?.code).toBe('LIVE_NOT_OPEN')
  })

  it('غير المشترك ممنوع، وبلا جلسة أو من غير التطبيق ممنوع، والمعرّف الخاطئ غير موجود', async () => {
    expect((await join(outsider, ids.soon)).body.error?.code).toBe('COURSE_NOT_ENROLLED')
    expect((await join(null, ids.soon)).body.error?.code).toBe('AUTH_REQUIRED')
    expect((await join(student, ids.soon, { client: null })).body.error?.code).toBe('FORBIDDEN')
    const bad = await join(student, 'not-a-uuid')
    expect(bad.status).toBe(404)
    expect(bad.body.error?.code).toBe('LIVE_NOT_FOUND')
  })
})
