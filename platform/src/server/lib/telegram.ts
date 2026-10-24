/**
 * إشعارات تيليغرام للمشرف (على نسق NOVA COMMERCE، مبسَّطة لمنصّة بمشرف واحد):
 * بوت واحد (رمز من BotFather) ومحادثة واحدة (chat_id للمشرف أو لمجموعة الفريق).
 * الرمز يُحفظ مختوماً في جدول الإعدادات؛ لا يصل إلى المتصفح ولا يُسجَّل.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { seal, unseal } from './secret-box'

export const TELEGRAM_SETTINGS_KEY = 'notify.telegram'
const SEAL_PURPOSE = 'telegram-bot'
const API = 'https://api.telegram.org'

export interface TelegramConfig {
  enabled: boolean
  chatId: string
  /** آخر 4 من الرمز، للعرض */
  hint: string | null
  botUsername: string | null
  updatedAt: string | null
}

interface Stored {
  enabled: boolean
  chatId: string
  tokenSealed: string | null
  hint: string | null
  botUsername: string | null
  updatedAt: string
}

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, TELEGRAM_SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<Stored> | undefined
  if (!v) return null
  return { enabled: v.enabled === true, chatId: v.chatId ?? '', tokenSealed: v.tokenSealed ?? null, hint: v.hint ?? null, botUsername: v.botUsername ?? null, updatedAt: v.updatedAt ?? '' }
}

export async function telegramConfig(db: Db): Promise<TelegramConfig> {
  const s = await readStored(db)
  return { enabled: Boolean(s?.enabled && s.tokenSealed && s.chatId), chatId: s?.chatId ?? '', hint: s?.hint ?? null, botUsername: s?.botUsername ?? null, updatedAt: s?.updatedAt || null }
}

export class TelegramError extends Error {}

async function api<T = unknown>(token: string, method: string, body: Record<string, unknown>, fetchImpl: typeof fetch = fetch): Promise<T> {
  const res = await fetchImpl(`${API}/bot${token}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15_000) })
  const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
  if (!res.ok || !json?.ok) throw new TelegramError(json?.description ?? `Telegram HTTP ${res.status}`)
  return json.result as T
}

/** يحفظ الإعداد؛ الرمز يُستبدل فقط حين يُعطى (undefined = إبقاء المحفوظ، '' = حذفه). يتحقق من الرمز عبر getMe. */
export async function saveTelegramConfig(db: Db, patch: { enabled: boolean; chatId: string; token?: string }, fetchImpl: typeof fetch = fetch): Promise<TelegramConfig> {
  const cur = await readStored(db)
  let tokenSealed = cur?.tokenSealed ?? null
  let hint = cur?.hint ?? null
  let botUsername = cur?.botUsername ?? null
  if (patch.token !== undefined) {
    const t = patch.token.trim()
    if (!t) {
      tokenSealed = null
      hint = null
      botUsername = null
    } else {
      if (!/^\d{6,}:[A-Za-z0-9_-]{30,}$/.test(t)) throw new TelegramError('رمز البوت غير صالح (الشكل: 123456:ABC…)')
      const me = await api<{ username?: string }>(t, 'getMe', {}, fetchImpl)
      tokenSealed = seal(t, SEAL_PURPOSE)
      hint = t.slice(-4)
      botUsername = me.username ?? null
    }
  }
  const chatId = patch.chatId.trim()
  if (patch.enabled && (!tokenSealed || !chatId)) throw new TelegramError('أدخل رمز البوت ومعرّف المحادثة قبل التفعيل')
  const stored: Stored = { enabled: patch.enabled, chatId, tokenSealed, hint, botUsername, updatedAt: new Date().toISOString() }
  await db
    .insert(appSettings)
    .values({ key: TELEGRAM_SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } })
  return telegramConfig(db)
}

/** يرسل نصاً إلى محادثة المشرف إن كان البوت مفعّلاً؛ لا يرمي أبداً (الإشعار لا يُفشل العملية) */
export async function sendTelegram(db: Db, text: string, opts: { fetchImpl?: typeof fetch; throwOnError?: boolean } = {}): Promise<boolean> {
  try {
    const s = await readStored(db)
    if (!s?.enabled || !s.tokenSealed || !s.chatId) return false
    const token = unseal(s.tokenSealed, SEAL_PURPOSE)
    if (!token) return false
    await api(token, 'sendMessage', { chat_id: s.chatId, text: text.slice(0, 4000), disable_web_page_preview: true }, opts.fetchImpl)
    return true
  } catch (e) {
    if (opts.throwOnError) throw e
    if (process.env.NODE_ENV !== 'test') console.error('[telegram]', e instanceof Error ? e.message : e)
    return false
  }
}
