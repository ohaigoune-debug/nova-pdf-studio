/**
 * تصحيح خطوة في مواضيع PLAY — دوال صافية بلا Node، تعمل في الخادم وفي المتصفح.
 * المتصفح يصحّح التدريب فورًا (كتطبيق الآيفون) ويرسل الإجابات دفعة واحدة؛ الخادم يعيد التصحيح بمفاتيحه دائمًا.
 */
import { normalizeArabic } from '@/server/lib/arabic'
import type { StepAnswer, StepAnswerKey, StepPayload, TrainingStep } from './types'

/** هامش المقارنة العددية للأوزان */
export const WEIGHT_EPSILON = 1e-6

export const norm = (s: string) => normalizeArabic(s).replace(/\s+/g, ' ').trim()
/** مقارنة حرفية (مع التشكيل والرموز): الإعراب والعروض يختلفان بالحركات وحدها */
export const exact = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()

/** درجة الخطوة من 0 إلى 1 (جزئية للأنواع المركّبة). إجابة من نوع آخر أو ناقصة = 0. */
export function gradeStep(key: StepAnswerKey, answer: StepAnswer | null | undefined, payload?: StepPayload): number {
  if (!answer || answer.type !== key.type) return 0
  switch (key.type) {
    case 'mcq':
      return answer.type === 'mcq' && answer.choice === key.correct ? 1 : 0
    case 'portrait':
      return answer.type === 'portrait' && answer.choice === key.correct ? 1 : 0
    case 'multi': {
      if (answer.type !== 'multi') return 0
      const want = new Set(key.correct)
      const got = new Set(answer.choices)
      let hit = 0
      let wrong = 0
      for (const c of got) {
        if (want.has(c)) hit++
        else wrong++
      }
      return Math.max(0, Math.min(1, (hit - wrong) / Math.max(1, want.size)))
    }
    case 'fill_blank': {
      if (answer.type !== 'fill_blank') return 0
      // الإجابة من بنك الكلمات: مطابقة حرفية؛ والتسامح (دون تشكيل) فقط إن لم يكن في البنك كلمتان تختلفان بالتشكيل وحده
      const bank = payload?.type === 'fill_blank' ? payload.bank : []
      const strict = new Set(bank.map(norm)).size !== bank.length
      let ok = 0
      key.blanks.forEach((alts, i) => {
        const v = answer.blanks[i]
        if (typeof v === 'string' && alts.some((a) => exact(a) === exact(v) || (!strict && norm(a) === norm(v)))) ok++
      })
      return ok / Math.max(1, key.blanks.length)
    }
    case 'ordering': {
      if (answer.type !== 'ordering' || answer.order.length !== key.order.length) return 0
      let ok = 0
      key.order.forEach((v, i) => {
        if (answer.order[i] === v) ok++
      })
      return ok / Math.max(1, key.order.length)
    }
    case 'matching': {
      if (answer.type !== 'matching' || answer.pairs.length !== key.pairs.length) return 0
      let ok = 0
      key.pairs.forEach((v, i) => {
        if (answer.pairs[i] === v) ok++
      })
      return ok / Math.max(1, key.pairs.length)
    }
    case 'numeric':
      return answer.type === 'numeric' && Number.isFinite(answer.value) && Math.abs(answer.value - key.value) <= key.tolerance + WEIGHT_EPSILON ? 1 : 0
    case 'short_text':
      return answer.type === 'short_text' && key.accepted.some((a) => norm(a) === norm(answer.text)) ? 1 : 0
    default:
      return 0
  }
}

/** نص الإجابة الصحيحة للعرض بعد المحاولة */
export function answerText(step: Pick<TrainingStep, 'payload' | 'answer'>): string {
  const k = step.answer
  const p = step.payload
  switch (k.type) {
    case 'mcq':
    case 'portrait':
      return 'options' in p ? (p.options[k.correct] ?? '') : ''
    case 'multi':
      return 'options' in p ? k.correct.map((i) => p.options[i]).join(' ، ') : ''
    case 'fill_blank':
      return k.blanks.map((b) => b[0]).join(' ، ')
    case 'ordering':
      return 'items' in p ? k.order.map((i) => p.items[i]).join(' ← ') : ''
    case 'matching':
      return 'lefts' in p ? p.lefts.map((l, i) => `${l} ← ${p.rights[k.pairs[i]!] ?? ''}`).join(' | ') : ''
    case 'numeric':
      return `${k.value}${k.unit ? ` ${k.unit}` : ''}`
    case 'short_text':
      return k.accepted[0] ?? ''
    default:
      return ''
  }
}

/** إجابة التلميذ نصًّا (للتغذية الراجعة وصفحة النتيجة) */
export function studentAnswerText(step: Pick<TrainingStep, 'payload'>, a: StepAnswer | null | undefined): string {
  if (!a) return '—'
  const p = step.payload
  switch (a.type) {
    case 'mcq':
    case 'portrait':
      return 'options' in p ? (p.options[a.choice] ?? '—') : '—'
    case 'multi':
      return 'options' in p ? a.choices.map((i) => p.options[i]).filter(Boolean).join(' ، ') || '—' : '—'
    case 'fill_blank':
      return a.blanks.join(' ، ') || '—'
    case 'ordering':
      return 'items' in p ? a.order.map((i) => p.items[i]).join(' ← ') : '—'
    case 'matching':
      return 'lefts' in p ? p.lefts.map((l, i) => `${l} ← ${p.rights[a.pairs[i]!] ?? '؟'}`).join(' | ') : '—'
    case 'numeric':
      return String(a.value)
    case 'short_text':
      return a.text || '—'
  }
}
