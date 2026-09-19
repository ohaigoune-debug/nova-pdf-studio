import { PermanentJobError } from '@/server/lib/errors'
import type { AIProvider, AnalyzeStudentInput, AnalyzeStudentOutput, EssayBatchItem, EssayBatchOutcome, EssayBatchStatus, EvaluateEssayInput, EvaluateEssayOutput, GenerateExercisesInput, GenerateExercisesOutput, GeneratedQuestion, TeacherInsightsInput, TeacherInsightsOutput } from './types'

/**
 * مزوّد حقيقي عبر Anthropic Messages API (بلا SDK — fetch فقط).
 * يُفعَّل بـ AI_PROVIDER=anthropic و AI_API_KEY=… و(اختياري) AI_MODEL=…
 * المفتاح يبقى في الخادم. التصحيح يستعمل المخرجات المُهيكلة (JSON مضمون بالمخطط)،
 * والدفعات تمرّ عبر Message Batches بنصف السعر.
 */
const DEFAULT_MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'
const BATCHES_URL = 'https://api.anthropic.com/v1/messages/batches'
const ESSAY_MAX_TOKENS = 4096

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

/** مخطط ردّ التصحيح: الخادم يفرضه فلا يصل JSON مكسور، والحقول كلها إلزامية */
const stringList = { type: 'array', items: { type: 'string' } }
const ESSAY_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    suggested_score: { type: 'number' },
    confidence: { type: 'number' },
    rubric_breakdown: {
      anyOf: [
        {
          type: 'array',
          items: { type: 'object', properties: { item_id: { type: 'string' }, points: { type: 'number' } }, required: ['item_id', 'points'], additionalProperties: false }
        },
        { type: 'null' }
      ]
    },
    strengths: stringList,
    weaknesses: stringList,
    mistakes: stringList,
    skills_detected: stringList,
    skills_to_improve: stringList,
    teacher_notes: { type: 'string' }
  },
  required: ['suggested_score', 'confidence', 'rubric_breakdown', 'strengths', 'weaknesses', 'mistakes', 'skills_detected', 'skills_to_improve', 'teacher_notes'],
  additionalProperties: false
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0) throw new PermanentJobError('AI response is not JSON')
  try {
    return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    throw new PermanentJobError('AI response is not valid JSON')
  }
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

/** 429 والأخطاء الخادمية غير مفوتَرة وتستحق الإعادة؛ 4xx الأخرى خطأ في طلبنا فلا تُعاد */
function httpError(status: number): Error {
  const retryable = status === 408 || status === 409 || status === 429 || status >= 500
  return retryable ? new Error(`AI HTTP ${status}`) : new PermanentJobError(`AI HTTP ${status}`)
}

const strList = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, max) : [])
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback)

export function createAnthropicProvider(opts: Opts): AIProvider {
  const model = opts.model ?? DEFAULT_MODEL
  const timeoutMs = opts.timeoutMs ?? 60_000
  const headers = { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' }

  async function request(url: string, init: RequestInit): Promise<Response> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, { ...init, headers, signal: ctrl.signal })
      if (!res.ok) throw httpError(res.status)
      return res
    } finally {
      clearTimeout(timer)
    }
  }

  async function complete(params: MessageParams): Promise<Record<string, unknown>> {
    const res = await request(API_URL, { method: 'POST', body: JSON.stringify(params) })
    const msg = (await res.json()) as ApiMessage
    assertComplete(msg)
    return extractJson(messageText(msg))
  }

  const textParams = (system: string, user: string, maxTokens: number): MessageParams => ({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })

  function essayParams(input: EvaluateEssayInput): MessageParams {
    const system = [
      'أنت مساعد أستاذ لغة عربية وآدابها في الطور الثانوي بالجزائر. تقيّم إجابة نصية كتبها طالب.',
      'أعد JSON فقط بالحقول: suggested_score (رقم)، confidence (0–1)، rubric_breakdown (قائمة {item_id, points} لكل بند من الشبكة، أو null إن لم توجد شبكة)،',
      'strengths، weaknesses، mistakes، skills_detected، skills_to_improve (قوائم نصوص)، teacher_notes (نص).',
      'القيم كلها بالعربية الفصحى، مختصرة وعملية للأستاذ. لا تتجاوز النقطة القصوى ولا نقاط كل بند.',
      'skills_detected و skills_to_improve تُختار حصراً من قائمة المهارات المعطاة.'
    ].join('\n')
    const rubricText = input.rubric?.length
      ? `شبكة التقييم (item_id | البند | الوصف | النقاط القصوى):\n${input.rubric.map((r) => `${r.id} | ${r.label} | ${r.description ?? ''} | ${r.maxPoints}`).join('\n')}`
      : 'لا توجد شبكة تقييم؛ اقترح علامة إجمالية فقط (rubric_breakdown = null).'
    const user = [
      `عنوان الواجب: ${input.assignmentTitle}`,
      `نص الواجب: ${input.prompt ?? '—'}`,
      `النقطة القصوى: ${input.maxScore}`,
      input.skillName ? `المهارة المستهدفة: ${input.skillName}` : '',
      `المهارات المتاحة: ${input.knownSkills.join('، ')}`,
      rubricText,
      '',
      'إجابة الطالب:',
      '"""',
      input.answerText.slice(0, 12_000),
      '"""'
    ]
      .filter((l) => l !== '')
      .join('\n')
    return { ...textParams(system, user, ESSAY_MAX_TOKENS), output_config: { format: { type: 'json_schema', schema: ESSAY_SCHEMA } } }
  }

  function parseEssay(j: Record<string, unknown>, input: EvaluateEssayInput): EvaluateEssayOutput {
    let rubricBreakdown: Record<string, number> | null = null
    if (Array.isArray(j.rubric_breakdown) && input.rubric?.length) {
      const given = new Map<string, number>()
      for (const row of j.rubric_breakdown as { item_id?: unknown; points?: unknown }[]) if (typeof row?.item_id === 'string') given.set(row.item_id, num(row.points))
      rubricBreakdown = {}
      for (const it of input.rubric) rubricBreakdown[it.id] = Math.max(0, Math.min(it.maxPoints, given.get(it.id) ?? 0))
    }
    const suggested = rubricBreakdown ? Object.values(rubricBreakdown).reduce((s, v) => s + v, 0) : num(j.suggested_score)
    return {
      suggestedScore: Math.max(0, Math.min(input.maxScore, Math.round(suggested * 100) / 100)),
      confidence: Math.max(0, Math.min(1, num(j.confidence, 0.5))),
      rubricBreakdown,
      strengths: strList(j.strengths),
      weaknesses: strList(j.weaknesses),
      mistakes: strList(j.mistakes),
      skillsDetected: strList(j.skills_detected).filter((s) => input.knownSkills.includes(s)),
      skillsToImprove: strList(j.skills_to_improve).filter((s) => input.knownSkills.includes(s)),
      teacherNotesSuggestion: typeof j.teacher_notes === 'string' ? j.teacher_notes.slice(0, 2000) : '',
      raw: j
    }
  }

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
      const text = await (await request(meta.results_url, { method: 'GET' })).text()
      const outcomes: Record<string, EssayBatchOutcome> = {}
      for (const raw of text.split('\n')) {
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
      const system = [
        'أنت مساعد بيداغوجي لأستاذ لغة عربية. تصوغ الحقائق المعطاة (وهي مستخرجة من قاعدة بيانات حقيقية) في ملخص قصير وتوصيات عملية للحصة القادمة.',
        'لا تخترع أرقاماً أو أسماء غير موجودة في الحقائق. أعد JSON فقط: {"summary":string,"next_lesson":string[]}'
      ].join('\n')
      const user = `الأستاذ: ${input.teacherName}\nالحقائق:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- لا توجد حقائق بعد'}`
      const j = await complete(textParams(system, user, 1000))
      return { summary: typeof j.summary === 'string' ? j.summary.slice(0, 3000) : '', nextLessonSuggestions: strList(j.next_lesson, 6), raw: j }
    },
    async generateExercises(input: GenerateExercisesInput): Promise<GenerateExercisesOutput> {
      const system = [
        'أنت أستاذ لغة عربية وآدابها للطور الثانوي بالجزائر. تولّد تمارين علاجية قصيرة لمهارة محددة.',
        'أعد JSON فقط: {"title":string,"description":string,"questions":[{"type":"MCQ"|"TRUE_FALSE"|"SHORT_ANSWER"|"FILL_BLANK","prompt":string,"options":[{"label":string,"isCorrect":boolean}],"answerKey":object|null,"explanation":string}]}',
        'قواعد المفاتيح: MCQ ⇒ options (2–4) مع isCorrect واحد على الأقل وanswerKey=null؛ TRUE_FALSE ⇒ answerKey={"value":boolean}؛ SHORT_ANSWER ⇒ answerKey={"accepted":[إجابات مقبولة قصيرة]}؛ FILL_BLANK ⇒ ضع ___ مكان كل فراغ في prompt وanswerKey={"blanks":[[إجابات الفراغ الأول],…]} بنفس عدد الفراغات.',
        'اللغة فصحى، مستوى بكالوريا، بلا أسئلة غامضة أو مفاتيح متعددة التأويل.'
      ].join('\n')
      const user = `المهارة: ${input.skillName}${input.skillCategory ? ` (${input.skillCategory})` : ''}\nالمستوى: ${input.levelName ?? 'الثانوي'}\nعدد الأسئلة: ${input.count}`
      const j = await complete(textParams(system, user, 2500))
      const qs = Array.isArray(j.questions) ? (j.questions as Record<string, unknown>[]) : []
      const questions: GeneratedQuestion[] = qs
        .filter((q) => typeof q.prompt === 'string' && ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'].includes(String(q.type)))
        .map((q) => ({
          type: q.type as GeneratedQuestion['type'],
          prompt: String(q.prompt).trim(),
          options: Array.isArray(q.options) ? (q.options as { label?: unknown; isCorrect?: unknown }[]).filter((o) => typeof o.label === 'string').map((o) => ({ label: String(o.label), isCorrect: Boolean(o.isCorrect) })) : undefined,
          answerKey: q.answerKey && typeof q.answerKey === 'object' ? (q.answerKey as Record<string, unknown>) : null,
          explanation: typeof q.explanation === 'string' ? q.explanation : undefined
        }))
      return { title: typeof j.title === 'string' ? j.title.slice(0, 200) : `تمارين علاجية: ${input.skillName}`, description: typeof j.description === 'string' ? j.description.slice(0, 1000) : '', questions, raw: j }
    },

    async analyzeStudent(input: AnalyzeStudentInput): Promise<AnalyzeStudentOutput> {
      const system = [
        'أنت مساعد بيداغوجي لأستاذ لغة عربية. تحلّل ملف طالب من حقائق حقيقية مستخرجة من قاعدة البيانات وتقترح توصيات عملية.',
        'لا تخترع أرقاماً أو أحداثاً. أعد JSON فقط: {"summary":string,"strengths":string[],"weaknesses":string[],"recommendations":string[]}'
      ].join('\n')
      const user = `الطالب: ${input.studentName}\nالحقائق:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- لا توجد حقائق بعد'}`
      const j = await complete(textParams(system, user, 1200))
      return { summary: typeof j.summary === 'string' ? j.summary.slice(0, 3000) : '', strengths: strList(j.strengths, 6), weaknesses: strList(j.weaknesses, 6), recommendations: strList(j.recommendations, 6), raw: j }
    }
  }
}
