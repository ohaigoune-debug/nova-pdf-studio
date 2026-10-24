/** أقسام المنصة الستة في أعلى الموقع — المصدر الوحيد للتسميات والروابط (الترويسة، الشريط الجانبي للتلميذ، التذييل) */
export const MAIN_SECTIONS = [
  { href: '/bac', label: 'بنك البكالوريات السابقة', iconKey: 'FileStack' },
  { href: '/exams', label: 'الفروض والاختبارات', iconKey: 'FileText' },
  { href: '/quizzes', label: 'اختبارات المستوى QCM', iconKey: 'ListChecks' },
  { href: '/lessons', label: 'الدروس والموارد', iconKey: 'BookOpen' },
  { href: '/videos', label: 'الفيديوهات والقنوات', iconKey: 'PlayCircle' },
  { href: '/forum', label: 'المنتدى', iconKey: 'MessageSquareText' }
] as const

/** روابط ثانوية تبقى في التذييل فقط */
export const FOOTER_EXTRA = [
  { href: '/library', label: 'المكتبة' }
] as const
