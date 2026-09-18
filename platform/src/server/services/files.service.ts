import { createHash } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { files } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, newStorageKey, storage } from '@/server/lib/storage'

export interface UploadInput {
  originalName: string
  mimeType: string
  bytes: Buffer
  bucket?: 'private' | 'public'
}

export async function uploadFile(db: Db, actor: Actor, input: UploadInput) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  if (input.bytes.length === 0) throw new AppError('VALIDATION', { field: 'file' })
  if (input.bytes.length > MAX_UPLOAD_BYTES) throw new AppError('FILE_TOO_LARGE')
  const mime = input.mimeType.toLowerCase()
  if (!ALLOWED_MIME.has(mime)) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  const ext = input.originalName.includes('.') ? input.originalName.split('.').pop() ?? '' : ''
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : null
  const key = newStorageKey(workspaceId, ext)
  await storage().put(key, input.bytes)
  const [row] = await db
    .insert(files)
    .values({
      workspaceId,
      ownerUserId: actor.userId,
      bucket: input.bucket ?? 'private',
      storageKey: key,
      originalName: input.originalName.slice(0, 200),
      mimeType: mime,
      sizeBytes: input.bytes.length,
      checksum: createHash('sha256').update(input.bytes).digest('hex')
    })
    .returning()
  if (!row) throw new AppError('INTERNAL')
  await writeAudit(db, { actorUserId: actor.userId, workspaceId, action: 'file.upload', entityType: 'file', entityId: row.id, newValue: { name: row.originalName, size: row.sizeBytes, mime } })
  return row
}

export async function deleteFile(db: Db, actor: Actor, id: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const [f] = await db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt))).limit(1)
  if (!f) throw new AppError('FILE_NOT_FOUND')
  if (actor.role === 'TEACHER' && f.workspaceId !== actor.workspaceId) throw new AppError('FILE_NOT_FOUND')
  await db.transaction(async (tx) => {
    await tx.update(files).set({ deletedAt: new Date() }).where(eq(files.id, f.id))
    await writeAudit(tx, { actorUserId: actor.userId, workspaceId: f.workspaceId, action: 'file.delete', entityType: 'file', entityId: f.id, oldValue: { name: f.originalName } })
  })
}

/** يُستدعى من مسار التنزيل بعد التحقق من التوقيع فقط */
export async function readFileForDownload(db: Db, id: string) {
  assertUuid(id, 'FILE_NOT_FOUND')
  const [f] = await db.select().from(files).where(and(eq(files.id, id), isNull(files.deletedAt))).limit(1)
  if (!f) throw new AppError('FILE_NOT_FOUND')
  const bytes = await storage().get(f.storageKey)
  return { file: f, bytes }
}
