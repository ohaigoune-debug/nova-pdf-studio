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
}

export const STUDENT_HUBS = {
  courses: {
    key: 'courses',
    label: 'الدورات',
    iconKey: 'BookMarked',
    href: '/student/courses',
    tabs: [
      { href: '/student/courses', label: 'دوراتي', exact: true },
      { href: '/student/courses/catalog', label: 'شراء دورة' }
    ]
  },
  lessons: {
    key: 'lessons',
    label: 'الدروس',
    iconKey: 'BookOpen',
    href: '/student/lessons',
    tabs: [
      { href: '/student/lessons', label: 'دروسي' },
      { href: '/student/videos', label: 'الفيديوهات' },
      { href: '/student/files', label: 'الملفات' }
    ]
  },
  train: {
    key: 'train',
    label: 'تدرّب',
    iconKey: 'Gamepad2',
    href: '/student/play',
    tabs: [
      { href: '/student/play', label: 'MADRASADZ PLAY' },
      { href: '/student/quizzes', label: 'اختبارات أستاذي' },
      { href: '/student/practice', label: 'تدريب حرّ' }
    ]
  },
  exams: {
    key: 'exams',
    label: 'الفروض',
    iconKey: 'FileText',
    href: '/student/exams',
    tabs: [
      { href: '/student/exams', label: 'فروض واختبارات مجانية' },
      { href: '/student/assignments', label: 'واجباتي' }
    ]
  },
  progress: {
    key: 'progress',
    label: 'تقدّمي',
    iconKey: 'TrendingUp',
    href: '/student/progress',
    tabs: [
      { href: '/student/progress', label: 'التقدم' },
      { href: '/student/grades', label: 'العلامات' }
    ]
  }
} as const satisfies Record<string, StudentHub>

export type StudentHubKey = keyof typeof STUDENT_HUBS

/** كل مسارات المجمّع (لتفعيل مدخل القائمة وأنت في أي تبويب) */
export function hubPaths(key: StudentHubKey): string[] {
  return STUDENT_HUBS[key].tabs.map((t) => t.href)
}
