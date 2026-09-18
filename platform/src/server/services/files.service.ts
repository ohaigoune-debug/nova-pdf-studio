import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { files } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError, assertUuid } from '@/server/lib/errors'
import { ALLOWED_MIME, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, newStorageKey, storage } from '@/server/lib/storage'

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

/* -------------------------------------------------------------------------- */
/*            رفع مباشر للملفات الكبيرة (فيديو): تذكرة → PUT → إكمال            */
/* -------------------------------------------------------------------------- */

export interface UploadTicket {
  fileId: string
  method: 'PUT'
  url: string
  headers: Record<string, string>
  /** true = الرفع إلى S3 مباشرة من المتصفح؛ false = تيار عبر خادم التطبيق */
  direct: boolean
  maxBytes: number
}

const UPLOAD_TTL_SECONDS = 30 * 60

function uploadSecret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return s
}

export function signUploadUrl(fileId: string, userId: string, ttlSeconds = UPLOAD_TTL_SECONDS, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const sig = createHmac('sha256', uploadSecret()).update(`upload.${fileId}.${userId}.${exp}`).digest('base64url')
  return `/api/v1/files/${fileId}/upload?exp=${exp}&sig=${sig}`
}

export function verifyUploadSignature(fileId: string, userId: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(now / 1000)) return false
  const expected = createHmac('sha256', uploadSecret()).update(`upload.${fileId}.${userId}.${expNum}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function maxBytesFor(mime: string): number {
  return mime.startsWith('video/') ? MAX_VIDEO_UPLOAD_BYTES() : MAX_UPLOAD_BYTES
}

/** يحجز صف ملف PENDING ويعطي رابط رفع (S3 مباشر إن أمكن، وإلا تيار عبر الخادم). */
export async function createUploadTicket(db: Db, actor: Actor, input: { originalName: string; mimeType: string; sizeBytes: number }): Promise<UploadTicket> {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  const mime = input.mimeType.toLowerCase()
  if (!ALLOWED_MIME.has(mime)) throw new AppError('FILE_TYPE_NOT_ALLOWED')
  const max = maxBytesFor(mime)
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) throw new AppError('VALIDATION', { field: 'size' })
  if (input.sizeBytes > max) throw new AppError('FILE_TOO_LARGE')
  const ext = input.originalName.includes('.') ? input.originalName.split('.').pop() ?? '' : ''
  const workspaceId = actor.role === 'TEACHER' ? actor.workspaceId : null
  const key = newStorageKey(workspaceId, ext)
  const [row] = await db
    .insert(files)
    .values({ workspaceId, ownerUserId: actor.userId, bucket: 'private', storageKey: key, originalName: input.originalName.slice(0, 200), mimeType: mime, sizeBytes: input.sizeBytes, status: 'PENDING' })
    .returning({ id: files.id })
  if (!row) throw new AppError('INTERNAL')
  const s = storage()
  if (s.presignPut) {
    const p = await s.presignPut(key, mime, input.sizeBytes, UPLOAD_TTL_SECONDS)
    return { fileId: row.id, method: 'PUT', url: p.url, headers: p.headers, direct: true, maxBytes: max }
  }
  return { fileId: row.id, method: 'PUT', url: signUploadUrl(row.id, actor.userId), headers: { 'Content-Type': mime }, direct: false, maxBytes: max }
}

/** يستقبل جسم الطلب كتيار ويكتبه في التخزين (المسار غير المباشر). */
export async function receiveUploadStream(db: Db, actor: Actor, fileId: string, body: ReadableStream<Uint8Array> | null) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(fileId, 'FILE_NOT_FOUND')
  const [f] = await db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1)
  if (!f || f.ownerUserId !== actor.userId) throw new AppError('FILE_NOT_FOUND')
  if (f.status !== 'PENDING') throw new AppError('VALIDATION', { reason: 'already uploaded' })
  if (!body) throw new AppError('VALIDATION', { field: 'body' })
  let total: number
  try {
    total = await storage().putStream(f.storageKey, body, maxBytesFor(f.mimeType))
  } catch (err) {
    if (String(err).includes('FILE_TOO_LARGE')) throw new AppError('FILE_TOO_LARGE')
    throw err
  }
  return { fileId: f.id, bytes: total }
}

/** يتحقق أن الكائن موجود بالحجم المعلن ثم يعلّم الملف READY. */
export async function completeUpload(db: Db, actor: Actor, fileId: string) {
  assertRole(actor, 'TEACHER', 'SUPER_ADMIN')
  assertUuid(fileId, 'FILE_NOT_FOUND')
  const [f] = await db.select().from(files).where(and(eq(files.id, fileId), isNull(files.deletedAt))).limit(1)
  if (!f || f.ownerUserId !== actor.userId) throw new AppError('FILE_NOT_FOUND')
  if (f.status === 'READY') return f
  const size = await storage().size(f.storageKey)
  if (size === null || size <= 0) throw new AppError('UPLOAD_INCOMPLETE')
  const [row] = await db.update(files).set({ status: 'READY', sizeBytes: size }).where(eq(files.id, f.id)).returning()
  await writeAudit(db, { actorUserId: actor.userId, workspaceId: f.workspaceId, action: 'file.upload', entityType: 'file', entityId: f.id, newValue: { name: f.originalName, size, mime: f.mimeType, direct: true } })
  return row ?? f
}
