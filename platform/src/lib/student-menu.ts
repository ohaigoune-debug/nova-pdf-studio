/**
 * إخفاء أقسام حساب التلميذ من الإدارة بلا برمجة (طلب المالك 1 نوفمبر 2026).
 * المخزَّن: قائمة مسارات مخفية. إخفاء مجمّع (الفروض مثلًا) يخفي كل تبويباته. دوال نقية تُختبر وحدها.
 */
import { STUDENT_HUBS, type StudentHubKey } from './student-hubs'

export interface HideableEntry {
  href: string
  label: string
  /** تبويبات تختفي معه (مجمّع كامل) */
  covers: string[]
  group: string
}

const hub = (k: StudentHubKey, group: string, label?: string): HideableEntry => ({ href: STUDENT_HUBS[k].href, label: label ?? `${STUDENT_HUBS[k].label} (القسم كله)`, covers: STUDENT_HUBS[k].tabs.map((t) => t.href), group })
const tab = (href: string, label: string, group: string): HideableEntry => ({ href, label, covers: [href], group })

/**
 * ما يمكن إخفاؤه. «الرئيسية» و«حسابي» لا تُخفيان أبدًا (إلا تبويبات منه).
 * المسارات المخزّنة قبل الأبواب الثلاثة تبقى صالحة: «/student/lessons» يخفي الدروس والملفات معًا كما كان،
 * و«/student/exams» يخفي الفروض والواجبات معًا كما كان، و«/student/play» يخفي PLAY بكل تبويباته.
 */
export const HIDEABLE_STUDENT_ENTRIES: HideableEntry[] = [
  hub('courses', 'دوراتي'),
  tab('/student/assignments', 'تبويب «واجباتي»', 'دوراتي'),
  { href: '/student/lessons', label: 'تبويبا «دروس مجانية» و«الملفات»', covers: ['/student/lessons', '/student/files'], group: 'دوراتي' },
  tab('/student/files', 'تبويب «الملفات» وحده', 'دوراتي'),
  tab('/student/classroom', 'القسم العام والأقسام الافتراضية للدورات', 'دوراتي'),
  tab('/student/courses/catalog', 'تبويب «شراء دورة» (و«استكشف» في الهاتف)', 'دوراتي'),
  tab('/student/courses/orders', 'تبويب «طلباتي»', 'دوراتي'),
  hub('train', 'PLAY'),
  { href: '/student/exams', label: 'تبويب «فروض واختبارات» (ومعه «واجباتي»)', covers: ['/student/exams', '/student/assignments'], group: 'PLAY' },
  tab('/bac', 'بنك البكالوريات السابقة', 'PLAY'),
  tab('/student/quizzes', 'تبويب «اختبارات أستاذي»', 'PLAY'),
  tab('/student/practice', 'تبويب «تدريب حرّ»', 'PLAY'),
  tab('/student/progress', 'تبويب «تقدّمي»', 'حسابي'),
  tab('/student/grades', 'تبويب «العلامات»', 'حسابي'),
  tab('/student/notifications', 'الإشعارات', 'حسابي'),
  tab('/student/invite', 'ادعُ زميلك ورصيدي', 'حسابي'),
  tab('/student/support', 'الدعم والشكاوى', 'حسابي')
]

const ALLOWED = new Set(HIDEABLE_STUDENT_ENTRIES.map((e) => e.href))

/** ينظّف ما يصل من النموذج: مسارات معروفة فقط */
export function cleanHiddenEntries(input: readonly string[]): string[] {
  return [...new Set(input.filter((h) => ALLOWED.has(h)))]
}

/** كل المسارات المخفية فعليًّا (بعد توسيع المجمّعات إلى تبويباتها) */
export function expandHidden(hidden: readonly string[]): string[] {
  const out = new Set<string>()
  for (const h of hidden) for (const c of HIDEABLE_STUDENT_ENTRIES.find((e) => e.href === h)?.covers ?? []) out.add(c)
  return [...out]
}

/** هل هذا المسار مخفي؟ (المسار نفسه أو صفحة داخله). «/student/courses» المخفي كقسم لا يُخفي صفحة دورة يملكها التلميذ. */
export function isPathHidden(path: string, expanded: readonly string[]): boolean {
  return expanded.some((h) => path === h || (h !== '/student/courses' && path.startsWith(h + '/')))
}
