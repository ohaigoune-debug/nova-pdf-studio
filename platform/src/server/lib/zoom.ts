/**
 * Zoom Meeting SDK (الحصص المباشرة داخل المنصة) — 16 نوفمبر 2026.
 *
 * - اعتمادات تطبيق Meeting SDK (Client ID / Client Secret من Zoom Marketplace) تُحفظ مختومة
 *   (secret-box) في جدول الإعدادات تحت المفتاح `live.zoom`، ولا يعود السرّ إلى المتصفح أبدًا.
 * - التوقيع (SDK JWT) نقي بلا شبكة ولا قاعدة بيانات كي يُختبر وحدويًّا: HS256 بالسرّ،
 *   الحمولة { appKey, sdkKey, mn, role, iat, exp, tokenExp } كما في عيّنة Zoom الرسمية.
 * - الدور دائمًا 0 (مشارك): التلميذ لا يبدأ الحصة؛ الأستاذ يبدأها من تطبيق Zoom على حسابه.
 * - التطبيق غير المنشور في Marketplace يدخل اجتماعات الحساب نفسه فقط، وهذا ما نحتاجه: الحصص على حساب الأستاذ.
 */
import { createHmac } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'

export const ZOOM_SETTINGS_KEY = 'live.zoom'
const PURPOSE = 'zoom'

/** نسخة Zoom Meeting SDK للويب المحمَّلة من CDN الخاص بـ Zoom (source.zoom.us) — تُرفع هنا وحدها عند التحديث */
export const ZOOM_SDK_VERSION = '6.10.0'
export const ZOOM_CDN = 'https://source.zoom.us'

/** لغة واجهة Zoom داخل الحصة (لا عربية في ملفات لغة Zoom؛ الفرنسية أقرب للتلميذ الجزائري) */
export const ZOOM_UI_LANG = 'fr-FR'

export interface ZoomSdkCredentials {
  /** Client ID لتطبيق Meeting SDK (يُسمّى أيضًا SDK Key) */
  sdkKey: string
  /** Client Secret (SDK Secret) — لا يغادر الخادم */
  sdkSecret: string
}

export interface ZoomSdkView {
  sdkKeyHint: string
  secretHint: string
  updatedAt: string
  /** false: حُفظ بسرّ جلسة قديم ولم يعد يُفتح — يجب إدخاله من جديد */
  usable: boolean
}

interface Stored {
  sdkKeySealed: string
  sdkSecretSealed: string
  updatedAt: string
}

const KEY_RE = /^[A-Za-z0-9_-]{10,100}$/
const SECRET_RE = /^[A-Za-z0-9_-]{16,200}$/

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, ZOOM_SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<Stored> | undefined
  if (!v?.sdkKeySealed || !v.sdkSecretSealed) return null
  return { sdkKeySealed: v.sdkKeySealed, sdkSecretSealed: v.sdkSecretSealed, updatedAt: v.updatedAt ?? '' }
}

/** الاعتمادات مفتوحة للاستعمال في الخادم؛ null إن لم تُضبط أو تعذّر فتحها */
export async function getZoomSdkCredentials(db: Db): Promise<ZoomSdkCredentials | null> {
  const s = await readStored(db)
  if (!s) return null
  const sdkKey = unseal(s.sdkKeySealed, PURPOSE)
  const sdkSecret = unseal(s.sdkSecretSealed, PURPOSE)
  if (!sdkKey || !sdkSecret) return null
  return { sdkKey, sdkSecret }
}

export async function getZoomSdkView(db: Db): Promise<ZoomSdkView | null> {
  const s = await readStored(db)
  if (!s) return null
  const sdkKey = unseal(s.sdkKeySealed, PURPOSE)
  const sdkSecret = unseal(s.sdkSecretSealed, PURPOSE)
  return {
    sdkKeyHint: sdkKey ? sdkKey.slice(-4) : '',
    secretHint: sdkSecret ? sdkSecret.slice(-4) : '',
    updatedAt: s.updatedAt,
    usable: !!sdkKey && !!sdkSecret
  }
}

export async function saveZoomSdkCredentials(db: Db, input: ZoomSdkCredentials): Promise<void> {
  const sdkKey = input.sdkKey.trim()
  const sdkSecret = input.sdkSecret.trim()
  if (!KEY_RE.test(sdkKey)) throw new AppError('VALIDATION', { field: 'sdkKey' })
  if (!SECRET_RE.test(sdkSecret)) throw new AppError('VALIDATION', { field: 'sdkSecret' })
  if (sdkKey === sdkSecret) throw new AppError('VALIDATION', { field: 'sdkSecret' })
  const value: Stored = { sdkKeySealed: seal(sdkKey, PURPOSE), sdkSecretSealed: seal(sdkSecret, PURPOSE), updatedAt: new Date().toISOString() }
  await db
    .insert(appSettings)
    .values({ key: ZOOM_SETTINGS_KEY, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

export async function clearZoomSdkCredentials(db: Db): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, ZOOM_SETTINGS_KEY))
}

/* ------------------------------ الاجتماع ------------------------------ */

/** رقم اجتماع Zoom: 9 إلى 11 رقمًا (تُقبل المسافات والشرطات كما تُنسخ من الدعوة) */
export function normalizeMeetingNumber(v: string | null | undefined): string | null {
  const digits = (v ?? '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660)).replace(/[\s-]/g, '')
  return /^\d{9,11}$/.test(digits) ? digits : null
}

/**
 * رمز الدخول الصريح (Passcode) كما يُكتب يدويًّا: حتى 10 خانات من الحروف والأرقام و@ - _ *.
 * قيمة pwd في روابط الدعوة مشفّرة وأطول، ولا يقبلها Meeting SDK للويب — لذلك تُطلب صراحة.
 */
export function isPlainPasscode(v: string | null | undefined): v is string {
  return !!v && /^[A-Za-z0-9@*_-]{1,10}$/.test(v)
}

/** يستخرج رقم الاجتماع ورمز pwd من رابط دعوة Zoom (https://us05web.zoom.us/j/123…?pwd=…) */
export function zoomMeetingFromUrl(url: string | null | undefined): { meetingNumber: string | null; pwd: string | null } {
  if (!url) return { meetingNumber: null, pwd: null }
  let u: URL
  try {
    u = new URL(url)
  } catch {
    return { meetingNumber: null, pwd: null }
  }
  const host = u.hostname.toLowerCase()
  if (!(host === 'zoom.us' || host.endsWith('.zoom.us') || host === 'zoom.com' || host.endsWith('.zoom.com'))) return { meetingNumber: null, pwd: null }
  const m = /\/(?:j|w|s|wc\/join|wc)\/(\d{9,11})(?:\/|$)/.exec(u.pathname)
  return { meetingNumber: m?.[1] ?? null, pwd: u.searchParams.get('pwd') }
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

/** مدة صلاحية التوقيع: Zoom يشترط نصف ساعة على الأقل و48 ساعة على الأكثر */
export const SIGNATURE_MIN_TTL_S = 30 * 60
export const SIGNATURE_MAX_TTL_S = 48 * 3600

/**
 * توقيع Meeting SDK (JWT HS256) لاجتماع واحد. role=0 مشارك.
 * iat يُرجَع 30 ثانية تحسّبًا لفرق الساعة بين الخادم وZoom (كما في عيّنة Zoom).
 */
export function meetingSdkSignature(creds: ZoomSdkCredentials, meetingNumber: string, opts: { nowMs?: number; ttlSeconds?: number; role?: 0 } = {}): string {
  const mn = normalizeMeetingNumber(meetingNumber)
  if (!mn) throw new AppError('VALIDATION', { field: 'meetingNumber' })
  const iat = Math.floor((opts.nowMs ?? Date.now()) / 1000) - 30
  const ttl = Math.min(SIGNATURE_MAX_TTL_S, Math.max(SIGNATURE_MIN_TTL_S, Math.floor(opts.ttlSeconds ?? 4 * 3600)))
  const exp = iat + ttl
  const header = { alg: 'HS256', typ: 'JWT' }
  const payload = { appKey: creds.sdkKey, sdkKey: creds.sdkKey, mn: Number(mn), role: opts.role ?? 0, iat, exp, tokenExp: exp }
  const signingInput = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`
  const sig = b64url(createHmac('sha256', creds.sdkSecret).update(signingInput).digest())
  return `${signingInput}.${sig}`
}

