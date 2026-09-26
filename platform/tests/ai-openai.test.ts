import { afterEach, describe, expect, it, vi } from 'vitest'
import { aiFailureReason } from '@/server/ai/failure'
import { createOpenAiProvider } from '@/server/ai/openai-provider'
import { exercisesMaxTokens, salvageQuestions } from '@/server/ai/shared'
import type { EvaluateEssayInput } from '@/server/ai/types'
import { isPermanentJobError } from '@/server/lib/errors'

const input: EvaluateEssayInput = {
  assignmentTitle: 'تحليل نص',
  prompt: 'حلّل النص',
  answerText: 'إجابة الطالب',
  maxScore: 20,
  rubric: [{ id: 'r1', label: 'الفهم', description: null, maxPoints: 12, skillName: null }],
  skillName: null,
  knownSkills: ['تحليل النصوص', 'البلاغة']
}

const original = globalThis.fetch
afterEach(() => {
  globalThis.fetch = original
})

function mockFetch(body: unknown, status = 200) {
  const fn = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response
  )
  globalThis.fetch = fn as unknown as typeof fetch
  return fn
}

const chat = (content: string, finish = 'stop') => ({ choices: [{ message: { content }, finish_reason: finish }] })

describe('مزوّد OpenAI', () => {
  it('يرسل مخططاً صارماً ويقرأ النتيجة ضمن حدود الشبكة', async () => {
    const fn = mockFetch(
      chat(
        JSON.stringify({
          suggested_score: 99,
          confidence: 0.8,
          rubric_breakdown: [{ item_id: 'r1', points: 50 }],
          strengths: ['وضوح'],
          weaknesses: [],
          mistakes: [],
          skills_detected: ['البلاغة', 'مهارة مخترعة'],
          skills_to_improve: [],
          teacher_notes: 'ملاحظة'
        })
      )
    )
    const out = await createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input)
    // نقاط البند لا تتجاوز سقفه، والمجموع لا يتجاوز النقطة القصوى
    expect(out.rubricBreakdown).toEqual({ r1: 12 })
    expect(out.suggestedScore).toBe(12)
    // مهارة خارج القائمة تُسقط بدل أن تُعرض للأستاذ
    expect(out.skillsDetected).toEqual(['البلاغة'])

    const body = JSON.parse(String(fn.mock.calls[0]![1]!.body))
    expect(body.response_format.json_schema.strict).toBe(true)
    expect(body.response_format.json_schema.schema.required).toContain('suggested_score')
    expect(String(fn.mock.calls[0]![0])).toBe('https://api.openai.com/v1/chat/completions')
  })

  it('الرفض والبتر خطآن دائمان: إعادتهما تُفوتر بلا فائدة', async () => {
    mockFetch({ choices: [{ message: { refusal: 'no' }, finish_reason: 'stop' }] })
    await expect(createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input)).rejects.toSatisfy(isPermanentJobError)

    mockFetch(chat('{"suggested_score":1', 'length'))
    await expect(createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input)).rejects.toSatisfy(isPermanentJobError)
  })

  it('429 يُعاد و400 لا يُعاد', async () => {
    mockFetch({}, 429)
    await expect(createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input)).rejects.toSatisfy((e) => !isPermanentJobError(e))

    mockFetch({}, 400)
    await expect(createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input)).rejects.toSatisfy(isPermanentJobError)
  })

  it('خادم متوافق آخر: AI_BASE_URL يُحترم', async () => {
    const fn = mockFetch(chat(JSON.stringify({ summary: 'ملخص', next_lesson: ['اقتراح'] })))
    const out = await createOpenAiProvider({ apiKey: 'k', baseUrl: 'https://llm.example.com/v1/' }).generateTeacherInsights({ teacherName: 'أسامة', facts: ['حقيقة'] })
    expect(out.summary).toBe('ملخص')
    expect(String(fn.mock.calls[0]![0])).toBe('https://llm.example.com/v1/chat/completions')
  })

  it('تنظيم الدروس: يعيد كل فيديوهات القائمة مرقّمة', async () => {
    mockFetch(
      chat(
        JSON.stringify({
          lessons: [
            { youtube_id: 'bbbbbbbbbbb', title: 'ب', summary: 's', topic: 'محور', order: 1 },
            { youtube_id: 'aaaaaaaaaaa', title: 'أ', summary: 's', topic: null, order: 2 }
          ]
        })
      )
    )
    const out = await createOpenAiProvider({ apiKey: 'k' }).organizeLessons!({
      playlistTitle: 'دروس البكالوريا',
      levelName: 'الثالثة ثانوي',
      streamName: null,
      items: [
        { youtubeId: 'aaaaaaaaaaa', title: 'الأول', description: null },
        { youtubeId: 'bbbbbbbbbbb', title: 'الثاني', description: null }
      ]
    })
    expect(out.lessons.map((l) => [l.youtubeId, l.order])).toEqual([
      ['bbbbbbbbbbb', 1],
      ['aaaaaaaaaaa', 2]
    ])
  })

  it('توليد الأسئلة: سقف الإخراج يتسع مع العدد، والردّ المبتور تُستنقذ أسئلته المكتملة', async () => {
    expect(exercisesMaxTokens(20)).toBeGreaterThan(exercisesMaxTokens(5))
    expect(exercisesMaxTokens(20)).toBeGreaterThanOrEqual(10_000)
    const q = (i: number) => JSON.stringify({ type: 'TRUE_FALSE', prompt: `عبارة \"${i}\" {}`, options: [], answerKey: { value: true }, explanation: 'من الدرس' })
    const cut = `{"title":"اختبار \\"الاستعارة\\"","description":"وصف","questions":[${q(1)},${q(2)},{"type":"MCQ","prompt":"سؤال لم يكتمل`
    const fn = mockFetch(chat(cut, 'length'))
    const out = await createOpenAiProvider({ apiKey: 'k' }).generateExercises({ skillName: 'الاستعارة', skillCategory: null, levelName: null, count: 20, sources: [{ title: 'درس', text: 'نص' }] })
    expect(out.questions.map((x) => x.prompt)).toEqual(['عبارة "1" {}', 'عبارة "2" {}'])
    expect(out.title).toBe('اختبار "الاستعارة"')
    expect(JSON.parse(String(fn.mock.calls[0]![1]!.body)).max_completion_tokens).toBe(exercisesMaxTokens(20))
    // لا شيء مكتمل ⇒ خطأ دائم كما كان
    mockFetch(chat('{"title":"x","questions":[{"type":"MCQ","prompt":"نصف', 'length'))
    await expect(createOpenAiProvider({ apiKey: 'k' }).generateExercises({ skillName: 's', skillCategory: null, levelName: null, count: 5, sources: [] })).rejects.toSatisfy(isPermanentJobError)
    expect(salvageQuestions('لا JSON هنا')).toBeNull()
  })

  it('429 برصيد منتهٍ دائم لا يُعاد، وسبب الفشل يُشرح للأستاذ', async () => {
    const fn = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}), text: async () => '{"error":{"code":"insufficient_quota"}}' }) as unknown as Response)
    globalThis.fetch = fn as unknown as typeof fetch
    const err = await createOpenAiProvider({ apiKey: 'k' }).evaluateEssay(input).catch((e: unknown) => e)
    expect(isPermanentJobError(err)).toBe(true)
    expect(aiFailureReason(err)).toContain('رصيد')
    expect(aiFailureReason(new Error('AI HTTP 401'))).toContain('مفتاح')
    expect(aiFailureReason(new Error('AI timeout'))).toContain('مهلة')
    expect(aiFailureReason(new Error('AI output truncated (max_completion_tokens)'))).toContain('عدد الأسئلة')
  })
})
