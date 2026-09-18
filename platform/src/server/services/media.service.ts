import { createHmac, timingSafeEqual } from 'node:crypto'
import { and, desc, eq, gt, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib'
import type { Db } from '@/server/db/connect'
import { content, contentTargets, files, groupStudents, mediaViews, profiles, users } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { AppError, assertUuid } from '@/server/lib/errors'
import { addTimeline } from './timeline.service'

/**
 * حماية الوسائط الخاصة (فيديو مرفوع / PDF):
 * 1) لا رابط مباشر للملف أبداً: الرابط موقّع بـ(الملف + المحتوى + هوية المشاهد + انتهاء) ولا يعمل إلا
 *    مع جلسة نفس المستخدم ⇒ نسخ الرابط إلى متصفح آخر لا يعمل.
 * 2) التحقق من الرؤية في كل طلب (عام / طلاب / أفواج / طلاب محددون / مساحة الأستاذ).
 * 3) PDF يُختم في الخادم باسم/بريد الطالب وتاريخ المشاهدة على كل صفحة (رادع لإعادة النشر).
 * 4) سجل مشاهدة بنبضات دورية + حدّ للأجهزة المتزامنة (عناوين IP مختلفة خلال 10 دقائق) لكشف مشاركة الحساب.
 * ما لا يمكن منعه تقنياً: تصوير الشاشة بهاتف آخر. الردع = الختم المائي الشخصي + السجل + إغلاق الحساب.
 */

export const MEDIA_URL_TTL_SECONDS = 4 * 3600
export const ANON_VIEWER = 'anon'
const DEVICE_WINDOW_MS = 10 * 60_000

export function maxConcurrentDevices(): number {
  const n = Number(process.env.MEDIA_MAX_DEVICES ?? 2)
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 2
}

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return s
}

/** رابط بثّ موقّع بهوية المشاهد؛ يُستهلك من نفس الجلسة فقط */
export function signMediaUrl(fileId: string, contentId: string, viewerId: string, ttlSeconds = MEDIA_URL_TTL_SECONDS, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const sig = createHmac('sha256', secret()).update(`media.${fileId}.${contentId}.${viewerId}.${exp}`).digest('base64url')
  return `/api/v1/media/${fileId}?c=${contentId}&exp=${exp}&sig=${sig}`
}

export function verifyMediaSignature(fileId: string, contentId: string | null, viewerId: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!contentId || !exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(now / 1000)) return false
  const expected = createHmac('sha256', secret()).update(`media.${fileId}.${contentId}.${viewerId}.${expNum}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export interface MediaAccess {
  content: typeof content.$inferSelect
  file: typeof files.$inferSelect | null
  viewerId: string
  studentId: string | null
  /** سطور الختم المائي (لاتينية: البريد/المعرّف/التاريخ لأن pdf-lib لا يشكّل العربية) */
  watermark: string[]
  displayName: string
}

/**
 * يتحقق أن الفاعل (أو الزائر) يحق له مشاهدة وسائط هذا المحتوى ويرجع الملف المرتبط.
 * الطالب: PUBLIC/STUDENTS_ONLY أو موجّه لأفواجه/له. الأستاذ ومساعده: مساحتهما. المشرف: الكل. الزائر: PUBLIC فقط.
 */
export async function resolveMediaAccess(db: Db, actor: Actor | null, contentId: string): Promise<MediaAccess> {
  assertUuid(contentId, 'CONTENT_NOT_FOUND')
  const [c] = await db.select().from(content).where(and(eq(content.id, contentId), isNull(content.deletedAt), isNotNull(content.publishedAt))).limit(1)
  if (!c) throw new AppError('CONTENT_NOT_FOUND')

  let allowed = false
  let studentId: string | null = null
  if (!actor) allowed = c.visibility === 'PUBLIC'
  else if (actor.role === 'SUPER_ADMIN') allowed = true
  else if (actor.role === 'TEACHER' || actor.role === 'ASSISTANT') allowed = c.visibility === 'PUBLIC' || (!!actor.workspaceId && c.workspaceId === actor.workspaceId)
  else if (actor.role === 'STUDENT' && actor.studentId) {
    studentId = actor.studentId
    if (c.visibility === 'PUBLIC' || c.visibility === 'STUDENTS_ONLY') allowed = true
    else if (c.visibility === 'GROUP_ONLY' || c.visibility === 'SPECIFIC_STUDENTS') {
      const gids = (
        await db
          .select({ groupId: groupStudents.groupId })
          .from(groupStudents)
          .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
      ).map((r) => r.groupId)
      const [t] = await db
        .select({ id: contentTargets.id })
        .from(contentTargets)
        .where(and(eq(contentTargets.contentId, c.id), or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId))))
        .limit(1)
      allowed = !!t
    }
  } else allowed = c.visibility === 'PUBLIC'
  if (!allowed) throw new AppError('CONTENT_NOT_FOUND')

  let file: typeof files.$inferSelect | null = null
  if (c.fileId) {
    const [f] = await db.select().from(files).where(and(eq(files.id, c.fileId), isNull(files.deletedAt))).limit(1)
    file = f ?? null
  }
  const viewerId = actor?.userId ?? ANON_VIEWER
  const date = new Date().toISOString().slice(0, 10)
  const watermark = actor ? [actor.email, `${date} · ${actor.userId.slice(0, 8)}`] : ['madrasa · public', date]
  return { content: c, file, viewerId, studentId, watermark, displayName: actor?.fullName ?? '' }
}

/**
 * ختم PDF في الخادم: نص مائل شبه شفاف في وسط كل صفحة + سطر صغير أسفلها.
 * يعمل على نسخة من الملف الأصلي في كل طلب؛ الأصل لا يُعدَّل.
 */
export async function stampPdf(bytes: Buffer, lines: string[]): Promise<Buffer> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const text = lines.join('   ')
  for (const page of doc.getPages()) {
    const { width, height } = page.getSize()
    const size = Math.max(14, Math.min(28, width / 24))
    const textWidth = font.widthOfTextAtSize(text, size)
    page.drawText(text, {
      x: Math.max(24, (width - textWidth * 0.8) / 2),
      y: height / 2,
      size,
      font,
      color: rgb(0.55, 0.1, 0.1),
      opacity: 0.16,
      rotate: degrees(30)
    })
    page.drawText(text, { x: 18, y: 12, size: 8, font, color: rgb(0.35, 0.35, 0.35), opacity: 0.7 })
  }
  return Buffer.from(await doc.save({ useObjectStreams: false }))
}

export interface HeartbeatInput {
  contentId: string
  viewerKey: string
  position: number
  delta: number
  completed?: boolean
  ip?: string | null
  userAgent?: string | null
  now?: Date
}

/**
 * نبضة مشاهدة: تُنشئ/تحدّث سجل المشاهدة لهذا الجهاز، وترفض عند تجاوز عدد الأجهزة المتزامنة
 * (عناوين IP مختلفة لنفس الحساب خلال 10 دقائق) ⇒ إشارة مشاركة حساب.
 */
export async function recordMediaHeartbeat(db: Db, actor: Actor, input: HeartbeatInput) {
  const access = await resolveMediaAccess(db, actor, input.contentId)
  const now = input.now ?? new Date()
  const viewerKey = input.viewerKey.slice(0, 64)
  const ip = input.ip ?? null

  const recent = await db
    .select({ ip: mediaViews.ip, viewerKey: mediaViews.viewerKey })
    .from(mediaViews)
    .where(and(eq(mediaViews.userId, actor.userId), gt(mediaViews.lastSeenAt, new Date(now.getTime() - DEVICE_WINDOW_MS))))
  const activeIps = new Set(recent.filter((r) => r.viewerKey !== viewerKey).map((r) => r.ip ?? 'unknown'))
  if (ip && !activeIps.has(ip) && activeIps.size >= maxConcurrentDevices()) throw new AppError('MEDIA_TOO_MANY_DEVICES')

  const delta = Math.max(0, Math.min(Math.floor(input.delta), 120))
  const position = Math.max(0, Math.floor(input.position))
  const [existing] = await db
    .select()
    .from(mediaViews)
    .where(and(eq(mediaViews.contentId, access.content.id), eq(mediaViews.userId, actor.userId), eq(mediaViews.viewerKey, viewerKey)))
    .limit(1)
  if (existing) {
    await db
      .update(mediaViews)
      .set({
        lastSeenAt: now,
        ip: ip ?? existing.ip,
        secondsWatched: existing.secondsWatched + delta,
        maxPosition: Math.max(existing.maxPosition, position),
        completed: existing.completed || !!input.completed
      })
      .where(eq(mediaViews.id, existing.id))
    return { viewId: existing.id, secondsWatched: existing.secondsWatched + delta, first: false }
  }
  const [prior] = await db
    .select({ id: mediaViews.id })
    .from(mediaViews)
    .where(and(eq(mediaViews.contentId, access.content.id), eq(mediaViews.userId, actor.userId)))
    .limit(1)
  const [row] = await db
    .insert(mediaViews)
    .values({
      workspaceId: access.content.workspaceId,
      contentId: access.content.id,
      fileId: access.file?.id ?? null,
      userId: actor.userId,
      studentId: access.studentId,
      viewerKey,
      ip,
      userAgent: input.userAgent?.slice(0, 300) ?? null,
      startedAt: now,
      lastSeenAt: now,
      secondsWatched: delta,
      maxPosition: position,
      completed: !!input.completed
    })
    .returning({ id: mediaViews.id })
  if (!prior && access.studentId) {
    await addTimeline(db, {
      studentId: access.studentId,
      workspaceId: access.content.workspaceId,
      type: 'LESSON_VIEWED',
      title: `شاهد ${access.content.type === 'VIDEO' ? 'فيديو' : 'درس'}: ${access.content.title}`,
      meta: { contentId: access.content.id },
      occurredAt: now
    })
  }
  return { viewId: row?.id ?? '', secondsWatched: delta, first: !prior }
}

export interface ContentViewRow {
  userId: string
  studentId: string | null
  fullName: string
  email: string
  sessions: number
  secondsWatched: number
  maxPosition: number
  completed: boolean
  distinctIps: number
  lastSeenAt: Date
  /** أكثر من جهازين مختلفين خلال 24 ساعة ⇒ اشتباه مشاركة الحساب */
  flagged: boolean
}

/** مشاهدات محتوى معيّن مجمّعة لكل طالب (للأستاذ داخل مساحته) */
export async function listContentViews(db: Db, actor: Actor, contentId: string): Promise<{ title: string; rows: ContentViewRow[] }> {
  if (actor.role !== 'TEACHER' && actor.role !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN')
  assertUuid(contentId, 'CONTENT_NOT_FOUND')
  const [c] = await db.select({ id: content.id, title: content.title, workspaceId: content.workspaceId }).from(content).where(and(eq(content.id, contentId), isNull(content.deletedAt))).limit(1)
  if (!c || (actor.role === 'TEACHER' && c.workspaceId !== actor.workspaceId)) throw new AppError('CONTENT_NOT_FOUND')
  const dayAgo = new Date(Date.now() - 86_400_000)
  const rows = await db
    .select({
      userId: mediaViews.userId,
      studentId: mediaViews.studentId,
      fullName: profiles.fullName,
      email: users.email,
      sessions: sql<number>`count(*)::int`,
      secondsWatched: sql<number>`coalesce(sum(${mediaViews.secondsWatched}), 0)::int`,
      maxPosition: sql<number>`coalesce(max(${mediaViews.maxPosition}), 0)::int`,
      completed: sql<boolean>`bool_or(${mediaViews.completed})`,
      distinctIps: sql<number>`count(distinct ${mediaViews.ip})::int`,
      recentIps: sql<number>`count(distinct case when ${mediaViews.lastSeenAt} > ${dayAgo} then ${mediaViews.ip} end)::int`,
      lastSeenAt: sql<Date>`max(${mediaViews.lastSeenAt})`
    })
    .from(mediaViews)
    .innerJoin(users, eq(users.id, mediaViews.userId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(eq(mediaViews.contentId, c.id))
    .groupBy(mediaViews.userId, mediaViews.studentId, profiles.fullName, users.email)
    .orderBy(desc(sql`max(${mediaViews.lastSeenAt})`))
  return {
    title: c.title,
    rows: rows.map((r) => ({
      userId: r.userId,
      studentId: r.studentId,
      fullName: r.fullName ?? r.email,
      email: r.email,
      sessions: r.sessions,
      secondsWatched: r.secondsWatched,
      maxPosition: r.maxPosition,
      completed: r.completed,
      distinctIps: r.distinctIps,
      lastSeenAt: new Date(r.lastSeenAt),
      flagged: r.recentIps > maxConcurrentDevices()
    }))
  }
}

/** عدد المشاهدين المتميّزين لكل محتوى في المساحة (لقائمة الأستاذ) */
export async function viewCountsForWorkspace(db: Db, actor: Actor): Promise<Record<string, number>> {
  if (!actor.workspaceId) return {}
  const rows = await db
    .select({ contentId: mediaViews.contentId, n: sql<number>`count(distinct ${mediaViews.userId})::int` })
    .from(mediaViews)
    .where(eq(mediaViews.workspaceId, actor.workspaceId))
    .groupBy(mediaViews.contentId)
  return Object.fromEntries(rows.map((r) => [r.contentId, r.n]))
}
