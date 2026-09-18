import { randomBytes } from 'node:crypto'
import { and, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { content, contentTargets, files, groupStudents, levels, profiles, students, users } from '@/server/db/schema'
import type { ContentType, VideoProvider, Visibility } from '@/server/db/schema/enums'
import { parseYoutubeId } from '@/server/lib/youtube'
import { assertRole, studentIdOf, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { assertGroupAccess } from './groups.service'
import { notifyMany } from './notifications.service'

export interface ContentInput {
  type: ContentType
  title: string
  summary?: string | null
  body?: string | null
  externalUrl?: string | null
  fileId?: string | null
  levelId?: string | null
  streamId?: string | null
  topic?: string | null
  skillId?: string | null
  visibility: Visibility
  groupIds?: string[]
  studentIds?: string[]
  publish?: boolean
  /** فيديو: YOUTUBE (رابط) أو UPLOAD (ملف من مكتبة الأستاذ) */
  videoProvider?: VideoProvider | null
  /** PDF: السماح بالتنزيل الخام (الافتراضي عرض مختوم داخل التطبيق فقط) */
  allowDownload?: boolean
}

/** يشتق حقول الفيديو من المدخلات: معرّف يوتيوب مُتحقَّق منه أو ملف مرفوع */
function videoFields(input: Partial<ContentInput>): Partial<typeof content.$inferInsert> {
  if (input.type !== 'VIDEO') return { videoProvider: null, youtubeId: null }
  const provider = input.videoProvider ?? (input.fileId ? 'UPLOAD' : 'YOUTUBE')
  if (provider === 'YOUTUBE') {
    const id = parseYoutubeId(input.externalUrl ?? '')
    if (!id) throw new AppError('INVALID_YOUTUBE_URL')
    return { videoProvider: 'YOUTUBE', youtubeId: id, externalUrl: `https://www.youtube.com/watch?v=${id}` }
  }
  if (!input.fileId) throw new AppError('VALIDATION', { field: 'fileId' })
  return { videoProvider: 'UPLOAD', youtubeId: null }
}

type ContentRow = typeof content.$inferSelect

function slugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${base || 'content'}-${randomBytes(3).toString('hex')}`
}

async function assertContentAccess(db: Db, actor: Actor, id: string): Promise<ContentRow> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(id, 'CONTENT_NOT_FOUND')
  const [c] = await db.select().from(content).where(and(eq(content.id, id), isNull(content.deletedAt))).limit(1)
  if (!c) throw new AppError('CONTENT_NOT_FOUND')
  if (actor.role === 'TEACHER' && c.workspaceId !== actor.workspaceId) throw new AppError('CONTENT_NOT_FOUND')
  return c
}

async function writeTargets(tx: Db, actor: Actor, contentId: string, visibility: Visibility, groupIds: string[], studentIds: string[]) {
  await tx.delete(contentTargets).where(eq(contentTargets.contentId, contentId))
  if (visibility === 'GROUP_ONLY') {
    if (groupIds.length === 0) throw new AppError('VALIDATION', { field: 'groupIds' })
    for (const g of groupIds) await assertGroupAccess(tx, actor, g)
    await tx.insert(contentTargets).values(groupIds.map((groupId) => ({ contentId, groupId })))
  } else if (visibility === 'SPECIFIC_STUDENTS') {
    if (studentIds.length === 0) throw new AppError('VALIDATION', { field: 'studentIds' })
    await tx.insert(contentTargets).values(studentIds.map((studentId) => ({ contentId, studentId })))
  }
}

async function notifyTargets(tx: Db, c: ContentRow) {
  if (!c.publishedAt) return
  const targets = await tx.select().from(contentTargets).where(eq(contentTargets.contentId, c.id))
  const gids = targets.map((t) => t.groupId).filter((x): x is string => !!x)
  const sids = new Set(targets.map((t) => t.studentId).filter((x): x is string => !!x))
  if (gids.length) {
    const rows = await tx.select({ studentId: groupStudents.studentId }).from(groupStudents).where(and(inArray(groupStudents.groupId, gids), eq(groupStudents.status, 'ACTIVE')))
    for (const r of rows) sids.add(r.studentId)
  }
  if (sids.size === 0) return
  const usersRows = await tx.select({ userId: students.userId }).from(students).where(inArray(students.id, [...sids]))
  await notifyMany(
    tx,
    usersRows.map((u) => ({ userId: u.userId, workspaceId: c.workspaceId, type: 'NEW_FILE' as const, title: `محتوى جديد: ${c.title}`, link: `/student/lessons/${c.slug}` }))
  )
}

export async function createContent(db: Db, actor: Actor, input: ContentInput) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const title = input.title.trim()
  if (!title) throw new AppError('VALIDATION', { field: 'title' })
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : null
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(content)
      .values({
        workspaceId,
        authorUserId: actor.userId,
        type: input.type,
        title,
        slug: slugify(title),
        summary: input.summary?.trim() || null,
        body: input.body?.trim() || null,
        externalUrl: input.externalUrl?.trim() || null,
        fileId: input.fileId ?? null,
        levelId: input.levelId ?? null,
        streamId: input.streamId ?? null,
        topic: input.topic?.trim() || null,
        skillId: input.skillId ?? null,
        visibility: input.visibility,
        publishedAt: input.publish ? new Date() : null,
        allowDownload: input.allowDownload ?? false,
        ...videoFields(input)
      })
      .returning()
    if (!row) throw new AppError('INTERNAL')
    await writeTargets(tx, actor, row.id, input.visibility, input.groupIds ?? [], input.studentIds ?? [])
    await notifyTargets(tx, row)
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId, action: 'content.create', entityType: 'content', entityId: row.id, newValue: { title, type: input.type, visibility: input.visibility } })
    return row
  })
}

export async function updateContent(db: Db, actor: Actor, id: string, input: Partial<ContentInput>) {
  const c = await assertContentAccess(db, actor, id)
  const patch: Partial<typeof content.$inferInsert> = {}
  if (input.type !== undefined) patch.type = input.type
  if (input.title !== undefined) patch.title = input.title.trim()
  if (input.summary !== undefined) patch.summary = input.summary?.trim() || null
  if (input.body !== undefined) patch.body = input.body?.trim() || null
  if (input.externalUrl !== undefined) patch.externalUrl = input.externalUrl?.trim() || null
  if (input.fileId !== undefined) patch.fileId = input.fileId
  if (input.levelId !== undefined) patch.levelId = input.levelId
  if (input.streamId !== undefined) patch.streamId = input.streamId
  if (input.topic !== undefined) patch.topic = input.topic?.trim() || null
  if (input.skillId !== undefined) patch.skillId = input.skillId
  if (input.visibility !== undefined) patch.visibility = input.visibility
  if (input.publish !== undefined) patch.publishedAt = input.publish ? (c.publishedAt ?? new Date()) : null
  if (input.allowDownload !== undefined) patch.allowDownload = input.allowDownload
  if (input.type !== undefined || input.videoProvider !== undefined || input.externalUrl !== undefined || input.fileId !== undefined) {
    Object.assign(
      patch,
      videoFields({
        type: input.type ?? (c.type as ContentType),
        videoProvider: input.videoProvider ?? (c.videoProvider as VideoProvider | null),
        externalUrl: input.externalUrl !== undefined ? input.externalUrl : c.externalUrl,
        fileId: input.fileId !== undefined ? input.fileId : c.fileId
      })
    )
  }
  return db.transaction(async (tx) => {
    const [row] = await tx.update(content).set(patch).where(eq(content.id, c.id)).returning()
    const vis = input.visibility ?? (c.visibility as Visibility)
    if (input.visibility !== undefined || input.groupIds !== undefined || input.studentIds !== undefined) {
      await writeTargets(tx, actor, c.id, vis, input.groupIds ?? [], input.studentIds ?? [])
    }
    if (row && !c.publishedAt && row.publishedAt) await notifyTargets(tx, row)
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'content.update', entityType: 'content', entityId: c.id, oldValue: { title: c.title, visibility: c.visibility }, newValue: patch as Record<string, unknown> })
    return row
  })
}

export async function deleteContent(db: Db, actor: Actor, id: string) {
  const c = await assertContentAccess(db, actor, id)
  await db.transaction(async (tx) => {
    await tx.update(content).set({ deletedAt: new Date() }).where(eq(content.id, c.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: c.workspaceId, action: 'content.delete', entityType: 'content', entityId: c.id, oldValue: { title: c.title } })
  })
}

export async function getContentForEdit(db: Db, actor: Actor, id: string) {
  const c = await assertContentAccess(db, actor, id)
  const targets = await db.select().from(contentTargets).where(eq(contentTargets.contentId, c.id))
  return {
    ...c,
    groupIds: targets.map((t) => t.groupId).filter((x): x is string => !!x),
    studentIds: targets.map((t) => t.studentId).filter((x): x is string => !!x)
  }
}

/** محتوى للطالب حسب الرؤية: عام / للطلاب / موجّه لأفواجه أو له */
export async function getContentForStudent(db: Db, actor: Actor, slug: string) {
  const studentId = studentIdOf(actor)
  const gids = (
    await db
      .select({ groupId: groupStudents.groupId })
      .from(groupStudents)
      .where(and(eq(groupStudents.studentId, studentId), inArray(groupStudents.status, ['ACTIVE', 'SUSPENDED', 'SUSPENDED_DUE_TO_ABSENCE'])))
  ).map((r) => r.groupId)
  const targeted = db
    .select({ id: contentTargets.contentId })
    .from(contentTargets)
    .where(or(gids.length ? inArray(contentTargets.groupId, gids) : sql`false`, eq(contentTargets.studentId, studentId)))
  const [row] = await db
    .select({
      id: content.id,
      slug: content.slug,
      type: content.type,
      title: content.title,
      summary: content.summary,
      body: content.body,
      topic: content.topic,
      externalUrl: content.externalUrl,
      fileId: content.fileId,
      fileName: files.originalName,
      fileMime: files.mimeType,
      fileStatus: files.status,
      videoProvider: content.videoProvider,
      youtubeId: content.youtubeId,
      allowDownload: content.allowDownload,
      levelName: levels.nameAr,
      authorName: profiles.fullName,
      publishedAt: content.publishedAt
    })
    .from(content)
    .leftJoin(files, eq(files.id, content.fileId))
    .leftJoin(levels, eq(levels.id, content.levelId))
    .leftJoin(users, eq(users.id, content.authorUserId))
    .leftJoin(profiles, eq(profiles.userId, users.id))
    .where(
      and(
        eq(content.slug, slug),
        isNotNull(content.publishedAt),
        isNull(content.deletedAt),
        or(inArray(content.visibility, ['PUBLIC', 'STUDENTS_ONLY']), inArray(content.id, targeted))
      )
    )
    .limit(1)
  if (!row) throw new AppError('CONTENT_NOT_FOUND')
  return row
}
