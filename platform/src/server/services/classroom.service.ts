/**
 * القسم الافتراضي (على نمط Google Classroom): لكل فوج «ساحة» ينشر فيها الأستاذ
 * (نصّ، رابط، ملف، تثبيت، إغلاق التعليقات) ويعلّق التلاميذ. المنشور بلا فوج يظهر لكل أفواج الأستاذ.
 * التلميذ لا يرى إلا ساحات أفواجه، والأستاذ يحذف أي تعليق في مساحته.
 */
import { and, asc, desc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { classComments, classPosts, files, groups, groupStudents, profiles, users } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { signFileUrl } from '@/server/lib/storage'
import { REACHABLE_STATUSES, studentUserIds } from './announcements.service'
import { assertGroupAccess } from './groups.service'
import { notify, notifyMany } from './notifications.service'

export const MAX_POST = 5000
export const MAX_COMMENT = 1500

type PostRow = typeof classPosts.$inferSelect

export interface StreamComment {
  id: string
  body: string
  createdAt: Date
  authorName: string
  authorRole: string
  mine: boolean
  canDelete: boolean
}

export interface StreamPost {
  id: string
  body: string
  linkUrl: string | null
  file: { name: string; url: string } | null
  pinned: boolean
  allowComments: boolean
  createdAt: Date
  groupId: string | null
  groupName: string | null
  authorName: string
  comments: StreamComment[]
}

/* ------------------------------ الوصول ------------------------------ */

/** أفواج التلميذ التي ما زال فيها (مع مساحة كل فوج) */
export async function studentClassGroups(db: Db, actor: Actor) {
  assertRole(actor, 'STUDENT')
  if (!actor.studentId) throw new AppError('FORBIDDEN')
  return db
    .select({ id: groups.id, name: groups.name, workspaceId: groups.workspaceId })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(and(eq(groupStudents.studentId, actor.studentId), inArray(groupStudents.status, [...REACHABLE_STATUSES]), isNull(groups.deletedAt)))
    .orderBy(groups.name)
}

/** شرط المنشورات التي يراها التلميذ: منشورات أفواجه، والعامّة في مساحات أساتذته */
function studentScope(gs: { id: string; workspaceId: string }[]): SQL | undefined {
  if (gs.length === 0) return undefined
  return or(inArray(classPosts.groupId, gs.map((g) => g.id)), and(isNull(classPosts.groupId), inArray(classPosts.workspaceId, [...new Set(gs.map((g) => g.workspaceId))])))
}

async function loadPost(db: Db, postId: string): Promise<PostRow> {
  assertUuid(postId, 'POST_NOT_FOUND')
  const [p] = await db.select().from(classPosts).where(and(eq(classPosts.id, postId), isNull(classPosts.deletedAt))).limit(1)
  if (!p) throw new AppError('POST_NOT_FOUND')
  return p
}

async function assertPostAccess(db: Db, actor: Actor, post: PostRow): Promise<void> {
  if (actor.role === 'TEACHER') {
    if (post.workspaceId !== actor.workspaceId) throw new AppError('POST_NOT_FOUND')
    return
  }
  if (actor.role !== 'STUDENT') throw new AppError('FORBIDDEN')
  const gs = await studentClassGroups(db, actor)
  const ok = post.groupId ? gs.some((g) => g.id === post.groupId) : gs.some((g) => g.workspaceId === post.workspaceId)
  if (!ok) throw new AppError('POST_NOT_FOUND')
}

/* ------------------------------ القراءة ------------------------------ */

async function hydrate(db: Db, actor: Actor, posts: PostRow[]): Promise<StreamPost[]> {
  if (posts.length === 0) return []
  const ids = posts.map((p) => p.id)
  const [comments, authors, groupRows, fileRows] = await Promise.all([
    db
      .select({ c: classComments, name: profiles.fullName, role: users.role })
      .from(classComments)
      .innerJoin(users, eq(users.id, classComments.authorUserId))
      .leftJoin(profiles, eq(profiles.userId, classComments.authorUserId))
      .where(and(inArray(classComments.postId, ids), isNull(classComments.deletedAt)))
      .orderBy(asc(classComments.createdAt)),
    db.select({ id: profiles.userId, name: profiles.fullName }).from(profiles).where(inArray(profiles.userId, [...new Set(posts.map((p) => p.authorUserId))])),
    db.select({ id: groups.id, name: groups.name }).from(groups).where(inArray(groups.id, posts.map((p) => p.groupId).filter((g): g is string => !!g).concat('00000000-0000-0000-0000-000000000000'))),
    db.select({ id: files.id, name: files.originalName }).from(files).where(inArray(files.id, posts.map((p) => p.fileId).filter((f): f is string => !!f).concat('00000000-0000-0000-0000-000000000000')))
  ])
  const authorName = new Map(authors.map((a) => [a.id, a.name]))
  const groupName = new Map(groupRows.map((g) => [g.id, g.name]))
  const fileName = new Map(fileRows.map((f) => [f.id, f.name]))
  const isTeacher = actor.role === 'TEACHER'
  return posts.map((p) => ({
    id: p.id,
    body: p.body,
    linkUrl: p.linkUrl,
    file: p.fileId ? { name: fileName.get(p.fileId) ?? 'ملف', url: signFileUrl(p.fileId, 3600) } : null,
    pinned: p.pinned,
    allowComments: p.allowComments,
    createdAt: p.createdAt,
    groupId: p.groupId,
    groupName: p.groupId ? (groupName.get(p.groupId) ?? null) : null,
    authorName: authorName.get(p.authorUserId) ?? 'الأستاذ',
    comments: comments
      .filter((c) => c.c.postId === p.id)
      .map((c) => ({
        id: c.c.id,
        body: c.c.body,
        createdAt: c.c.createdAt,
        authorName: c.name ?? '—',
        authorRole: c.role,
        mine: c.c.authorUserId === actor.userId,
        canDelete: isTeacher || c.c.authorUserId === actor.userId
      }))
  }))
}

const order = [desc(classPosts.pinned), desc(classPosts.createdAt)]

/** ساحة الأستاذ: كل منشوراته، أو ما يخصّ فوجاً (منشوراته + العامّة) */
export async function teacherStream(db: Db, actor: Actor, groupId?: string | null): Promise<StreamPost[]> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  if (groupId) await assertGroupAccess(db, actor, groupId)
  const posts = await db
    .select()
    .from(classPosts)
    .where(and(eq(classPosts.workspaceId, actor.workspaceId), isNull(classPosts.deletedAt), groupId ? or(eq(classPosts.groupId, groupId), isNull(classPosts.groupId)) : undefined))
    .orderBy(...order)
    .limit(100)
  return hydrate(db, actor, posts)
}

/** ساحة التلميذ: أفواجه فقط، أو فوج واحد منها */
export async function studentStream(db: Db, actor: Actor, groupId?: string | null): Promise<{ groups: { id: string; name: string }[]; posts: StreamPost[] }> {
  const gs = await studentClassGroups(db, actor)
  const scoped = groupId ? gs.filter((g) => g.id === groupId) : gs
  const scope = studentScope(scoped)
  if (!scope) return { groups: gs.map(({ id, name }) => ({ id, name })), posts: [] }
  const posts = await db.select().from(classPosts).where(and(isNull(classPosts.deletedAt), scope)).orderBy(...order).limit(100)
  return { groups: gs.map(({ id, name }) => ({ id, name })), posts: await hydrate(db, actor, posts) }
}

/* ------------------------------ الكتابة ------------------------------ */

export async function createPost(db: Db, actor: Actor, input: { groupId: string | null; body: string; linkUrl?: string | null; fileId?: string | null; allowComments?: boolean }) {
  assertRole(actor, 'TEACHER')
  const workspaceId = actor.workspaceId
  if (!workspaceId) throw new AppError('FORBIDDEN')
  const body = input.body.trim()
  if (body.length < 1 || body.length > MAX_POST) throw new AppError('VALIDATION', { field: 'body' })
  const linkUrl = input.linkUrl?.trim() || null
  if (linkUrl && !/^https:\/\//.test(linkUrl)) throw new AppError('VALIDATION', { field: 'linkUrl' })
  if (input.groupId) await assertGroupAccess(db, actor, input.groupId)
  if (input.fileId) {
    assertUuid(input.fileId, 'FILE_NOT_FOUND')
    const [f] = await db.select({ id: files.id }).from(files).where(and(eq(files.id, input.fileId), eq(files.workspaceId, workspaceId), eq(files.status, 'READY'), isNull(files.deletedAt))).limit(1)
    if (!f) throw new AppError('FILE_NOT_FOUND')
  }
  const [post] = await db
    .insert(classPosts)
    .values({ workspaceId, groupId: input.groupId, authorUserId: actor.userId, body, linkUrl, fileId: input.fileId ?? null, allowComments: input.allowComments ?? true })
    .returning()
  const recipients = await studentUserIds(db, workspaceId, input.groupId ? [input.groupId] : [])
  const preview = body.length > 140 ? `${body.slice(0, 140)}…` : body
  for (let i = 0; i < recipients.length; i += 500) {
    await notifyMany(
      db,
      recipients.slice(i, i + 500).map((userId) => ({ userId, workspaceId, type: 'CLASS_POST' as const, title: `منشور جديد في القسم — ${actor.fullName}`, body: preview, link: `/student/classroom#post-${post!.id}` }))
    )
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'class.post_create', entityType: 'class_post', entityId: post!.id, newValue: { groupId: input.groupId, recipients: recipients.length } })
  return post!
}

export async function updatePost(db: Db, actor: Actor, postId: string, patch: { pinned?: boolean; allowComments?: boolean }) {
  assertRole(actor, 'TEACHER')
  const post = await loadPost(db, postId)
  await assertPostAccess(db, actor, post)
  const set: Partial<typeof classPosts.$inferInsert> = {}
  if (patch.pinned !== undefined) set.pinned = patch.pinned
  if (patch.allowComments !== undefined) set.allowComments = patch.allowComments
  await db.update(classPosts).set(set).where(eq(classPosts.id, post.id))
}

export async function deletePost(db: Db, actor: Actor, postId: string) {
  assertRole(actor, 'TEACHER')
  const post = await loadPost(db, postId)
  await assertPostAccess(db, actor, post)
  await db.update(classPosts).set({ deletedAt: new Date() }).where(eq(classPosts.id, post.id))
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: post.workspaceId, action: 'class.post_delete', entityType: 'class_post', entityId: post.id })
}

export async function addComment(db: Db, actor: Actor, postId: string, text: string) {
  assertRole(actor, 'TEACHER', 'STUDENT')
  const post = await loadPost(db, postId)
  await assertPostAccess(db, actor, post)
  if (!post.allowComments && actor.role !== 'TEACHER') throw new AppError('COMMENTS_CLOSED')
  const body = text.trim()
  if (body.length < 1 || body.length > MAX_COMMENT) throw new AppError('VALIDATION', { field: 'body' })
  const [c] = await db.insert(classComments).values({ postId: post.id, authorUserId: actor.userId, body }).returning()
  // الأستاذ يعلم بكل تعليق تلميذ على منشوره
  if (actor.role === 'STUDENT' && post.authorUserId !== actor.userId) {
    await notify(db, {
      userId: post.authorUserId,
      workspaceId: post.workspaceId,
      type: 'CLASS_COMMENT',
      title: `تعليق من ${actor.fullName}`,
      body: body.length > 140 ? `${body.slice(0, 140)}…` : body,
      link: `/teacher/classroom${post.groupId ? `?group=${post.groupId}` : ''}#post-${post.id}`
    })
  }
  return c!
}

export async function deleteComment(db: Db, actor: Actor, commentId: string) {
  assertRole(actor, 'TEACHER', 'STUDENT')
  assertUuid(commentId, 'POST_NOT_FOUND')
  const [c] = await db.select().from(classComments).where(and(eq(classComments.id, commentId), isNull(classComments.deletedAt))).limit(1)
  if (!c) throw new AppError('POST_NOT_FOUND')
  const post = await loadPost(db, c.postId)
  await assertPostAccess(db, actor, post)
  // التلميذ يحذف تعليقه وحده؛ الأستاذ يحذف أي تعليق في مساحته
  if (actor.role === 'STUDENT' && c.authorUserId !== actor.userId) throw new AppError('FORBIDDEN')
  await db.update(classComments).set({ deletedAt: new Date() }).where(eq(classComments.id, c.id))
  if (actor.role === 'TEACHER' && c.authorUserId !== actor.userId) {
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: post.workspaceId, action: 'class.comment_delete', entityType: 'class_comment', entityId: c.id, oldValue: { body: c.body.slice(0, 200) } })
  }
}
