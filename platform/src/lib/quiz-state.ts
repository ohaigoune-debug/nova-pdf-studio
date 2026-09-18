/** حالة سؤال داخل محرّر الاختبار (مشتركة بين الخادم والعميل) */
export interface QuestionState {
  key: string
  id?: string
  type: string
  prompt: string
  points: number
  skillId: string
  imageFileId: string
  options: { label: string; isCorrect: boolean }[]
  tfValue: boolean
  accepted: string
  blanks: string
  pairs: string
}

/** يحوّل السؤال المخزَّن إلى حالة المحرّر */
export function toState(q: { id: string; type: string; prompt: string; points: number; skillId: string | null; imageFileId: string | null; answerKey: Record<string, unknown> | null; options: { label: string; isCorrect: boolean }[] }): QuestionState {
  const key = q.answerKey ?? {}
  return {
    key: q.id,
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    points: q.points,
    skillId: q.skillId ?? '',
    imageFileId: q.imageFileId ?? '',
    options: q.options.length ? q.options : [{ label: '', isCorrect: true }],
    tfValue: typeof key.value === 'boolean' ? (key.value as boolean) : true,
    accepted: Array.isArray(key.accepted) ? (key.accepted as string[]).join('\n') : '',
    blanks: Array.isArray(key.blanks) ? (key.blanks as string[][]).map((b) => b.join(' | ')).join('\n') : '',
    pairs: Array.isArray(key.pairs) ? (key.pairs as { left: string; right: string }[]).map((p) => `${p.left} = ${p.right}`).join('\n') : ''
  }
}
