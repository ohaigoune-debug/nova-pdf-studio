/** حساب نقاط عنصر الورقة وعناوينه التلقائية — دوال خالصة تُستعمل في الخادم والمتصفح (المحرّر، المعاينة، الطباعة) */
import type { ExamItemRow } from '@/server/db/schema/exams'

const round2 = (n: number) => Math.round(n * 100) / 100

/** نقاط العنصر: التجاوز اليدوي، وإلا نقاط النسخة (أو مجموع فرعياتها)؛ الكتل والنصوص والفواصل بلا نقاط */
export function itemPoints(it: Pick<ExamItemRow, 'kind' | 'points' | 'snapshot'>): number {
  if (it.kind === 'TEXT' || it.kind === 'PAGE_BREAK' || it.kind === 'BLOCK') return 0
  if (it.points != null) return Number(it.points)
  const s = it.snapshot
  if (s.children?.length) return round2(s.children.reduce((a, c) => a + (c.points ?? 0), 0))
  return s.points ?? 0
}

/** عنوان تلقائي: «التمرين الأول/الثاني…» للتمارين و«السؤال n» للأسئلة؛ العنوان اليدوي يغلب */
export const ORDINALS = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر']
export function autoTitle(kind: string, n: number, numbering: 'words' | 'digits' = 'words'): string {
  if (kind === 'EXERCISE') return numbering === 'digits' ? `التمرين ${n}` : `التمرين ${ORDINALS[n - 1] ?? n}`
  return `السؤال ${n}`
}
