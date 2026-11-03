/**
 * تصحيح سؤال بطاقة في PLAY — دوال صافية بلا Node تعمل في الخادم والمتصفح.
 * المتصفح يصحّح الجولة فورًا ويرسل الإجابات دفعات (4 نوفمبر 2026)؛ الخادم يعيد التصحيح بمفاتيحه دائمًا.
 */
import type { GradeOutcome, PlayAnswerKey, PlayStudentAnswer } from './question-types'

/** مقارنة دقيقة لكلمات الفراغ: التشكيل مهم (نافعٌ ≠ نافعًا) لذلك لا نستعمل normalizeArabic هنا */
export function exactToken(s: string): string {
  return s.normalize('NFKC').replace(/ـ/g, '').replace(/\s+/g, ' ').trim()
}

/** التصحيح (في الخادم، وفي المتصفح للعرض الفوري) */
export function gradePlayAnswer(key: PlayAnswerKey, answer: PlayStudentAnswer | null | undefined): GradeOutcome {
  if (!answer || answer.type !== key.type) return { isCorrect: false, score: 0 }
  switch (key.type) {
    case 'MCQ': {
      const ok = (answer as { key: string }).key === key.correct
      return { isCorrect: ok, score: ok ? 1 : 0 }
    }
    case 'FILL_BLANK': {
      const given = (answer as { blanks: string[] }).blanks ?? []
      let hit = 0
      key.answers.forEach((alts, i) => {
        const g = exactToken(given[i] ?? '')
        if (g && alts.includes(g)) hit++
      })
      const score = key.answers.length ? hit / key.answers.length : 0
      return { isCorrect: hit === key.answers.length && key.answers.length > 0, score }
    }
    case 'MATCHING': {
      const m = (answer as { matches: Record<string, string> }).matches ?? {}
      const entries = Object.entries(key.pairs)
      const hit = entries.filter(([l, r]) => m[l] === r).length
      return { isCorrect: hit === entries.length, score: entries.length ? hit / entries.length : 0 }
    }
    case 'ORDERING': {
      const o = (answer as { order: string[] }).order ?? []
      const ok = o.length === key.order.length && o.every((k, i) => k === key.order[i])
      // درجة جزئية: نسبة العناصر في موضعها الصحيح
      const hit = key.order.filter((k, i) => o[i] === k).length
      return { isCorrect: ok, score: key.order.length ? hit / key.order.length : 0 }
    }
  }
}
