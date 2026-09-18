import { createAnthropicProvider } from './anthropic-provider'
import { createMockProvider } from './mock-provider'
import type { AIProvider } from './types'

export type { AIProvider, AnalyzeStudentInput, AnalyzeStudentOutput, EvaluateEssayInput, EvaluateEssayOutput, GenerateExercisesInput, GenerateExercisesOutput, GeneratedQuestion, TeacherInsightsInput, TeacherInsightsOutput } from './types'

let override: AIProvider | null = null
let cached: AIProvider | null = null

/**
 * يختار المزوّد من البيئة فقط:
 *   AI_PROVIDER=mock (افتراضي) | anthropic
 *   AI_API_KEY=…  AI_MODEL=…
 * إن اختير مزوّد حقيقي بلا مفتاح يُرجَع المزوّد التجريبي مع تحذير في السجل (لا يتعطّل التطبيق).
 */
export function getAiProvider(): AIProvider {
  if (override) return override
  if (cached) return cached
  const name = (process.env.AI_PROVIDER ?? 'mock').toLowerCase()
  const apiKey = process.env.AI_API_KEY
  if (name === 'anthropic') {
    if (apiKey) cached = createAnthropicProvider({ apiKey, model: process.env.AI_MODEL || undefined })
    else {
      console.warn('[ai] AI_PROVIDER=anthropic بلا AI_API_KEY — سيُستعمل المزوّد التجريبي')
      cached = createMockProvider()
    }
  } else {
    cached = createMockProvider()
  }
  return cached
}

export function aiProviderInfo() {
  const p = getAiProvider()
  return { name: p.name, model: p.model, configured: p.name !== 'mock' }
}

/** للاختبارات فقط: حقن مزوّد بديل (ناجح/فاشل) */
export function setAiProviderForTests(p: AIProvider | null) {
  override = p
}
