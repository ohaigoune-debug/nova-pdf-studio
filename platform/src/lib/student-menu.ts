/**
 * إخفاء أقسام حساب التلميذ من الإدارة بلا برمجة (طلب المالك 1 نوفمبر 2026).
 * المخزَّن: قائمة مسارات مخفية. إخفاء مجمّع (الفروض مثلًا) يخفي كل تبويباته. دوال نقية تُختبر وحدها.
 */
import { STUDENT_HUBS, type StudentHub, type StudentHubKey } from './student-hubs'

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
 * المسارات المخزّنة قبل مداخل 21 نوفمبر تبقى صالحة: «/student/courses/catalog» و«/student/support» صارا مدخلين،
 * و«/student/exams» يخفي الفروض والواجبات معًا كما كان، و«/student/play» يخفي «العب» بكل تبويباته.
 * الدروس والملفات المجانية لم تعد في القائمة أصلًا (صفحتاهما تحوّلان إلى «دوراتي»)، فلا خانة لهما.
 */
export const HIDEABLE_STUDENT_ENTRIES: HideableEntry[] = [
  hub('courses', 'دوراتي'),
  tab('/student/assignments', 'صفحة «واجباتي»', 'دوراتي'),
  tab('/student/classroom', 'منتديات الدورات', 'دوراتي'),
  hub('shop', 'الكتب والدورات'),
  tab('/student/courses/orders', 'تبويب «طلباتي»', 'الكتب والدورات'),
  hub('code', 'تفعيل دورة', 'تفعيل دورة بالكود'),
  hub('train', 'العب'),
  { href: '/student/exams', label: 'تبويب «فروض واختبارات» (ومعه «واجباتي»)', covers: ['/student/exams', '/student/assignments'], group: 'العب' },
  tab('/bac', 'بنك البكالوريات السابقة', 'العب'),
  tab('/student/quizzes', 'تبويب «اختبارات أستاذي»', 'العب'),
  tab('/student/practice', 'تبويب «تدريب حرّ»', 'العب'),
  hub('support', 'الشكاوى والدعم', 'الشكاوى والدعم'),
  tab('/student/progress', 'تبويب «تقدّمي»', 'حسابي'),
  tab('/student/grades', 'تبويب «العلامات»', 'حسابي'),
  tab('/student/notifications', 'الإشعارات', 'حسابي'),
  tab('/student/invite', 'ادعُ زميلك ورصيدي', 'حسابي'),
  tab('/student/invoices', 'تبويب «فواتيري»', 'حسابي')
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

/** قوائم تُخفى وحدها دون صفحاتها: دورة يملكها التلميذ، ودرس أو ملف من دورته */
const LIST_ONLY = new Set(['/student/courses', '/student/lessons', '/student/files'])

/** هل هذا المسار مخفي؟ (المسار نفسه أو صفحة داخله، إلا القوائم أعلاه) */
export function isPathHidden(path: string, expanded: readonly string[]): boolean {
  return expanded.some((h) => path === h || (!LIST_ONLY.has(h) && path.startsWith(h + '/')))
}

/**
 * مدخل المجمّع كما يراه التلميذ: يفتح أول تبويب ظاهر. null: كل تبويباته مخفية،
 * أو خُفي تبويبه الأول والمجمّع يشترطه («العب» حين يُخفى PLAY خارج آيفون).
 */
export function hubEntry(key: StudentHubKey, hidden: readonly string[]): { href: string; label: string; iconKey: string } | null {
  const h: StudentHub = STUDENT_HUBS[key]
  const first = h.tabs.find((t) => !isPathHidden(t.href, hidden))
  if (!first) return null
  if (h.requireFirst && first.href !== h.tabs[0]?.href) return null
  return { href: first.href, label: h.label, iconKey: h.iconKey }
}

/**
 * المدخل النشط في القائمة أو شريط الهاتف: صاحب أطول مسار يطابق الصفحة الحالية،
 * فلا يُضاء «دوراتي» (/student/courses) في «الكتب والدورات» (/student/courses/catalog).
 */
export function activeEntry(pathname: string, entries: readonly { id: string; paths: readonly string[]; exact?: boolean }[]): string | null {
  let best: { id: string; len: number } | null = null
  for (const e of entries) {
    for (const p of e.paths) {
      const hit = e.exact ? pathname === p : pathname === p || pathname.startsWith(p + '/')
      if (hit && (!best || p.length > best.len)) best = { id: e.id, len: p.length }
    }
  }
  return best?.id ?? null
}

/** المجمّع الذي يبدأ بهذا المسار (مدخله في القائمة) */
export function hubKeyByHref(href: string): StudentHubKey | null {
  return (Object.keys(STUDENT_HUBS) as StudentHubKey[]).find((k) => STUDENT_HUBS[k].href === href) ?? null
}
