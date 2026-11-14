import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { navFor } from '@/components/layout/nav'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications, teacherAssistants } from '@/server/db/schema'
import { assertAttendanceStaff, isClassroomAssistant, type Actor } from '@/server/lib/actor'
import { createAssistantCode, joinAsAssistant, listAssistants } from '@/server/services/assistants.service'
import { listSessions } from '@/server/services/class-sessions.service'
import { addComment, assistantClassGroups, assistantStream, createPost, deleteComment, studentStream, updatePost } from '@/server/services/classroom.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { actorOf, makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let otherTeacher: Actor
let helper: Actor
let attendanceHelper: Actor
let a1: Actor
let groupA: { id: string }
let foreignGroup: { id: string }

async function joinAs(owner: Actor, email: string, scope: 'FULL' | 'CLASSROOM') {
  const c = await createAssistantCode(h.db, owner, { email, scope })
  const r = await joinAsAssistant(h.db, { code: c.code, email, fullName: scope === 'CLASSROOM' ? 'أستاذ مساعد' : 'مساعد حضور', password: 'Assist@12345' })
  return actorOf(h.db, r.userId)
}
const notes = (userId: string) => h.db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, 'CLASS_COMMENT')))

beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ')
  otherTeacher = await makeTeacher(h.db, admin, 'أستاذ آخر')
  groupA = await createGroup(h.db, teacher, { name: 'دورة الأدب' })
  foreignGroup = await createGroup(h.db, otherTeacher, { name: 'دورة غريبة' })
  a1 = await makeStudent(h.db, 'أمينة بن سالم')
  const { codes } = await generateCodes(h.db, teacher, { groupId: groupA.id, count: 1 })
  await redeemEnrollmentCode(h.db, a1, codes[0]!.code)
  helper = await joinAs(teacher, 'helper@test.dz', 'CLASSROOM')
  attendanceHelper = await joinAs(teacher, 'attend@test.dz', 'FULL')
})
afterAll(async () => {
  await h.close()
})

describe('«الأستاذ المساعد» في القسم الافتراضي', () => {
  it('الجلسة تحمل نطاقه، والقائمة: القسم الافتراضي ثم حسابه فقط؛ ومساعد الحضور كما كان', async () => {
    expect(helper.role).toBe('ASSISTANT')
    expect(helper.assistantScope).toBe('CLASSROOM')
    expect(isClassroomAssistant(helper)).toBe(true)
    expect(attendanceHelper.assistantScope).toBe('FULL')
    expect(isClassroomAssistant(attendanceHelper)).toBe(false)

    const hrefs = navFor('ASSISTANT', { assistantScope: 'CLASSROOM' }).flatMap((s) => s.items.map((i) => i.href))
    expect(hrefs).toEqual(['/assistant/classroom', '/assistant/notifications', '/assistant/settings'])
    expect(navFor('ASSISTANT', { assistantScope: 'FULL' }).flatMap((s) => s.items.map((i) => i.href))).toContain('/assistant/students')

    const [m] = await h.db.select({ scope: teacherAssistants.scope }).from(teacherAssistants).where(eq(teacherAssistants.userId, helper.userId))
    expect(m?.scope).toBe('CLASSROOM')
    const list = await listAssistants(h.db, teacher)
    expect(list.assistants.map((a) => a.scope).sort()).toEqual(['CLASSROOM', 'FULL'])
  })

  it('لا يرى الحضور ولا الحصص ولا قوائم التلاميذ', async () => {
    expect(() => assertAttendanceStaff(helper)).toThrow()
    await expect(listSessions(h.db, helper)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    // مساعد الحضور لم يتغيّر
    expect(() => assertAttendanceStaff(attendanceHelper)).not.toThrow()
  })

  it('يرى منشورات أستاذه وحده، ويصفّيها بدوراته؛ ومساعد الحضور لا قسم له', async () => {
    const mine = await createPost(h.db, teacher, { groupId: groupA.id, body: 'سؤال اليوم: ما الاستعارة؟' })
    const foreign = await createPost(h.db, otherTeacher, { groupId: foreignGroup.id, body: 'منشور أستاذ آخر' })
    const all = await assistantStream(h.db, helper)
    expect(all.map((p) => p.id)).toContain(mine.id)
    expect(all.map((p) => p.id)).not.toContain(foreign.id)
    expect((await assistantStream(h.db, helper, groupA.id)).map((p) => p.id)).toEqual([mine.id])
    expect(await assistantStream(h.db, helper, foreignGroup.id)).toEqual([])
    expect((await assistantClassGroups(h.db, helper)).map((g) => g.id)).toEqual([groupA.id])
    await expect(assistantStream(h.db, attendanceHelper)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(assistantClassGroups(h.db, attendanceHelper)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('يُبلَّغ بسؤال التلميذ ويردّ بشارة «الأستاذ المساعد»، ولا ينشر', async () => {
    const post = await createPost(h.db, teacher, { groupId: groupA.id, body: 'اطرحوا أسئلتكم هنا' })
    await addComment(h.db, a1, post.id, 'ما الفرق بين الكناية والمجاز؟')
    const n = await notes(helper.userId)
    expect(n.some((x) => x.link === `/assistant/classroom?group=${groupA.id}#post-${post.id}`)).toBe(true)
    // مساعد الحضور لا يُبلَّغ
    expect(await notes(attendanceHelper.userId)).toHaveLength(0)

    await addComment(h.db, helper, post.id, 'الكناية لفظ أُريد به لازم معناه مع جواز إرادة المعنى الأصلي')
    const seen = (await studentStream(h.db, a1, groupA.id)).posts.find((p) => p.id === post.id)!
    expect(seen.comments.at(-1)?.authorRole).toBe('ASSISTANT')

    await expect(createPost(h.db, helper, { groupId: groupA.id, body: 'منشور' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(updatePost(h.db, helper, post.id, { pinned: true })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await expect(addComment(h.db, attendanceHelper, post.id, 'تطفّل')).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('يُخفي تعليق التلميذ وحده، لا تعليق الأستاذ؛ ولا يكتب إن أُغلقت التعليقات أو في قسم أستاذ آخر', async () => {
    const post = await createPost(h.db, teacher, { groupId: groupA.id, body: 'نقاش' })
    const bad = await addComment(h.db, a1, post.id, 'تعليق غير لائق')
    const byTeacher = await addComment(h.db, teacher, post.id, 'تعليق الأستاذ')
    const view = (await assistantStream(h.db, helper, groupA.id)).find((p) => p.id === post.id)!
    expect(view.comments.find((c) => c.id === bad.id)?.canDelete).toBe(true)
    expect(view.comments.find((c) => c.id === byTeacher.id)?.canDelete).toBe(false)

    await deleteComment(h.db, helper, bad.id)
    await expect(deleteComment(h.db, helper, byTeacher.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    const after = (await studentStream(h.db, a1, groupA.id)).posts.find((p) => p.id === post.id)!
    expect(after.comments.map((c) => c.id)).toEqual([byTeacher.id])

    await updatePost(h.db, teacher, post.id, { allowComments: false })
    await expect(addComment(h.db, helper, post.id, 'بعد الإغلاق')).rejects.toMatchObject({ code: 'COMMENTS_CLOSED' })

    const foreign = await createPost(h.db, otherTeacher, { groupId: foreignGroup.id, body: 'قسم آخر' })
    await expect(addComment(h.db, helper, foreign.id, 'تطفّل')).rejects.toMatchObject({ code: 'POST_NOT_FOUND' })
  })
})
