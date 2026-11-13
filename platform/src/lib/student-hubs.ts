/**
 * مجمّعات واجهة التلميذ (دمج الأقسام المتشابهة، قرار المالك 2026-10-23):
 * مدخل واحد في القائمة لكل مجمّع، والصفحات القديمة تبقى بمساراتها كتبويبات داخله.
 * المصدر الوحيد للتسميات والمسارات: القائمة الجانبية وشريط التبويبات يقرآن من هنا.
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
  /** اسم المدخل وأيقونته حين يُخفى تبويبه الأول (PLAY خارج آيفون مثلًا) */
  whenFirstHidden?: { label: string; iconKey: string }
}

export const STUDENT_HUBS = {
  // ثلاثة أبواب فقط (قرار المالك 3 نوفمبر 2026): دوراتي، PLAY، حسابي — مع «اليوم» في الرئيسية.
  // كل الصفحات القديمة باقية بمساراتها كتبويبات داخل بابها، فلا ينكسر رابط ولا إشعار.
  courses: {
    key: 'courses',
    label: 'دوراتي',
    iconKey: 'BookMarked',
    href: '/student/courses',
    tabs: [
      { href: '/student/courses', label: 'دوراتي', exact: true },
      { href: '/student/assignments', label: 'واجباتي' },
      { href: '/student/lessons', label: 'دروس مجانية' },
      { href: '/student/classroom', label: 'القسم العام' },
      { href: '/student/files', label: 'الملفات' },
      { href: '/student/courses/catalog', label: 'شراء دورة' },
      { href: '/student/courses/orders', label: 'طلباتي' }
    ]
  },
  train: {
    key: 'train',
    label: 'PLAY',
    iconKey: 'Gamepad2',
    href: '/student/play',
    whenFirstHidden: { label: 'تدرّب', iconKey: 'Target' },
    tabs: [
      { href: '/student/play', label: 'MADRASADZ PLAY' },
      { href: '/student/exams', label: 'فروض واختبارات' },
      { href: '/bac', label: 'بنك البكالوريات' },
      { href: '/student/quizzes', label: 'اختبارات أستاذي' },
      { href: '/student/practice', label: 'تدريب حرّ' }
    ]
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
      { href: '/student/support', label: 'الدعم والشكاوى' }
    ]
  }
} as const satisfies Record<string, StudentHub>

export type StudentHubKey = keyof typeof STUDENT_HUBS

/** كل مسارات المجمّع (لتفعيل مدخل القائمة وأنت في أي تبويب) */
export function hubPaths(key: StudentHubKey): string[] {
  return STUDENT_HUBS[key].tabs.map((t) => t.href)
}
