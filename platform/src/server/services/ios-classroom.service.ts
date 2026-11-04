/**
 * القسم الافتراضي في تطبيق الآيفون (Build 16، 4 نوفمبر 2026، طلب المالك): منشورات الأستاذ لفوج الدورة وتعليقات
 * التلاميذ — الصلاحيات نفسها في الموقع (classroom.service): التلميذ لا يرى إلا أفواجه، ويحذف تعليقه وحده.
 *
 * محتوى ينشره المستخدمون (Apple 1.2): بلاغ عن أي تعليق يصل فورًا إلى المشرف (تذكرة دعم) وإلى أستاذ المنشور،
 * والأستاذ يحذف أي تعليق في مساحته؛ وحجب كاتب تعليق يتم في التطبيق بمفتاح ثابت لا يكشف حسابه (authorKey).
 */
import { createHash } from 'node:crypto'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { classComments, classPosts, profiles } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import { addComment, deleteComment, studentStream } from './classroom.service'
import { requireIosLearningStudent } from './ios-learning.service'
import { notify } from './notifications.service'
import { openTicket } from './support.service'

/** مفتاح ثابت لكاتب التعليق من منظور هذا التلميذ وحده (لا يُستنتج منه حساب ولا يتطابق بين تلميذين) */
const authorKeyFor = (viewerId: string, authorId: string) => createHash('sha256').update(`${viewerId}|${authorId}|classroom`).digest('hex').slice(0, 20)

export async function iosClassroom(db: Db, actor: Actor | null, groupId: string | null) {
  const student = await requireIosLearningStudent(db, actor)
  if (groupId) assertUuid(groupId, 'VALIDATION')
  const { groups, posts } = await studentStream(db, student, groupId)
  // معرّفات الكتّاب لمفتاح الحجب (studentStream لا يعيدها)
  const commentIds = posts.flatMap((p) => p.comments.map((c) => c.id))
  const authorIds = new Map(
    commentIds.length ? (await db.select({ id: classComments.id, author: classComments.authorUserId }).from(classComments).where(inArray(classComments.id, commentIds))).map((r) => [r.id, r.author] as const) : []
  )
  return {
    groups,
    posts: posts.map((p) => ({
      id: p.id,
      body: p.body,
      linkUrl: p.linkUrl,
      file: p.file,
      pinned: p.pinned,
      allowComments: p.allowComments,
      createdAt: p.createdAt.toISOString(),
      groupName: p.groupName,
      authorName: p.authorName,
      comments: p.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt.toISOString(),
        authorName: c.authorName,
        teacher: c.authorRole === 'TEACHER' || c.authorRole === 'ASSISTANT',
        mine: c.mine,
        authorKey: c.mine ? null : authorKeyFor(student.userId, authorIds.get(c.id) ?? c.id)
      }))
    }))
  }
}

export async function iosAddComment(db: Db, actor: Actor | null, postId: string, text: string) {
  const student = await requireIosLearningStudent(db, actor)
  const c = await addComment(db, student, postId, text)
  return { id: c.id }
}

export async function iosDeleteComment(db: Db, actor: Actor | null, commentId: string) {
  const student = await requireIosLearningStudent(db, actor)
  await deleteComment(db, student, commentId)
  return { deleted: true }
}

/** بلاغ عن تعليق: تذكرة «المحتوى» للمشرف بنصّ التعليق وكاتبه، وإشعار لأستاذ المنشور ليحذفه إن لزم */
export async function iosReportComment(db: Db, actor: Actor | null, commentId: string, reason: string | null) {
  const student = await requireIosLearningStudent(db, actor)
  assertUuid(commentId, 'POST_NOT_FOUND')
  const [row] = await db
    .select({ comment: classComments, post: classPosts, authorName: profiles.fullName })
    .from(classComments)
    .innerJoin(classPosts, eq(classPosts.id, classComments.postId))
    .leftJoin(profiles, eq(profiles.userId, classComments.authorUserId))
    .where(and(eq(classComments.id, commentId), isNull(classComments.deletedAt), isNull(classPosts.deletedAt)))
    .limit(1)
  if (!row) throw new AppError('POST_NOT_FOUND')
  // يرى التلميذ هذا المنشور؟ (الصلاحية نفسها لقراءة القسم)
  const visible = await studentStream(db, student, row.post.groupId)
  if (!visible.posts.some((p) => p.id === row.post.id)) throw new AppError('POST_NOT_FOUND')
  if (row.comment.authorUserId === student.userId) throw new AppError('VALIDATION', { field: 'commentId' })
  const why = reason?.trim().slice(0, 500) || '—'
  const ticket = await openTicket(db, student, {
    kind: 'CONTENT',
    subject: 'بلاغ عن تعليق في القسم الافتراضي',
    body: `تعليق ${row.authorName ?? '—'}:\n«${row.comment.body.slice(0, 1500)}»\n\nعلى منشور: «${row.post.body.slice(0, 200)}»\n\nسبب البلاغ: ${why}\n(من تطبيق الآيفون)`
  })
  await notify(db, {
    userId: row.post.authorUserId,
    workspaceId: row.post.workspaceId,
    type: 'CLASS_COMMENT',
    title: 'بلاغ عن تعليق في قسمك',
    body: row.comment.body.length > 140 ? `${row.comment.body.slice(0, 140)}…` : row.comment.body,
    link: `/teacher/classroom${row.post.groupId ? `?group=${row.post.groupId}` : ''}#post-${row.post.id}`
  })
  return { reported: true, ticketNumber: ticket.number }
}
