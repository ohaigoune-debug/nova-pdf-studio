import type { AIProvider, AnalyzeStudentInput, AnalyzeStudentOutput, EvaluateEssayInput, EvaluateEssayOutput, GenerateExercisesInput, GenerateExercisesOutput, GeneratedQuestion, TeacherInsightsInput, TeacherInsightsOutput } from './types'

/**
 * مزوّد حقيقي عبر Anthropic Messages API (بلا SDK — fetch فقط).
 * يُفعَّل بـ AI_PROVIDER=anthropic و AI_API_KEY=… و(اختياري) AI_MODEL=…
 * المفتاح يبقى في الخادم؛ الرد يُفرض عليه شكل JSON ويُتحقق منه قبل التخزين.
 */
const DEFAULT_MODEL = 'claude-sonnet-5'
const API_URL = 'https://api.anthropic.com/v1/messages'

interface Opts {
  apiKey: string
  model?: string
  timeoutMs?: number
}

function extractJson(text: string): Record<string, unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced?.[1] ?? text).trim()
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end < 0) throw new Error('AI response is not JSON')
  return JSON.parse(candidate.slice(start, end + 1)) as Record<string, unknown>
}

const strList = (v: unknown, max = 8): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').map((s) => s.trim()).filter(Boolean).slice(0, max) : [])
const num = (v: unknown, fallback = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback)

export function createAnthropicProvider(opts: Opts): AIProvider {
  const model = opts.model ?? DEFAULT_MODEL
  const timeoutMs = opts.timeoutMs ?? 60_000

  async function complete(system: string, user: string, maxTokens = 1500): Promise<Record<string, unknown>> {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', 'x-api-key': opts.apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
      })
      if (!res.ok) throw new Error(`AI HTTP ${res.status}`)
      const data = (await res.json()) as { content?: { type: string; text?: string }[] }
      const text = (data.content ?? []).filter((c) => c.type === 'text').map((c) => c.text ?? '').join('\n')
      return extractJson(text)
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    name: 'anthropic',
    model,
    async evaluateEssay(input: EvaluateEssayInput): Promise<EvaluateEssayOutput> {
      const system = [
        'أنت مساعد أستاذ لغة عربية وآدابها في الطور الثانوي بالجزائر. تقيّم إجابة نصية كتبها طالب.',
        'أعد JSON فقط بلا أي نص آخر بالحقول:',
        '{"suggested_score":number,"confidence":number(0-1),"rubric_breakdown":{"<item_id>":number}|null,"strengths":string[],"weaknesses":string[],"mistakes":string[],"skills_detected":string[],"skills_to_improve":string[],"teacher_notes":string}',
        'القيم كلها بالعربية الفصحى، مختصرة وعملية للأستاذ. لا تتجاوز النقطة القصوى ولا نقاط كل بند.',
        'skills_detected و skills_to_improve تُختار حصراً من قائمة المهارات المعطاة.'
      ].join('\n')
      const rubricText = input.rubric?.length
        ? `شبكة التقييم (id | البند | الوصف | النقاط القصوى):\n${input.rubric.map((r) => `${r.id} | ${r.label} | ${r.description ?? ''} | ${r.maxPoints}`).join('\n')}`
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
      const j = await complete(system, user)
      const breakdownRaw = j.rubric_breakdown
      let rubricBreakdown: Record<string, number> | null = null
      if (breakdownRaw && typeof breakdownRaw === 'object' && input.rubric?.length) {
        rubricBreakdown = {}
        for (const it of input.rubric) rubricBreakdown[it.id] = Math.max(0, Math.min(it.maxPoints, num((breakdownRaw as Record<string, unknown>)[it.id])))
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
    },

    async generateTeacherInsights(input: TeacherInsightsInput): Promise<TeacherInsightsOutput> {
      const system = [
        'أنت مساعد بيداغوجي لأستاذ لغة عربية. تصوغ الحقائق المعطاة (وهي مستخرجة من قاعدة بيانات حقيقية) في ملخص قصير وتوصيات عملية للحصة القادمة.',
        'لا تخترع أرقاماً أو أسماء غير موجودة في الحقائق. أعد JSON فقط: {"summary":string,"next_lesson":string[]}'
      ].join('\n')
      const user = `الأستاذ: ${input.teacherName}\nالحقائق:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- لا توجد حقائق بعد'}`
      const j = await complete(system, user, 1000)
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
      const j = await complete(system, user, 2500)
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
      const j = await complete(system, user, 1200)
      return { summary: typeof j.summary === 'string' ? j.summary.slice(0, 3000) : '', strengths: strList(j.strengths, 6), weaknesses: strList(j.weaknesses, 6), recommendations: strList(j.recommendations, 6), raw: j }
    }
  }
}
