/**
 * لعبة البطاقات — منطق حالة البطاقة (بلا React ولا DOM) حتى يُختبر وحده.
 *
 * covered → flipping → question → answered → next → (السؤال التالي) covered
 * مع الحركة المخفّضة: covered → question مباشرة.
 *
 * لا يعرف هذا الملف شيئًا عن التصحيح: الخادم وحده يصحّح ويسجّل (submitPlayAnswer).
 */
import type { PlayPublicPayload, PlayStudentAnswer } from '@/server/play/question-types'

export type CardPhase = 'covered' | 'flipping' | 'question' | 'answered' | 'next'

export interface CardState {
  /** السؤال الذي تعرضه البطاقة */
  questionId: string | null
  phase: CardPhase
  /** إرسال جارٍ إلى الخادم: لا يُقبل إرسال ثانٍ حتى يعود الرد */
  submitting: boolean
}

export type CardEvent =
  /** بطاقة جديدة لسؤال (أو استئناف سؤال مُجاب من قبل) */
  | { type: 'LOAD'; questionId: string; answered?: boolean }
  /** لمس البطاقة أو Enter/Space */
  | { type: 'REVEAL'; reducedMotion: boolean }
  /** انتهاء حركة القلب (transitionend أو المهلة الاحتياطية) */
  | { type: 'FLIP_END' }
  | { type: 'SUBMIT' }
  | { type: 'SUBMIT_OK' }
  | { type: 'SUBMIT_FAIL' }
  | { type: 'NEXT' }

/** مدة القلب (ضمن 550–650ms المطلوبة) */
export const FLIP_MS = 600
/** مهلة احتياطية إن لم يصل transitionend (تبويب في الخلفية، متصفح قديم) */
export const FLIP_FALLBACK_MS = FLIP_MS + 150
/** خروج البطاقة قبل ظهور التالية */
export const LEAVE_MS = 220
/** تمدد وجه السؤال الطويل بعد القلب */
export const GROW_MS = 240

export function initialCardState(questionId: string | null, answered = false): CardState {
  return { questionId, phase: answered ? 'answered' : 'covered', submitting: false }
}

export function cardReducer(state: CardState, event: CardEvent): CardState {
  switch (event.type) {
    case 'LOAD':
      if (event.questionId === state.questionId && state.phase !== 'next') {
        // الخادم يؤكد أن السؤال مُجاب (رد ضاع بعد التسجيل ثم حُدّثت الصفحة): تُعرض نتيجته ولا يُعاد إرساله
        if (event.answered && state.phase !== 'answered') return { ...state, phase: 'answered', submitting: false }
        // إعادة الرسم لنفس السؤال لا تعيد البطاقة إلى الإخفاء
        return state
      }
      return initialCardState(event.questionId, !!event.answered)
    case 'REVEAL':
      // النقرات المتسارعة: القلب مرة واحدة فقط
      if (state.phase !== 'covered') return state
      return { ...state, phase: event.reducedMotion ? 'question' : 'flipping' }
    case 'FLIP_END':
      if (state.phase !== 'flipping') return state
      return { ...state, phase: 'question' }
    case 'SUBMIT':
      if (state.phase !== 'question' || state.submitting) return state
      return { ...state, submitting: true }
    case 'SUBMIT_OK':
      if (state.phase !== 'question' || !state.submitting) return state
      return { ...state, phase: 'answered', submitting: false }
    case 'SUBMIT_FAIL':
      if (!state.submitting) return state
      return { ...state, submitting: false }
    case 'NEXT':
      if (state.phase !== 'answered') return state
      return { ...state, phase: 'next' }
  }
}

/**
 * هل الإجابة مكتملة بحسب نوع السؤال الحقيقي؟ (فحص واجهة فقط قبل الإرسال؛ التصحيح في الخادم)
 * ملء الفراغ: كل الفراغات ممتلئة بكلمات من البنك. الاختيار المتعدد: مفتاح موجود بين الخيارات.
 */
export function answerReady(payload: PlayPublicPayload, answer: PlayStudentAnswer | null): boolean {
  if (!answer || answer.type !== payload.type) return false
  switch (payload.type) {
    case 'MCQ':
      return answer.type === 'MCQ' && payload.options.some((o) => o.key === answer.key)
    case 'FILL_BLANK':
      return answer.type === 'FILL_BLANK' && answer.blanks.length === payload.blanks && answer.blanks.every((w) => typeof w === 'string' && w.trim() !== '' && payload.bank.includes(w))
    case 'MATCHING':
      return answer.type === 'MATCHING' && payload.lefts.every((l) => payload.rights.some((r) => r.key === answer.matches[l.key]))
    case 'ORDERING':
      return answer.type === 'ORDERING' && answer.order.length === payload.items.length && payload.items.every((i) => answer.order.includes(i.key))
  }
}

/** هل يُسمح بإرسال إجابة الآن؟ (الإجابة مكتملة، والبطاقة مكشوفة، ولا إرسال جارٍ) */
export function canSubmit(state: CardState, answerReady: boolean): boolean {
  return answerReady && state.phase === 'question' && !state.submitting
}

/** ما يراه القارئ والشاشة من وجهَي البطاقة في كل حالة */
export interface FaceVisibility {
  /** الوجه الأزرق خارج شجرة الوصول وغير قابل للتركيز */
  backHidden: boolean
  /** وجه السؤال خارج شجرة الوصول وغير قابل للتركيز */
  frontHidden: boolean
  /** البطاقة مقلوبة (وجه السؤال إلى الأمام) */
  flipped: boolean
  /** انتهى القلب: يُزال الوجه الأزرق وتُلغى التحويلات ثلاثية الأبعاد عن المحتوى التفاعلي */
  settled: boolean
}

export function faceVisibility(phase: CardPhase): FaceVisibility {
  switch (phase) {
    case 'covered':
      return { backHidden: false, frontHidden: true, flipped: false, settled: false }
    case 'flipping':
      // أثناء الحركة لا يُقرأ أي وجه، ثم يُنقل التركيز إلى السؤال
      return { backHidden: true, frontHidden: true, flipped: true, settled: false }
    case 'question':
    case 'answered':
      return { backHidden: true, frontHidden: false, flipped: true, settled: true }
    case 'next':
      // البطاقة تغادر: تبقى مرئية لحظة لكن لا تقبل لمسًا
      return { backHidden: true, frontHidden: true, flipped: true, settled: true }
  }
}

/**
 * قفل متزامن ضد الإرسال المكرر: نقرتان في الإطار نفسه تسبقان إعادة الرسم،
 * فلا يكفي فحص الحالة وحده. الخادم يرفض التكرار أيضًا (PLAY_ALREADY_ANSWERED).
 */
export function createSubmitGate() {
  let busy = false
  return {
    tryEnter(): boolean {
      if (busy) return false
      busy = true
      return true
    },
    leave(): void {
      busy = false
    },
    get busy(): boolean {
      return busy
    }
  }
}

/** أطول سلسلة إجابات صحيحة متتالية في الجولة (عرض فقط، لا يُخزَّن) */
export function longestStreak(outcomes: (boolean | null | undefined)[]): number {
  let best = 0
  let run = 0
  for (const o of outcomes) {
    if (o === true) {
      run += 1
      best = Math.max(best, run)
    } else if (o === false) run = 0
  }
  return best
}

/** فهرس أول سؤال غير مُجاب لاستئناف الجولة؛ طول القائمة يعني «انتهت» */
export function resumeIndex(status: string, answered: boolean[]): number {
  if (status !== 'ACTIVE') return answered.length
  const first = answered.findIndex((a) => !a)
  return first >= 0 ? first : answered.length
}
