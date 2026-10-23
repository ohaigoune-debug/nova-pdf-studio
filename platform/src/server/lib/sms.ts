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
  text: string
}

export interface SmsSender {
  readonly name: string
  send(m: SmsMessage): Promise<void>
}

/**
 * شكل طلب SuiviSMS غير موثّق لدينا بدقّة: المسار وشكل الجسم في ثابتين هنا حتى يسهل تصحيحهما
 * بعد تجربة «إرسال رسالة اختبار» من لوحة الإدارة. الافتراض: POST JSON مع Bearer.
 */
export const SUIVISMS_ENDPOINT_PATH = '/v1/messages'
export const suivismsBody = (m: SmsMessage, sender?: string | null): Record<string, string> => ({ to: m.to, text: m.text, ...(sender ? { sender } : {}) })
const SUIVISMS_DEFAULT_BASE = 'https://api.suivisms.com'

export const SMS_SETTINGS_KEY = 'sms.credentials'
const SEAL_PURPOSE = 'sms'

export const SMS_PROVIDERS = ['console', 'webhook', 'suivisms'] as const
export type SmsProviderName = (typeof SMS_PROVIDERS)[number]

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

function suivismsSender(apiKey: string, opts: { baseUrl?: string | null; sender?: string | null } = {}): SmsSender {
  const base = (opts.baseUrl || process.env.SUIVISMS_BASE_URL || SUIVISMS_DEFAULT_BASE).replace(/\/+$/, '')
  const sender = opts.sender ?? process.env.SUIVISMS_SENDER ?? null
  return {
    name: 'suivisms',
    async send(m) {
      const res = await fetch(`${base}${SUIVISMS_ENDPOINT_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(suivismsBody(m, sender)),
        signal: AbortSignal.timeout(15_000)
      })
      if (!res.ok) throw new Error(`sms HTTP ${res.status}`)
    }
  }
}

/* ----------------------- المفتاح المحفوظ من لوحة الإدارة ----------------------- */

interface StoredSms {
  key: string
  hint: string
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
    if (key) cached = suivismsSender(key, { sender: s?.sender ?? null })
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
  await s.send({ to, text: 'مدرسة: رسالة اختبار — إعداد الرسائل القصيرة يعمل.' })
  return { provider: s.name }
}

/** للاختبارات فقط */
export function setSmsSenderForTests(s: SmsSender | null) {
  override = s
  cached = null
}
