/**
 * القسم الافتراضي في تطبيق الآيفون (Build 16، 4 نوفمبر 2026): القراءة والتعليق والحذف بصلاحيات الموقع نفسها،
 * والبلاغ (تذكرة للمشرف + إشعار لأستاذ المنشور) ومفتاح الحجب الذي لا يكشف الحساب (Apple 1.2).
 */
import { and, eq } from 'drizzle-orm'
import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createSession, SESSION_COOKIE } from '@/server/auth/session'
import { getDb } from '@/server/db/client'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications, supportMessages, supportTickets } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { addComment, createPost } from '@/server/services/classroom.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { GET as classroomRoute } from '@/app/api/v1/ios/classroom/route'
import { POST as commentRoute } from '@/app/api/v1/ios/classroom/posts/[id]/comments/route'
import { POST as deleteRoute } from '@/app/api/v1/ios/classroom/comments/[id]/delete/route'
import { POST as reportRoute } from '@/app/api/v1/ios/classroom/comments/[id]/report/route'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

vi.mock('@/server/db/client', () => ({ getDb: vi.fn() }))

let h: DatabaseHandle
let teacher: Actor
let a1: Actor
let a2: Actor
let outsider: Actor
let group: { id: string }
let openPost: string
let closedPost: string
let a2Comment: string
const cookies = new Map<string, string>()

const cookieOf = (a: Actor) => cookies.get(a.userId)!
const get = (a: Actor, q = '') => classroomRoute(new NextRequest(`https://madrasadz.com/api/v1/ios/classroom${q}`, { headers: { cookie: cookieOf(a) } }))
const post = (route: typeof commentRoute, a: Actor, id: string, body: unknown, ios = true) =>
  route(new NextRequest(`https://madrasadz.com/api/v1/ios/classroom/x/${id}`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: cookieOf(a), ...(ios ? { 'x-madrasadz-client': 'ios' } : {}) }, body: JSON.stringify(body) }), { params: Promise.resolve({ id }) })

async function join(student: Actor, groupId: string, owner: Actor) {
  const { codes } = await generateCodes(h.db, owner, { groupId, count: 1 })
  await redeemEnrollmentCode(h.db, student, codes[0]!.code)
}

beforeAll(async () => {
  h = await setupDb()
  vi.mocked(getDb).mockResolvedValue(h.db)
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ')
  const otherTeacher = await makeTeacher(h.db, admin, 'أستاذ آخر')
  group = await createGroup(h.db, teacher, { name: 'فوج الدورة' })
  const foreign = await createGroup(h.db, otherTeacher, { name: 'فوج غريب' })
  a1 = await makeStudent(h.db, 'أمينة')
  a2 = await makeStudent(h.db, 'كريم')
  outsider = await makeStudent(h.db, 'خارجي')
  await join(a1, group.id, teacher)
  await join(a2, group.id, teacher)
  await join(outsider, foreign.id, otherTeacher)
  for (const a of [a1, a2, outsider]) cookies.set(a.userId, `${SESSION_COOKIE}=${(await createSession(h.db, { userId: a.userId })).token}`)
  openPost = (await createPost(h.db, teacher, { groupId: group.id, body: 'واجب الأسبوع: حلّل القصيدة', allowComments: true })).id
  closedPost = (await createPost(h.db, teacher, { groupId: group.id, body: 'إعلان: لا تعليقات', allowComments: false })).id
  a2Comment = (await addComment(h.db, a2, openPost, 'سؤال عن البيت الثالث')).id
  await addComment(h.db, teacher, openPost, 'سأشرحه في الحصة')
})
afterAll(async () => h?.close())

describe('القسم الافتراضي في التطبيق', () => {
  it('التلميذ يرى منشورات فوجه وتعليقاتها؛ تعليق الأستاذ معلَّم، ومفتاح الحجب يختلف من تلميذ لآخر', async () => {
    const res = await get(a1, `?group=${group.id}`)
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data.groups).toEqual([{ id: group.id, name: 'فوج الدورة' }])
    const p = data.posts.find((x: { id: string }) => x.id === openPost)
    expect(p).toMatchObject({ body: 'واجب الأسبوع: حلّل القصيدة', allowComments: true, authorName: 'الأستاذ' })
    const [student, teacherReply] = p.comments
    expect(student).toMatchObject({ body: 'سؤال عن البيت الثالث', authorName: 'كريم', teacher: false, mine: false })
    expect(student.authorKey).toMatch(/^[0-9a-f]{20}$/)
    expect(teacherReply).toMatchObject({ teacher: true })
    expect(JSON.stringify(data)).not.toContain(a2.userId)
    // مفتاح كريم عند أمينة غير مفتاحه عند غيرها (لا يُتتبَّع بين التلاميذ)
    const other = await makeStudent(h.db, 'رابع')
    await join(other, group.id, teacher)
    cookies.set(other.userId, `${SESSION_COOKIE}=${(await createSession(h.db, { userId: other.userId })).token}`)
    const seen = (await (await get(other, `?group=${group.id}`)).json()).data.posts.find((x: { id: string }) => x.id === openPost).comments[0]
    expect(seen.authorKey).not.toBe(student.authorKey)
  })

  it('تلميذ من خارج الفوج لا يرى شيئًا ولا يعلّق ولا يبلّغ', async () => {
    const { data } = await (await get(outsider, `?group=${group.id}`)).json()
    expect(data.posts).toEqual([])
    expect((await post(commentRoute, outsider, openPost, { body: 'تجربة' })).status).toBe(404)
    expect((await post(reportRoute, outsider, a2Comment, {})).status).toBe(404)
  })

  it('التعليق: ترويسة التطبيق إلزامية، والمنشور المغلق يرفض، والتلميذ يحذف تعليقه وحده', async () => {
    expect((await post(commentRoute, a1, openPost, { body: 'شكرًا أستاذ' }, false)).status).toBe(403)
    const ok = await post(commentRoute, a1, openPost, { body: 'شكرًا أستاذ' })
    expect(ok.status).toBe(200)
    const mineId = (await ok.json()).data.id
    expect((await (await post(commentRoute, a1, closedPost, { body: 'تعليق' })).json()).error.code).toBe('COMMENTS_CLOSED')
    const { data } = await (await get(a1, `?group=${group.id}`)).json()
    expect(data.posts.find((x: { id: string }) => x.id === openPost).comments.find((c: { id: string }) => c.id === mineId)).toMatchObject({ mine: true, authorKey: null })
    expect((await post(deleteRoute, a1, a2Comment, {})).status).toBe(403)
    expect((await post(deleteRoute, a1, mineId, {})).status).toBe(200)
  })

  it('البلاغ: تذكرة «المحتوى» بنص التعليق وكاتبه للمشرف، وإشعار لأستاذ المنشور؛ ولا بلاغ عن تعليقك', async () => {
    const res = await post(reportRoute, a1, a2Comment, { reason: 'كلام غير لائق' })
    expect(res.status).toBe(200)
    const { data } = await res.json()
    expect(data).toMatchObject({ reported: true })
    const [t] = await h.db.select().from(supportTickets).where(and(eq(supportTickets.userId, a1.userId), eq(supportTickets.number, data.ticketNumber)))
    expect(t).toMatchObject({ kind: 'CONTENT', subject: 'بلاغ عن تعليق في القسم الافتراضي' })
    const [m] = await h.db.select().from(supportMessages).where(eq(supportMessages.ticketId, t!.id))
    expect(m!.body).toContain('سؤال عن البيت الثالث')
    expect(m!.body).toContain('كريم')
    expect(m!.body).toContain('كلام غير لائق')
    const notes = await h.db.select().from(notifications).where(and(eq(notifications.userId, teacher.userId), eq(notifications.title, 'بلاغ عن تعليق في قسمك')))
    expect(notes).toHaveLength(1)
    const own = (await addComment(h.db, a1, openPost, 'تعليقي')).id
    expect((await post(reportRoute, a1, own, {})).status).toBe(422)
  })
})
