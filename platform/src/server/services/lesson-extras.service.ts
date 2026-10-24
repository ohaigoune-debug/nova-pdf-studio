/**
 * ما تحت فيديو الحصة (قرار المالك 2026-10-24):
 *  - اختبار QCM مرتبط بالحصة: الأستاذ يختاره، فيُستهدف تلقائياً بأفواج الحصة؛ التلميذ يراه زرّاً تحت الفيديو.
 *  - تعليقات: التلميذ يكتب ⇒ PENDING ولا يراه غيره؛ الأستاذ يوافق (مع ردّ اختياري) أو يرفض. لا شيء يمرّ عشوائياً.
 */
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentTargets, lessonComments, lessonQuizzes, profiles, quizTargets, quizzes, teachers } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { getContentForStudent } from './content.service'
import { notifyMany } from './notifications.service'
import { assertStudentQuizAccess } from './quizzes.service'

const COMMENT_MAX = 1000

async function teacherContent(db: Db, actor: Actor, contentId: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(contentId, 'CONTENT_NOT_FOUND')
  const [c] = await db.select().from(content).where(and(eq(content.id, contentId), isNull(content.deletedAt))).limit(1)
  if (!c) throw new AppError('CONTENT_NOT_FOUND')
  if (actor.role === 'TEACHER' && c.workspaceId !== actor.workspaceId) throw new AppError('CONTENT_NOT_FOUND')
  return c
}

/* ───────────── QCM ───────────── */

/** الأستاذ يربط اختباراً بالحصة (null = فكّ الربط). الاختبار يُستهدف بأفواج الحصة كي يصل إليه من يرى الحصة. */
export async function setLessonQuiz(db: Db, actor: Actor, contentId: string, quizId: string | null): Promise<void> {
  const c = await teacherContent(db, actor, contentId)
  if (!quizId) {
    await db.delete(lessonQuizzes).where(eq(lessonQuizzes.contentId, c.id))
    return
  }
  assertUuid(quizId, 'QUIZ_NOT_FOUND')
  const [q] = await db.select({ id: quizzes.id, workspaceId: quizzes.workspaceId, isPublic: quizzes.isPublic }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1)
  if (!q) throw new AppError('QUIZ_NOT_FOUND')
  if (actor.role === 'TEACHER' && q.workspaceId !== actor.workspaceId) throw new AppError('QUIZ_NOT_FOUND')
  await db.insert(lessonQuizzes).values({ contentId: c.id, quizId: q.id }).onConflictDoUpdate({ target: lessonQuizzes.contentId, set: { quizId: q.id, createdAt: new Date() } })
  if (!q.isPublic) {
    const groupsOfLesson = (await db.select({ groupId: contentTargets.groupId }).from(contentTargets).where(eq(contentTargets.contentId, c.id))).map((r) => r.groupId).filter((g): g is string => Boolean(g))
    const existing = new Set((await db.select({ groupId: quizTargets.groupId }).from(quizTargets).where(eq(quizTargets.quizId, q.id))).map((r) => r.groupId))
    const missing = groupsOfLesson.filter((g) => !existing.has(g))
    if (missing.length) await db.insert(quizTargets).values(missing.map((groupId) => ({ quizId: q.id, groupId })))
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'lesson.quiz_set', entityType: 'content', entityId: c.id, newValue: { quizId: q.id } })
}

export async function lessonQuizForTeacher(db: Db, actor: Actor, contentId: string): Promise<string | null> {
  const c = await teacherContent(db, actor, contentId)
  const [r] = await db.select({ quizId: lessonQuizzes.quizId }).from(lessonQuizzes).where(eq(lessonQuizzes.contentId, c.id)).limit(1)
  return r?.quizId ?? null
}

/** اختبار الحصة للتلميذ إن كان منشوراً ومتاحاً له؛ وإلا null */
export async function lessonQuizForStudent(db: Db, actor: Actor, contentId: string): Promise<{ id: string; title: string; questions: number } | null> {
  const [r] = await db.select({ quizId: lessonQuizzes.quizId, title: quizzes.title }).from(lessonQuizzes).innerJoin(quizzes, eq(quizzes.id, lessonQuizzes.quizId)).where(eq(lessonQuizzes.contentId, contentId)).limit(1)
  if (!r || !actor.studentId) return null
  try {
    await assertStudentQuizAccess(db, actor.studentId, r.quizId)
  } catch {
    return null
  }
  const [n] = await db.select({ n: sql<number>`(select count(*)::int from questions q where q.quiz_id = ${r.quizId})` }).from(quizzes).where(eq(quizzes.id, r.quizId)).limit(1)
  return { id: r.quizId, title: r.title, questions: n?.n ?? 0 }
}

/* ───────────── التعليقات ───────────── */

export interface LessonCommentView {
  id: string
  body: string
  status: string
  reply: string | null
  authorName: string
  mine: boolean
  createdAt: Date
}

/** تعليقات الحصة كما يراها التلميذ: الموافَق عليها + تعليقاته هو (مع حالتها) */
export async function listLessonComments(db: Db, actor: Actor, contentId: string): Promise<LessonCommentView[]> {
  assertUuid(contentId, 'CONTENT_NOT_FOUND')
  const rows = await db
    .select({ c: lessonComments, name: profiles.fullName })
    .from(lessonComments)
    .leftJoin(profiles, eq(profiles.userId, lessonComments.userId))
    .where(and(eq(lessonComments.contentId, contentId), or(eq(lessonComments.status, 'APPROVED'), eq(lessonComments.userId, actor.userId))))
    .orderBy(desc(lessonComments.createdAt))
    .limit(100)
  return rows.map((r) => ({ id: r.c.id, body: r.c.body, status: r.c.status, reply: r.c.reply, authorName: r.name ?? '—', mine: r.c.userId === actor.userId, createdAt: r.c.createdAt }))
}

/** التلميذ يعلّق على حصة يصل إليها ⇒ PENDING + إشعار لأستاذ الحصة */
export async function addLessonComment(db: Db, actor: Actor, slug: string, body: string): Promise<{ id: string }> {
  const item = await getContentForStudent(db, actor, slug)
  const text = body.trim()
  if (text.length < 2 || text.length > COMMENT_MAX) throw new AppError('VALIDATION', { field: 'body' })
  const [recent] = await db.select({ n: sql<number>`count(*)::int` }).from(lessonComments).where(and(eq(lessonComments.userId, actor.userId), sql`${lessonComments.createdAt} > now() - interval '10 minutes'`))
  if ((recent?.n ?? 0) >= 5) throw new AppError('RATE_LIMITED')
  const [row] = await db.insert(lessonComments).values({ contentId: item.id, userId: actor.userId, body: text }).returning({ id: lessonComments.id })
  const [c] = await db.select({ workspaceId: content.workspaceId, authorUserId: content.authorUserId }).from(content).where(eq(content.id, item.id)).limit(1)
  const teacherUsers = c?.workspaceId ? (await db.select({ userId: teachers.userId }).from(teachers).where(eq(teachers.workspaceId, c.workspaceId))).map((t) => t.userId) : []
  const targets = [...new Set([...(c?.authorUserId ? [c.authorUserId] : []), ...teacherUsers])]
  if (targets.length) await notifyMany(db, targets.map((userId) => ({ userId, workspaceId: c?.workspaceId ?? null, type: 'SYSTEM' as const, title: `تعليق جديد بانتظار موافقتك — ${item.title}`, body: `${actor.fullName}: ${text.slice(0, 120)}`, link: '/teacher/comments' })))
  return { id: row!.id }
}

export interface PendingComment {
  id: string
  body: string
  authorName: string
  contentTitle: string
  contentSlug: string
  createdAt: Date
}

/** تعليقات تنتظر موافقة الأستاذ (مساحته) أو المشرف (الكل) */
export async function listPendingComments(db: Db, actor: Actor): Promise<PendingComment[]> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const rows = await db
    .select({ id: lessonComments.id, body: lessonComments.body, authorName: profiles.fullName, contentTitle: content.title, contentSlug: content.slug, createdAt: lessonComments.createdAt })
    .from(lessonComments)
    .innerJoin(content, eq(content.id, lessonComments.contentId))
    .leftJoin(profiles, eq(profiles.userId, lessonComments.userId))
    .where(and(eq(lessonComments.status, 'PENDING'), actor.role === 'TEACHER' ? eq(content.workspaceId, actor.workspaceId!) : undefined))
    .orderBy(lessonComments.createdAt)
    .limit(200)
  return rows.map((r) => ({ ...r, authorName: r.authorName ?? '—' }))
}

export async function pendingCommentsCount(db: Db, actor: Actor): Promise<number> {
  return (await listPendingComments(db, actor)).length
}

/** الأستاذ يوافق (مع ردّ اختياري) أو يرفض؛ صاحب التعليق يُخطر */
export async function moderateLessonComment(db: Db, actor: Actor, commentId: string, decision: 'APPROVED' | 'REJECTED', reply?: string | null): Promise<void> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(commentId, 'NOT_FOUND')
  const [row] = await db.select({ c: lessonComments, workspaceId: content.workspaceId, title: content.title, slug: content.slug }).from(lessonComments).innerJoin(content, eq(content.id, lessonComments.contentId)).where(eq(lessonComments.id, commentId)).limit(1)
  if (!row) throw new AppError('NOT_FOUND')
  if (actor.role === 'TEACHER' && row.workspaceId !== actor.workspaceId) throw new AppError('NOT_FOUND')
  await db.update(lessonComments).set({ status: decision, reply: reply?.trim().slice(0, COMMENT_MAX) || null, moderatedByUserId: actor.userId, moderatedAt: new Date() }).where(eq(lessonComments.id, commentId))
  if (decision === 'APPROVED') await notifyMany(db, [{ userId: row.c.userId, workspaceId: row.workspaceId, type: 'SYSTEM', title: `نُشر تعليقك على «${row.title}»`, body: reply?.trim() ? `ردّ الأستاذ: ${reply.trim().slice(0, 140)}` : null, link: `/student/lessons/${row.slug}` }])
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: row.workspaceId, action: 'lesson.comment_moderate', entityType: 'lesson_comment', entityId: commentId, newValue: { decision } })
}

