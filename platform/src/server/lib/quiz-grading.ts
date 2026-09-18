import { normalizeArabic } from './arabic'

/** مفاتيح الإجابة حسب النوع */
export type AnswerKey =
  | { kind: 'TRUE_FALSE'; value: boolean }
  | { kind: 'SHORT_ANSWER'; accepted: string[] }
  | { kind: 'FILL_BLANK'; blanks: string[][] }
  | { kind: 'MATCHING'; pairs: { left: string; right: string }[] }
  | { kind: 'NONE' }

/** إجابة الطالب كما تُرسل من الواجهة */
export interface StudentAnswer {
  questionId: string
  optionIds?: string[]
  value?: boolean
  text?: string
  blanks?: string[]
  /** فهرس اليسار → فهرس اليمين (بعد الخلط يُرسل الفهرس الأصلي) */
  matches?: Record<string, number>
}

export interface GradableQuestion {
  id: string
  type: string
  points: number
  answerKey: Record<string, unknown> | null
  options: { id: string; isCorrect: boolean }[]
}

export interface GradeResult {
  score: number | null
  isCorrect: boolean | null
  needsReview: boolean
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function gradeAnswer(q: GradableQuestion, a: StudentAnswer | undefined): GradeResult {
  const key = (q.answerKey ?? {}) as Record<string, unknown>
  switch (q.type) {
    case 'MCQ':
    case 'IMAGE': {
      if (q.options.length === 0) {
        if (Array.isArray(key.accepted)) return gradeShort(q, a, key.accepted as string[])
        return { score: null, isCorrect: null, needsReview: true }
      }
      const correct = new Set(q.options.filter((o) => o.isCorrect).map((o) => o.id))
      const chosen = new Set(a?.optionIds ?? [])
      const ok = correct.size === chosen.size && [...correct].every((id) => chosen.has(id))
      return { score: ok ? q.points : 0, isCorrect: ok, needsReview: false }
    }
    case 'TRUE_FALSE': {
      const ok = typeof a?.value === 'boolean' && a.value === Boolean(key.value)
      return { score: ok ? q.points : 0, isCorrect: ok, needsReview: false }
    }
    case 'SHORT_ANSWER':
      return gradeShort(q, a, Array.isArray(key.accepted) ? (key.accepted as string[]) : [])
    case 'FILL_BLANK': {
      const blanks = Array.isArray(key.blanks) ? (key.blanks as string[][]) : []
      if (blanks.length === 0) return { score: 0, isCorrect: false, needsReview: false }
      let hit = 0
      blanks.forEach((accepted, i) => {
        const given = a?.blanks?.[i] ?? ''
        if (given && accepted.some((x) => normalizeArabic(x) === normalizeArabic(given))) hit++
      })
      const score = round2((hit / blanks.length) * q.points)
      return { score, isCorrect: hit === blanks.length, needsReview: false }
    }
    case 'MATCHING': {
      const pairs = Array.isArray(key.pairs) ? (key.pairs as { left: string; right: string }[]) : []
      if (pairs.length === 0) return { score: 0, isCorrect: false, needsReview: false }
      let hit = 0
      pairs.forEach((_, i) => {
        if (a?.matches?.[String(i)] === i) hit++
      })
      const score = round2((hit / pairs.length) * q.points)
      return { score, isCorrect: hit === pairs.length, needsReview: false }
    }
    case 'LONG_ANSWER':
    default:
      return { score: null, isCorrect: null, needsReview: true }
  }
}

function gradeShort(q: GradableQuestion, a: StudentAnswer | undefined, accepted: string[]): GradeResult {
  const given = a?.text?.trim() ?? ''
  if (!given || accepted.length === 0) return { score: 0, isCorrect: false, needsReview: false }
  const ok = accepted.some((x) => normalizeArabic(x) === normalizeArabic(given))
  return { score: ok ? q.points : 0, isCorrect: ok, needsReview: false }
}

/** يجمع نتائج الأسئلة: المجموع الآلي + هل توجد أسئلة تنتظر المراجعة */
export function summarize(results: GradeResult[]): { autoScore: number; needsReview: boolean } {
  return {
    autoScore: round2(results.reduce((s, r) => s + (r.score ?? 0), 0)),
    needsReview: results.some((r) => r.needsReview)
  }
}

/** تحقق من صحة مفتاح الإجابة عند حفظ السؤال */
export function validateQuestion(q: { type: string; prompt: string; points: number; answerKey: Record<string, unknown> | null; options: { label: string; isCorrect: boolean }[] }): string | null {
  if (!q.prompt.trim()) return 'نص السؤال مطلوب'
  if (!(q.points > 0)) return 'النقاط يجب أن تكون موجبة'
  const key = q.answerKey ?? {}
  switch (q.type) {
    case 'MCQ':
      if (q.options.length < 2) return 'أضف اختيارين على الأقل'
      if (!q.options.some((o) => o.isCorrect)) return 'حدّد الاختيار الصحيح'
      if (q.options.some((o) => !o.label.trim())) return 'كل اختيار يحتاج نصاً'
      return null
    case 'IMAGE':
      if (q.options.length > 0 && !q.options.some((o) => o.isCorrect)) return 'حدّد الاختيار الصحيح'
      return null
    case 'TRUE_FALSE':
      if (typeof key.value !== 'boolean') return 'حدّد الإجابة الصحيحة (صحيح/خطأ)'
      return null
    case 'SHORT_ANSWER':
      if (!Array.isArray(key.accepted) || (key.accepted as string[]).filter((x) => x.trim()).length === 0) return 'أدخل إجابة مقبولة واحدة على الأقل'
      return null
    case 'FILL_BLANK': {
      const n = (q.prompt.match(/___/g) ?? []).length
      const blanks = Array.isArray(key.blanks) ? (key.blanks as string[][]) : []
      if (n === 0) return 'ضع ___ مكان الفراغ في نص السؤال'
      if (blanks.length !== n) return `عدد إجابات الفراغات (${blanks.length}) لا يطابق عدد الفراغات (${n})`
      return null
    }
    case 'MATCHING': {
      const pairs = Array.isArray(key.pairs) ? (key.pairs as { left: string; right: string }[]) : []
      if (pairs.length < 2) return 'أضف زوجين للمطابقة على الأقل'
      return null
    }
    case 'LONG_ANSWER':
      return null
    default:
      return 'نوع سؤال غير معروف'
  }
}
