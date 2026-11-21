/**
 * ألوان أيقونات المداخل الستة وتلميحاتها (التصوّر الذي اعتمده المالك، 21 نوفمبر 2026):
 * نفسها في أيقونات الرئيسية الكبيرة وفي القائمة الجانبية على الهاتف، حتى يعرف التلميذ كل باب بلونه.
 */
import type { StudentHubKey } from './student-hubs'

export const STUDENT_TONES: Record<StudentHubKey, string> = {
  courses: 'bg-primary/10 text-primary',
  shop: 'bg-warning/10 text-warning',
  code: 'bg-[#C29B45]/15 text-[#9A772C] dark:text-[#E6CF95]',
  train: 'bg-[#C11574]/10 text-[#C11574] dark:text-[#F5A3D6]',
  support: 'bg-success/10 text-success',
  account: 'bg-muted text-foreground/80'
}

export const STUDENT_HINTS: Record<StudentHubKey, string> = {
  courses: 'حصصك وملفاتك وتمارينك',
  shop: 'رقمية أو مع الكتاب',
  code: 'عندك كود؟ فعّله هنا',
  train: 'تحدَّ زملاءك',
  support: 'نردّ عليك في أقرب وقت',
  account: 'الفواتير وكلمة السر'
}
