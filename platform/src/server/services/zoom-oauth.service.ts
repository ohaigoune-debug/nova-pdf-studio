/**
 * «ربط Zoom» (المرحلة الثانية، 22 نوفمبر 2026): المشرف يربط حسابه في Zoom مرة واحدة (OAuth على مستوى المستخدم،
 * بنفس تطبيق General App ومفتاحيه ZOOM_SDK_CLIENT_ID/SECRET)، فتأخذ المنصة عند كل بدء حصة مفتاح المضيف (ZAK)
 * ويبدأ الحصة كمضيف من المتصفح دون تطبيق Zoom.
 *
 * - الصلاحية الوحيدة المطلوبة: user:read:zak ‏(GET https://api.zoom.us/v2/users/me/zak).
 * - رمز الوصول ورمز التجديد مختومان (secret-box) في الإعدادات؛ لا يظهران في أي عرض ولا سجلّ.
 * - Zoom يبدّل رمز التجديد عند كل تجديد: التجديد تحت قفل صفّ الإعداد كي لا يُبطل طلبان متزامنان أحدهما الآخر.
 * - رابط العودة: ‎https://madrasadz.com/api/v1/zoom/callback‎ (يُضاف في Redirect URL وقائمة Allow List للتطبيق).
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import type { Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'
import { zoomSdkKeys, type ZoomSdkKeys } from '@/server/lib/zoom-sdk'

export const ZOOM_OAUTH_KEY = 'live.zoom.oauth'
export const ZOOM_CALLBACK_PATH = '/api/v1/zoom/callback'
export const ZOOM_STATE_COOKIE = 'zoom_oauth_state'
const PURPOSE = 'zoom-oauth'
const TOKEN_URL = 'https://zoom.us/oauth/token'
const ZAK_URL = 'https://api.zoom.us/v2/users/me/zak'
/** نجدّد قبل انتهاء رمز الوصول بدقيقتين */
const REFRESH_MARGIN_MS = 2 * 60_000

interface Stored {
  accessSealed: string
  refreshSealed: string
  expiresAt: string
  scope: string
  connectedAt: string
  connectedBy: string
  lastError?: string | null
}

interface TokenResponse {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  scope?: string
  reason?: string
  error?: string
}

export interface ZoomOAuthStatus {
  /** مفتاحا التطبيق في بيئة الخادم */
  configured: boolean
  connected: boolean
  connectedAt: string | null
  /** محفوظ لكن لا يُفتح (تغيّر سرّ الخادم) أو رفضه Zoom آخر مرة: يُعاد الربط */
  needsReconnect: boolean
  /** الربط يشمل صلاحية إنشاء الاجتماعات (meeting:write:meeting) */
  canCreateMeetings: boolean
  redirectUri: string
}

/** رابط العودة: أصل APP_URL إن كان https، وإلا https://madrasadz.com */
export function zoomRedirectUri(appUrl: string | undefined = process.env.APP_URL): string {
  let origin = 'https://madrasadz.com'
  try {
    const u = new URL((appUrl ?? '').trim())
    if (u.protocol === 'https:') origin = u.origin
  } catch {
    /* الافتراضي */
  }
  return `${origin}${ZOOM_CALLBACK_PATH}`
}

export function zoomAuthorizeUrl(keys: ZoomSdkKeys, state: string, redirectUri: string = zoomRedirectUri()): string {
  const u = new URL('https://zoom.us/oauth/authorize')
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('client_id', keys.clientId)
  u.searchParams.set('redirect_uri', redirectUri)
  u.searchParams.set('state', state)
  return u.toString()
}

function requireKeys(): ZoomSdkKeys {
  const keys = zoomSdkKeys()
  if (!keys) throw new AppError('LIVE_EMBED_UNAVAILABLE')
  return keys
}

function assertAdmin(actor: Actor) {
  if (actor.role !== 'SUPER_ADMIN') throw new AppError('FORBIDDEN')
}

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, ZOOM_OAUTH_KEY)).limit(1)
  return (row?.value as Stored | undefined) ?? null
}

async function writeStored(db: Db, value: Stored): Promise<void> {
  await db
    .insert(appSettings)
    .values({ key: ZOOM_OAUTH_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

/** صلاحيات إنشاء اجتماعات Zoom من المنصة وتعديلها وحذفها (تُضاف في تطبيق Zoom ثم يُعاد الربط) */
export const ZOOM_MEETING_SCOPES = ['meeting:write:meeting', 'meeting:update:meeting', 'meeting:delete:meeting'] as const

function hasScope(scope: string | undefined, wanted: string): boolean {
  return (scope ?? '').split(/[\s,]+/).includes(wanted)
}

export async function zoomOAuthStatus(db: Db): Promise<ZoomOAuthStatus> {
  const s = await readStored(db)
  const unusable = Boolean(s && (unseal(s.refreshSealed, PURPOSE) === null || s.lastError))
  const connected = Boolean(s) && !unusable
  return {
    configured: zoomSdkKeys() !== null,
    connected,
    connectedAt: s?.connectedAt ?? null,
    needsReconnect: Boolean(s) && unusable,
    canCreateMeetings: connected && hasScope(s?.scope, 'meeting:write:meeting'),
    redirectUri: zoomRedirectUri()
  }
}

async function tokenRequest(keys: ZoomSdkKeys, params: Record<string, string>, fetchImpl: typeof fetch): Promise<Required<Pick<TokenResponse, 'access_token' | 'refresh_token' | 'expires_in'>> & { scope: string }> {
  let res: Response
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams(params).toString(),
      signal: AbortSignal.timeout(20_000)
    })
  } catch {
    throw new AppError('ZOOM_UNREACHABLE')
  }
  let body: TokenResponse = {}
  try {
    body = (await res.json()) as TokenResponse
  } catch {
    /* ردّ غير JSON */
  }
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new AppError('ZOOM_AUTH_FAILED', { status: res.status, reason: String(body.reason ?? body.error ?? '').slice(0, 120) })
  }
  return { access_token: body.access_token, refresh_token: body.refresh_token, expires_in: Number(body.expires_in) || 3600, scope: String(body.scope ?? '') }
}

/** تبادل رمز العودة من Zoom برمزَي الوصول والتجديد، وحفظهما مختومين */
export async function connectZoomWithCode(db: Db, actor: Actor, code: string, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<void> {
  assertAdmin(actor)
  const keys = requireKeys()
  const clean = code.trim()
  if (!clean || clean.length > 512) throw new AppError('VALIDATION', { field: 'code' })
  const now = opts.now ?? new Date()
  const t = await tokenRequest(keys, { grant_type: 'authorization_code', code: clean, redirect_uri: zoomRedirectUri() }, opts.fetchImpl ?? fetch)
  await writeStored(db, {
    accessSealed: seal(t.access_token, PURPOSE),
    refreshSealed: seal(t.refresh_token, PURPOSE),
    expiresAt: new Date(now.getTime() + t.expires_in * 1000).toISOString(),
    scope: t.scope,
    connectedAt: now.toISOString(),
    connectedBy: actor.userId,
    lastError: null
  })
  await writeAudit(db, { actorUserId: actor.userId, action: 'zoom.connect', entityType: 'setting', newValue: { key: ZOOM_OAUTH_KEY, scope: t.scope } })
}

/** فصل الحساب: حذف الرمزين من المنصة، وإلغاؤهما عند Zoom (أفضل جهد) */
export async function disconnectZoom(db: Db, actor: Actor, fetchImpl: typeof fetch = fetch): Promise<void> {
  assertAdmin(actor)
  const s = await readStored(db)
  await db.delete(appSettings).where(eq(appSettings.key, ZOOM_OAUTH_KEY))
  await writeAudit(db, { actorUserId: actor.userId, action: 'zoom.disconnect', entityType: 'setting', newValue: { key: ZOOM_OAUTH_KEY } })
  const keys = zoomSdkKeys()
  const token = s ? unseal(s.refreshSealed, PURPOSE) : null
  if (!keys || !token) return
  try {
    await fetchImpl(`https://zoom.us/oauth/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${keys.clientId}:${keys.clientSecret}`).toString('base64')}` },
      signal: AbortSignal.timeout(10_000)
    })
  } catch {
    /* الحذف من المنصة يكفي */
  }
}

/**
 * رمز وصول صالح: المحفوظ إن بقي له أكثر من دقيقتين، وإلا تجديد (Zoom يعطي رمز تجديد جديدًا يُحفظ مكان القديم).
 * force: تجديد ولو بدا الرمز صالحًا (بعد رفض Zoom له).
 */
async function accessToken(db: Db, keys: ZoomSdkKeys, fetchImpl: typeof fetch, now: Date, force = false): Promise<string> {
  const r = await db.transaction(async (tx): Promise<{ token: string } | { failed: unknown; stored: Stored }> => {
    const [row] = await tx.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, ZOOM_OAUTH_KEY)).for('update').limit(1)
    const s = (row?.value as Stored | undefined) ?? null
    if (!s) throw new AppError('ZOOM_NOT_CONNECTED')
    const access = unseal(s.accessSealed, PURPOSE)
    if (!force && access && new Date(s.expiresAt).getTime() - now.getTime() > REFRESH_MARGIN_MS) return { token: access }
    const refresh = unseal(s.refreshSealed, PURPOSE)
    if (!refresh) return { failed: new AppError('ZOOM_AUTH_FAILED', { reason: 'sealed token unreadable' }), stored: s }
    let t
    try {
      t = await tokenRequest(keys, { grant_type: 'refresh_token', refresh_token: refresh }, fetchImpl)
    } catch (e) {
      return { failed: e, stored: s }
    }
    const next: Stored = { ...s, accessSealed: seal(t.access_token, PURPOSE), refreshSealed: seal(t.refresh_token, PURPOSE), expiresAt: new Date(now.getTime() + t.expires_in * 1000).toISOString(), scope: t.scope || s.scope, lastError: null }
    await tx.update(appSettings).set({ value: next, updatedAt: new Date() }).where(eq(appSettings.key, ZOOM_OAUTH_KEY))
    return { token: t.access_token }
  })
  if ('token' in r) return r.token
  // انقطاع الاتصال بـ Zoom ليس رفضًا: لا نطلب إعادة الربط
  if (r.failed instanceof AppError && r.failed.code === 'ZOOM_UNREACHABLE') throw r.failed
  // رمز التجديد مرفوض (فُصل التطبيق من Zoom، أو مرّت 90 يومًا): نعلّم الربط ليظهر «أعد الربط» (خارج المعاملة كي لا يُلغى)
  const reason = r.failed instanceof AppError ? String(r.failed.details?.reason || 'refresh rejected') : 'refresh failed'
  await db
    .update(appSettings)
    .set({ value: { ...r.stored, lastError: reason }, updatedAt: new Date() })
    .where(eq(appSettings.key, ZOOM_OAUTH_KEY))
  throw r.failed instanceof AppError ? r.failed : new AppError('ZOOM_AUTH_FAILED', { reason })
}

async function fetchZak(token: string, fetchImpl: typeof fetch): Promise<{ ok: true; zak: string } | { ok: false; status: number }> {
  let res: Response
  try {
    res = await fetchImpl(ZAK_URL, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new AppError('ZOOM_UNREACHABLE')
  }
  if (!res.ok) return { ok: false, status: res.status }
  const body = (await res.json().catch(() => ({}))) as { token?: string }
  return body.token ? { ok: true, zak: body.token } : { ok: false, status: 502 }
}

/** مفتاح المضيف (ZAK) لحساب Zoom المربوط، يُطلب لحظة بدء الحصة (صلاحيته دقائق) */
export async function zoomHostZak(db: Db, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<string> {
  const keys = requireKeys()
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? new Date()
  let r = await fetchZak(await accessToken(db, keys, fetchImpl, now), fetchImpl)
  // رمز الوصول أُلغي قبل موعده ⇒ تجديد مرة واحدة ثم إعادة المحاولة
  if (!r.ok && r.status === 401) r = await fetchZak(await accessToken(db, keys, fetchImpl, now, true), fetchImpl)
  if (!r.ok) throw new AppError('ZOOM_AUTH_FAILED', { status: r.status, reason: 'zak' })
  return r.zak
}

/* ───────────── اجتماعات Zoom من المنصة (إنشاء، تعديل، حذف) ───────────── */

const API = 'https://api.zoom.us/v2'

interface ApiResult<T> {
  status: number
  body: T | null
}

async function apiCall<T>(token: string, method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, fetchImpl: typeof fetch): Promise<ApiResult<T>> {
  let res: Response
  try {
    res = await fetchImpl(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000)
    })
  } catch {
    throw new AppError('ZOOM_UNREACHABLE')
  }
  const text = await res.text().catch(() => '')
  let parsed: T | null = null
  try {
    parsed = text ? (JSON.parse(text) as T) : null
  } catch {
    parsed = null
  }
  return { status: res.status, body: parsed }
}

/** طلب إلى واجهة Zoom بحساب المشرف المربوط: تجديد الرمز عند الحاجة، وإعادة مرة واحدة بعد 401 */
async function zoomApi<T>(db: Db, method: 'POST' | 'PATCH' | 'DELETE', path: string, body: unknown, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<ApiResult<T>> {
  const keys = requireKeys()
  const fetchImpl = opts.fetchImpl ?? fetch
  const now = opts.now ?? new Date()
  let r = await apiCall<T>(await accessToken(db, keys, fetchImpl, now), method, path, body, fetchImpl)
  if (r.status === 401) r = await apiCall<T>(await accessToken(db, keys, fetchImpl, now, true), method, path, body, fetchImpl)
  const err = r.body as { code?: number; message?: string } | null
  // رمز بلا الصلاحية المطلوبة (لم تُضف في التطبيق أو لم يُعَد الربط بعد إضافتها)
  if ((r.status === 400 || r.status === 401 || r.status === 403) && (err?.code === 4711 || err?.code === 4700 || /scope/i.test(err?.message ?? ''))) throw new AppError('ZOOM_SCOPE_MISSING')
  return r
}

export interface ZoomMeetingInput {
  topic: string
  startsAt: Date
  durationMinutes: number
}

/** إعدادات اجتماعات الحصص: التلميذ يدخل بلا كاميرا وبميكروفون مكتوم، ولا يدخل قبل الأستاذ */
function meetingBody(input: ZoomMeetingInput) {
  return {
    topic: input.topic.slice(0, 200),
    type: 2,
    start_time: input.startsAt.toISOString().replace(/\.\d{3}Z$/, 'Z'),
    duration: Math.max(10, Math.min(600, Math.floor(input.durationMinutes))),
    timezone: 'Africa/Algiers',
    settings: { host_video: true, participant_video: false, join_before_host: false, mute_upon_entry: true, waiting_room: false, approval_type: 2 }
  }
}

/** إنشاء اجتماع Zoom في الحساب المربوط: الرابط ورقم الاجتماع ورمزه */
export async function createZoomMeeting(db: Db, input: ZoomMeetingInput, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<{ meetingId: string; joinUrl: string; passcode: string }> {
  const r = await zoomApi<{ id?: number | string; join_url?: string; password?: string; message?: string }>(db, 'POST', '/users/me/meetings', meetingBody(input), opts)
  if (r.status !== 201 && r.status !== 200) throw new AppError('ZOOM_MEETING_FAILED', { status: r.status, reason: String(r.body?.message ?? '').slice(0, 120) })
  const id = r.body?.id !== undefined ? String(r.body.id) : ''
  if (!/^\d{9,12}$/.test(id) || !r.body?.join_url) throw new AppError('ZOOM_MEETING_FAILED', { status: r.status, reason: 'bad response' })
  return { meetingId: id, joinUrl: r.body.join_url, passcode: String(r.body.password ?? '') }
}

/** تحديث عنوان الاجتماع وموعده ومدته في Zoom */
export async function updateZoomMeeting(db: Db, meetingId: string, input: ZoomMeetingInput, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<void> {
  const { settings: _s, ...body } = meetingBody(input)
  void _s
  const r = await zoomApi(db, 'PATCH', `/meetings/${encodeURIComponent(meetingId)}`, body, opts)
  if (r.status !== 204 && r.status !== 200) throw new AppError('ZOOM_MEETING_FAILED', { status: r.status, reason: 'update' })
}

/** حذف الاجتماع من Zoom (غير موجود أصلًا = تمّ) */
export async function deleteZoomMeeting(db: Db, meetingId: string, opts: { fetchImpl?: typeof fetch; now?: Date } = {}): Promise<void> {
  const r = await zoomApi(db, 'DELETE', `/meetings/${encodeURIComponent(meetingId)}`, null, opts)
  if (r.status !== 204 && r.status !== 200 && r.status !== 404) throw new AppError('ZOOM_MEETING_FAILED', { status: r.status, reason: 'delete' })
}

