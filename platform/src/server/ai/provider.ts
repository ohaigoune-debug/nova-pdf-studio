import { createAnthropicProvider } from './anthropic-provider'
import { createMockProvider } from './mock-provider'
import { createOpenAiProvider } from './openai-provider'
import type { AIProvider } from './types'

export type { AIProvider, AnalyzeStudentInput, AnalyzeStudentOutput, EvaluateEssayInput, EvaluateEssayOutput, GenerateExercisesInput, GenerateExercisesOutput, GeneratedQuestion, OrganizeLessonsInput, OrganizeLessonsOutput, OrganizedLesson, TeacherInsightsInput, TeacherInsightsOutput } from './types'

let override: AIProvider | null = null
let cached: AIProvider | null = null

export type AiProviderName = 'openai' | 'anthropic'

/** مفتاح أُدخل من لوحة الإدارة (مخزَّن مشفّراً): يتقدّم على ملف البيئة */
export interface AiRuntimeConfig {
  provider: AiProviderName
  apiKey: string
  model: string | null
}
let runtime: AiRuntimeConfig | null = null

export function setAiRuntimeConfig(c: AiRuntimeConfig | null): void {
  const same = runtime?.provider === c?.provider && runtime?.apiKey === c?.apiKey && runtime?.model === c?.model
  runtime = c
  if (!same) cached = null
}

/**
 * يختار المزوّد: مفتاح لوحة الإدارة أولاً، وإلا البيئة:
 *   AI_PROVIDER=mock (افتراضي) | anthropic | openai
 *   AI_API_KEY=…  AI_MODEL=…  AI_BASE_URL=… (openai فقط: خادم متوافق)
 * إن اختير مزوّد حقيقي بلا مفتاح يُرجَع المزوّد التجريبي مع تحذير في السجل (لا يتعطّل التطبيق).
 */
export function getAiProvider(): AIProvider {
  if (override) return override
  if (cached) return cached
  if (runtime) {
    cached =
      runtime.provider === 'anthropic'
        ? createAnthropicProvider({ apiKey: runtime.apiKey, model: runtime.model ?? undefined })
        : createOpenAiProvider({ apiKey: runtime.apiKey, model: runtime.model ?? undefined })
    return cached
  }
  const name = (process.env.AI_PROVIDER ?? 'mock').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  const model = process.env.AI_MODEL || undefined
  if (name !== 'anthropic' && name !== 'openai') {
    cached = createMockProvider()
  } else if (!apiKey) {
    console.warn(`[ai] AI_PROVIDER=${name} بلا AI_API_KEY — سيُستعمل المزوّد التجريبي`)
    cached = createMockProvider()
  } else if (name === 'anthropic') {
    cached = createAnthropicProvider({ apiKey, model })
  } else {
    cached = createOpenAiProvider({ apiKey, model, baseUrl: process.env.AI_BASE_URL || undefined })
  }
  return cached
}

export function aiProviderInfo() {
  const p = getAiProvider()
  return { name: p.name, model: p.model, configured: p.name !== 'mock', source: override ? ('test' as const) : runtime ? ('admin' as const) : p.name !== 'mock' ? ('env' as const) : ('none' as const) }
}

/** للاختبارات فقط: حقن مزوّد بديل (ناجح/فاشل) */
export function setAiProviderForTests(p: AIProvider | null) {
  override = p
}
