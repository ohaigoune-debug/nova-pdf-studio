/**
 * إرسال الرسائل القصيرة عبر واجهة مجرّدة (على غرار mailer.ts). الاختيار من البيئة:
 *   SMS_PROVIDER=console (افتراضي: يطبع في السجل) | webhook (POST JSON إلى SMS_WEBHOOK_URL) | suivisms (بوابة جزائرية)
 * مفتاح SuiviSMS يأتي من SUIVISMS_API_KEY في البيئة، أو من إعداد `sms.credentials` المحفوظ مشفّراً من لوحة الإدارة
 * (يتقدّم على البيئة). لا يُسجَّل المفتاح كاملاً أبداً ولا يصل إلى المتصفح.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { seal, unseal } from './secret-box'

export interface SmsMessage {
  to: string
  /** النص الحرّ (console/webhook، وsandbox SuiviSMS) */
  text: string
  /** متغيّرات القالب المعتمد لدى SuiviSMS (مثل {name, code}) — الإرسال الحيّ لا يقبل نصاً حرّاً */
  variables?: Record<string, string>
}

export class SmsError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code: string | null = null
  ) {
    super(message)
    this.name = 'SmsError'
  }
}

export interface SmsSender {
  readonly name: string
  send(m: SmsMessage): Promise<void>
  /** تحدّي OTP تولّده البوابة (SuiviSMS): يعمل من يوم إنشاء المفتاح بلا قالب معتمد */
  sendOtp?(to: string, idempotencyKey: string): Promise<{ id: string }>
  verifyOtp?(challengeId: string, code: string): Promise<{ ok: boolean; status: string }>
}

/**
 * SuiviSMS (suivisms.com) — بوابة جزائرية تغطّي Mobilis/Djezzy/Ooredoo، 10 دج للرسالة (إرسال OTP وإعادته محسوبان؛ التحقق مجاني).
 * من توثيق الحساب (نُقل من NOVA COMMERCE packages/core/src/sms/suivisms.ts):
 * - الأساس https://suivisms.com، كل المسارات تحت /v1/؛ مفاتيح الاختبار (sv_test_…) تستعمل /v1/sandbox/….
 * - Authorization: Bearer <key>. النطاقات messages:send, otp:send, otp:verify تُختار عند إنشاء المفتاح.
 * - POST /v1/messages: { to, template_id, variables } — لا نصّ حرّ ولا حقل مرسِل. القالب معاملاتي معتمد (1–5 متغيّرات ≤ 40 حرفاً).
 *   Sandbox: template_id "tpl_test_transactional" والحقل اسمه "fields".
 * - POST /v1/otp/challenges: { to } → تحدّي (كود 4 أرقام، 3 محاولات)؛ التحقق POST /v1/otp/challenges/{id}/verify { code }.
 * - ترويسة Idempotency-Key إلزامية في POST (8–128 حرفاً ^[A-Za-z0-9][A-Za-z0-9._:-]+$).
 * - الأرقام بالصيغة الدولية فقط "+213…".
 */
export const SUIVISMS = {
  baseUrl: 'https://suivisms.com',
  sandboxPrefix: '/v1/sandbox',
  messagesPath: '/v1/messages',
  otpPath: '/v1/otp/challenges',
  otpVerifyPath: (id: string) => `/v1/otp/challenges/${encodeURIComponent(id)}/verify`,
  sandboxTemplateId: 'tpl_test_transactional',
  idempotencyPattern: /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/,
  timeoutMs: 15_000
} as const

export const SMS_SETTINGS_KEY = 'sms.credentials'
const SEAL_PURPOSE = 'sms'

export const SMS_PROVIDERS = ['console', 'webhook', 'suivisms'] as const
export type SmsProviderName = (typeof SMS_PROVIDERS)[number]

/** 05xxxxxxxx / 213… → +213… كما تطلبه البوابة */
export function toInternational(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.startsWith('213')) return `+${d}`
  if (d.length === 10 && d.startsWith('0')) return `+213${d.slice(1)}`
  if (d.length === 9) return `+213${d}`
  return `+${d}`
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : null)

const consoleSender: SmsSender = {
  name: 'console',
  async send(m) {
    if (process.env.NODE_ENV !== 'test') console.log(`[sms] to=${m.to}\n${m.text}`)
  }
}

function webhookSender(url: string, secret?: string): SmsSender {
  return {
    name: 'webhook',
    async send(m) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(secret ? { 'x-sms-secret': secret } : {}) },
        body: JSON.stringify(m),
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) throw new Error(`sms HTTP ${res.status}`)
    }
  }
}

export interface SuivismsOptions {
  baseUrl?: string | null
  /** معرّف القالب المعتمد (متغيّراته name وcode)؛ بدونه: تحدّي OTP البوابة ولا رسائل حرّة حيّة */
  templateId?: string | null
  sandbox?: boolean
  fetchImpl?: typeof fetch
}

export function suivismsSender(apiKey: string, opts: SuivismsOptions = {}): SmsSender & { readonly templateId: string | null; readonly sandbox: boolean } {
  const sandbox = opts.sandbox ?? apiKey.startsWith('sv_test_')
  const base = (opts.baseUrl || process.env.SUIVISMS_BASE_URL || SUIVISMS.baseUrl).replace(/\/+$/, '')
  const templateId = opts.templateId?.trim() || null
  const fetchImpl = opts.fetchImpl ?? fetch
  const path = (live: string) => (sandbox ? live.replace(/^\/v1/, SUIVISMS.sandboxPrefix) : live)
  const headers = (idempotencyKey?: string) => {
    const h: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${apiKey}` }
    if (idempotencyKey) {
      if (!SUIVISMS.idempotencyPattern.test(idempotencyKey)) throw new SmsError(`Idempotency key "${idempotencyKey}" does not match the gateway's pattern`)
      h['idempotency-key'] = idempotencyKey
    }
    return h
  }
  async function call(url: string, init: RequestInit): Promise<Record<string, unknown>> {
    let res: Response
    try {
      res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(SUIVISMS.timeoutMs) })
    } catch (e) {
      throw new SmsError(`SuiviSMS unreachable: ${(e as Error).message}`, 502)
    }
    const text = await res.text()
    let json: Record<string, unknown> | null = null
    try {
      json = text ? (JSON.parse(text) as Record<string, unknown>) : null
    } catch {
      json = null
    }
    if (!res.ok) {
      const err = (json?.error ?? {}) as { code?: string; message?: string }
      throw new SmsError(`SuiviSMS ${res.status} ${err.code ?? ''}: ${err.message ?? err.code ?? text.slice(0, 200) ?? res.statusText}`.replace(/\s+:/, ':'), res.status, err.code ?? null)
    }
    return json ?? {}
  }
  const idem = (prefix: string) => `${prefix}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`
  return {
    name: 'suivisms',
    templateId,
    sandbox,
    async send(m) {
      if (!templateId && !sandbox) throw new SmsError('SuiviSMS live sends need an approved template_id (free-form text is not accepted)', 500, 'template_required')
      const variables = m.variables ?? { name: 'مدرسة', code: m.text.slice(0, 40) }
      const body = sandbox ? { to: toInternational(m.to), template_id: SUIVISMS.sandboxTemplateId, fields: variables } : { to: toInternational(m.to), template_id: templateId, variables }
      await call(`${base}${path(SUIVISMS.messagesPath)}`, { method: 'POST', headers: headers(idem('msg')), body: JSON.stringify(body) })
    },
    async sendOtp(to, idempotencyKey) {
      const json = await call(`${base}${path(SUIVISMS.otpPath)}`, { method: 'POST', headers: headers(idempotencyKey), body: JSON.stringify({ to: toInternational(to) }) })
      const id = str(json.id)
      if (!id) throw new SmsError('SuiviSMS answered without an OTP id', 502)
      return { id }
    },
    async verifyOtp(challengeId, code) {
      try {
        const json = await call(`${base}${path(SUIVISMS.otpVerifyPath(challengeId))}`, { method: 'POST', headers: headers(), body: JSON.stringify({ code }) })
        const status = str(json.status) ?? 'failed'
        return { ok: status === 'verified', status }
      } catch (e) {
        // الكود الخاطئ يعود خطأ 4xx لدى بعض البوابات: «غير متحقَّق»، أما 5xx فيبقى صاخباً
        if (e instanceof SmsError && e.status >= 400 && e.status < 500 && e.status !== 401 && e.status !== 403) {
          const c = e.code ?? ''
          return { ok: false, status: /expired/.test(c) ? 'expired' : /attempt|locked|too_many/.test(c) ? 'failed' : 'wrong' }
        }
        throw e
      }
    }
  }
}

/* ----------------------- المفتاح المحفوظ من لوحة الإدارة ----------------------- */

interface StoredSms {
  key: string
  hint: string
  /** معرّف القالب المعتمد لدى SuiviSMS (كان يُسمّى sender) */
  sender: string | null
  updatedAt: string
}

async function readStored(db: Db): Promise<StoredSms | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, SMS_SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<StoredSms> | undefined
  if (!v?.key) return null
  return { key: v.key, hint: v.hint ?? '', sender: v.sender ?? null, updatedAt: v.updatedAt ?? '' }
}

/** يحفظ مفتاح SuiviSMS مشفّراً (المشرف وحده يستدعيه من خدمة/إجراء مصرّح) */
export async function saveSmsKey(db: Db, apiKey: string, sender?: string | null): Promise<{ hint: string }> {
  const key = apiKey.replace(/\s+/g, '')
  if (key.length < 8 || key.length > 400) throw new Error('sms key shape')
  if (sender && !/^[A-Za-z0-9_.:-]{3,80}$/.test(sender.trim())) throw new Error('sms template shape')
  const stored: StoredSms = { key: seal(key, SEAL_PURPOSE), hint: key.slice(-4), sender: sender?.trim() || null, updatedAt: new Date().toISOString() }
  await db
    .insert(appSettings)
    .values({ key: SMS_SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } })
  cached = null
  return { hint: stored.hint }
}

export async function clearSmsKey(db: Db): Promise<void> {
  await db.delete(appSettings).where(eq(appSettings.key, SMS_SETTINGS_KEY))
  cached = null
}

export interface SmsStatus {
  provider: SmsProviderName
  /** مصدر مفتاح suivisms إن وُجد */
  keySource: 'admin' | 'env' | 'none'
  hint: string | null
  sender: string | null
  updatedAt: string | null
  /** المفتاح المحفوظ لا يُفتح (تغيّر SESSION_SECRET) */
  unusable: boolean
}

/** ما تعرضه لوحة الإدارة: بلا المفتاح نفسه */
export async function smsStatus(db: Db): Promise<SmsStatus> {
  const provider = envProvider()
  const s = await readStored(db)
  const unusable = Boolean(s && unseal(s.key, SEAL_PURPOSE) === null)
  const keySource: SmsStatus['keySource'] = s && !unusable ? 'admin' : process.env.SUIVISMS_API_KEY ? 'env' : 'none'
  return { provider, keySource, hint: s?.hint ?? null, sender: s?.sender ?? process.env.SUIVISMS_SENDER ?? null, updatedAt: s?.updatedAt ?? null, unusable }
}

function envProvider(): SmsProviderName {
  const p = (process.env.SMS_PROVIDER ?? 'console').toLowerCase()
  return (SMS_PROVIDERS as readonly string[]).includes(p) ? (p as SmsProviderName) : 'console'
}

let override: SmsSender | null = null
let cached: SmsSender | null = null

/** المرسِل الفعّال: يقرأ المفتاح المحفوظ عند الحاجة (suivisms) ثم يُخزَّن حتى تغيير الإعداد */
export async function getSmsSender(db?: Db): Promise<SmsSender> {
  if (override) return override
  if (cached) return cached
  const p = envProvider()
  if (p === 'webhook' && process.env.SMS_WEBHOOK_URL) cached = webhookSender(process.env.SMS_WEBHOOK_URL, process.env.SMS_WEBHOOK_SECRET)
  else if (p === 'suivisms') {
    const s = db ? await readStored(db) : null
    const adminKey = s ? unseal(s.key, SEAL_PURPOSE) : null
    const key = adminKey ?? process.env.SUIVISMS_API_KEY ?? null
    if (key) cached = suivismsSender(key, { templateId: s?.sender ?? process.env.SUIVISMS_TEMPLATE_ID ?? null })
    else {
      if (process.env.NODE_ENV !== 'test') console.warn('[sms] SMS_PROVIDER=suivisms بلا مفتاح — تُطبع الرسائل في السجل')
      cached = consoleSender
    }
  } else cached = consoleSender
  return cached
}

export async function sendSms(db: Db, m: SmsMessage): Promise<void> {
  const s = await getSmsSender(db)
  await s.send(m)
}

/** رسالة اختبار من لوحة الإدارة للتحقّق من الإعداد؛ تُرجع اسم المزوّد المستعمل */
export async function testSmsSend(db: Db, to: string): Promise<{ provider: string }> {
  const s = await getSmsSender(db)
  // مع SuiviSMS بلا قالب: تحدّي OTP حقيقي (هو ما سيصل الزبون فعلاً)
  if (s.name === 'suivisms' && !(s as { templateId?: string | null }).templateId && s.sendOtp) {
    await s.sendOtp(to, `test:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`)
    return { provider: 'suivisms (otp)' }
  }
  await s.send({ to, text: 'مدرسة: رسالة اختبار — إعداد الرسائل القصيرة يعمل.', variables: { name: 'مدرسة', code: '0000' } })
  return { provider: s.name }
}

/** للاختبارات فقط */
export function setSmsSenderForTests(s: SmsSender | null) {
  override = s
  cached = null
}
