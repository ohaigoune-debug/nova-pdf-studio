import { createHash, randomBytes } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

/**
 * كاش النسخ المختومة من ملفات PDF المحمية.
 * الختم (pdf-lib) يكلّف مئات الملّي ثانية من المعالج لكل فتح؛ هنا يُحفظ الناتج على القرص
 * بمفتاح يضم كل ما يحدّد بايتاته (الملف ونسخته + المشاهد + نص الختم وإعداداته) فلا يُعاد
 * الختم عند الفتح الثاني. الكاش لا يقرّر الأحقية أبداً: المسار يتحقق من الصلاحية أولاً ثم يسأل الكاش.
 * - الكتابة ذرّية (ملف مؤقت + fsync + rename): انقطاع في المنتصف لا يترك ملفاً ناقصاً يُخدَم.
 * - الفتحات المتزامنة لنفس المفتاح داخل العملية تختم مرة واحدة.
 * - أي عطل في الكاش (قرص للقراءة فقط، امتلاء…) لا يمنع التسليم: يُختم الملف ويُرسل كما كان.
 */

/** مجلد فرعي داخل مجلد المرفوعات (نفس الـvolume الدائم القابل للكتابة) — مستثنى من النسخ الاحتياطي في scripts/backup.sh */
export const STAMP_CACHE_DIRNAME = '.stamp-cache'
/** نسخة لم تُفتح منذ 30 يوماً تُحذف */
export const STAMP_CACHE_MAX_AGE_MS = 30 * 86_400_000
const DEFAULT_MAX_MB = 2048
/** ملف مؤقت أقدم من ساعة = كتابة انقطعت */
const STALE_PART_MS = 3600_000
/** لا يُحدَّث وقت «آخر فتح» أكثر من مرة في الساعة (تخفيف الكتابة) */
const TOUCH_INTERVAL_MS = 3600_000

export function stampCacheDir(): string {
  const custom = process.env.PDF_STAMP_CACHE_DIR
  if (custom) return path.resolve(process.cwd(), custom)
  return path.join(path.resolve(process.cwd(), process.env.UPLOADS_DIR ?? 'data/uploads'), STAMP_CACHE_DIRNAME)
}

/** السقف الكلي بالبايت: PDF_STAMP_CACHE_MAX_MB (افتراضياً 2048). القيمة 0 تعطّل الكاش كلياً. */
export function stampCacheMaxBytes(): number {
  const raw = process.env.PDF_STAMP_CACHE_MAX_MB
  if (raw === undefined || raw.trim() === '') return DEFAULT_MAX_MB * 1024 * 1024
  const mb = Number(raw)
  if (!Number.isFinite(mb) || mb < 0) return DEFAULT_MAX_MB * 1024 * 1024
  return Math.floor(mb * 1024 * 1024)
}

export interface StampKeyInput {
  /** هوية الملف ونسخة محتواه: استبدال المرفوع يغيّر واحداً منها على الأقل */
  fileId: string
  storageKey: string
  checksum: string | null
  sizeBytes: number
  updatedAt: Date | string | null
  /** الحجم الفعلي في التخزين لحظة الطلب (يكشف استبدال الكائن بلا تحديث الصف) */
  storedSize: number | null
  viewerId: string
  /** سطور الختم كما ستُرسم حرفياً */
  watermark: string[]
  /** نسخة إعدادات الختم (الخط، الموضع، طريقة الحفظ) */
  stampVersion: string
}

export function stampCacheKey(i: StampKeyInput): string {
  const updatedAt = i.updatedAt ? new Date(i.updatedAt).toISOString() : null
  return createHash('sha256')
    .update(JSON.stringify(['pdf-stamp', i.stampVersion, i.fileId, i.storageKey, i.checksum, i.sizeBytes, updatedAt, i.storedSize, i.viewerId, i.watermark]))
    .digest('hex')
}

function entryPath(key: string): string {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('invalid stamp cache key')
  return path.join(stampCacheDir(), key.slice(0, 2), `${key}.pdf`)
}

export interface StampedPdf {
  size: number
  body: Uint8Array | ReadableStream<Uint8Array>
  /** true = خُدم من القرص بلا ختم */
  hit: boolean
}

async function openCached(key: string, now: number): Promise<StampedPdf | null> {
  let fh: fs.FileHandle
  try {
    fh = await fs.open(entryPath(key), 'r')
  } catch {
    return null
  }
  try {
    const st = await fh.stat()
    if (!st.isFile() || st.size <= 0) {
      await fh.close()
      return null
    }
    // «آخر فتح» = mtime (atime غير موثوق على الأقراص المركّبة بـ noatime)
    if (now - st.mtimeMs > TOUCH_INTERVAL_MS) await fh.utimes(new Date(now), new Date(now)).catch(() => {})
    // الواصف مفتوح: حذف الملف أثناء البث (تنظيف) لا يقطع هذا الرد
    const stream = Readable.toWeb(fh.createReadStream({ autoClose: true })) as ReadableStream<Uint8Array>
    return { size: st.size, body: stream, hit: true }
  } catch {
    await fh.close().catch(() => {})
    return null
  }
}

async function writeAtomic(key: string, data: Buffer): Promise<void> {
  const final = entryPath(key)
  await fs.mkdir(path.dirname(final), { recursive: true })
  const tmp = `${final}.${process.pid}.${randomBytes(6).toString('hex')}.part`
  try {
    const fh = await fs.open(tmp, 'wx')
    try {
      await fh.writeFile(data)
      await fh.sync()
    } finally {
      await fh.close()
    }
    await fs.rename(tmp, final)
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

const inflight = new Map<string, Promise<Buffer>>()
let bytesSinceSweep = 0
let sweeping: Promise<unknown> | null = null
let warned = false

/**
 * يرجع النسخة المختومة لهذا المفتاح: من القرص إن وُجدت، وإلا يستدعي produce مرة واحدة
 * (مهما تزامنت الطلبات) ويحفظ الناتج. يُستدعى بعد التحقق من الصلاحية فقط.
 */
export async function getOrCreateStamped(key: string, produce: () => Promise<Buffer>, now: number = Date.now()): Promise<StampedPdf> {
  const max = stampCacheMaxBytes()
  if (max <= 0) {
    const out = await produce()
    return { size: out.length, body: new Uint8Array(out), hit: false }
  }
  const cached = await openCached(key, now)
  if (cached) return cached

  let job = inflight.get(key)
  if (!job) {
    job = (async () => {
      const out = await produce()
      try {
        await writeAtomic(key, out)
        bytesSinceSweep += out.length
        // السقف لا ينتظر مهمة الصيانة اليومية: كلما كُتب 1/16 منه يُفحص الحجم في الخلفية
        if (bytesSinceSweep >= max / 16) void sweepStampCache().catch(() => {})
      } catch (err) {
        if (!warned) {
          warned = true
          console.warn('[pdf-stamp-cache] تعذّرت الكتابة في الكاش — يستمر الختم المباشر:', err instanceof Error ? err.message : err)
        }
      }
      return out
    })()
    inflight.set(key, job)
    void job.finally(() => inflight.delete(key)).catch(() => {})
  }
  const out = await job
  return { size: out.length, body: new Uint8Array(out), hit: false }
}

export interface StampCacheSweep {
  /** ما بقي بعد التنظيف */
  files: number
  bytes: number
  removed: number
  removedBytes: number
}

/**
 * تنظيف الكاش: يحذف ما لم يُفتح منذ 30 يوماً والملفات المؤقتة المنقطعة، ثم يفرض السقف الكلي
 * بحذف الأقدم فتحاً أولاً (LRU). يُستدعى من مهمة الصيانة اليومية CLEANUP ومن الكتابة عند الاقتراب من السقف.
 */
export async function sweepStampCache(now: number = Date.now(), opts: { maxBytes?: number; maxAgeMs?: number } = {}): Promise<StampCacheSweep> {
  if (sweeping) await sweeping.catch(() => {})
  const run = doSweep(now, opts.maxBytes ?? stampCacheMaxBytes(), opts.maxAgeMs ?? STAMP_CACHE_MAX_AGE_MS)
  sweeping = run
  try {
    return await run
  } finally {
    if (sweeping === run) sweeping = null
  }
}

async function doSweep(now: number, maxBytes: number, maxAgeMs: number): Promise<StampCacheSweep> {
  bytesSinceSweep = 0
  const root = stampCacheDir()
  const kept: { p: string; size: number; mtime: number }[] = []
  let removed = 0
  let removedBytes = 0
  const drop = async (p: string, size: number) => {
    try {
      await fs.rm(p, { force: true })
      removed++
      removedBytes += size
    } catch {
      /* يُعاد في الدورة القادمة */
    }
  }
  const shards = await fs.readdir(root, { withFileTypes: true }).catch(() => [])
  for (const shard of shards) {
    if (!shard.isDirectory() || !/^[a-f0-9]{2}$/.test(shard.name)) continue
    const dir = path.join(root, shard.name)
    for (const name of await fs.readdir(dir).catch(() => [] as string[])) {
      const p = path.join(dir, name)
      const st = await fs.stat(p).catch(() => null)
      if (!st || !st.isFile()) continue
      if (name.endsWith('.part')) {
        if (now - st.mtimeMs > STALE_PART_MS) await drop(p, st.size)
      } else if (/^[a-f0-9]{64}\.pdf$/.test(name)) {
        if (now - st.mtimeMs > maxAgeMs) await drop(p, st.size)
        else kept.push({ p, size: st.size, mtime: st.mtimeMs })
      }
    }
  }
  let bytes = kept.reduce((n, e) => n + e.size, 0)
  let files = kept.length
  if (bytes > maxBytes) {
    kept.sort((a, b) => a.mtime - b.mtime)
    for (const e of kept) {
      if (bytes <= maxBytes) break
      await drop(e.p, e.size)
      bytes -= e.size
      files--
    }
  }
  return { files, bytes, removed, removedBytes }
}

/** هل تطابق ترويسة If-None-Match هذا الوسم؟ (قائمة، W/، أو *) */
export function etagMatches(header: string | null, etag: string): boolean {
  if (!header) return false
  return header.split(',').some((raw) => {
    const v = raw.trim().replace(/^W\//, '')
    return v === '*' || v === etag
  })
}
