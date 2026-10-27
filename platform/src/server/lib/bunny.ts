/**
 * Bunny Stream: مزوّد فيديو خارجي يحمي البث برابط تضمين موقّع مؤقّت (Token Authentication).
 * - الاعتمادات تُحفظ مختومة (secret-box) في جدول الإعدادات تحت المفتاح `video.bunny`.
 * - التوقيع نقي (بلا شبكة ولا قاعدة بيانات) كي يُختبر وحدوياً:
 *   token = sha256hex(tokenAuthKey + videoId + expires)
 * - الحماية تقلّل التسريب ولا تمنعه كلياً؛ الرابط لا يُسلَّم إلا لمن تحقّقت أحقيته في media.service.
 */
import { createHash } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'

export const BUNNY_SETTINGS_KEY = 'video.bunny'
const PURPOSE = 'bunny'
const API_BASE = 'https://video.bunnycdn.com'
export const BUNNY_EMBED_BASE = 'https://iframe.mediadelivery.net/embed'

export interface BunnyCredentials {
  libraryId: string
  apiKey: string
  tokenAuthKey: string
  cdnHostname: string
}

/** ما تعرضه لوحة الإدارة: بلا المفاتيح نفسها */
export interface BunnyCredentialsView {
  libraryId: string
  cdnHostname: string
  apiKeyHint: string
  tokenKeyHint: string
  updatedAt: string
  /** false: حُفظ بسرّ جلسة قديم ولم يعد يُفتح — يجب إدخاله من جديد */
  usable: boolean
}

interface Stored {
  libraryId: string
  cdnHostname: string
  apiKeySealed: string
  tokenAuthKeySealed: string
  updatedAt: string
}

const LIBRARY_RE = /^\d{1,12}$/
const VIDEO_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isBunnyVideoId(v: string | null | undefined): v is string {
  return !!v && VIDEO_ID_RE.test(v)
}

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, BUNNY_SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<Stored> | undefined
  if (!v?.libraryId || !v.apiKeySealed || !v.tokenAuthKeySealed) return null
  return { libraryId: v.libraryId, cdnHostname: v.cdnHostname ?? '', apiKeySealed: v.apiKeySealed, tokenAuthKeySealed: v.tokenAuthKeySealed, updatedAt: v.updatedAt ?? '' }
}

/** الاعتمادات مفتوحة للاستعمال في الخادم؛ null إن لم تُضبط أو تعذّر فتحها */
export async function getBunnyCredentials(db: Db): Promise<BunnyCredentials | null> {
  const s = await readStored(db)
  if (!s) return null
  const apiKey = unseal(s.apiKeySealed, PURPOSE)
  const tokenAuthKey = unseal(s.tokenAuthKeySealed, PURPOSE)
  if (!apiKey || !tokenAuthKey) return null
  return { libraryId: s.libraryId, apiKey, tokenAuthKey, cdnHostname: s.cdnHostname }
}

export async function getBunnyCredentialsView(db: Db): Promise<BunnyCredentialsView | null> {
  const s = await readStored(db)
  if (!s) return null
  const apiKey = unseal(s.apiKeySealed, PURPOSE)
  const tokenKey = unseal(s.tokenAuthKeySealed, PURPOSE)
  return {
    libraryId: s.libraryId,
    cdnHostname: s.cdnHostname,
    apiKeyHint: apiKey ? apiKey.slice(-4) : '',
    tokenKeyHint: tokenKey ? tokenKey.slice(-4) : '',
    updatedAt: s.updatedAt,
    usable: !!apiKey && !!tokenKey
  }
}

export async function saveBunnyCredentials(db: Db, input: BunnyCredentials): Promise<void> {
  const libraryId = input.libraryId.trim()
  if (!LIBRARY_RE.test(libraryId)) throw new AppError('VALIDATION', { field: 'libraryId' })
  const apiKey = input.apiKey.trim()
  const tokenAuthKey = input.tokenAuthKey.trim()
  if (apiKey.length < 16) throw new AppError('VALIDATION', { field: 'apiKey' })
  if (tokenAuthKey.length < 16) throw new AppError('VALIDATION', { field: 'tokenAuthKey' })
  const cdnHostname = input.cdnHostname.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  const value: Stored = { libraryId, cdnHostname, apiKeySealed: seal(apiKey, PURPOSE), tokenAuthKeySealed: seal(tokenAuthKey, PURPOSE), updatedAt: new Date().toISOString() }
  const now = new Date()
  await db
    .insert(appSettings)
    .values({ key: BUNNY_SETTINGS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: now } })
}

export async function clearBunnyCredentials(db: Db): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, BUNNY_SETTINGS_KEY))
}

function apiHeaders(creds: Pick<BunnyCredentials, 'apiKey'>): Record<string, string> {
  return { AccessKey: creds.apiKey, accept: 'application/json', 'content-type': 'application/json' }
}

/** طلب خفيف عند Bunny: هل المكتبة والمفتاح صحيحان؟ */
export async function testBunny(creds: Pick<BunnyCredentials, 'libraryId' | 'apiKey'>, fetchImpl: typeof fetch = fetch): Promise<{ ok: true; totalItems: number }> {
  let res: Response
  try {
    res = await fetchImpl(`${API_BASE}/library/${encodeURIComponent(creds.libraryId)}/videos?itemsPerPage=1`, { headers: apiHeaders(creds), signal: AbortSignal.timeout(10_000) })
  } catch {
    throw new AppError('BUNNY_UNREACHABLE')
  }
  if (res.status === 401 || res.status === 403 || res.status === 404) throw new AppError('BUNNY_KEY_INVALID')
  if (!res.ok) throw new AppError('BUNNY_UNREACHABLE')
  const j = (await res.json().catch(() => ({}))) as { totalItems?: number }
  return { ok: true, totalItems: Number(j.totalItems ?? 0) }
}

/** ينشئ كيان فيديو فارغاً في المكتبة ويرجع معرّفه (ثم يُرفع الملف عليه) */
export async function createVideo(creds: Pick<BunnyCredentials, 'libraryId' | 'apiKey'>, title: string, fetchImpl: typeof fetch = fetch): Promise<{ videoId: string }> {
  const res = await fetchImpl(`${API_BASE}/library/${encodeURIComponent(creds.libraryId)}/videos`, {
    method: 'POST',
    headers: apiHeaders(creds),
    body: JSON.stringify({ title: title.trim().slice(0, 200) || 'video' }),
    signal: AbortSignal.timeout(15_000)
  })
  if (res.status === 401 || res.status === 403) throw new AppError('BUNNY_KEY_INVALID')
  if (!res.ok) throw new AppError('BUNNY_UNREACHABLE')
  const j = (await res.json()) as { guid?: string }
  if (!j.guid) throw new AppError('BUNNY_UNREACHABLE')
  return { videoId: j.guid }
}

/**
 * عنوان الرفع (PUT بجسم الملف الخام مع ترويسة AccessKey). الرفع نفسه يتم من لوحة Bunny أو
 * من إجراء خادمي يمرّر الملف كاملاً؛ ثم يُلصق معرّف الفيديو في نموذج المحتوى.
 */
export function uploadUrl(creds: Pick<BunnyCredentials, 'libraryId'>, videoId: string): string {
  return `${API_BASE}/library/${encodeURIComponent(creds.libraryId)}/videos/${encodeURIComponent(videoId)}`
}

/** رفع ملف فيديو كامل إلى كيان موجود (للملفات الصغيرة من نموذج خادمي) */
export async function uploadVideoBytes(creds: Pick<BunnyCredentials, 'libraryId' | 'apiKey'>, videoId: string, bytes: Uint8Array, fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await fetchImpl(uploadUrl(creds, videoId), { method: 'PUT', headers: { AccessKey: creds.apiKey, 'content-type': 'application/octet-stream' }, body: new Blob([bytes as BlobPart]) })
  if (res.status === 401 || res.status === 403) throw new AppError('BUNNY_KEY_INVALID')
  if (!res.ok) throw new AppError('BUNNY_UNREACHABLE')
}

/** رمز Bunny للتضمين الموقّع: sha256hex(tokenAuthKey + videoId + expires) — نقي */
export function embedToken(tokenAuthKey: string, videoId: string, expires: number): string {
  return createHash('sha256').update(`${tokenAuthKey}${videoId}${expires}`).digest('hex')
}

export interface SignedEmbedInput {
  videoId: string
  expiresInSeconds: number
  /** علامة المشاهد (تُمرَّر كمعامل حرّ للتتبّع؛ العلامة المائية الفعلية تُرسم فوق الإطار في العميل) */
  viewerLabel?: string
  now?: number
}

/** رابط تضمين موقّع صالح حتى `expires` (ثوانٍ Unix) */
export function signedEmbedUrl(creds: Pick<BunnyCredentials, 'libraryId' | 'tokenAuthKey'>, input: SignedEmbedInput): { url: string; expires: number } {
  if (!isBunnyVideoId(input.videoId)) throw new AppError('VALIDATION', { field: 'bunnyVideoId' })
  const now = input.now ?? Date.now()
  const expires = Math.floor(now / 1000) + Math.max(60, Math.floor(input.expiresInSeconds))
  const token = embedToken(creds.tokenAuthKey, input.videoId, expires)
  // Documented Stream embedding options: keep the iPhone player inline so the
  // enclosing page's watermark remains visible. These UI options are not DRM.
  // https://bunny.net/docs/stream/embedding.md
  const q = new URLSearchParams({
    token, expires: String(expires), autoplay: 'false',
    playsinline: 'true', disableIosPlayer: 'true', disableAirPlay: 'true', chromecast: 'false'
  })
  if (input.viewerLabel) q.set('v', input.viewerLabel.slice(0, 64))
  return { url: `${BUNNY_EMBED_BASE}/${encodeURIComponent(creds.libraryId)}/${input.videoId}?${q.toString()}`, expires }
}

/** هل انتهت صلاحية رابط موقّع؟ (للاختبار والواجهة) */
export function embedExpired(expires: number, now = Date.now()): boolean {
  return expires <= Math.floor(now / 1000)
}
