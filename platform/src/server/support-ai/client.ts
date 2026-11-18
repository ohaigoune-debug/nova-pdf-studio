/**
 * نداء Claude بالأدوات (Messages API، بلا SDK — fetch فقط، كبقية مزوّدات المنصة).
 * التوثيق الرسمي: POST https://api.anthropic.com/v1/messages ، رأسا x-api-key و anthropic-version: 2023-06-01 ،
 * الأداة {name, description, input_schema}، والنتيجة tool_result في رسالة المستخدم التالية مباشرة.
 * الاستهلاك يُبلَّغ إلى ai_usage_logs (المهمة support_ai) فيُحسب منه الحدّ اليومي للتكلفة.
 */
import { reportAiUsage } from '@/server/ai/usage'

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages'

export interface ToolDef {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export type TextBlock = { type: 'text'; text: string }
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string | ContentBlock[]
}

export interface ClaudeResponse {
  content: (TextBlock | ToolUseBlock | { type: string })[]
  stop_reason: string | null
  usage?: { input_tokens?: number; output_tokens?: number }
}

export interface ClaudeCall {
  apiKey: string
  model: string
  system: string
  tools: ToolDef[]
  messages: ChatMessage[]
  maxTokens?: number
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class ClaudeHttpError extends Error {
  constructor(
    readonly status: number,
    body: string
  ) {
    super(`Anthropic ${status}: ${body.slice(0, 300)}`)
  }
}

export async function callClaude(c: ClaudeCall): Promise<ClaudeResponse> {
  const started = Date.now()
  const f = c.fetchImpl ?? fetch
  let res: Response
  try {
    res = await f(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: c.model, max_tokens: c.maxTokens ?? 1200, system: c.system, tools: c.tools, messages: c.messages }),
      signal: AbortSignal.timeout(c.timeoutMs ?? 60_000)
    })
  } catch (err) {
    reportAiUsage({ provider: 'anthropic', model: c.model, durationMs: Date.now() - started, ok: false, error: err instanceof Error ? err.message : String(err) })
    throw err
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    reportAiUsage({ provider: 'anthropic', model: c.model, durationMs: Date.now() - started, ok: false, error: `HTTP ${res.status}` })
    throw new ClaudeHttpError(res.status, body)
  }
  const msg = (await res.json()) as ClaudeResponse
  reportAiUsage({ provider: 'anthropic', model: c.model, inputTokens: msg.usage?.input_tokens, outputTokens: msg.usage?.output_tokens, durationMs: Date.now() - started, ok: true })
  return msg
}

export function textOf(msg: ClaudeResponse): string {
  return msg.content
    .filter((b): b is TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

export function toolUsesOf(msg: ClaudeResponse): ToolUseBlock[] {
  return msg.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
}
