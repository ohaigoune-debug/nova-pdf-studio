import { and, eq } from 'drizzle-orm'
import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import type { DatabaseHandle } from '@/server/db/connect'
import { notifications } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { listAnnouncements, sendAnnouncement } from '@/server/services/announcements.service'
import { addComment, createPost, deleteComment, studentStream, teacherStream, updatePost } from '@/server/services/classroom.service'
import { generateCodes } from '@/server/services/enrollment-codes.service'
import { redeemEnrollmentCode } from '@/server/services/enrollment.service'
import { createGroup } from '@/server/services/groups.service'
import { makeAdmin, makeStudent, makeTeacher, setupDb } from './helpers'

let h: DatabaseHandle
let teacher: Actor
let otherTeacher: Actor
let a1: Actor
let a2: Actor
let b1: Actor
let outsider: Actor
let groupA: { id: string }
let groupB: { id: string }
let foreignGroup: { id: string }

async function join(student: Actor, groupId: string, owner: Actor) {
  const { codes } = await generateCodes(h.db, owner, { groupId, count: 1 })
  await redeemEnrollmentCode(h.db, student, codes[0]!.code)
}
const notes = (userId: string, type: string) => h.db.select().from(notifications).where(and(eq(notifications.userId, userId), eq(notifications.type, type)))

beforeAll(async () => {
  h = await setupDb()
  const admin = await makeAdmin(h.db)
  teacher = await makeTeacher(h.db, admin, 'الأستاذ')
  otherTeacher = await makeTeacher(h.db, admin, 'أستاذ آخر')
  groupA = await createGroup(h.db, teacher, { name: 'الفوج أ' })
  groupB = await createGroup(h.db, teacher, { name: 'الفوج ب' })
  foreignGroup = await createGroup(h.db, otherTeacher, { name: 'فوج غريب' })
  a1 = await makeStudent(h.db, 'تلميذ أ1')
  a2 = await makeStudent(h.db, 'تلميذ أ2')
  b1 = await makeStudent(h.db, 'تلميذ ب1')
  outsider = await makeStudent(h.db, 'تلميذ خارجي')
  await join(a1, groupA.id, teacher)
  await join(a2, groupA.id, teacher)
  await join(b1, groupB.id, teacher)
  await join(outsider, foreignGroup.id, otherTeacher)
})
afterAll(async () => {
  await h.close()
})

describe('الإشعارات: رسالة الأستاذ للجميع أو لأفواج', () => {
  it('للكل تصل كل تلاميذه فقط، ولفوج تصل تلاميذه فقط، ويبقى السجلّ', async () => {
    const all = await sendAnnouncement(h.db, teacher, { title: 'تأجيل الحصة', body: 'حصة السبت يوم الأحد', groupIds: [] })
    expect(all.recipients).toBe(3)
    expect(await notes(a1.userId, 'ANNOUNCEMENT')).toHaveLength(1)
    expect(await notes(outsider.userId, 'ANNOUNCEMENT')).toHaveLength(0)

    const onlyB = await sendAnnouncement(h.db, teacher, { title: 'فوج ب', body: 'أحضروا الكراريس', groupIds: [groupB.id] })
    expect(onlyB.recipients).toBe(1)
    expect(await notes(b1.userId, 'ANNOUNCEMENT')).toHaveLength(2)
    expect(await notes(a1.userId, 'ANNOUNCEMENT')).toHaveLength(1)

    const history = await listAnnouncements(h.db, teacher)
    expect(history.map((x) => x.title)).toEqual(['فوج ب', 'تأجيل الحصة'])
    expect(history[0]?.groupNames).toEqual(['الفوج ب'])
  })

  it('لا يُرسل لفوج أستاذ آخر، ولا لفوج بلا تلاميذ، ولا يرسل التلميذ', async () => {
    await expect(sendAnnouncement(h.db, teacher, { title: 'x x', body: 'y y', groupIds: [foreignGroup.id] })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    const empty = await createGroup(h.db, teacher, { name: 'فوج فارغ' })
    await expect(sendAnnouncement(h.db, teacher, { title: 'x x', body: 'y y', groupIds: [empty.id] })).rejects.toMatchObject({ code: 'NO_RECIPIENTS' })
    await expect(sendAnnouncement(h.db, a1, { title: 'x x', body: 'y y', groupIds: [] })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })
})

describe('القسم الافتراضي', () => {
  it('منشور الفوج لتلاميذه وحدهم، ومنشور «كل الأفواج» للجميع، مع إشعار', async () => {
    const pa = await createPost(h.db, teacher, { groupId: groupA.id, body: 'ناقشوا: ما الفرق بين التشبيه والاستعارة؟' })
    const all = await createPost(h.db, teacher, { groupId: null, body: 'مرحباً بالجميع في القسم', linkUrl: 'https://drive.google.com/x' })
    const seenA = (await studentStream(h.db, a1)).posts.map((p) => p.id)
    const seenB = (await studentStream(h.db, b1)).posts.map((p) => p.id)
    expect(seenA).toEqual(expect.arrayContaining([pa.id, all.id]))
    expect(seenB).toEqual([all.id])
    expect((await studentStream(h.db, outsider)).posts).toHaveLength(0)
    expect(await notes(a1.userId, 'CLASS_POST')).toHaveLength(2)
    expect(await notes(b1.userId, 'CLASS_POST')).toHaveLength(1)
    // ساحة فوج ب عند الأستاذ: منشورات ب والعامّة
    expect((await teacherStream(h.db, teacher, groupB.id)).map((p) => p.id)).toEqual([all.id])
    await expect(teacherStream(h.db, otherTeacher, groupA.id)).rejects.toBeTruthy()
  })

  it('التعليقات: التلميذ يعلّق ويحذف تعليقه لا غيره، والأستاذ يُبلَّغ ويحذف أي تعليق، والإغلاق يمنع', async () => {
    const post = await createPost(h.db, teacher, { groupId: groupA.id, body: 'سؤال اليوم' })
    const c1 = await addComment(h.db, a1, post.id, 'الاستعارة تشبيه حُذف أحد طرفيه')
    const c2 = await addComment(h.db, a2, post.id, 'أوافق')
    expect((await notes(teacher.userId, 'CLASS_COMMENT')).length).toBeGreaterThanOrEqual(2)
    await expect(addComment(h.db, b1, post.id, 'تطفّل')).rejects.toMatchObject({ code: 'POST_NOT_FOUND' })
    await expect(deleteComment(h.db, a2, c1.id)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    await deleteComment(h.db, a1, c1.id)
    await deleteComment(h.db, teacher, c2.id)
    const stream = await studentStream(h.db, a1, groupA.id)
    expect(stream.posts.find((p) => p.id === post.id)?.comments).toHaveLength(0)

    await updatePost(h.db, teacher, post.id, { allowComments: false, pinned: true })
    await expect(addComment(h.db, a1, post.id, 'بعد الإغلاق')).rejects.toMatchObject({ code: 'COMMENTS_CLOSED' })
    await expect(addComment(h.db, teacher, post.id, 'الأستاذ يردّ دائماً')).resolves.toBeTruthy()
    // المثبّت أولاً
    expect((await studentStream(h.db, a1)).posts[0]?.id).toBe(post.id)
  })
})
