/**
 * قراءة مجلد Google Drive عامّ («كل من لديه الرابط — عارض») بمفتاح API، بلا تسجيل دخول Google.
 * المفتاح: GOOGLE_API_KEY، وإلا مفتاح يوتيوب نفسه (مشروع Google Cloud واحد يُفعَّل فيه Drive API).
 *
 * الأنواع المقروءة: مستندات Google وعروضها، PDF (ذات نصّ لا مصوّرة)، Word (docx)، والنص العادي.
 */
import { cleanText, extractDocText } from './doc-text'
import { AppError } from './errors'

export const DRIVE_MIME = {
  folder: 'application/vnd.google-apps.folder',
  gdoc: 'application/vnd.google-apps.document',
  gslides: 'application/vnd.google-apps.presentation',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  text: 'text/plain'
} as const

const READABLE: string[] = [DRIVE_MIME.gdoc, DRIVE_MIME.gslides, DRIVE_MIME.pdf, DRIVE_MIME.docx, DRIVE_MIME.pptx, DRIVE_MIME.text]
/** حدود تحمي الخادم من مجلد ضخم أو ملف عملاق (قابلة للرفع صراحةً لكل استدعاء) */
export const MAX_FILES = 80
const DEFAULT_MAX_FILES = MAX_FILES
const DEFAULT_MAX_DEPTH = 2
const MAX_BYTES = 25 * 1024 * 1024

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  size?: number
}

export interface DriveOptions {
  apiKey?: string
  fetch?: typeof fetch
  /** حدود السرد (الافتراضي 80 ملفاً ومستويان — يكفي لمكتبة أستاذ؛ أرشيف البكالوريا يرفعها) */
  maxFiles?: number
  maxDepth?: number
}

export function driveApiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.YOUTUBE_API_KEY || undefined
}

/** رابط ملف واحد: /file/d/ID، أو مستند/عرض Google، أو ?id=ID */
export function parseDriveFileId(input: string): string | null {
  const m = input.trim().match(/\/(?:file|document|presentation|spreadsheets)\/d\/([A-Za-z0-9_-]{10,})/)
  return m ? m[1]! : null
}

/** بيانات ملف واحد (للروابط المفردة) */
export async function getDriveFile(fileId: string, opts: DriveOptions = {}): Promise<DriveFile> {
  const f = (await (await driveGet(`files/${encodeURIComponent(fileId)}`, { fields: 'id,name,mimeType,modifiedTime,size' }, opts)).json()) as {
    id: string
    name: string
    mimeType: string
    modifiedTime: string
    size?: string
  }
  return { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, size: f.size ? Number(f.size) : undefined }
}

/** رابط مجلد (بأي صيغة يعطيها Drive) أو معرّفه مباشرة */
export function parseDriveFolderId(input: string): string | null {
  const s = input.trim()
  const m = s.match(/\/folders\/([A-Za-z0-9_-]{10,})/) ?? s.match(/[?&]id=([A-Za-z0-9_-]{10,})/)
  if (m) return m[1]!
  return /^[A-Za-z0-9_-]{10,}$/.test(s) ? s : null
}

export function isReadable(mimeType: string): boolean {
  return READABLE.includes(mimeType)
}

async function driveGet(path: string, params: Record<string, string>, opts: DriveOptions): Promise<Response> {
  const key = opts.apiKey ?? driveApiKey()
  if (!key) throw new AppError('DRIVE_API_DISABLED')
  const q = new URLSearchParams({ ...params, key })
  const res = await (opts.fetch ?? fetch)(`https://www.googleapis.com/drive/v3/${path}?${q.toString()}`, { signal: AbortSignal.timeout(30_000) })
  if (res.ok) return res
  const body = await res.text().catch(() => '')
  // مفتاح غير صالح أو Drive API غير مفعّلة في مشروعه
  if (res.status === 400 || /accessNotConfigured|API_KEY|keyInvalid|SERVICE_DISABLED|API has not been used/i.test(body)) throw new AppError('DRIVE_API_DISABLED')
  // 404/403: المجلد أو الملف غير مشارَك للعموم
  if (res.status === 404 || res.status === 403) throw new AppError('DRIVE_NOT_SHARED')
  throw new AppError('DRIVE_FETCH_FAILED')
}

/** ملفات المجلد القابلة للقراءة، مع مجلداته الفرعية (مستويان افتراضياً)، مرتّبة بالاسم */
export async function listDriveFolder(folderId: string, opts: DriveOptions = {}): Promise<{ name: string; files: DriveFile[] }> {
  const meta = (await (await driveGet(`files/${encodeURIComponent(folderId)}`, { fields: 'id,name,mimeType' }, opts)).json()) as { name?: string; mimeType?: string }
  if (meta.mimeType !== DRIVE_MIME.folder) throw new AppError('DRIVE_NOT_FOLDER')
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH
  const files: DriveFile[] = []
  const walk = async (id: string, depth: number, prefix: string) => {
    let pageToken = ''
    do {
      const r = (await (
        await driveGet(
          'files',
          {
            q: `'${id}' in parents and trashed = false`,
            fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
            pageSize: '100',
            orderBy: 'name',
            ...(pageToken ? { pageToken } : {})
          },
          opts
        )
      ).json()) as { nextPageToken?: string; files?: { id: string; name: string; mimeType: string; modifiedTime: string; size?: string }[] }
      for (const f of r.files ?? []) {
        if (files.length >= maxFiles) return
        if (f.mimeType === DRIVE_MIME.folder) {
          if (depth < maxDepth) await walk(f.id, depth + 1, `${prefix}${f.name} / `)
        } else if (isReadable(f.mimeType)) {
          files.push({ id: f.id, name: `${prefix}${f.name}`, mimeType: f.mimeType, modifiedTime: f.modifiedTime, size: f.size ? Number(f.size) : undefined })
        }
      }
      pageToken = r.nextPageToken ?? ''
    } while (pageToken && files.length < maxFiles)
  }
  await walk(folderId, 0, '')
  return { name: meta.name ?? '', files }
}

/** بايتات ملف واحد (PDF/Word/نص) — لتخزينه محلياً؛ مستندات Google تُصدَّر PDF */
export async function fetchDriveBytes(file: DriveFile, opts: DriveOptions = {}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  if (file.size && file.size > MAX_BYTES) throw new AppError('DRIVE_FETCH_FAILED')
  if (file.mimeType === DRIVE_MIME.gdoc || file.mimeType === DRIVE_MIME.gslides) {
    const res = await driveGet(`files/${encodeURIComponent(file.id)}/export`, { mimeType: DRIVE_MIME.pdf }, opts)
    return { bytes: new Uint8Array(await res.arrayBuffer()), mimeType: DRIVE_MIME.pdf }
  }
  const res = await driveGet(`files/${encodeURIComponent(file.id)}`, { alt: 'media' }, opts)
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw new AppError('DRIVE_FETCH_FAILED')
  return { bytes, mimeType: file.mimeType }
}

/** نصّ ملف واحد، أو '' إن لم يكن فيه نصّ (PDF مصوّر مثلاً) */
export async function fetchDriveText(file: DriveFile, opts: DriveOptions = {}): Promise<string> {
  if (file.size && file.size > MAX_BYTES) return ''
  if (file.mimeType === DRIVE_MIME.gdoc || file.mimeType === DRIVE_MIME.gslides) {
    const res = await driveGet(`files/${encodeURIComponent(file.id)}/export`, { mimeType: 'text/plain' }, opts)
    return cleanText(await res.text())
  }
  const res = await driveGet(`files/${encodeURIComponent(file.id)}`, { alt: 'media' }, opts)
  const buf = new Uint8Array(await res.arrayBuffer())
  if (buf.byteLength > MAX_BYTES) return ''
  return extractDocText(buf, file.mimeType)
}

/* ───────────── مجلد عامّ بلا مفتاح API ───────────── */

const decodeEntities = (t: string) =>
  t
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .trim()

/** عناصر صفحة «embeddedfolderview» لمجلد عامّ: مجلدات فرعية وملفات بمعرّفاتها وأسمائها */
export function parseEmbeddedFolderView(html: string): { id: string; name: string; folder: boolean }[] {
  const out: { id: string; name: string; folder: boolean }[] = []
  const re = /<div class="flip-entry"[^>]*\sid="entry-([A-Za-z0-9_-]{10,})"[\s\S]*?<a\s+href="([^"]+)"[\s\S]*?<div class="flip-entry-title">([\s\S]*?)<\/div>/g
  for (const m of html.matchAll(re)) {
    const href = decodeEntities(m[2]!)
    out.push({ id: m[1]!, name: decodeEntities(m[3]!.replace(/<[^>]+>/g, '')), folder: /\/folders\//.test(href) })
  }
  return out
}

const EXT_MIME: Record<string, string> = { pdf: DRIVE_MIME.pdf, docx: DRIVE_MIME.docx, pptx: DRIVE_MIME.pptx, txt: DRIVE_MIME.text }

/**
 * سرد مجلد مشارَك للعموم («كل من لديه الرابط») بلا مفتاح Google API: صفحة العرض المضمَّن التي يتيحها Drive لكل مجلد عامّ.
 * بديل عند غياب المفتاح أو تعطيل Drive API في مشروعه؛ المجلد الخاص يعطي DRIVE_NOT_SHARED.
 */
export async function listPublicFolderNoKey(folderId: string, opts: DriveOptions = {}): Promise<{ name: string; files: DriveFile[] }> {
  const doFetch = opts.fetch ?? fetch
  const maxFiles = opts.maxFiles ?? DEFAULT_MAX_FILES
  const maxDepth = opts.maxDepth ?? DEFAULT_MAX_DEPTH
  const page = async (id: string): Promise<{ title: string; items: { id: string; name: string; folder: boolean }[] }> => {
    const res = await doFetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(30_000), headers: { 'accept-language': 'ar,fr;q=0.8,en;q=0.5' } })
    if (res.status === 404 || res.status === 403) throw new AppError('DRIVE_NOT_SHARED')
    if (!res.ok) throw new AppError('DRIVE_FETCH_FAILED')
    const html = await res.text()
    // مجلد خاص: Drive يحوّل إلى صفحة تسجيل الدخول بدل القائمة
    if (!/flip-entry|flip-list/.test(html) && /accounts\.google\.com|ServiceLogin/.test(html)) throw new AppError('DRIVE_NOT_SHARED')
    const title = decodeEntities(/<title>([\s\S]*?)<\/title>/.exec(html)?.[1] ?? '')
    return { title, items: parseEmbeddedFolderView(html) }
  }
  const files: DriveFile[] = []
  const root = await page(folderId)
  const walk = async (items: { id: string; name: string; folder: boolean }[], depth: number, prefix: string) => {
    for (const it of items.sort((a, b) => a.name.localeCompare(b.name))) {
      if (files.length >= maxFiles) return
      if (it.folder) {
        if (depth < maxDepth) await walk((await page(it.id)).items, depth + 1, `${prefix}${it.name} / `)
        continue
      }
      const ext = /\.([a-z0-9]{2,5})$/i.exec(it.name)?.[1]?.toLowerCase() ?? ''
      const mimeType = EXT_MIME[ext]
      if (mimeType) files.push({ id: it.id, name: `${prefix}${it.name}`, mimeType, modifiedTime: '' })
    }
  }
  await walk(root.items, 0, '')
  return { name: root.title, files }
}

/** تنزيل ملف عامّ بلا مفتاح (رابط التنزيل المباشر)؛ صفحة HTML بدل الملف تعني أنه غير مشارَك */
export async function fetchPublicFileBytes(file: DriveFile, opts: DriveOptions = {}): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const res = await (opts.fetch ?? fetch)(`https://drive.usercontent.google.com/download?id=${encodeURIComponent(file.id)}&export=download&confirm=t`, { redirect: 'follow', signal: AbortSignal.timeout(120_000) })
  if (res.status === 404 || res.status === 403) throw new AppError('DRIVE_NOT_SHARED')
  if (!res.ok) throw new AppError('DRIVE_FETCH_FAILED')
  if ((res.headers.get('content-type') ?? '').includes('text/html')) throw new AppError('DRIVE_NOT_SHARED')
  const bytes = new Uint8Array(await res.arrayBuffer())
  if (bytes.byteLength > MAX_BYTES) throw new AppError('DRIVE_FETCH_FAILED')
  if (file.mimeType === DRIVE_MIME.pdf && !(bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46)) throw new AppError('DRIVE_FETCH_FAILED')
  return { bytes, mimeType: file.mimeType }
}
