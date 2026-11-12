/**
 * ملف PLAY من حساب التلميذ (البند ب3، 12 نوفمبر 2026): التلميذ أعطى سنته وشعبته عند التسجيل، فلا نسأله ثانية.
 *
 * الشعبة في الحساب قد لا تطابق شعب PLAY حرفيًا:
 *  - خيارات تقني رياضي (هندسة مدنية، ميكانيكية، كهربائية، طرائق) تُقرأ كشعبتها الأم «تقني رياضي».
 *  - تلميذ السنة الأولى ثانوي الذي اختار شعبة السنة الثانية يُقرأ بجذعه المشترك:
 *    علوم تجريبية ورياضيات وتقني رياضي وتسيير واقتصاد ← جذع مشترك علوم وتكنولوجيا؛ آداب وفلسفة ولغات أجنبية ← جذع مشترك آداب.
 * والعكس غير ممكن: جذع مشترك في السنة الثانية أو الثالثة يحتمل أكثر من شعبة، فتُعرض شاشة الإعداد والسنة مختارة سلفًا.
 */
import { gradeByCode } from '@/server/play/constants'

const FIRST_YEAR_TRUNK: Readonly<Record<string, string>> = {
  SCI: 'TC_SCI',
  MATH: 'TC_SCI',
  TM: 'TC_SCI',
  GE: 'TC_SCI',
  LIT: 'TC_LIT',
  LANG: 'TC_LIT'
}

export type AccountPlayProfile =
  /** السنة والشعبة معروفتان: يدخل التلميذ موادّه مباشرة */
  | { kind: 'full'; gradeCode: string; streamCode: string | null }
  /** السنة معروفة والشعبة لا: شاشة الإعداد بالسنة مختارة */
  | { kind: 'grade-only'; gradeCode: string }
  /** لا شيء يُستنتج (لا مستوى، أو مستوى ليس في PLAY بعد) */
  | { kind: 'none' }

export function playProfileFromAccount(input: { levelCode: string | null; streamCode: string | null; parentStreamCode: string | null }): AccountPlayProfile {
  const grade = input.levelCode ? gradeByCode(input.levelCode) : undefined
  if (!grade || !grade.isActive) return { kind: 'none' }
  if (grade.streams.length === 0) return { kind: 'full', gradeCode: grade.code, streamCode: null }
  const has = (code: string | null | undefined): code is string => Boolean(code) && grade.streams.includes(code!)
  const own = input.streamCode
  const parent = input.parentStreamCode
  const trunk = grade.code === '1AS' ? FIRST_YEAR_TRUNK[parent ?? own ?? ''] : undefined
  const streamCode = has(own) ? own : has(parent) ? parent : has(trunk) ? trunk : null
  return streamCode ? { kind: 'full', gradeCode: grade.code, streamCode } : { kind: 'grade-only', gradeCode: grade.code }
}
