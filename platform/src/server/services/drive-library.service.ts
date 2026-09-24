/**
 * «مكتبة Drive»: الأستاذ يختار ملفاً واحداً من مجلده المربوط (موضوعاً أو تمريناً أو درساً)،
 * فيتعلّمه الذكاء الاصطناعي ويصوغ منه مسودة — واجباً بحلّه النموذجي، أو شرحاً للتلاميذ.
 * لا شيء يصل التلاميذ قبل أن يراجعه الأستاذ ويؤكّده.
 */
import { getAiProvider } from '@/server/ai/provider'
import type { DraftFromSourceOutput } from '@/server/ai/types'
import type { Db } from '@/server/db/connect'
import type { Visibility } from '@/server/db/schema/enums'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { fetchDriveText, listDriveFolder, type DriveFile, type DriveOptions } from '@/server/lib/google-drive'
import { cachedText } from '@/server/lib/text-cache'
import { workspaceSubject } from './ai.service'
import { createContent } from './content.service'
import { getDriveSource } from './drive-source.service'
import { driveViewUrl } from './file-import.service'

export interface LibraryFile extends DriveFile {
  viewUrl: string
}

function workspaceOf(actor: Actor): string {
  assertRole(actor, 'TEACHER')
  if (!actor.workspaceId) throw new AppError('FORBIDDEN')
  return actor.workspaceId
}

export async function listDriveLibrary(db: Db, actor: Actor, opts: DriveOptions = {}): Promise<{ folderName: string; files: LibraryFile[] } | null> {
  const source = await getDriveSource(db, workspaceOf(actor))
  if (!source) return null
  const { files } = await listDriveFolder(source.folderId, opts)
  return { folderName: source.folderName, files: files.map((f) => ({ ...f, viewUrl: driveViewUrl(f) })) }
}

/** الملف من المجلد المربوط نفسه، لا أي ملف على Drive */
async function libraryFile(db: Db, actor: Actor, fileId: string, opts: DriveOptions): Promise<DriveFile> {
  const lib = await listDriveLibrary(db, actor, opts)
  if (!lib) throw new AppError('DRIVE_SOURCE_MISSING')
  const f = lib.files.find((x) => x.id === fileId)
  if (!f) throw new AppError('FILE_NOT_FOUND')
  return f
}

export async function draftFromDriveFile(db: Db, actor: Actor, fileId: string, mode: 'assignment' | 'explanation', opts: DriveOptions = {}): Promise<DraftFromSourceOutput & { fileName: string; viewUrl: string }> {
  const workspaceId = workspaceOf(actor)
  const f = await libraryFile(db, actor, fileId, opts)
  const text = await cachedText(`drive:${f.id}:${f.modifiedTime}`, () => fetchDriveText(f, opts))
  if (text.length < 40) throw new AppError('DRIVE_EMPTY')
  const provider = getAiProvider()
  if (!provider.draftFromSource) throw new AppError('AI_UNAVAILABLE')
  let out: DraftFromSourceOutput
  try {
    out = await provider.draftFromSource({ subject: await workspaceSubject(db, workspaceId), mode, fileTitle: f.name, text })
  } catch (err) {
    console.error('[drive-library] draft failed', err)
    throw new AppError('AI_UNAVAILABLE')
  }
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'ai.draft.from_drive', entityType: 'drive_file', newValue: { file: f.name, mode } })
  const { raw: _raw, ...draft } = out
  return { ...draft, fileName: f.name, viewUrl: driveViewUrl(f) }
}

/** نشر الشرح بعد مراجعة الأستاذ وتعديله: مقال للتلاميذ مع رابط الملف الأصلي */
export async function publishExplanation(
  db: Db,
  actor: Actor,
  input: { title: string; summary: string; body: string; sourceUrl?: string | null; visibility: Visibility; groupIds: string[]; publish: boolean }
) {
  workspaceOf(actor)
  if (!input.body.trim()) throw new AppError('VALIDATION', { field: 'body' })
  const body = input.sourceUrl ? `${input.body.trim()}\n\nالمرجع: ${input.sourceUrl}` : input.body.trim()
  return createContent(db, actor, { type: 'ARTICLE', title: input.title, summary: input.summary || null, body, visibility: input.visibility, groupIds: input.groupIds, publish: input.publish })
}
