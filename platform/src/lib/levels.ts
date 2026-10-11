/**
 * المستوى الدراسي الذي يختاره الزائر (4 متوسط، 1 ثانوي…) — يحدّد ما تعرضه الدروس والفروض والاختبارات والفيديوهات والقنوات.
 * يُحفظ في كوكي (md_level) ويُرسل أيضاً في الرابط (?level=4AM) حين يُشارَك.
 */
export const LEVEL_COOKIE = 'md_level'

export interface PickerLevel {
  code: string
  /** تسمية قصيرة للقائمة والشارات */
  label: string
  stage: 'MIDDLE' | 'SECONDARY'
}

export const PICKER_LEVELS: PickerLevel[] = [
  { code: '1AM', label: '1 متوسط', stage: 'MIDDLE' },
  { code: '2AM', label: '2 متوسط', stage: 'MIDDLE' },
  { code: '3AM', label: '3 متوسط', stage: 'MIDDLE' },
  { code: '4AM', label: '4 متوسط (BEM)', stage: 'MIDDLE' },
  { code: '1AS', label: '1 ثانوي', stage: 'SECONDARY' },
  { code: '2AS', label: '2 ثانوي', stage: 'SECONDARY' },
  { code: '3AS', label: '3 ثانوي (بكالوريا)', stage: 'SECONDARY' }
]

export const STAGE_LABEL: Record<PickerLevel['stage'], string> = { MIDDLE: 'التعليم المتوسط', SECONDARY: 'التعليم الثانوي' }

/** يطبّع قيمة الرابط/الكوكي إلى رمز مستوى معروف (4am، 4AM ← 4AM)، أو null */
export function levelCodeOf(raw: string | null | undefined): string | null {
  if (!raw) return null
  const v = raw.trim().toUpperCase()
  return PICKER_LEVELS.some((l) => l.code === v) ? v : null
}

export function levelLabel(code: string | null | undefined): string | null {
  return PICKER_LEVELS.find((l) => l.code === code)?.label ?? null
}
