import type { UserRole } from '@/server/db/schema/enums'
import { t } from '@/i18n'
import { STUDENT_HUBS, hubPaths, type StudentHubKey } from '@/lib/student-hubs'

/** iconKey = اسم أيقونة lucide (PascalCase) يُحلّ في العميل */
export interface NavItem {
  href: string
  label: string
  iconKey: string
  exact?: boolean
  /** مسارات أخرى تُفعّل هذا المدخل (تبويبات المجمّع) */
  also?: string[]
  children?: NavItem[]
}

/** مدخل قائمة لمجمّع تلميذ: يفتح التبويب الأول ويبقى مفعّلاً في كل تبويباته */
function hubItem(key: StudentHubKey): NavItem {
  const h = STUDENT_HUBS[key]
  return { href: h.href, label: h.label, iconKey: h.iconKey, also: hubPaths(key) }
}

export interface NavSection {
  title?: string
  collapsible?: boolean
  items: NavItem[]
}

/**
 * أدوات الأستاذ التي خرجت من القائمة المبسّطة — تبقى في /teacher/tools وبمساراتها نفسها.
 * الحضور (الماسح، الحصص الحضورية، قوائم الحضور، أكواد الأفواج، المساعدون) مخفي بقرار المالك (2026-10-24).
 */
export const TEACHER_TOOLS: (NavItem & { group: string })[] = [
  { group: 'التقييم', href: '/teacher/quizzes', label: 'اختبارات QCM', iconKey: 'ListChecks' },
  { group: 'التقييم', href: '/teacher/assignments', label: t('nav.assignments'), iconKey: 'ClipboardList' },
  { group: 'التقييم', href: '/teacher/exams', label: 'الامتحانات', iconKey: 'FileText' },
  { group: 'التقييم', href: '/teacher/bank', label: 'بنك الأسئلة', iconKey: 'Library' },
  { group: 'التقييم', href: '/teacher/rubrics', label: t('rubrics.title'), iconKey: 'ClipboardCheck' },
  { group: 'المحتوى', href: '/teacher/files', label: t('nav.files'), iconKey: 'FolderOpen' },
  { group: 'المحتوى', href: '/teacher/library', label: 'مكتبتي', iconKey: 'BookMarked' },
  { group: 'المحتوى', href: '/teacher/drive', label: 'مكتبة Drive', iconKey: 'HardDrive' },
  { group: 'المحتوى', href: '/teacher/market', label: 'سوق الأساتذة', iconKey: 'Store' },
  { group: 'المحتوى', href: '/teacher/announcements', label: 'الإشعارات للتلاميذ', iconKey: 'Megaphone' },
  { group: 'المتابعة', href: '/teacher/groups', label: 'الأفواج', iconKey: 'UsersRound' },
  { group: 'المتابعة', href: '/teacher/reports', label: t('nav.reports'), iconKey: 'BarChart3' },
  { group: 'المتابعة', href: '/teacher/ai-insights', label: t('nav.aiInsights'), iconKey: 'Brain' }
]

export function navFor(role: UserRole): NavSection[] {
  switch (role) {
    case 'STUDENT':
      // قرار المالك (3 نوفمبر 2026): ثلاثة أبواب فقط بعد «اليوم» — دوراتي، PLAY، حسابي.
      // الصفحات القديمة (الدروس، الفروض، بنك البكالوريات، الإشعارات…) تبويبات داخل أبوابها بمساراتها نفسها.
      return [
        {
          items: [
            { href: '/student', label: 'اليوم', iconKey: 'Sun', exact: true },
            hubItem('courses'),
            hubItem('train'),
            hubItem('account')
          ]
        }
      ]
    case 'TEACHER':
      // قرار المالك (2026-10-24): المسجّلون، المداخيل، نشر المحتوى، التفاعل — فقط. بقية الأدوات في /teacher/tools.
      return [
        {
          items: [
            { href: '/teacher', label: 'المسجّلون والمداخيل', iconKey: 'LayoutDashboard', exact: true },
            { href: '/teacher/students', label: 'المسجّلون', iconKey: 'Users' }
          ]
        },
        {
          title: 'نشر المحتوى',
          items: [
            { href: '/teacher/publish', label: 'نشر درس / ملف / اختبار', iconKey: 'Upload' },
            { href: '/teacher/content', label: 'المحتوى والحصص السابقة', iconKey: 'BookOpen' }
          ]
        },
        {
          title: 'التفاعل',
          items: [
            { href: '/teacher/classroom', label: 'القسم الافتراضي', iconKey: 'MessagesSquare' },
            { href: '/teacher/comments', label: 'تعليقات الحصص', iconKey: 'MessageSquare' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/teacher/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/teacher/settings', label: t('nav.settings'), iconKey: 'Settings' },
            { href: '/teacher/tools', label: 'أدوات أخرى', iconKey: 'Wrench', also: TEACHER_TOOLS.map((x) => x.href) }
          ]
        }
      ]
    case 'ASSISTANT':
      return [
        {
          items: [
            { href: '/assistant', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true },
            { href: '/assistant/students', label: t('nav.students'), iconKey: 'Users' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/assistant/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/assistant/settings', label: t('nav.settings'), iconKey: 'Settings' }
          ]
        }
      ]
    case 'CONTENT_UPLOADER':
      // رافع المحتوى: دوراته المسندة فقط (طلب المالك 1 نوفمبر 2026)
      return [{ items: [{ href: '/studio', label: 'دوراتي ودروسها', iconKey: 'GraduationCap' }] }]
    case 'MANAGER':
      // مدير العمليات: نقاط البيع، المسوّقون وطلبات الشراكة، والمال المستلَم والمدفوع (قرار المالك 2 نوفمبر 2026)
      return [{ items: [
        { href: '/admin/points-of-sale', label: 'نقاط البيع', iconKey: 'Store' },
        { href: '/admin/affiliates', label: 'المسوّقون وطلبات الشراكة', iconKey: 'Megaphone' },
        { href: '/admin/notifications', label: 'الإشعارات', iconKey: 'BellRing' }
      ] }]
    case 'CONFIRMER':
      return [{ items: [
        { href: '/admin/store/confirm', label: 'طابور التأكيد', iconKey: 'PhoneCall', exact: true },
        { href: '/admin/store', label: 'الطلبات', iconKey: 'ShoppingBag', exact: true }
      ] }]
    case 'SUPER_ADMIN':
      return [
        {
          items: [
            // خمسة أقسام رئيسية (طلب التبسيط 1 نوفمبر 2026)؛ بقية الأدوات في «المزيد» بمساراتها نفسها
            { href: '/admin', label: 'الرئيسية', iconKey: 'LayoutDashboard', exact: true },
            { href: '/admin/courses', label: 'الدورات والدروس', iconKey: 'GraduationCap' },
            { href: '/admin/students', label: 'التلاميذ', iconKey: 'Users' },
            {
              href: '/admin/store', label: 'الطلبات', iconKey: 'ShoppingBag',
              children: [
                { href: '/admin/store', label: 'طلبات الدورات', iconKey: 'ShoppingBag', exact: true },
                { href: '/admin/store/confirm', label: 'طابور التأكيد', iconKey: 'PhoneCall' },
                { href: '/admin/delivery', label: 'التوصيل', iconKey: 'Truck' },
                { href: '/admin/points-of-sale', label: 'نقاط البيع', iconKey: 'Store' },
                { href: '/admin/affiliates', label: 'المسوّقون', iconKey: 'Megaphone' }
              ]
            },
            {
              href: '/admin/settings', label: 'الإعدادات', iconKey: 'Settings',
              children: [
                { href: '/admin/settings', label: 'الإعدادات العامة', iconKey: 'Settings', exact: true },
                { href: '/admin/employees', label: 'الموظفون ورافعو المحتوى', iconKey: 'UsersRound' },
                { href: '/admin/settings/video', label: 'الفيديو (Bunny)', iconKey: 'Video' },
                { href: '/admin/settings/payment', label: 'الدفع الإلكتروني', iconKey: 'CreditCard' },
                { href: '/admin/settings/student-menu', label: 'أقسام حساب التلميذ', iconKey: 'EyeOff' }
              ]
            }
          ]
        },
        {
          title: 'المزيد',
          collapsible: true,
          items: [
            { href: '/admin/teachers', label: t('nav.teachers'), iconKey: 'GraduationCap' },
            { href: '/admin/users', label: t('nav.users'), iconKey: 'UserRound' },
            { href: '/admin/groups', label: t('common.groups'), iconKey: 'UsersRound' },
            { href: '/admin/publish', label: 'النشر في المكتبة العامة', iconKey: 'Upload' },
            { href: '/admin/curriculum', label: 'المنهاج والمكتبة', iconKey: 'Network' },
            { href: '/admin/bac-bank', label: 'بنك البكالوريا', iconKey: 'Database' },
            { href: '/admin/play', label: 'MADRASADZ PLAY', iconKey: 'Gamepad2' },
            { href: '/admin/exam-engine', label: 'محرّك الامتحانات', iconKey: 'Cog' },
            { href: '/admin/educators', label: 'دليل الأساتذة', iconKey: 'PlayCircle' },
            { href: '/admin/content', label: t('nav.content'), iconKey: 'FileText' },
            { href: '/admin/support', label: 'الشكاوى', iconKey: 'LifeBuoy' },
            { href: '/admin/live', label: 'البث المباشر', iconKey: 'Radio' },
            { href: '/admin/market', label: 'سوق الأساتذة', iconKey: 'Store' },
            { href: '/admin/ai', label: t('nav.ai'), iconKey: 'Cpu' },
            { href: '/admin/storage', label: t('nav.storage'), iconKey: 'HardDrive' },
            { href: '/admin/security', label: t('nav.security'), iconKey: 'Shield' },
            { href: '/admin/security/leaks', label: 'كشف التسريب', iconKey: 'ScanSearch' },
            { href: '/admin/logs', label: t('nav.logs'), iconKey: 'ScrollText' },
            { href: '/admin/notifications', label: t('common.notifications'), iconKey: 'BellRing' }
          ]
        }
      ]
    default:
      return []
  }
}
