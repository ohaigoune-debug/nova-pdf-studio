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
  text: 'text/plain'
} as const

const READABLE: string[] = [DRIVE_MIME.gdoc, DRIVE_MIME.gslides, DRIVE_MIME.pdf, DRIVE_MIME.docx, DRIVE_MIME.text]
/** حدود تحمي الخادم من مجلد ضخم أو ملف عملاق */
export const MAX_FILES = 80
const MAX_DEPTH = 2
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

/** ملفات المجلد القابلة للقراءة، مع مجلداته الفرعية (مستويان)، مرتّبة بالاسم */
export async function listDriveFolder(folderId: string, opts: DriveOptions = {}): Promise<{ name: string; files: DriveFile[] }> {
  const meta = (await (await driveGet(`files/${encodeURIComponent(folderId)}`, { fields: 'id,name,mimeType' }, opts)).json()) as { name?: string; mimeType?: string }
  if (meta.mimeType !== DRIVE_MIME.folder) throw new AppError('DRIVE_NOT_FOLDER')
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
        if (files.length >= MAX_FILES) return
        if (f.mimeType === DRIVE_MIME.folder) {
          if (depth < MAX_DEPTH) await walk(f.id, depth + 1, `${prefix}${f.name} / `)
        } else if (isReadable(f.mimeType)) {
          files.push({ id: f.id, name: `${prefix}${f.name}`, mimeType: f.mimeType, modifiedTime: f.modifiedTime, size: f.size ? Number(f.size) : undefined })
        }
      }
      pageToken = r.nextPageToken ?? ''
    } while (pageToken && files.length < MAX_FILES)
  }
  await walk(folderId, 0, '')
  return { name: meta.name ?? '', files }
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
