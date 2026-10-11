/**
 * المنتدى العامّ: كل تلميذ مسجّل (انضمّ إلى أستاذ بكود أم لا) وكل أستاذ يطرح سؤالاً أو يجيب.
 * الزائر يقرأ فقط. المشرف العامّ يثبّت ويقفل ويخفي؛ صاحب الموضوع أو الردّ يحذفه.
 */
import { and, asc, desc, eq, ilike, isNull, lt, or, sql, type SQL } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { forumPosts, forumThreads, levels, profiles, subjects, users } from '@/server/db/schema'
import type { ForumThreadStatus } from '@/server/db/schema/forum'
import type { UserRole } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { checkRateLimit } from '@/server/lib/rate-limit'
import { levelLabel } from '@/lib/levels'
import { notify } from './notifications.service'

/** من يكتب في المنتدى */
const WRITERS: UserRole[] = ['STUDENT', 'TEACHER', 'ASSISTANT', 'SUPER_ADMIN']
export const FORUM_LIMITS = { title: { min: 4, max: 140 }, body: { min: 2, max: 5000 }, threadsPerHour: 6, postsPerHour: 40 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function canWriteForum(actor: Actor | null | undefined): boolean {
  return Boolean(actor && WRITERS.includes(actor.role))
}

function isAdmin(actor: Actor | null | undefined): boolean {
  return actor?.role === 'SUPER_ADMIN'
}

/** شارة الكاتب: أستاذ، مشرف، تلميذ */
export function roleBadge(role: string): string {
  return role === 'TEACHER' ? 'أستاذ' : role === 'SUPER_ADMIN' ? 'المشرف' : role === 'ASSISTANT' ? 'مساعد أستاذ' : 'تلميذ'
}

function clean(s: string): string {
  // يحذف أحرف التحكم ويوحّد الأسطر الفارغة المتتالية
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function checkLength(value: string, field: 'title' | 'body') {
  const { min, max } = FORUM_LIMITS[field]
  if (value.length < min || value.length > max) throw new AppError('VALIDATION', { field })
}

export interface ForumThreadCard {
  id: string
  title: string
  excerpt: string
  status: ForumThreadStatus
  pinned: boolean
  repliesCount: number
  lastPostAt: Date
  createdAt: Date
  author: { name: string; role: string; badge: string }
  subject: { id: string; name: string } | null
  level: { id: string; code: string; label: string } | null
}

export interface ForumFilter {
  levelId?: string | null
  subjectId?: string | null
  q?: string | null
  /** مواضيعي فقط */
  authorUserId?: string | null
}

/** قائمة المواضيع: المثبّتة أولاً ثم الأحدث نشاطاً؛ ترقيم بالمؤشّر (lastPostAt|id) */
export async function listThreads(db: Db, viewer: Actor | null, f: ForumFilter = {}, page: { cursor?: string | null; limit?: number } = {}): Promise<{ items: ForumThreadCard[]; nextCursor: string | null }> {
  const limit = Math.max(1, Math.min(50, page.limit ?? 20))
  const q = f.q?.trim().slice(0, 80) ?? ''
  const where: (SQL | undefined)[] = [
    isNull(forumThreads.deletedAt),
    isAdmin(viewer) ? undefined : or(eq(forumThreads.status, 'OPEN'), eq(forumThreads.status, 'LOCKED')),
    // موضوع بلا مستوى يظهر لكل المستويات
    f.levelId && UUID.test(f.levelId) ? or(eq(forumThreads.levelId, f.levelId), isNull(forumThreads.levelId)) : undefined,
    f.subjectId && UUID.test(f.subjectId) ? eq(forumThreads.subjectId, f.subjectId) : undefined,
    f.authorUserId ? eq(forumThreads.authorUserId, f.authorUserId) : undefined,
    q.length >= 2 ? or(ilike(forumThreads.title, `%${q.replace(/[%_\\]/g, '\\$&')}%`), ilike(forumThreads.body, `%${q.replace(/[%_\\]/g, '\\$&')}%`)) : undefined
  ]
  if (page.cursor) {
    const [pin, at, id] = Buffer.from(page.cursor, 'base64url').toString().split('|')
    if (pin && at && id && UUID.test(id)) {
      const pinned = pin === '1'
      const atDate = new Date(at)
      if (!Number.isNaN(atDate.getTime()))
        where.push(
          pinned
            ? or(eq(forumThreads.pinned, false), and(eq(forumThreads.pinned, true), or(lt(forumThreads.lastPostAt, atDate), and(eq(forumThreads.lastPostAt, atDate), lt(forumThreads.id, id)))))
            : and(eq(forumThreads.pinned, false), or(lt(forumThreads.lastPostAt, atDate), and(eq(forumThreads.lastPostAt, atDate), lt(forumThreads.id, id))))
        )
    }
  }
  const rows = await db
    .select({ t: forumThreads, authorName: profiles.fullName, authorRole: users.role, subjectName: subjects.nameAr, levelCode: levels.code, levelName: levels.nameAr })
    .from(forumThreads)
    .innerJoin(users, eq(users.id, forumThreads.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(subjects, eq(subjects.id, forumThreads.subjectId))
    .leftJoin(levels, eq(levels.id, forumThreads.levelId))
    .where(and(...where))
    .orderBy(desc(forumThreads.pinned), desc(forumThreads.lastPostAt), desc(forumThreads.id))
    .limit(limit + 1)
  const items = rows.slice(0, limit).map((r) => toCard(r))
  const last = rows[limit - 1]
  const nextCursor = rows.length > limit && last ? Buffer.from(`${last.t.pinned ? '1' : '0'}|${last.t.lastPostAt.toISOString()}|${last.t.id}`).toString('base64url') : null
  return { items, nextCursor }
}

function toCard(r: { t: typeof forumThreads.$inferSelect; authorName: string | null; authorRole: string; subjectName: string | null; levelCode: string | null; levelName: string | null }): ForumThreadCard {
  return {
    id: r.t.id,
    title: r.t.title,
    excerpt: r.t.body.replace(/\s+/g, ' ').slice(0, 180),
    status: r.t.status as ForumThreadStatus,
    pinned: r.t.pinned,
    repliesCount: r.t.repliesCount,
    lastPostAt: r.t.lastPostAt,
    createdAt: r.t.createdAt,
    author: { name: r.authorName ?? 'عضو', role: r.authorRole, badge: roleBadge(r.authorRole) },
    subject: r.t.subjectId && r.subjectName ? { id: r.t.subjectId, name: r.subjectName } : null,
    level: r.t.levelId && r.levelCode ? { id: r.t.levelId, code: r.levelCode, label: levelLabel(r.levelCode) ?? r.levelName ?? r.levelCode } : null
  }
}

export interface ForumPostView {
  id: string
  body: string
  hidden: boolean
  createdAt: Date
  author: { id: string; name: string; role: string; badge: string }
  canDelete: boolean
}

export interface ForumThreadView extends ForumThreadCard {
  body: string
  authorUserId: string
  canDelete: boolean
  canReply: boolean
  posts: ForumPostView[]
}

export async function getThread(db: Db, viewer: Actor | null, threadId: string): Promise<ForumThreadView> {
  if (!UUID.test(threadId)) throw new AppError('NOT_FOUND')
  const [r] = await db
    .select({ t: forumThreads, authorName: profiles.fullName, authorRole: users.role, subjectName: subjects.nameAr, levelCode: levels.code, levelName: levels.nameAr })
    .from(forumThreads)
    .innerJoin(users, eq(users.id, forumThreads.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .leftJoin(subjects, eq(subjects.id, forumThreads.subjectId))
    .leftJoin(levels, eq(levels.id, forumThreads.levelId))
    .where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt)))
    .limit(1)
  if (!r || (r.t.status === 'HIDDEN' && !isAdmin(viewer))) throw new AppError('NOT_FOUND')
  const admin = isAdmin(viewer)
  const posts = await db
    .select({ p: forumPosts, authorName: profiles.fullName, authorRole: users.role })
    .from(forumPosts)
    .innerJoin(users, eq(users.id, forumPosts.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(and(eq(forumPosts.threadId, threadId), isNull(forumPosts.deletedAt), admin ? undefined : eq(forumPosts.hidden, false)))
    .orderBy(asc(forumPosts.createdAt), asc(forumPosts.id))
    .limit(500)
  return {
    ...toCard(r),
    body: r.t.body,
    authorUserId: r.t.authorUserId,
    canDelete: Boolean(viewer && (admin || viewer.userId === r.t.authorUserId)),
    canReply: canWriteForum(viewer) && r.t.status === 'OPEN',
    posts: posts.map((x) => ({
      id: x.p.id,
      body: x.p.body,
      hidden: x.p.hidden,
      createdAt: x.p.createdAt,
      author: { id: x.p.authorUserId, name: x.authorName ?? 'عضو', role: x.authorRole, badge: roleBadge(x.authorRole) },
      canDelete: Boolean(viewer && (admin || viewer.userId === x.p.authorUserId))
    }))
  }
}

export interface CreateThreadInput {
  title: string
  body: string
  subjectId?: string | null
  levelId?: string | null
}

export async function createThread(db: Db, actor: Actor, input: CreateThreadInput): Promise<{ id: string }> {
  if (!canWriteForum(actor)) throw new AppError('FORBIDDEN')
  const title = clean(input.title).replace(/\n+/g, ' ')
  const body = clean(input.body)
  checkLength(title, 'title')
  checkLength(body, 'body')
  const subjectId = input.subjectId && UUID.test(input.subjectId) ? input.subjectId : null
  const levelId = input.levelId && UUID.test(input.levelId) ? input.levelId : null
  if (subjectId && !(await db.select({ id: subjects.id }).from(subjects).where(eq(subjects.id, subjectId)).limit(1)).length) throw new AppError('VALIDATION', { field: 'subjectId' })
  if (levelId && !(await db.select({ id: levels.id }).from(levels).where(eq(levels.id, levelId)).limit(1)).length) throw new AppError('VALIDATION', { field: 'levelId' })
  if (!isAdmin(actor)) await checkRateLimit(db, { scope: 'forum.thread', subject: actor.userId, limit: FORUM_LIMITS.threadsPerHour, windowSeconds: 3600 })
  const [row] = await db.insert(forumThreads).values({ authorUserId: actor.userId, title, body, subjectId, levelId }).returning({ id: forumThreads.id })
  return { id: row!.id }
}

export async function replyToThread(db: Db, actor: Actor, threadId: string, rawBody: string): Promise<{ id: string }> {
  if (!canWriteForum(actor)) throw new AppError('FORBIDDEN')
  if (!UUID.test(threadId)) throw new AppError('NOT_FOUND')
  const body = clean(rawBody)
  checkLength(body, 'body')
  const [t] = await db.select().from(forumThreads).where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt))).limit(1)
  if (!t || t.status === 'HIDDEN') throw new AppError('NOT_FOUND')
  if (t.status === 'LOCKED' && !isAdmin(actor)) throw new AppError('FORBIDDEN')
  if (!isAdmin(actor)) await checkRateLimit(db, { scope: 'forum.post', subject: actor.userId, limit: FORUM_LIMITS.postsPerHour, windowSeconds: 3600 })
  const now = new Date()
  const id = await db.transaction(async (tx) => {
    const [p] = await tx.insert(forumPosts).values({ threadId, authorUserId: actor.userId, body }).returning({ id: forumPosts.id })
    await tx
      .update(forumThreads)
      .set({ repliesCount: sql`${forumThreads.repliesCount} + 1`, lastPostAt: now, updatedAt: now })
      .where(eq(forumThreads.id, threadId))
    return p!.id
  })
  // صاحب الموضوع يعرف أن أحداً أجابه (لا إشعار لمن يردّ على نفسه)
  if (t.authorUserId !== actor.userId) {
    await notify(db, { userId: t.authorUserId, workspaceId: null, type: 'CLASS_COMMENT', title: `ردّ جديد على «${t.title.slice(0, 60)}»`, body: `${actor.fullName || 'عضو'}: ${body.replace(/\s+/g, ' ').slice(0, 140)}`, link: `/forum/${threadId}#p-${id}` }).catch(() => undefined)
  }
  return { id }
}

/** حذف موضوع (صاحبه أو المشرف): حذف ناعم يُخفيه ويُخفي ردوده */
export async function deleteThread(db: Db, actor: Actor, threadId: string): Promise<void> {
  if (!UUID.test(threadId)) throw new AppError('NOT_FOUND')
  const [t] = await db.select({ id: forumThreads.id, authorUserId: forumThreads.authorUserId }).from(forumThreads).where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt))).limit(1)
  if (!t) throw new AppError('NOT_FOUND')
  if (!isAdmin(actor) && t.authorUserId !== actor.userId) throw new AppError('FORBIDDEN')
  await db.update(forumThreads).set({ deletedAt: new Date() }).where(eq(forumThreads.id, threadId))
  if (isAdmin(actor) && t.authorUserId !== actor.userId) await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'forum.thread_delete', entityType: 'forum_thread', entityId: threadId, newValue: {} })
}

export async function deletePost(db: Db, actor: Actor, postId: string): Promise<{ threadId: string }> {
  if (!UUID.test(postId)) throw new AppError('NOT_FOUND')
  const [p] = await db.select({ id: forumPosts.id, threadId: forumPosts.threadId, authorUserId: forumPosts.authorUserId }).from(forumPosts).where(and(eq(forumPosts.id, postId), isNull(forumPosts.deletedAt))).limit(1)
  if (!p) throw new AppError('NOT_FOUND')
  if (!isAdmin(actor) && p.authorUserId !== actor.userId) throw new AppError('FORBIDDEN')
  await db.transaction(async (tx) => {
    await tx.update(forumPosts).set({ deletedAt: new Date() }).where(eq(forumPosts.id, postId))
    await tx
      .update(forumThreads)
      .set({ repliesCount: sql`greatest(${forumThreads.repliesCount} - 1, 0)` })
      .where(eq(forumThreads.id, p.threadId))
  })
  if (isAdmin(actor) && p.authorUserId !== actor.userId) await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'forum.post_delete', entityType: 'forum_post', entityId: postId, newValue: { threadId: p.threadId } })
  return { threadId: p.threadId }
}

export type ForumModeration = 'pin' | 'unpin' | 'lock' | 'unlock' | 'hide' | 'unhide'

/** أحداث السجلّ بأسمائها الحرفية (لكل منها تسمية عربية في «النشاط») */
const MODERATION_AUDIT: Record<ForumModeration, { action: string }> = {
  pin: { action: 'forum.pin' },
  unpin: { action: 'forum.unpin' },
  lock: { action: 'forum.lock' },
  unlock: { action: 'forum.unlock' },
  hide: { action: 'forum.hide' },
  unhide: { action: 'forum.unhide' }
}
const POST_AUDIT = { hide: { action: 'forum.post_hide' }, show: { action: 'forum.post_unhide' } }

/** إشراف: تثبيت، قفل الردود، إخفاء — للمشرف العامّ فقط */
export async function moderateThread(db: Db, actor: Actor, threadId: string, action: ForumModeration): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!UUID.test(threadId)) throw new AppError('NOT_FOUND')
  const patch: Partial<typeof forumThreads.$inferInsert> =
    action === 'pin' ? { pinned: true } : action === 'unpin' ? { pinned: false } : action === 'lock' ? { status: 'LOCKED' } : action === 'hide' ? { status: 'HIDDEN' } : { status: 'OPEN' }
  const [row] = await db.update(forumThreads).set(patch).where(and(eq(forumThreads.id, threadId), isNull(forumThreads.deletedAt))).returning({ id: forumThreads.id })
  if (!row) throw new AppError('NOT_FOUND')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: MODERATION_AUDIT[action].action, entityType: 'forum_thread', entityId: threadId, newValue: patch })
}

export async function hidePost(db: Db, actor: Actor, postId: string, hidden: boolean): Promise<{ threadId: string }> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!UUID.test(postId)) throw new AppError('NOT_FOUND')
  const [row] = await db.update(forumPosts).set({ hidden }).where(and(eq(forumPosts.id, postId), isNull(forumPosts.deletedAt))).returning({ threadId: forumPosts.threadId })
  if (!row) throw new AppError('NOT_FOUND')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: (hidden ? POST_AUDIT.hide : POST_AUDIT.show).action, entityType: 'forum_post', entityId: postId, newValue: { hidden } })
  return row
}

/** أرقام صغيرة لرأس الصفحة */
export async function forumStats(db: Db): Promise<{ threads: number; posts: number }> {
  const [[t], [p]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(forumThreads).where(and(isNull(forumThreads.deletedAt), or(eq(forumThreads.status, 'OPEN'), eq(forumThreads.status, 'LOCKED')))),
    db.select({ n: sql<number>`count(*)::int` }).from(forumPosts).where(and(isNull(forumPosts.deletedAt), eq(forumPosts.hidden, false)))
  ])
  return { threads: t?.n ?? 0, posts: p?.n ?? 0 }
}
