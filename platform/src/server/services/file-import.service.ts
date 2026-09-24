/**
 * استيراد ملفات كثيرة دفعة واحدة دروساً في المنصة، منظّمة بالذكاء الاصطناعي:
 * عنوان من المضمون، وملخّص، ومحور، وترتيب بيداغوجي.
 *   - ملفات مرفوعة: PDF يُعرض داخل المنصة، Word ونص يصيران مقالاً مقروءاً.
 *   - ملفات Google Drive: تبقى على Drive، والدرس رابط إليها.
 */
import { and, eq, isNull } from 'drizzle-orm'
import { getAiProvider } from '@/server/ai/provider'
import type { OrganizedLesson } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import { content, levels, profiles, streams } from '@/server/db/schema'
import type { Visibility } from '@/server/db/schema/enums'
import { enqueueJob } from '@/server/jobs/queue'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { TEXT_MIME } from '@/server/lib/doc-text'
import { AppError, assertUuid, PermanentJobError, type ErrorCode } from '@/server/lib/errors'
import { DRIVE_MIME, fetchDriveText, getDriveFile, listDriveFolder, parseDriveFileId, parseDriveFolderId, type DriveFile, type DriveOptions } from '@/server/lib/google-drive'
import { cachedText } from '@/server/lib/text-cache'
import { t } from '@/i18n'
import { workspaceSubject } from './ai.service'
import { createContent } from './content.service'
import { notify } from './notifications.service'
import { assertOwnFiles, loadFileDocs, MAX_DRIVE_LINKS, MAX_SOURCE_FILES } from './sources.service'

export interface FileImportInput {
  fileIds: string[]
  driveLinks: string[]
  organize: boolean
  levelId?: string | null
  streamId?: string | null
  visibility: Visibility
  groupIds: string[]
  publish: boolean
}

export async function requestFileImport(db: Db, actor: Actor, input: FileImportInput): Promise<{ jobId: string }> {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  if (input.fileIds.length === 0 && input.driveLinks.length === 0) throw new AppError('SOURCES_REQUIRED')
  if (input.fileIds.length > MAX_SOURCE_FILES || input.driveLinks.length > MAX_DRIVE_LINKS) throw new AppError('VALIDATION', { field: 'sources' })
  input.fileIds.forEach((id) => assertUuid(id, 'FILE_NOT_FOUND'))
  await assertOwnFiles(db, actor.workspaceId, input.fileIds)
  for (const l of input.driveLinks) if (!parseDriveFileId(l) && !parseDriveFolderId(l)) throw new AppError('INVALID_DRIVE_URL')
  const job = await enqueueJob(db, { type: 'AI_IMPORT_FILES', payload: { ...input, workspaceId: actor.workspaceId, userId: actor.userId }, workspaceId: actor.workspaceId, maxAttempts: 2 })
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: actor.workspaceId, action: 'content.import_files', entityType: 'job', entityId: job.id, newValue: { files: input.fileIds.length, links: input.driveLinks.length, organize: input.organize } })
  return { jobId: job.id }
}

/** رابط عرض الملف على Drive (المستندات والعروض تُفتح في محرّرها) */
export function driveViewUrl(f: Pick<DriveFile, 'id' | 'mimeType'>): string {
  if (f.mimeType === DRIVE_MIME.gdoc) return `https://docs.google.com/document/d/${f.id}/view`
  if (f.mimeType === DRIVE_MIME.gslides) return `https://docs.google.com/presentation/d/${f.id}/view`
  return `https://drive.google.com/file/d/${f.id}/view`
}

interface Item {
  key: string
  name: string
  excerpt: string
  create: (lesson: OrganizedLesson) => Parameters<typeof createContent>[2]
}

const strs = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

async function driveItems(links: string[], opts: DriveOptions): Promise<DriveFile[]> {
  const out: DriveFile[] = []
  for (const l of links) {
    const fileId = parseDriveFileId(l)
    if (fileId) out.push(await getDriveFile(fileId, opts))
    else out.push(...(await listDriveFolder(parseDriveFolderId(l)!, opts)).files)
  }
  const seen = new Set<string>()
  return out.filter((f) => (seen.has(f.id) ? false : (seen.add(f.id), true)))
}

export async function runFileImportJob(db: Db, payload: Record<string, unknown>, opts: DriveOptions = {}): Promise<Record<string, unknown>> {
  const workspaceId = String(payload.workspaceId ?? '')
  const userId = String(payload.userId ?? '')
  assertUuid(workspaceId, 'NOT_FOUND')
  assertUuid(userId, 'NOT_FOUND')
  const [p] = await db.select({ fullName: profiles.fullName }).from(profiles).where(eq(profiles.userId, userId)).limit(1)
  const actor: Actor = { userId, role: 'TEACHER', fullName: p?.fullName ?? '', email: '', workspaceId, teacherId: null, studentId: null }
  const stop = async (code: ErrorCode): Promise<never> => {
    await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'لم يكتمل استيراد الملفات', body: t(`errors.${code}` as never), link: '/teacher/content/import' })
    throw new PermanentJobError(code)
  }
  const base = {
    levelId: (payload.levelId as string | null) ?? null,
    streamId: (payload.streamId as string | null) ?? null,
    visibility: String(payload.visibility ?? 'STUDENTS_ONLY') as Visibility,
    groupIds: strs(payload.groupIds),
    publish: payload.publish === true
  }

  // ما سبق استيراده لا يُضاعَف: نفس الملف المرفوع أو نفس رابط Drive
  const fileIds = strs(payload.fileIds)
  const already = new Set(
    (
      await db
        .select({ fileId: content.fileId, url: content.externalUrl })
        .from(content)
        .where(and(eq(content.workspaceId, workspaceId), isNull(content.deletedAt)))
    ).flatMap((r) => [r.fileId, r.url].filter((v): v is string => !!v))
  )

  const items: Item[] = []
  try {
    const rows = (await assertOwnFiles(db, workspaceId, fileIds)).filter((f) => !already.has(f.id))
    const docs = new Map((await loadFileDocs(db, workspaceId, rows.map((r) => r.id))).map((d) => [d.title, d.text]))
    for (const f of rows) {
      const text = docs.get(f.originalName) ?? ''
      const isPdf = f.mimeType === TEXT_MIME.pdf
      items.push({
        key: `u${items.length + 1}`,
        name: f.originalName,
        excerpt: text.slice(0, 900),
        // PDF يُعرض في المنصة؛ Word والنص يصيران مقالاً يُقرأ مباشرة والملف الأصلي مرفق به
        create: (l) => (isPdf ? { ...base, type: 'PDF', title: l.title, summary: l.summary || null, topic: l.topic, fileId: f.id } : { ...base, type: 'ARTICLE', title: l.title, summary: l.summary || null, topic: l.topic, body: text || null, fileId: f.id })
      })
    }
    for (const f of await driveItems(strs(payload.driveLinks), opts)) {
      const url = driveViewUrl(f)
      if (already.has(url)) continue
      const text = await cachedText(`drive:${f.id}:${f.modifiedTime}`, () => fetchDriveText(f, opts)).catch(() => '')
      items.push({ key: `d${items.length + 1}`, name: f.name, excerpt: text.slice(0, 900), create: (l) => ({ ...base, type: 'LINK', title: l.title, summary: l.summary || null, topic: l.topic, externalUrl: url }) })
    }
  } catch (e) {
    if (e instanceof AppError && e.code !== 'INTERNAL') return stop(e.code)
    throw e
  }
  if (items.length === 0) {
    await notify(db, { userId, workspaceId, type: 'SYSTEM', title: 'لا ملفات جديدة للاستيراد', body: 'كل الملفات المختارة موجودة سلفاً في دروسك.', link: '/teacher/content' })
    return { imported: 0 }
  }

  let lessons: OrganizedLesson[] = items.map((i, n) => ({ youtubeId: i.key, title: i.name.replace(/\.[a-z0-9]{2,5}$/i, ''), summary: '', topic: null, order: n + 1 }))
  let organizedBy: string | null = null
  const provider = getAiProvider()
  if (payload.organize === true && provider.organizeLessons) {
    try {
      const [level] = base.levelId ? await db.select({ n: levels.nameAr }).from(levels).where(eq(levels.id, base.levelId)).limit(1) : []
      const [stream] = base.streamId ? await db.select({ n: streams.nameAr }).from(streams).where(eq(streams.id, base.streamId)).limit(1) : []
      const out = await provider.organizeLessons({
        kind: 'files',
        subject: await workspaceSubject(db, workspaceId),
        playlistTitle: null,
        levelName: level?.n ?? null,
        streamName: stream?.n ?? null,
        items: items.map((i) => ({ youtubeId: i.key, title: i.name, description: i.excerpt || null }))
      })
      // ما أسقطه النموذج يُلحق بعنوانه الأصلي — لا يضيع ملف
      const got = new Set(out.lessons.map((l) => l.youtubeId))
      lessons = [...out.lessons, ...lessons.filter((l) => !got.has(l.youtubeId))]
      organizedBy = provider.name
    } catch (err) {
      // التنظيم تحسين لا شرط
      console.error('[file-import] organize failed', err)
    }
  }

  const byKey = new Map(items.map((i) => [i.key, i]))
  const titles: string[] = []
  for (const l of lessons) {
    const item = byKey.get(l.youtubeId)
    if (!item) continue
    const row = await createContent(db, actor, item.create(l))
    titles.push(row.title)
  }
  await notify(db, { userId, workspaceId, type: 'SYSTEM', title: `استُورد ${titles.length} درساً`, body: organizedBy ? 'رُتّبت ولُخّصت بالذكاء الاصطناعي — راجعها وانشرها.' : 'راجعها وانشرها.', link: '/teacher/content' })
  return { imported: titles.length, organizedBy, titles }
}
