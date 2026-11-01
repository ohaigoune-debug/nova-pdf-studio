/**
 * Guiddini ePay (بوابة SATIM: CIB والذهبية) — التوثيق: https://guiddini.dz/docs/api/initiate و /docs/api/check
 *  - POST {base}/api/payment/initiate  {amount, language} ⇒ data.id + data.attributes.form_url (صفحة SATIM)
 *  - GET  {base}/api/payment/check?order_number=… ⇒ data.attributes.status ('paid' = مدفوع)
 * المفتاحان x-app-key و x-app-secret يلصقهما المشرف في الإعدادات؛ السرّ مختوم ولا يعود إلى المتصفح أبدًا.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'

export const GUIDDINI_SETTINGS_KEY = 'payment.guiddini'
const PURPOSE = 'payment.guiddini'
export const GUIDDINI_DEFAULT_BASE = 'https://epay.guiddini.dz'

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
  return { baseUrl: s.baseUrl || GUIDDINI_DEFAULT_BASE, appKey: s.appKey, appSecret, enabled: s.enabled }
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
  return { baseUrl: s.baseUrl || GUIDDINI_DEFAULT_BASE, appKeyHint: s.appKey.slice(-4), secretHint: secret ? secret.slice(-4) : '', enabled: s.enabled, usable: Boolean(secret), updatedAt: s.updatedAt }
}

function cleanBase(raw: string): string {
  const base = (raw.trim() || GUIDDINI_DEFAULT_BASE).replace(/\/+$/, '')
  let u: URL
  try {
    u = new URL(base)
  } catch {
    throw new AppError('VALIDATION', { field: 'baseUrl' })
  }
  if (u.protocol !== 'https:') throw new AppError('VALIDATION', { field: 'baseUrl' })
  return u.origin
}

/** حفظ المفاتيح: السرّ الفارغ يُبقي السابق (لا يُطلب لصقه عند كل تعديل) */
export async function saveGuiddiniConfig(db: Db, input: { baseUrl: string; appKey: string; appSecret: string; enabled: boolean }): Promise<void> {
  const prev = await readStored(db)
  const appKey = input.appKey.trim()
  if (appKey.length < 8) throw new AppError('VALIDATION', { field: 'appKey' })
  const secret = input.appSecret.trim()
  const appSecretSealed = secret ? seal(secret, PURPOSE) : prev?.appSecretSealed
  if (!appSecretSealed) throw new AppError('VALIDATION', { field: 'appSecret' })
  const value: Stored = { baseUrl: cleanBase(input.baseUrl), appKey, appSecretSealed, enabled: input.enabled, updatedAt: new Date().toISOString() }
  await db.insert(appSettings).values({ key: GUIDDINI_SETTINGS_KEY, value }).onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } })
}

export async function clearGuiddiniConfig(db: Db): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, GUIDDINI_SETTINGS_KEY))
}

function headers(c: Pick<GuiddiniConfig, 'appKey' | 'appSecret'>): Record<string, string> {
  return { Accept: 'application/json', 'Content-Type': 'application/json', 'x-app-key': c.appKey, 'x-app-secret': c.appSecret }
}

async function call(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<{ status: number; json: Record<string, unknown> | null }> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new AppError('PAYMENT_GATEWAY_UNREACHABLE')
  }
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (res.status === 401 || res.status === 403) throw new AppError('PAYMENT_KEYS_INVALID')
  return { status: res.status, json }
}

type Attrs = Record<string, unknown>
const attrsOf = (j: Record<string, unknown> | null): { id: string | null; attrs: Attrs } => {
  const data = (j?.data ?? null) as { id?: unknown; attributes?: Attrs } | null
  return { id: typeof data?.id === 'string' ? data.id : null, attrs: data?.attributes ?? {} }
}

/** يبدأ معاملة ويعيد رابط صفحة SATIM ومعرّف المعاملة */
export async function guiddiniInitiate(c: GuiddiniConfig, amountDzd: number, fetchImpl: typeof fetch = fetch): Promise<{ ref: string; formUrl: string; raw: Record<string, unknown> | null }> {
  const r = await call(fetchImpl, `${c.baseUrl}/api/payment/initiate`, { method: 'POST', headers: headers(c), body: JSON.stringify({ amount: String(amountDzd), language: 'ar' }) })
  const { id, attrs } = attrsOf(r.json)
  const formUrl = typeof attrs.form_url === 'string' ? attrs.form_url : null
  if (r.status >= 400 || !id || !formUrl || !/^https:\/\//.test(formUrl)) throw new AppError('PAYMENT_GATEWAY_REJECTED')
  return { ref: id, formUrl, raw: r.json }
}

export interface GuiddiniCheck {
  /** paid | failed | processing | … كما تعيده البوابة (بأحرف صغيرة) */
  status: string
  amount: number | null
  found: boolean
  raw: Record<string, unknown> | null
}

/** يسأل البوابة (التي تسأل SATIM) عن حالة المعاملة الآن */
export async function guiddiniCheck(c: GuiddiniConfig, ref: string, fetchImpl: typeof fetch = fetch): Promise<GuiddiniCheck> {
  const r = await call(fetchImpl, `${c.baseUrl}/api/payment/check?order_number=${encodeURIComponent(ref)}`, { method: 'GET', headers: headers(c) })
  if (r.status === 404) return { status: 'not_found', amount: null, found: false, raw: r.json }
  if (r.status >= 400) throw new AppError('PAYMENT_GATEWAY_REJECTED')
  const { attrs } = attrsOf(r.json)
  const amount = Number(attrs.amount ?? attrs.deposit_amount)
  return { status: String(attrs.status ?? '').toLowerCase(), amount: Number.isFinite(amount) ? amount : null, found: true, raw: r.json }
}

/** اختبار المفاتيح بلا إنشاء معاملة: سؤال عن معاملة غير موجودة؛ 401/403 = مفاتيح خاطئة */
export async function guiddiniTest(c: Pick<GuiddiniConfig, 'baseUrl' | 'appKey' | 'appSecret'>, fetchImpl: typeof fetch = fetch): Promise<{ ok: true }> {
  await call(fetchImpl, `${c.baseUrl}/api/payment/check?order_number=MADRASA-TEST-0`, { method: 'GET', headers: headers(c) })
  return { ok: true }
}
