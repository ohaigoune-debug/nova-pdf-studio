import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { S3StorageAdapter, s3ConfigFromEnv } from './storage-s3'

/**
 * واجهة التخزين. التنفيذ الحالي محلي (data/uploads). لاحقاً S3/Supabase Storage بنفس الواجهة.
 * الملفات الخاصة لا تُخدم أبداً مباشرة؛ فقط عبر رابط موقّع قصير العمر.
 */
export interface StorageAdapter {
  put(key: string, data: Buffer): Promise<void>
  get(key: string): Promise<Buffer>
  remove(key: string): Promise<void>
}

const ROOT = () => path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? 'data/uploads')

class LocalStorageAdapter implements StorageAdapter {
  private resolve(key: string) {
    const p = path.resolve(ROOT(), key)
    if (!p.startsWith(ROOT())) throw new Error('invalid storage key')
    return p
  }
  async put(key: string, data: Buffer) {
    const p = this.resolve(key)
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.writeFile(p, data)
  }
  async get(key: string) {
    return fs.readFile(this.resolve(key))
  }
  async remove(key: string) {
    await fs.rm(this.resolve(key), { force: true })
  }
}

let adapter: StorageAdapter | null = null
/**
 * الاختيار من البيئة فقط: STORAGE_DRIVER=local (افتراضي) | s3 (يتطلب S3_BUCKET/S3_ACCESS_KEY_ID/S3_SECRET_ACCESS_KEY).
 * إن طُلب s3 بلا إعدادات كاملة يُستعمل المحلي مع تحذير (لا يتعطّل التطبيق).
 */
export function storage(): StorageAdapter {
  if (adapter) return adapter
  if ((process.env.STORAGE_DRIVER ?? 'local').toLowerCase() === 's3') {
    const cfg = s3ConfigFromEnv()
    if (cfg) adapter = new S3StorageAdapter(cfg)
    else {
      console.warn('[storage] STORAGE_DRIVER=s3 بلا إعدادات كاملة — سيُستعمل التخزين المحلي')
      adapter = new LocalStorageAdapter()
    }
  } else adapter = new LocalStorageAdapter()
  return adapter
}

export function storageInfo(): { driver: 'local' | 's3'; root?: string; bucket?: string } {
  const a = storage()
  return a instanceof S3StorageAdapter ? { driver: 's3', bucket: process.env.S3_BUCKET } : { driver: 'local', root: ROOT() }
}

export function newStorageKey(workspaceId: string | null, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 8).toLowerCase()
  return `${workspaceId ?? 'public'}/${new Date().toISOString().slice(0, 7)}/${randomBytes(16).toString('hex')}${safeExt ? '.' + safeExt : ''}`
}

function secret() {
  const s = process.env.SESSION_SECRET
  if (!s) throw new Error('SESSION_SECRET is not configured')
  return s
}

/** يوقّع رابط ملف صالحاً لمدة محددة (افتراضياً 10 دقائق). */
export function signFileUrl(fileId: string, ttlSeconds = 600, now = Date.now()): string {
  const exp = Math.floor(now / 1000) + ttlSeconds
  const sig = createHmac('sha256', secret()).update(`${fileId}.${exp}`).digest('base64url')
  return `/api/v1/files/${fileId}?exp=${exp}&sig=${sig}`
}

export function verifyFileSignature(fileId: string, exp: string | null, sig: string | null, now = Date.now()): boolean {
  if (!exp || !sig) return false
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Math.floor(now / 1000)) return false
  const expected = createHmac('sha256', secret()).update(`${fileId}.${expNum}`).digest('base64url')
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'video/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain'
])
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
