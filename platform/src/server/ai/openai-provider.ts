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
  exercisesUser,
  exercisesMaxTokens,
  exercisesTimeoutMs,
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
 * مزوّد عبر OpenAI Chat Completions (بلا SDK — fetch فقط).
 * يُفعَّل بـ AI_PROVIDER=openai و AI_API_KEY=… و(اختياري) AI_MODEL=… و AI_BASE_URL=…
 * نفس التعليمات والمخططات المستعملة مع المزوّد الآخر، فالنتيجة على الأستاذ واحدة.
 * لا دفعات هنا: تصحيح الواجب يمرّ فرادى (submitEssayBatch غير معرّف).
 */
export const DEFAULT_MODEL = 'gpt-4.1-mini'
const DEFAULT_BASE_URL = 'https://api.openai.com/v1'

interface Opts {
  apiKey: string
  model?: string
  baseUrl?: string
  timeoutMs?: number
}

interface ChatParams {
  model: string
  max_completion_tokens: number
  messages: { role: 'system' | 'user'; content: string }[]
  response_format: { type: 'json_object' } | { type: 'json_schema'; json_schema: { name: string; strict: true; schema: Record<string, unknown> } }
}

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string | null }[]
}

/** ردّ مبتور أو مرفوض: مدفوع الثمن ولن يتحسن بالإعادة — إلا ما يستنقذه salvage من المبتور */
function choiceText(res: ChatResponse, salvage?: (raw: string) => Record<string, unknown> | null): string | Record<string, unknown> {
  const choice = res.choices?.[0]
  if (!choice) throw new PermanentJobError('AI response has no choices')
  if (choice.message?.refusal) throw new PermanentJobError('AI refused the request')
  if (choice.finish_reason === 'length') {
    const saved = salvage?.(choice.message?.content ?? '')
    if (saved) return saved
    throw new PermanentJobError('AI output truncated (max_completion_tokens)')
  }
  if (choice.finish_reason === 'content_filter') throw new PermanentJobError('AI response blocked by content filter')
  return choice.message?.content ?? ''
}

/** المخطط الصارم عند OpenAI يمنع anyOf في الجذر ويوجب required لكل الحقول */
function strictify(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema.type !== 'object') return schema
  const props = (schema.properties ?? {}) as Record<string, Record<string, unknown>>
  return { ...schema, properties: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, strictify(v)])), required: Object.keys(props), additionalProperties: false }
}

export function createOpenAiProvider(opts: Opts): AIProvider {
  const model = opts.model ?? DEFAULT_MODEL
  const baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '')
  const timeoutMs = opts.timeoutMs ?? 60_000
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${opts.apiKey}` }

  async function complete(params: ChatParams, o: { timeoutMs?: number; salvage?: (raw: string) => Record<string, unknown> | null } = {}): Promise<Record<string, unknown>> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), Math.max(timeoutMs, o.timeoutMs ?? 0))
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(params), signal: ctrl.signal }).catch((e: unknown) => {
        throw ctrl.signal.aborted ? new Error('AI timeout') : e
      })
      if (!res.ok) throw httpError(res.status, 'AI', await res.text().catch(() => ''))
      const out = choiceText((await res.json()) as ChatResponse, o.salvage)
      return typeof out === 'string' ? extractJson(out) : out
    } finally {
      clearTimeout(timer)
    }
  }

  const base = (system: string, user: string, maxTokens: number) => ({
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system' as const, content: system },
      { role: 'user' as const, content: user }
    ]
  })

  const jsonParams = (system: string, user: string, maxTokens: number): ChatParams => ({ ...base(system, user, maxTokens), response_format: { type: 'json_object' } })

  const schemaParams = (system: string, user: string, maxTokens: number, name: string, schema: Record<string, unknown>): ChatParams => ({
    ...base(system, user, maxTokens),
    response_format: { type: 'json_schema', json_schema: { name, strict: true, schema: strictify(schema) } }
  })

  return {
    name: 'openai',
    model,

    async evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput> {
      const j = await complete(schemaParams(essaySystem(input.subject), essayUser(input), ESSAY_MAX_TOKENS, 'essay_evaluation', ESSAY_SCHEMA))
      return parseEssay(j, input)
    },

    async generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput> {
      const j = await complete(jsonParams(insightsSystem(input.subject), insightsUser(input), 1000))
      return { summary: text(j.summary, 3000), nextLessonSuggestions: strList(j.next_lesson, 6), raw: j }
    },

    async generateExercises(input: GenerateExercisesInput): Promise<GenerateExercisesOutput> {
      const j = await complete(jsonParams(exercisesSystem(input.subject), exercisesUser(input), exercisesMaxTokens(input.count)), { timeoutMs: exercisesTimeoutMs(input.count), salvage: salvageQuestions })
      return parseExercises(j, input)
    },

    async analyzeStudent(input: AnalyzeStudentInput): Promise<AnalyzeStudentOutput> {
      const j = await complete(jsonParams(analyzeSystem(input.subject), analyzeUser(input), 1200))
      return { summary: text(j.summary, 3000), strengths: strList(j.strengths, 6), weaknesses: strList(j.weaknesses, 6), recommendations: strList(j.recommendations, 6), raw: j }
    },

    async organizeLessons(input: OrganizeLessonsInput): Promise<OrganizeLessonsOutput> {
      const maxTokens = Math.min(8000, 600 + input.items.length * 200)
      return parseOrganize(await complete(schemaParams(organizeSystem(input.subject, input.kind), organizeUser(input), maxTokens, 'organized_lessons', ORGANIZE_SCHEMA)), input)
    },

    async draftFromSource(input: DraftFromSourceInput): Promise<DraftFromSourceOutput> {
      return parseDraft(await complete(schemaParams(draftSystem(input.subject, input.mode), draftUser(input), 6000, 'source_draft', DRAFT_SCHEMA)), input)
    }
  }
}
