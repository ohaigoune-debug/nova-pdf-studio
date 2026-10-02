/**
 * تسجيل استهلاك الذكاء الاصطناعي (محرّك الامتحانات): كل نداء نموذج يبلّغ هنا برموزه ومدته ونتيجته،
 * والسياق (المهمة، مساحة العمل، الكيان) يأتي من AsyncLocalStorage فلا يحتاج المزوّد إلى معرفة من يستدعيه.
 * المزوّد لا يعرف قاعدة البيانات: المغسلة (sink) تُركَّب من طبقة الخدمات.
 */
import { AsyncLocalStorage } from 'node:async_hooks'

export interface AiTaskContext {
  task: string
  workspaceId?: string | null
  userId?: string | null
  entityType?: string | null
  entityId?: string | null
}

export interface AiUsageEvent extends AiTaskContext {
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  durationMs: number
  ok: boolean
  error?: string | null
}

const als = new AsyncLocalStorage<AiTaskContext>()
let sink: ((e: AiUsageEvent) => void) | null = null
/** آخر الأحداث في الذاكرة (للاختبارات ولوحة الإدارة حين لا قاعدة) */
const recent: AiUsageEvent[] = []

export function setAiUsageSink(fn: ((e: AiUsageEvent) => void) | null): void {
  sink = fn
}

/** ينفّذ عملاً تحت سياق مهمة: ما يُبلَّغ من داخله يُنسب إليها */
export function withAiTask<T>(ctx: AiTaskContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn)
}

export function currentAiTask(): AiTaskContext | undefined {
  return als.getStore()
}

/** أسعار تقديرية بالدولار لكل مليون رمز (تُحدَّث يدوياً؛ غير المعروف يُسجَّل بتكلفة 0) */
const PRICES: { match: RegExp; input: number; output: number }[] = [
  { match: /gpt-4\.1-nano/i, input: 0.1, output: 0.4 },
  { match: /gpt-4\.1-mini/i, input: 0.4, output: 1.6 },
  { match: /gpt-4\.1/i, input: 2, output: 8 },
  { match: /gpt-4o-mini/i, input: 0.15, output: 0.6 },
  { match: /gpt-4o/i, input: 2.5, output: 10 },
  { match: /gpt-5-nano/i, input: 0.05, output: 0.4 },
  { match: /gpt-5-mini/i, input: 0.25, output: 2 },
  { match: /gpt-5/i, input: 1.25, output: 10 },
  { match: /o4-mini|o3-mini/i, input: 1.1, output: 4.4 },
  { match: /claude.*haiku/i, input: 0.8, output: 4 },
  { match: /claude.*sonnet/i, input: 3, output: 15 },
  { match: /claude.*opus/i, input: 15, output: 75 }
]

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICES.find((x) => x.match.test(model))
  if (!p) return 0
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 1e6) / 1e6
}

/** يبلّغ عن نداء (ناجح أو فاشل). لا يرمي أبداً: السجلّ لا يعطّل العمل. */
export function reportAiUsage(u: { provider: string; model: string; inputTokens?: number; outputTokens?: number; durationMs: number; ok: boolean; error?: string | null }): void {
  const ctx = als.getStore() ?? { task: 'unknown' }
  const inputTokens = Math.max(0, Math.round(u.inputTokens ?? 0))
  const outputTokens = Math.max(0, Math.round(u.outputTokens ?? 0))
  const e: AiUsageEvent = { ...ctx, provider: u.provider, model: u.model, inputTokens, outputTokens, costUsd: estimateCostUsd(u.model, inputTokens, outputTokens), durationMs: Math.max(0, Math.round(u.durationMs)), ok: u.ok, error: u.error ?? null }
  recent.push(e)
  if (recent.length > 200) recent.splice(0, recent.length - 200)
  try {
    sink?.(e)
  } catch (err) {
    console.error('[ai] usage sink failed', err)
  }
}

export function recentAiUsage(): AiUsageEvent[] {
  return [...recent]
}
