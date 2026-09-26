import {
  DRAFT_SCHEMA,
  draftSystem,
  draftUser,
  parseDraft,
  analyzeSystem,
  ESSAY_MAX_TOKENS,
  ESSAY_SCHEMA,
  essaySystem,
  exercisesSystem,
  insightsSystem,
  ORGANIZE_SCHEMA,
  organizeSystem,
  analyzeUser,
  essayUser,
  exercisesMaxTokens,
  exercisesTimeoutMs,
  exercisesUser,
  extractJson,
  httpError,
  insightsUser,
  organizeUser,
  parseEssay,
  parseExercises,
  parseOrganize,
  salvageQuestions,
  strList,
  text
} from './shared'
import { PermanentJobError } from '@/server/lib/errors'
import type {
  AIProvider,
  AnalyzeStudentInput,
  AnalyzeStudentOutput,
  DraftFromSourceInput,
  DraftFromSourceOutput,
  EssayBatchItem,
  EssayBatchOutcome,
  EssayBatchStatus,
  EvaluateEssayInput,
  EvaluateEssayOutput,
  GenerateExercisesInput,
  GenerateExercisesOutput,
  OrganizeLessonsInput,
  OrganizeLessonsOutput,
  TeacherInsightsInput,
  TeacherInsightsOutput
} from './types'

/**
 * مزوّد حقيقي عبر Anthropic Messages API (بلا SDK — fetch فقط).
 * يُفعَّل بـ AI_PROVIDER=anthropic و AI_API_KEY=… و(اختياري) AI_MODEL=…
 * المفتاح يبقى في الخادم. التصحيح يستعمل المخرجات المُهيكلة (JSON مضمون بالمخطط)،
 * والدفعات تمرّ عبر Message Batches بنصف السعر.
 */
export const DEFAULT_MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'
const BATCHES_URL = 'https://api.anthropic.com/v1/messages/batches'

interface Opts {
  apiKey: string
  model?: string
  timeoutMs?: number
}

interface MessageParams {
  model: string
  max_tokens: number
  system: string
  messages: { role: 'user'; content: string }[]
  output_config?: { format: { type: 'json_schema'; schema: Record<string, unknown> } }
}

interface ApiMessage {
  content?: { type: string; text?: string }[]
  stop_reason?: string | null
}

/** ردّ مبتور أو مرفوض: مدفوع الثمن ولن يتحسن بالإعادة */
function assertComplete(msg: ApiMessage): void {
  if (msg.stop_reason === 'max_tokens') throw new PermanentJobError('AI output truncated (max_tokens)')
  if (msg.stop_reason === 'refusal') throw new PermanentJobError('AI refused the request')
}

function messageText(msg: ApiMessage): string {
  return (msg.content ?? [])
    .filter((c) => c.type === 'text')
    .map((c) => c.text ?? '')
    .join('\n')
}

export function createAnthropicProvider(opts: Opts): AIProvider {
  const model = opts.model ?? DEFAULT_MODEL
  const timeoutMs = opts.timeoutMs ?? 60_000
  const headers = { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' }

  async function request(url: string, init: RequestInit, waitMs = timeoutMs): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.max(timeoutMs, waitMs))
    try {
      const res = await fetch(url, { ...init, headers, signal: ctrl.signal }).catch((e: unknown) => {
        throw ctrl.signal.aborted ? new Error('AI timeout') : e
      })
      if (!res.ok) throw httpError(res.status, 'AI', await res.text().catch(() => ''))
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  async function complete(params: MessageParams, o: { timeoutMs?: number; salvage?: (raw: string) => Record<string, unknown> | null } = {}): Promise<Record<string, unknown>> {
    const res = await request(API_URL, { method: 'POST', body: JSON.stringify(params) }, o.timeoutMs)
    const msg = (await res.json()) as ApiMessage
    if (msg.stop_reason === 'max_tokens' && o.salvage) {
      const saved = o.salvage(messageText(msg))
      if (saved) return saved
    }
    assertComplete(msg)
    return extractJson(messageText(msg))
  }

  const textParams = (system: string, user: string, maxTokens: number): MessageParams => ({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })

  const jsonParams = (system: string, user: string, maxTokens: number, schema: Record<string, unknown>): MessageParams => ({
    ...textParams(system, user, maxTokens),
    output_config: { format: { type: 'json_schema', schema } }
  })

  const essayParams = (input: EvaluateEssayInput): MessageParams => jsonParams(essaySystem(input.subject), essayUser(input), ESSAY_MAX_TOKENS, ESSAY_SCHEMA)

  /** سطر واحد من ملف نتائج الدفعة (JSONL) */
  interface BatchLine {
    custom_id: string
    result: { type: 'succeeded'; message: ApiMessage } | { type: 'errored'; error?: { type?: string; error?: { type?: string; message?: string } } } | { type: 'expired' | 'canceled' }
  }

  function batchOutcome(line: BatchLine, input: EvaluateEssayInput): EssayBatchOutcome {
    const r = line.result
    if (r.type === 'succeeded') {
      try {
        assertComplete(r.message)
        return { type: 'succeeded', output: parseEssay(extractJson(messageText(r.message)), input) }
      } catch (err) {
        // ردّ مدفوع لا يصلح: إعادته بنفس المدخل ستُفوتر مجدداً
        return { type: 'failed', error: err instanceof Error ? err.message : String(err), permanent: true }
      }
    }
    if (r.type === 'errored') {
      const kind = r.error?.error?.type ?? r.error?.type ?? 'unknown'
      return { type: 'failed', error: `batch ${kind}: ${r.error?.error?.message ?? ''}`.trim(), permanent: kind === 'invalid_request_error' }
    }
    // منتهية الصلاحية أو ملغاة: لم تُفوتر، فتُعاد فرادى
    return { type: 'failed', error: `batch ${r.type}`, permanent: false }
  }

  return {
    name: 'anthropic',
    model,
    async evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput> {
      return parseEssay(await complete(essayParams(input)), input)
    },

    async submitEssayBatch(items: EssayBatchItem[]): Promise<{ batchId: string }> {
      const body = { requests: items.map((i) => ({ custom_id: i.customId, params: essayParams(i.input) })) }
      const res = await request(BATCHES_URL, { method: 'POST', body: JSON.stringify(body) })
      const data = (await res.json()) as { id?: string }
      if (!data.id) throw new Error('batch id missing')
      return { batchId: data.id }
    },

    async fetchEssayBatch(batchId: string, items: EssayBatchItem[]): Promise<EssayBatchStatus> {
      const meta = (await (await request(`${BATCHES_URL}/${encodeURIComponent(batchId)}`, { method: 'GET' })).json()) as { processing_status?: string; results_url?: string | null }
      if (meta.processing_status !== 'ended' || !meta.results_url) return { ended: false, outcomes: {} }
      const inputs = new Map(items.map((i) => [i.customId, i.input]))
      const body = await (await request(meta.results_url, { method: 'GET' })).text()
      const outcomes: Record<string, EssayBatchOutcome> = {}
      for (const raw of body.split('\n')) {
        const line = raw.trim()
        if (!line) continue
        let parsed: BatchLine
        try {
          parsed = JSON.parse(line) as BatchLine
        } catch {
          continue
        }
        const input = inputs.get(parsed.custom_id)
        if (input) outcomes[parsed.custom_id] = batchOutcome(parsed, input)
      }
      return { ended: true, outcomes }
    },

    async generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput> {
      const j = await complete(textParams(insightsSystem(input.subject), insightsUser(input), 1000))
      return { summary: text(j.summary, 3000), nextLessonSuggestions: strList(j.next_lesson, 6), raw: j }
    },

    async generateExercises(input: GenerateExercisesInput): Promise<GenerateExercisesOutput> {
      const j = await complete(textParams(exercisesSystem(input.subject), exercisesUser(input), exercisesMaxTokens(input.count)), { timeoutMs: exercisesTimeoutMs(input.count), salvage: salvageQuestions })
      return parseExercises(j, input)
    },

    async analyzeStudent(input: AnalyzeStudentInput): Promise<AnalyzeStudentOutput> {
      const j = await complete(textParams(analyzeSystem(input.subject), analyzeUser(input), 1200))
      return { summary: text(j.summary, 3000), strengths: strList(j.strengths, 6), weaknesses: strList(j.weaknesses, 6), recommendations: strList(j.recommendations, 6), raw: j }
    },

    async organizeLessons(input: OrganizeLessonsInput): Promise<OrganizeLessonsOutput> {
      // ~160 رمزاً لكل درس في الردّ، مع هامش للقوائم الطويلة
      const maxTokens = Math.min(8000, 600 + input.items.length * 200)
      return parseOrganize(await complete(jsonParams(organizeSystem(input.subject, input.kind), organizeUser(input), maxTokens, ORGANIZE_SCHEMA)), input)
    },

    async draftFromSource(input: DraftFromSourceInput): Promise<DraftFromSourceOutput> {
      return parseDraft(await complete(jsonParams(draftSystem(input.subject, input.mode), draftUser(input), 6000, DRAFT_SCHEMA)), input)
    }
  }
}
