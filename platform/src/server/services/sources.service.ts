/**
 * مصادر الذكاء الاصطناعي في مساحة الأستاذ: ملفاته المرفوعة إلى المنصة، وروابط Drive
 * (ملف أو مجلد)، ومجلد Drive المربوط في إعداداته. كلّها تتحوّل نصوصاً، والتوليد لا يعرف غيرها.
 */
import { and, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { files } from '@/server/db/schema'
import { extractDocText, isTextExtractable } from '@/server/lib/doc-text'
import { AppError } from '@/server/lib/errors'
import { fetchDriveText, getDriveFile, isReadable, parseDriveFileId, parseDriveFolderId, type DriveOptions } from '@/server/lib/google-drive'
import { storage } from '@/server/lib/storage'
import { cachedText } from '@/server/lib/text-cache'
import { getDriveSource, loadSourceDocs, queryTerms, selectPassages, type SourceDoc } from './drive-source.service'

export const MAX_SOURCE_FILES = 30
export const MAX_DRIVE_LINKS = 10

export interface SourceSpec {
  fileIds: string[]
  driveLinks: string[]
  useLinkedFolder: boolean
}

/** ملفات المساحة التي يُستخرج منها نصّ (لقائمة الاختيار) */
export async function listSourceFiles(db: Db, workspaceId: string) {
  const rows = await db
    .select({ id: files.id, name: files.originalName, mimeType: files.mimeType, sizeBytes: files.sizeBytes, createdAt: files.createdAt })
    .from(files)
    .where(and(eq(files.workspaceId, workspaceId), eq(files.status, 'READY'), isNull(files.deletedAt)))
  return rows.filter((f) => isTextExtractable(f.mimeType)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/** ملفات مختارة: من مساحة الأستاذ نفسه فقط، وإلا يُرفض الطلب كلّه */
export async function assertOwnFiles(db: Db, workspaceId: string, fileIds: string[]) {
  if (fileIds.length === 0) return []
  const rows = await db
    .select()
    .from(files)
    .where(and(inArray(files.id, fileIds), eq(files.workspaceId, workspaceId), eq(files.status, 'READY'), isNull(files.deletedAt)))
  if (rows.length !== new Set(fileIds).size) throw new AppError('FILE_NOT_FOUND')
  return rows
}

export async function loadFileDocs(db: Db, workspaceId: string, fileIds: string[]): Promise<SourceDoc[]> {
  const rows = await assertOwnFiles(db, workspaceId, fileIds)
  const docs: SourceDoc[] = []
  for (const f of rows) {
    if (!isTextExtractable(f.mimeType)) continue
    const text = await cachedText(`file:${f.id}:${f.checksum ?? f.sizeBytes}`, async () => extractDocText(new Uint8Array(await storage().get(f.storageKey)), f.mimeType))
    if (text.length >= 40) docs.push({ title: f.originalName, text })
  }
  return docs
}

/** رابط Drive واحد: ملف مفرد أو مجلد كامل */
export async function loadDriveLinkDocs(link: string, opts: DriveOptions = {}): Promise<SourceDoc[]> {
  const fileId = parseDriveFileId(link)
  if (fileId) {
    const f = await getDriveFile(fileId, opts)
    if (!isReadable(f.mimeType)) return []
    const text = await cachedText(`drive:${f.id}:${f.modifiedTime}`, () => fetchDriveText(f, opts))
    return text.length >= 40 ? [{ title: f.name, text }] : []
  }
  const folderId = parseDriveFolderId(link)
  if (!folderId) throw new AppError('INVALID_DRIVE_URL')
  return loadSourceDocs(folderId, opts)
}

export function validateSourceSpec(spec: SourceSpec): void {
  if (spec.fileIds.length > MAX_SOURCE_FILES || spec.driveLinks.length > MAX_DRIVE_LINKS) throw new AppError('VALIDATION', { field: 'sources' })
  for (const l of spec.driveLinks) if (!parseDriveFileId(l) && !parseDriveFolderId(l)) throw new AppError('INVALID_DRIVE_URL')
  if (spec.fileIds.length === 0 && spec.driveLinks.length === 0 && !spec.useLinkedFolder) throw new AppError('SOURCES_REQUIRED')
}

/** كل النصوص المطلوبة، بلا تكرار عنوان، بترتيب: ملفات المنصة ثم الروابط ثم المجلد المربوط */
export async function resolveSources(db: Db, workspaceId: string, spec: SourceSpec, opts: DriveOptions = {}): Promise<SourceDoc[]> {
  const docs: SourceDoc[] = [...(await loadFileDocs(db, workspaceId, spec.fileIds))]
  for (const l of spec.driveLinks) docs.push(...(await loadDriveLinkDocs(l, opts)))
  if (spec.useLinkedFolder) {
    const linked = await getDriveSource(db, workspaceId)
    if (!linked) throw new AppError('DRIVE_SOURCE_MISSING')
    docs.push(...(await loadSourceDocs(linked.folderId, opts)))
  }
  const seen = new Set<string>()
  return docs.filter((d) => (seen.has(d.title + d.text.length) ? false : (seen.add(d.title + d.text.length), true)))
}

/**
 * مقاطع التوليد: بموضوع ⇒ ما يخصّه وحده (null إن غاب عن المصادر كلّها)؛
 * بلا موضوع ⇒ الملفات المختارة كلّها أصلاً ما يريده الأستاذ، فتؤخذ بحصص متساوية.
 */
export function passagesFor(docs: SourceDoc[], topic: string | null, maxChars = 14_000): SourceDoc[] | null {
  if (docs.length === 0) return null
  if (topic?.trim()) return selectPassages(docs, queryTerms(topic), maxChars)
  const share = Math.max(1500, Math.floor(maxChars / docs.length))
  return docs.slice(0, Math.max(1, Math.floor(maxChars / 1500))).map((d) => ({ title: d.title, text: d.text.slice(0, share) }))
}
