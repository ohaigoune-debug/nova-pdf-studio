/**
 * ما يشترك فيه المزوّدون الحقيقيون: المخططات، التعليمات، وقراءة الردّ.
 * سببه أن كل مزوّد جديد كان سينسخ التعليمات فتتفرّق الصياغة بين النماذج
 * وتختلف النتيجة على الأستاذ حسب المزوّد المفعّل.
 */
import { PermanentJobError } from '@/server/lib/errors'
import type {
  AnalyzeStudentInput,
  EvaluateEssayInput,
  EvaluateEssayOutput,
  GenerateExercisesInput,
  GenerateExercisesOutput,
  GeneratedQuestion,
  OrganizeLessonsInput,
  OrganizeLessonsOutput,
  TeacherInsightsInput
} from './types'

export const ESSAY_MAX_TOKENS = 4096

const stringList = { type: 'array', items: { type: 'string' } }

/** مخطط ردّ التصحيح: الخادم يفرضه فلا يصل JSON مكسور، والحقول كلها إلزامية */
export const ESSAY_SCHEMA: Record<string, unknown> = {
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

export const ORGANIZE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    lessons: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          youtube_id: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          topic: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          order: { type: 'number' }
        },
        required: ['youtube_id', 'title', 'summary', 'topic', 'order'],
        additionalProperties: false
      }
    }
  },
  required: ['lessons'],
  additionalProperties: false
}

export function extractJson(text: string): Record<string, unknown> {
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

/** 429 والأخطاء الخادمية غير مفوتَرة وتستحق الإعادة؛ 4xx الأخرى خطأ في طلبنا فلا تُعاد */
export function httpError(status: number, label = 'AI'): Error {
  const retryable = status === 408 || status === 409 || status === 429 || status >= 500
  return retryable ? new Error(`${label} HTTP ${status}`) : new PermanentJobError(`${label} HTTP ${status}`)
}

export const strList = (v: unknown, max = 8): string[] =>
  Array.isArray(v)
    ? v
        .filter((x): x is string => typeof x === 'string')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, max)
    : []

export const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback

export const text = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// ── التعليمات ────────────────────────────────────────────────────────────

export const ESSAY_SYSTEM = [
  'أنت مساعد أستاذ لغة عربية وآدابها في الطور الثانوي بالجزائر. تقيّم إجابة نصية كتبها طالب.',
  'أعد JSON فقط بالحقول: suggested_score (رقم)، confidence (0–1)، rubric_breakdown (قائمة {item_id, points} لكل بند من الشبكة، أو null إن لم توجد شبكة)،',
  'strengths، weaknesses، mistakes، skills_detected، skills_to_improve (قوائم نصوص)، teacher_notes (نص).',
  'القيم كلها بالعربية الفصحى، مختصرة وعملية للأستاذ. لا تتجاوز النقطة القصوى ولا نقاط كل بند.',
  'skills_detected و skills_to_improve تُختار حصراً من قائمة المهارات المعطاة.'
].join('\n')

export function essayUser(input: EvaluateEssayInput): string {
  const rubricText = input.rubric?.length
    ? `شبكة التقييم (item_id | البند | الوصف | النقاط القصوى):\n${input.rubric.map((r) => `${r.id} | ${r.label} | ${r.description ?? ''} | ${r.maxPoints}`).join('\n')}`
    : 'لا توجد شبكة تقييم؛ اقترح علامة إجمالية فقط (rubric_breakdown = null).'
  return [
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
}

export function parseEssay(j: Record<string, unknown>, input: EvaluateEssayInput): EvaluateEssayOutput {
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
    teacherNotesSuggestion: text(j.teacher_notes, 2000),
    raw: j
  }
}

export const INSIGHTS_SYSTEM = [
  'أنت مساعد بيداغوجي لأستاذ لغة عربية. تصوغ الحقائق المعطاة (وهي مستخرجة من قاعدة بيانات حقيقية) في ملخص قصير وتوصيات عملية للحصة القادمة.',
  'لا تخترع أرقاماً أو أسماء غير موجودة في الحقائق. أعد JSON فقط: {"summary":string,"next_lesson":string[]}'
].join('\n')

export const insightsUser = (input: TeacherInsightsInput): string =>
  `الأستاذ: ${input.teacherName}\nالحقائق:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- لا توجد حقائق بعد'}`

export const EXERCISES_SYSTEM = [
  'أنت أستاذ لغة عربية وآدابها للطور الثانوي بالجزائر. تولّد تمارين علاجية قصيرة لمهارة محددة.',
  'أعد JSON فقط: {"title":string,"description":string,"questions":[{"type":"MCQ"|"TRUE_FALSE"|"SHORT_ANSWER"|"FILL_BLANK","prompt":string,"options":[{"label":string,"isCorrect":boolean}],"answerKey":object|null,"explanation":string}]}',
  'قواعد المفاتيح: MCQ ⇒ options (2–4) مع isCorrect واحد على الأقل وanswerKey=null؛ TRUE_FALSE ⇒ answerKey={"value":boolean}؛ SHORT_ANSWER ⇒ answerKey={"accepted":[إجابات مقبولة قصيرة]}؛ FILL_BLANK ⇒ ضع ___ مكان كل فراغ في prompt وanswerKey={"blanks":[[إجابات الفراغ الأول],…]} بنفس عدد الفراغات.',
  'اللغة فصحى، مستوى بكالوريا، بلا أسئلة غامضة أو مفاتيح متعددة التأويل.'
].join('\n')

export const exercisesUser = (input: GenerateExercisesInput): string =>
  `المهارة: ${input.skillName}${input.skillCategory ? ` (${input.skillCategory})` : ''}\nالمستوى: ${input.levelName ?? 'الثانوي'}\nعدد الأسئلة: ${input.count}`

export function parseExercises(j: Record<string, unknown>, input: GenerateExercisesInput): GenerateExercisesOutput {
  const qs = Array.isArray(j.questions) ? (j.questions as Record<string, unknown>[]) : []
  const questions: GeneratedQuestion[] = qs
    .filter((q) => typeof q.prompt === 'string' && ['MCQ', 'TRUE_FALSE', 'SHORT_ANSWER', 'FILL_BLANK'].includes(String(q.type)))
    .map((q) => ({
      type: q.type as GeneratedQuestion['type'],
      prompt: String(q.prompt).trim(),
      options: Array.isArray(q.options)
        ? (q.options as { label?: unknown; isCorrect?: unknown }[]).filter((o) => typeof o.label === 'string').map((o) => ({ label: String(o.label), isCorrect: Boolean(o.isCorrect) }))
        : undefined,
      answerKey: q.answerKey && typeof q.answerKey === 'object' ? (q.answerKey as Record<string, unknown>) : null,
      explanation: typeof q.explanation === 'string' ? q.explanation : undefined
    }))
  return { title: text(j.title, 200) || `تمارين علاجية: ${input.skillName}`, description: text(j.description, 1000), questions, raw: j }
}

export const ANALYZE_SYSTEM = [
  'أنت مساعد بيداغوجي لأستاذ لغة عربية. تحلّل ملف طالب من حقائق حقيقية مستخرجة من قاعدة البيانات وتقترح توصيات عملية.',
  'لا تخترع أرقاماً أو أحداثاً. أعد JSON فقط: {"summary":string,"strengths":string[],"weaknesses":string[],"recommendations":string[]}'
].join('\n')

export const analyzeUser = (input: AnalyzeStudentInput): string =>
  `الطالب: ${input.studentName}\nالحقائق:\n${input.facts.map((f) => `- ${f}`).join('\n') || '- لا توجد حقائق بعد'}`

export const ORGANIZE_SYSTEM = [
  'أنت أستاذ لغة عربية وآدابها بالجزائر تنظّم قائمة فيديوهات يوتيوب لتصبح دروساً في منصة تعليمية.',
  'لكل فيديو: عنوان عربي فصيح نظيف (بلا "الحلقة 12" ولا اسم القناة ولا رموز ولا وسوم)، ملخّص سطرين يذكر ما يتعلّمه الطالب،',
  'المحور (الوحدة التعليمية) أو null إن لم يتّضح، وترتيب بيداغوجي يبدأ من 1 بحيث يسبق الأساسُ المتفرّعَ عنه.',
  'أعد JSON فقط: {"lessons":[{"youtube_id":string,"title":string,"summary":string,"topic":string|null,"order":number}]}',
  'أعد كل الفيديوهات المعطاة بلا حذف ولا إضافة، وانسخ youtube_id كما هو حرفاً بحرف. لا تخترع محتوى لا يدلّ عليه العنوان أو الوصف.'
].join('\n')

export function organizeUser(input: OrganizeLessonsInput): string {
  const head = [
    input.playlistTitle ? `قائمة التشغيل: ${input.playlistTitle}` : '',
    input.levelName ? `المستوى: ${input.levelName}` : '',
    input.streamName ? `الشعبة: ${input.streamName}` : ''
  ].filter(Boolean)
  const items = input.items.map((i, n) => `${n + 1}. [${i.youtubeId}] ${i.title}${i.description ? `\n   الوصف: ${i.description.slice(0, 300)}` : ''}`)
  return [...head, '', 'الفيديوهات بترتيب القائمة:', ...items].join('\n')
}

/** يحرس المخرجات: المعرّفات من القائمة فقط، والترتيب متتالٍ بلا تكرار */
export function parseOrganize(j: Record<string, unknown>, input: OrganizeLessonsInput): OrganizeLessonsOutput {
  const byId = new Map(input.items.map((i) => [i.youtubeId, i]))
  const rows = Array.isArray(j.lessons) ? (j.lessons as Record<string, unknown>[]) : []
  const seen = new Set<string>()
  const kept: { r: Record<string, unknown>; id: string }[] = []
  for (const r of rows) {
    const id = typeof r.youtube_id === 'string' ? r.youtube_id.trim() : ''
    if (!byId.has(id) || seen.has(id)) continue
    seen.add(id)
    kept.push({ r, id })
  }
  const picked = kept
    .sort((a, b) => num(a.r.order, 1e9) - num(b.r.order, 1e9))
    .map(({ r, id }, i) => ({
      youtubeId: id,
      title: text(r.title, 200) || byId.get(id)!.title,
      summary: text(r.summary, 600),
      topic: text(r.topic, 120) || null,
      order: i + 1
    }))
  // ما أسقطه النموذج يُلحق بترتيب القائمة الأصلي: لا يضيع درس
  const missing = input.items.filter((i) => !seen.has(i.youtubeId))
  const lessons = [...picked, ...missing.map((i, n) => ({ youtubeId: i.youtubeId, title: i.title, summary: '', topic: null, order: picked.length + n + 1 }))]
  return { lessons, raw: j }
}
