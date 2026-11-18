/**
 * إعدادات مساعد الدعم الذكي (قرار المالك، 18 نوفمبر 2026): يردّ على تذاكر التلاميذ بـ Claude من معطيات المنصة.
 *
 * التشغيل بالتدريج، من لوحة الإدارة دون برمجة:
 *   OFF   متوقف (الافتراضي).
 *   DRAFT يكتب مسودّة داخلية في التذكرة، والموظف يراجعها ويرسلها بنفسه. لا يرى التلميذ شيئًا منه.
 *   PILOT يردّ وحده على أرقام التجربة فقط (pilotPhones)، ومسودّة للبقية.
 *   ALL   يردّ وحده على كل التلاميذ.
 *
 * المفتاح نفسه الذي في «الذكاء الاصطناعي» بلوحة الإدارة (مختوم، لا يُخزَّن هنا).
 * botUserId: المشرف الذي فعّل المساعد — تُنسب إليه رسائل المساعد في قاعدة البيانات (عمود is_ai يميّزها)،
 * فلا حساب جديد بصلاحيات مشرف.
 */
import { eq } from 'drizzle-orm'
import type { Db } from '@/server/db/connect'
import { appSettings } from '@/server/db/schema'
import { assertRole, type Actor } from '@/server/lib/actor'
import { writeAudit } from '@/server/lib/audit'
import { AppError } from '@/server/lib/errors'

export const SUPPORT_AI_MODES = ['OFF', 'DRAFT', 'PILOT', 'ALL'] as const
export type SupportAiMode = (typeof SUPPORT_AI_MODES)[number]

/** قرار المالك: Sonnet 5.5 (صفحة النماذج الرسمية: 2$ للمليون الداخل و10$ للخارج) */
export const SUPPORT_AI_DEFAULT_MODEL = 'claude-sonnet-5-5'
/** القائمة في صفحة الإعداد، بأسعار صفحة النماذج الرسمية (دولار لكل مليون رمز: داخل / خارج). يُقبل أي معرّف Claude آخر يُكتب يدويًا */
export const SUPPORT_AI_MODELS = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 — الموصى به', input: 2, output: 10 },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 — الأرخص', input: 0.1, output: 0.5 },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 — الأقوى', input: 4, output: 20 },
  { id: 'claude-fable-5-2', label: 'Fable 5.2 — الأعلى', input: 8, output: 40 }
] as const

export const SUPPORT_AI_NAME = 'مساعد مدرسة الذكي'

export interface SupportAiSettings {
  mode: SupportAiMode
  model: string
  /** أرقام تلاميذ التجربة (وضع PILOT) بصيغة 0XXXXXXXXX */
  pilotPhones: string[]
  /** حدّ يومي لعدد الردود (ردّ أو مسودّة)؛ عند بلوغه تبقى التذاكر للموظفين */
  dailyLimit: number
  /** حدّ يومي للتكلفة بالدولار (تقدير من الرموز) */
  dailyBudgetUsd: number
  /** ما يعرفه المساعد عن المنصة ويكتبه المالك: أين الأشياء، القواعد، المواعيد… */
  knowledge: string
  botUserId: string | null
  updatedAt: string | null
}

const KEY = 'support_ai'

export const SUPPORT_AI_DEFAULTS: SupportAiSettings = {
  mode: 'OFF',
  model: SUPPORT_AI_DEFAULT_MODEL,
  pilotPhones: [],
  dailyLimit: 100,
  dailyBudgetUsd: 5,
  knowledge: '',
  botUserId: null,
  updatedAt: null
}

const MODEL_SHAPE = /^claude-[a-z0-9.-]{2,60}$/
const DZ_MOBILE = /^0[5-7][0-9]{8}$/

const normalizePhone = (raw: string) =>
  raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[\s\-().]/g, '')
    .replace(/^(\+|00)?213/, '0')

/**
 * يقبل رقمًا في كل سطر أو مفصولة بفاصلة، بالأرقام العربية و+213، ومع مسافات داخل الرقم («0661 23 45 67»).
 * يرجعها بصيغة 0XXXXXXXXX دون تكرار.
 */
export function parsePilotPhones(raw: string): string[] {
  const out = new Set<string>()
  for (const part of raw.split(/[\n,؛;،]+/)) {
    if (!part.trim()) continue
    const whole = normalizePhone(part)
    // سطر فيه أرقام مفصولة بمسافات فقط
    const pieces = DZ_MOBILE.test(whole) ? [whole] : part.trim().split(/\s+/).map(normalizePhone)
    for (const v of pieces) {
      if (!DZ_MOBILE.test(v)) throw new AppError('VALIDATION', { field: 'pilotPhones' })
      out.add(v)
    }
  }
  return [...out].slice(0, 200)
}

export async function readSupportAiSettings(db: Db): Promise<SupportAiSettings> {
  const [row] = await db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, KEY)).limit(1)
  const v = (row?.value ?? {}) as Partial<SupportAiSettings>
  return {
    mode: SUPPORT_AI_MODES.includes(v.mode as SupportAiMode) ? (v.mode as SupportAiMode) : 'OFF',
    model: typeof v.model === 'string' && MODEL_SHAPE.test(v.model) ? v.model : SUPPORT_AI_DEFAULT_MODEL,
    pilotPhones: Array.isArray(v.pilotPhones) ? v.pilotPhones.filter((p): p is string => typeof p === 'string' && DZ_MOBILE.test(p)) : [],
    dailyLimit: Number.isInteger(v.dailyLimit) && (v.dailyLimit as number) >= 0 ? (v.dailyLimit as number) : SUPPORT_AI_DEFAULTS.dailyLimit,
    dailyBudgetUsd: typeof v.dailyBudgetUsd === 'number' && v.dailyBudgetUsd >= 0 ? v.dailyBudgetUsd : SUPPORT_AI_DEFAULTS.dailyBudgetUsd,
    knowledge: typeof v.knowledge === 'string' ? v.knowledge : '',
    botUserId: typeof v.botUserId === 'string' ? v.botUserId : null,
    updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : null
  }
}

export interface SupportAiSettingsInput {
  mode: string
  model?: string | null
  pilotPhones?: string | null
  dailyLimit?: number | null
  dailyBudgetUsd?: number | null
  knowledge?: string | null
}

export async function saveSupportAiSettings(db: Db, actor: Actor, input: SupportAiSettingsInput): Promise<SupportAiSettings> {
  assertRole(actor, 'SUPER_ADMIN')
  if (!SUPPORT_AI_MODES.includes(input.mode as SupportAiMode)) throw new AppError('VALIDATION', { field: 'mode' })
  const model = input.model?.trim() || SUPPORT_AI_DEFAULT_MODEL
  if (!MODEL_SHAPE.test(model)) throw new AppError('VALIDATION', { field: 'model' })
  const dailyLimit = input.dailyLimit ?? SUPPORT_AI_DEFAULTS.dailyLimit
  if (!Number.isInteger(dailyLimit) || dailyLimit < 0 || dailyLimit > 5000) throw new AppError('VALIDATION', { field: 'dailyLimit' })
  const dailyBudgetUsd = input.dailyBudgetUsd ?? SUPPORT_AI_DEFAULTS.dailyBudgetUsd
  if (!Number.isFinite(dailyBudgetUsd) || dailyBudgetUsd < 0 || dailyBudgetUsd > 500) throw new AppError('VALIDATION', { field: 'dailyBudgetUsd' })
  const knowledge = (input.knowledge ?? '').trim()
  if (knowledge.length > 12_000) throw new AppError('VALIDATION', { field: 'knowledge' })
  const pilotPhones = parsePilotPhones(input.pilotPhones ?? '')

  const before = await readSupportAiSettings(db)
  const next: SupportAiSettings = { mode: input.mode as SupportAiMode, model, pilotPhones, dailyLimit, dailyBudgetUsd, knowledge, botUserId: actor.userId, updatedAt: new Date().toISOString() }
  await db
    .insert(appSettings)
    .values({ key: KEY, value: next })
    .onConflictDoUpdate({ target: appSettings.key, set: { value: next, updatedAt: new Date() } })
  await writeAudit(db, {
    actorUserId: actor.userId,
    workspaceId: null,
    action: 'settings.support_ai',
    entityType: 'settings',
    entityId: null,
    oldValue: { mode: before.mode, model: before.model, pilotPhones: before.pilotPhones.length, dailyLimit: before.dailyLimit, dailyBudgetUsd: before.dailyBudgetUsd },
    newValue: { mode: next.mode, model: next.model, pilotPhones: next.pilotPhones.length, dailyLimit: next.dailyLimit, dailyBudgetUsd: next.dailyBudgetUsd }
  })
  return next
}
