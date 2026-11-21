/**
 * مجمّعات واجهة التلميذ: مدخل واحد في القائمة لكل مجمّع، والصفحات القديمة تبقى بمساراتها كتبويبات داخله.
 * المصدر الوحيد للتسميات والمسارات: القائمة الجانبية وشريط الهاتف وشريط التبويبات يقرؤون من هنا.
 *
 * قرار المالك (21 نوفمبر 2026): المنصة للدورات وحدها. ستة مداخل بلا عناوين فرعية، بهذا الترتيب:
 * دوراتي، الكتب والدورات، تفعيل دورة، العب، الشكاوى والدعم، حسابي. «اليوم» صار «الرئيسية» (أيقونات كبيرة)،
 * والدروس والملفات المجانية و«القسم العام» لا تظهر (البيانات باقية، وروابط الدروس المباشرة تعمل).
 */
export interface HubTab {
  href: string
  label: string
  exact?: boolean
}

export interface StudentHub {
  key: string
  label: string
  iconKey: string
  /** المسار الذي يفتحه مدخل القائمة (= التبويب الأول) */
  href: string
  tabs: HubTab[]
  /** يختفي المدخل كله إن خُفي تبويبه الأول (لا «تدرّب» بديلًا حين يُخفى PLAY خارج آيفون) */
  requireFirst?: boolean
}

export const STUDENT_HUBS = {
  courses: {
    key: 'courses',
    label: 'دوراتي',
    iconKey: 'FolderOpen',
    href: '/student/courses',
    // صفحات تابعة لدوراته (لا تبويبات ظاهرة): الواجبات، منتدى الدورة، صفحات الدروس والملفات
    tabs: [
      { href: '/student/courses', label: 'دوراتي', exact: true },
      { href: '/student/assignments', label: 'واجباتي' },
      { href: '/student/classroom', label: 'المنتدى' },
      { href: '/student/lessons', label: 'الدروس' },
      { href: '/student/files', label: 'الملفات' }
    ]
  },
  shop: {
    key: 'shop',
    label: 'الكتب والدورات',
    iconKey: 'ShoppingBag',
    href: '/student/courses/catalog',
    tabs: [
      { href: '/student/courses/catalog', label: 'الكتب والدورات' },
      { href: '/student/courses/orders', label: 'طلباتي' }
    ]
  },
  code: {
    key: 'code',
    label: 'تفعيل دورة',
    iconKey: 'KeyRound',
    href: '/student/code',
    tabs: [{ href: '/student/code', label: 'تفعيل دورة' }]
  },
  train: {
    key: 'train',
    label: 'العب',
    iconKey: 'Gamepad2',
    href: '/student/play',
    requireFirst: true,
    tabs: [
      { href: '/student/play', label: 'MADRASADZ PLAY' },
      { href: '/student/exams', label: 'فروض واختبارات' },
      { href: '/bac', label: 'بنك البكالوريات' },
      { href: '/student/quizzes', label: 'اختبارات أستاذي' },
      { href: '/student/practice', label: 'تدريب حرّ' }
    ]
  },
  support: {
    key: 'support',
    label: 'الشكاوى والدعم',
    iconKey: 'LifeBuoy',
    href: '/student/support',
    tabs: [{ href: '/student/support', label: 'الشكاوى والدعم' }]
  },
  account: {
    key: 'account',
    label: 'حسابي',
    iconKey: 'UserRound',
    href: '/student/profile',
    tabs: [
      { href: '/student/profile', label: 'الملف الشخصي' },
      { href: '/student/progress', label: 'تقدّمي' },
      { href: '/student/grades', label: 'العلامات' },
      { href: '/student/notifications', label: 'الإشعارات' },
      { href: '/student/invite', label: 'ادعُ زميلك ورصيدي' },
      { href: '/student/invoices', label: 'فواتيري' }
    ]
  }
} as const satisfies Record<string, StudentHub>

/** ترتيب المداخل في القائمة الجانبية وأيقونات الرئيسية */
export const STUDENT_MENU_ORDER = ['courses', 'shop', 'code', 'train', 'support', 'account'] as const

export type StudentHubKey = keyof typeof STUDENT_HUBS

/** كل مسارات المجمّع (لتفعيل مدخل القائمة وأنت في أي تبويب) */
export function hubPaths(key: StudentHubKey): string[] {
  return STUDENT_HUBS[key].tabs.map((t) => t.href)
}

/**
 * قرار المالك (21 نوفمبر 2026): قائمتا «الدروس المجانية» و«الملفات» مخفيتان حتى تُجمع في دورة مجانية أفضل.
 * صفحتاهما تحوّلان إلى «دوراتي»؛ صفحة الدرس نفسها (/student/lessons/…) تبقى مفتوحة لدروس الدورات وللروابط المباشرة.
 * للإعادة: false.
 */
export const FREE_LISTS_HIDDEN = true
