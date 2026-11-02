/**
 * الدفع الإلكتروني عبر eFawtara (بطاقة «CIB & Edahabia · Délégué»، بوابة SATIM) — التوثيق: https://docs.efawtara.com
 *  - POST {base}/api/payment-requests  {amount, language: 'AR', return_url} + Idempotency-Key
 *      ⇒ data.id (رقم الطلب) + data.attributes.form_url (صفحة SATIM)
 *  - GET  {base}/api/payment-requests/check?order_number=… ⇒ data.attributes.status ('paid' وحدها = اقتُطع المال)
 *      + confirmation_status (requires_verification ثم confirmed | failed) + deposit_amount + data.links.href (الإيصال)
 * الترويستان X-App-Key (APP-…) و X-App-Secret (SEC-…) يلصقهما المشرف في الإعدادات؛ السرّ مختوم ولا يعود إلى المتصفح أبدًا.
 *
 * كانت هذه الواجهة لـ Guiddini (مساراتها /api/payment/initiate و /api/payment/check)، وتبقى تلك المسارات
 * فقط إن كان المضيف guiddini.dz صراحةً. الإعدادات المحفوظة تُصحَّح دائمًا إلى epay.efawtara.com.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'

export const GUIDDINI_SETTINGS_KEY = 'payment.guiddini'
const PURPOSE = 'payment.guiddini'
/** عنوان واجهة eFawtara (لا عنوان لوحة التحكم app.efawtara.com) */
export const GUIDDINI_DEFAULT_BASE = 'https://epay.efawtara.com'
const EFAWTARA_API_HOST = 'epay.efawtara.com'
/** صفحة العودة من SATIM: تُرسَل مع كل طلب دفع، فلا تُضبط في لوحة eFawtara */
export const PAYMENT_RETURN_PATH = '/student/payments/return'

interface Stored {
  baseUrl: string
  appKey: string
  appSecretSealed: string
  enabled: boolean
  updatedAt: string
}

export interface GuiddiniConfig {
  baseUrl: string
  appKey: string
  appSecret: string
  enabled: boolean
}

export interface GuiddiniView {
  baseUrl: string
  appKeyHint: string
  secretHint: string
  enabled: boolean
  usable: boolean
  updatedAt: string
}

const isGuiddiniHost = (host: string) => host === 'guiddini.dz' || host.endsWith('.guiddini.dz')
const isEfawtaraHost = (host: string) => host === 'efawtara.com' || host.endsWith('.efawtara.com')

/**
 * يصحّح عنوان البوابة: أي مضيف guiddini.dz، وأي مضيف efawtara.com غير epay.efawtara.com
 * (مثل لوحة التحكم app.efawtara.com) ⇒ https://epay.efawtara.com. الفارغ ⇒ الافتراضي.
 * يعيد الأصل فقط (بلا مسار): المسارات تضيفها الدوال أدناه.
 */
export function normalizeGatewayBase(raw: string | null | undefined): string {
  const trimmed = (raw ?? '').trim().replace(/\/+$/, '')
  if (!trimmed) return GUIDDINI_DEFAULT_BASE
  let u: URL
  try {
    u = new URL(trimmed)
  } catch {
    throw new AppError('VALIDATION', { field: 'baseUrl' })
  }
  const host = u.hostname.toLowerCase()
  if (isGuiddiniHost(host) || (isEfawtaraHost(host) && host !== EFAWTARA_API_HOST)) return GUIDDINI_DEFAULT_BASE
  if (u.protocol !== 'https:') throw new AppError('VALIDATION', { field: 'baseUrl' })
  return u.origin
}

/** عند القراءة: عنوان محفوظ تالف لا يوقف الدفع، بل يعود إلى الافتراضي */
function baseOnRead(raw: string | undefined): string {
  try {
    return normalizeGatewayBase(raw)
  } catch {
    return GUIDDINI_DEFAULT_BASE
  }
}

/** رابط العودة: أصل APP_URL إن كان https، وإلا https://madrasadz.com — بلا استعلام (eFawtara يضيف order_number) */
export function paymentReturnUrl(appUrl: string | undefined = process.env.APP_URL): string {
  let origin = 'https://madrasadz.com'
  try {
    const u = new URL((appUrl ?? '').trim())
    if (u.protocol === 'https:') origin = u.origin
  } catch {
    /* الافتراضي */
  }
  return `${origin}${PAYMENT_RETURN_PATH}`
}

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY)).limit(1)
  const v = row?.value as Stored | undefined
  return v && typeof v.appKey === 'string' && typeof v.appSecretSealed === 'string' ? v : null
}

export async function getGuiddiniConfig(db: Db): Promise<GuiddiniConfig | null> {
  const s = await readStored(db)
  if (!s) return null
  const appSecret = unseal(s.appSecretSealed, PURPOSE)
  if (!appSecret) return null
  return { baseUrl: baseOnRead(s.baseUrl), appKey: s.appKey, appSecret, enabled: s.enabled }
}

/** الدفع الإلكتروني متاح للتلاميذ الآن؟ (مفاتيح صالحة + مفعَّل) */
export async function onlinePaymentEnabled(db: Db): Promise<boolean> {
  const c = await getGuiddiniConfig(db)
  return Boolean(c?.enabled)
}

export async function getGuiddiniView(db: Db): Promise<GuiddiniView | null> {
  const s = await readStored(db)
  if (!s) return null
  const secret = unseal(s.appSecretSealed, PURPOSE)
  return { baseUrl: baseOnRead(s.baseUrl), appKeyHint: s.appKey.slice(-4), secretHint: secret ? secret.slice(-4) : '', enabled: s.enabled, usable: Boolean(secret), updatedAt: s.updatedAt }
}

/** حفظ المفاتيح: السرّ الفارغ يُبقي السابق (لا يُطلب لصقه عند كل تعديل). يعيد العنوان كما حُفظ بعد التصحيح. */
export async function saveGuiddiniConfig(db: Db, input: { baseUrl: string; appKey: string; appSecret: string; enabled: boolean }): Promise<{ baseUrl: string }> {
  const prev = await readStored(db)
  const appKey = input.appKey.trim()
  if (appKey.length < 8) throw new AppError('VALIDATION', { field: 'appKey' })
  const secret = input.appSecret.trim()
  const appSecretSealed = secret ? seal(secret, PURPOSE) : prev?.appSecretSealed
  if (!appSecretSealed) throw new AppError('VALIDATION', { field: 'appSecret' })
  const value: Stored = { baseUrl: normalizeGatewayBase(input.baseUrl), appKey, appSecretSealed, enabled: input.enabled, updatedAt: new Date().toISOString() }
  await db.insert(appSettings).values({ key: GUIDDINI_SETTINGS_KEY, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
  return { baseUrl: value.baseUrl }
}

export async function clearGuiddiniConfig(db: Db): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY))
}

/** مسارات الواجهة: eFawtara دائمًا، إلا إن كان المضيف guiddini.dz صراحةً (الواجهة القديمة) */
function endpoints(baseUrl: string): { legacy: boolean; create: string; check: (ref: string) => string } {
  const origin = baseUrl.replace(/\/+$/, '')
  let legacy = false
  try {
    legacy = isGuiddiniHost(new URL(origin).hostname.toLowerCase())
  } catch {
    /* ليس رابطًا: يفشل الاتصال لاحقًا */
  }
  if (legacy) return { legacy, create: `${origin}/api/payment/initiate`, check: (ref) => `${origin}/api/payment/check?order_number=${encodeURIComponent(ref)}` }
  return { legacy, create: `${origin}/api/payment-requests`, check: (ref) => `${origin}/api/payment-requests/check?order_number=${encodeURIComponent(ref)}` }
}

function headers(c: Pick<GuiddiniConfig, 'appKey' | 'appSecret'>, extra: Record<string, string> = {}): Record<string, string> {
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-App-Key': c.appKey, 'X-App-Secret': c.appSecret, ...extra }
}

/** سبب رفض البوابة كما أعادته ({errors:[{status, code, title, detail, meta}]})، مقصوصًا ليبقى السجلّ خفيفًا */
export interface GatewayRejection {
  httpStatus: number | null
  code: string | null
  title: string | null
  detail: string | null
  meta: unknown
}

const clip = (v: unknown, n: number): string | null => (typeof v === 'string' && v ? v.slice(0, n) : typeof v === 'number' ? String(v) : null)

function clipMeta(meta: unknown): unknown {
  if (meta === undefined || meta === null) return null
  try {
    const s = JSON.stringify(meta)
    if (s.length <= 2000) return meta
    return { truncated: s.slice(0, 2000) }
  } catch {
    return null
  }
}

export function rejectionOf(httpStatus: number | null, json: Record<string, unknown> | null): GatewayRejection {
  const errs = json?.errors
  // 429 يأتي بكائن errors لا قائمة
  const first = (Array.isArray(errs) ? errs[0] : errs && typeof errs === 'object' ? errs : null) as Record<string, unknown> | null
  const meta = json?.meta as Record<string, unknown> | undefined
  return {
    httpStatus,
    code: clip(first?.code, 80) ?? clip(meta?.code, 80),
    title: clip(first?.title, 200),
    detail: clip(first?.detail, 500) ?? clip(meta?.message, 500),
    meta: clipMeta(first?.meta)
  }
}

async function call(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<{ status: number; json: Record<string, unknown> | null }> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch (err) {
    throw new AppError('PAYMENT_GATEWAY_UNREACHABLE', { httpStatus: null, code: 'NETWORK', title: 'تعذّر الاتصال بالبوابة', detail: clip(err instanceof Error ? err.message : String(err), 300), meta: null })
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  // 401 وحده يعني مفاتيح خاطئة. 403 (ACCESS_DENIED) رفض من SATIM لحساب التاجر، لا خطأ في المفاتيح.
  if (res.status === 401) throw new AppError('PAYMENT_KEYS_INVALID', { ...rejectionOf(res.status, json) })
  return { status: res.status, json }
}

type Attrs = Record<string, unknown>
const dataOf = (j: Record<string, unknown> | null): { id: string | null; attrs: Attrs; links: Record<string, unknown> } => {
  const data = (j?.data ?? null) as { id?: unknown; attributes?: Attrs; links?: Record<string, unknown> } | null
  const id = typeof data?.id === 'string' ? data.id : typeof data?.id === 'number' ? String(data.id) : null
  return { id, attrs: data?.attributes ?? {}, links: data?.links ?? {} }
}

/** مفتاح منع التكرار: الطلب نفسه في اليوم نفسه يعيد المعاملة نفسها عند eFawtara (64 حرفًا كحد أقصى) */
export const idempotencyKeyFor = (orderId: string) => `madrasa-${orderId}`.slice(0, 64)

/** يبدأ معاملة ويعيد رابط صفحة SATIM ورقم الطلب عند البوابة. الرفض يحمل سببه في details. */
export async function guiddiniInitiate(
  c: GuiddiniConfig,
  input: { amountDzd: number; orderId: string; returnUrl?: string },
  fetchImpl: typeof fetch = fetch
): Promise<{ ref: string; formUrl: string; raw: Record<string, unknown> | null }> {
  const ep = endpoints(c.baseUrl)
  const init: RequestInit = ep.legacy
    ? { method: 'POST', headers: headers(c), body: JSON.stringify({ amount: String(input.amountDzd), language: 'ar' }) }
    : {
        method: 'POST',
        headers: headers(c, { 'Idempotency-Key': idempotencyKeyFor(input.orderId) }),
        body: JSON.stringify({ amount: input.amountDzd, language: 'AR', return_url: input.returnUrl ?? paymentReturnUrl() })
      }
  const r = await call(fetchImpl, ep.create, init)
  const { id, attrs } = dataOf(r.json)
  const formUrl = typeof attrs.form_url === 'string' ? attrs.form_url : null
  if (r.status >= 400) throw new AppError('PAYMENT_GATEWAY_REJECTED', { ...rejectionOf(r.status, r.json) })
  if (!id || !formUrl || !/^https:\/\//.test(formUrl)) {
    throw new AppError('PAYMENT_GATEWAY_REJECTED', { ...rejectionOf(r.status, r.json), code: 'MISSING_FORM_URL', title: 'ردّ البوابة بلا رقم طلب أو بلا رابط صفحة الدفع' })
  }
  return { ref: id, formUrl, raw: r.json }
}

export interface GuiddiniCheck {
  /** paid | no_payment_attempted | user_cancelled | … كما تعيده البوابة (بأحرف صغيرة) */
  status: string
  /** requires_verification | confirmed | failed (eFawtara) — فارغ في الواجهة القديمة */
  confirmationStatus: string
  /** المبلغ المقتطع (deposit_amount) إن وُجد، وإلا المبلغ المطلوب */
  amount: number | null
  /** رابط الإيصال الموقَّع (عند paid فقط) */
  receiptUrl: string | null
  found: boolean
  raw: Record<string, unknown> | null
}

const toNumber = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** يسأل البوابة (التي تسأل SATIM) عن حالة المعاملة الآن */
export async function guiddiniCheck(c: GuiddiniConfig, ref: string, fetchImpl: typeof fetch = fetch): Promise<GuiddiniCheck> {
  const r = await call(fetchImpl, endpoints(c.baseUrl).check(ref), { method: 'GET', headers: headers(c) })
  if (r.status === 404) return { status: 'not_found', confirmationStatus: '', amount: null, receiptUrl: null, found: false, raw: r.json }
  if (r.status >= 400) throw new AppError('PAYMENT_GATEWAY_REJECTED', { ...rejectionOf(r.status, r.json) })
  const { attrs, links } = dataOf(r.json)
  const receipt = typeof links.href === 'string' && /^https:\/\//.test(links.href) ? links.href : null
  return {
    status: String(attrs.status ?? '').toLowerCase(),
    confirmationStatus: String(attrs.confirmation_status ?? '').toLowerCase(),
    amount: toNumber(attrs.deposit_amount) ?? toNumber(attrs.amount),
    receiptUrl: receipt,
    found: true,
    raw: r.json
  }
}

/** اختبار المفاتيح بلا إنشاء معاملة: سؤال عن رقم طلب غير موجود؛ 401 وحده = مفاتيح خاطئة (404/422 = المفاتيح مقبولة) */
export async function guiddiniTest(c: Pick<GuiddiniConfig, 'baseUrl' | 'appKey' | 'appSecret'>, fetchImpl: typeof fetch = fetch): Promise<{ ok: true }> {
  const r = await call(fetchImpl, endpoints(c.baseUrl).check('MADRASATEST0'), { method: 'GET', headers: headers(c) })
  if (r.status >= 500 || r.status === 403) throw new AppError('PAYMENT_GATEWAY_REJECTED', { ...rejectionOf(r.status, r.json) })
  return { ok: true }
}
