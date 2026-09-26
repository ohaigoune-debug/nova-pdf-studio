/**
 * مفتاح الذكاء الاصطناعي من لوحة الإدارة: يُختبر عند المزوّد قبل الحفظ، ويُخزَّن مشفّراً،
 * ولا يعود إلى المتصفح أبداً (يُعرض آخر 4 أحرف فقط). يتقدّم على AI_API_KEY في ملف البيئة؛
 * حذفه يُرجع المنصة إلى ملف البيئة.
 */
import { eq } from 'drizzle-orm'
import { DEFAULT_MODEL as ANTHROPIC_DEFAULT } from '@/server/ai/anthropic-provider'
import { DEFAULT_MODEL as OPENAI_DEFAULT } from '@/server/ai/openai-provider'
import { setAiRuntimeConfig, type AiProviderName } from '@/server/ai/provider'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'
import { seal, unseal } from '@/server/lib/secret-box'

const SETTINGS_KEY = 'ai_credentials'
const PURPOSE = 'ai-key'

export const AI_PROVIDERS: AiProviderName[] = ['openai', 'anthropic']
export const DEFAULT_MODELS: Record<AiProviderName, string> = { openai: OPENAI_DEFAULT, anthropic: ANTHROPIC_DEFAULT }
/** اقتراحات لحقل النموذج (يقبل غيرها إن أتاحه الحساب) */
export const SUGGESTED_MODELS: Record<AiProviderName, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-5', 'claude-haiku-4-5-20251001', 'claude-opus-5-5']
}

interface Stored {
  provider: AiProviderName
  model: string | null
  key: string
  hint: string
  updatedAt: string
}

export interface AiCredentialsView {
  provider: AiProviderName
  model: string
  hint: string
  updatedAt: string
  /** false: حُفظ بسرّ جلسة قديم ولم يعد يُفتح — يجب إدخاله من جديد */
  usable: boolean
}

const KEY_SHAPE: Record<AiProviderName, RegExp> = {
  openai: /^sk-(?!ant-)[A-Za-z0-9_-]{20,}$/,
  anthropic: /^sk-ant-[A-Za-z0-9_-]{20,}$/
}
const MODEL_SHAPE = /^[A-Za-z0-9._:-]{2,80}$/

async function readStored(db: Db): Promise<Stored | null> {
  const [row] = await db.select().from(appSettings).where(eq(appSettings.key, SETTINGS_KEY)).limit(1)
  const v = row?.value as Partial<Stored> | undefined
  if (!v?.key || !v.provider || !AI_PROVIDERS.includes(v.provider)) return null
  return { provider: v.provider, model: v.model ?? null, key: v.key, hint: v.hint ?? '', updatedAt: v.updatedAt ?? '' }
}

/** ما تعرضه لوحة الإدارة: بلا المفتاح نفسه */
export async function getAiCredentials(db: Db, actor: Actor): Promise<AiCredentialsView | null> {
  assertRole(actor, 'SUPER_ADMIN')
  const s = await readStored(db)
  if (!s) return null
  return { provider: s.provider, model: s.model ?? DEFAULT_MODELS[s.provider], hint: s.hint, updatedAt: s.updatedAt, usable: unseal(s.key, PURPOSE) !== null }
}

let loadedAt = 0

/** يطبّق المفتاح المحفوظ على هذه العملية (عند الإقلاع، ودورياً لعامل مستقل) */
export async function loadAiCredentials(db: Db, opts: { maxAgeMs?: number } = {}): Promise<void> {
  if (opts.maxAgeMs && Date.now() - loadedAt < opts.maxAgeMs) return
  loadedAt = Date.now()
  const s = await readStored(db)
  const apiKey = s ? unseal(s.key, PURPOSE) : null
  if (s && !apiKey) console.warn('[ai] المفتاح المحفوظ في لوحة الإدارة لا يُفتح (تغيّر SESSION_SECRET؟) — يُستعمل ملف البيئة')
  setAiRuntimeConfig(s && apiKey ? { provider: s.provider, apiKey, model: s.model } : null)
}

/** طلب مجاني عند المزوّد: هل المفتاح مقبول والنموذج متاح؟ */
export async function testAiKey(provider: AiProviderName, apiKey: string, model: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const url = provider === 'openai' ? `https://api.openai.com/v1/models/${encodeURIComponent(model)}` : `https://api.anthropic.com/v1/models/${encodeURIComponent(model)}`
  const headers: Record<string, string> = provider === 'openai' ? { authorization: `Bearer ${apiKey}` } : { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
  let res: Response
  try {
    res = await fetchImpl(url, { headers, signal: AbortSignal.timeout(15_000) })
  } catch {
    throw new AppError('AI_KEY_UNREACHABLE')
  }
  if (res.ok) return
  if (res.status === 401 || res.status === 403) throw new AppError('AI_KEY_INVALID')
  if (res.status === 404) throw new AppError('AI_MODEL_UNKNOWN')
  throw new AppError('AI_KEY_UNREACHABLE')
}

export async function saveAiCredentials(
  db: Db,
  actor: Actor,
  input: { provider: string; apiKey: string; model?: string | null },
  opts: { fetch?: typeof fetch } = {}
): Promise<AiCredentialsView> {
  assertRole(actor, 'SUPER_ADMIN')
  const provider = input.provider as AiProviderName
  if (!AI_PROVIDERS.includes(provider)) throw new AppError('VALIDATION', { field: 'provider' })
  const apiKey = input.apiKey.replace(/\s+/g, '')
  if (!KEY_SHAPE[provider].test(apiKey)) throw new AppError('AI_KEY_FORMAT')
  const model = input.model?.trim() || null
  if (model && !MODEL_SHAPE.test(model)) throw new AppError('VALIDATION', { field: 'model' })

  await testAiKey(provider, apiKey, model ?? DEFAULT_MODELS[provider], opts.fetch)

  const previous = await readStored(db)
  const stored: Stored = { provider, model, key: seal(apiKey, PURPOSE), hint: apiKey.slice(-4), updatedAt: new Date().toISOString() }
  await db
    .insert(appSettings)
    .values({ key: SETTINGS_KEY, value: stored })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: stored, updatedAt: new Date() } })
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'settings.ai_key',
    entityType: 'settings',
    entityId: null,
    oldValue: previous ? { provider: previous.provider, model: previous.model, hint: previous.hint } : null,
    newValue: { provider, model, hint: stored.hint }
  })
  setAiRuntimeConfig({ provider, apiKey, model })
  loadedAt = Date.now()
  return { provider, model: model ?? DEFAULT_MODELS[provider], hint: stored.hint, updatedAt: stored.updatedAt, usable: true }
}

export async function clearAiCredentials(db: Db, actor: Actor): Promise<void> {
  assertRole(actor, 'SUPER_ADMIN')
  const previous = await readStored(db)
  await db.delete(appSettings).where(eq(appSettings.key, SETTINGS_KEY))
  if (previous) {
    await writeAudit(db, { actorUserId: actor.userId, workspaceId: null, action: 'settings.ai_key.clear', entityType: 'settings', entityId: null, oldValue: { provider: previous.provider, model: previous.model, hint: previous.hint }, newValue: null })
  }
  setAiRuntimeConfig(null)
  loadedAt = Date.now()
}
