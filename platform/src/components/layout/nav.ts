import type { UserRole } from '@/server/db/schema/enums'
import { t } from '@/i18n'
import { MAIN_SECTIONS } from '@/lib/sections'
import { STUDENT_HUBS, hubPaths, type StudentHubKey } from '@/lib/student-hubs'

/** iconKey = اسم أيقونة lucide (PascalCase) يُحلّ في العميل */
export interface NavItem {
  href: string
  label: string
  iconKey: string
  exact?: boolean
  /** مسارات أخرى تُفعّل هذا المدخل (تبويبات المجمّع) */
  also?: string[]
}

/** مدخل قائمة لمجمّع تلميذ: يفتح التبويب الأول ويبقى مفعّلاً في كل تبويباته */
function hubItem(key: StudentHubKey): NavItem {
  const h = STUDENT_HUBS[key]
  return { href: h.href, label: h.label, iconKey: h.iconKey, also: hubPaths(key) }
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export function navFor(role: UserRole): NavSection[] {
  switch (role) {
    case 'STUDENT':
      // قرار المالك (2026-10-24): خمسة أقسام فقط — الدروس، الفروض، بنك البكالوريات، تدرّب، الدورات.
      // الحضور (البطاقة والسجل) والأفواج مخفية؛ صفحاتها القديمة تبقى بمساراتها فلا ينكسر رابط قديم.
      return [
        {
          items: [
            { href: '/student', label: t('nav.home'), iconKey: 'Home', exact: true },
            hubItem('lessons'),
            hubItem('exams'),
            ...MAIN_SECTIONS.filter((s) => s.href === '/bac').map((s) => ({ href: s.href, label: s.label, iconKey: s.iconKey })),
            hubItem('train'),
            hubItem('courses')
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/student/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/student/support', label: 'الدعم والشكاوى', iconKey: 'LifeBuoy' },
            { href: '/student/profile', label: t('common.profile'), iconKey: 'UserRound' }
          ]
        }
      ]
    case 'TEACHER':
      return [
        {
          // الحضور (الماسح، الحصص الحضورية، قوائم الحضور) مخفي بقرار المالك؛ الصفحات باقية بمساراتها
          items: [{ href: '/teacher', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true }]
        },
        {
          title: 'الإدارة',
          items: [
            { href: '/teacher/groups', label: t('common.groups'), iconKey: 'UsersRound' },
            { href: '/teacher/students', label: t('nav.students'), iconKey: 'Users' },
            { href: '/teacher/assistants', label: t('nav.assistants'), iconKey: 'UserCog' }
          ]
        },
        {
          title: 'التعليم',
          items: [
            { href: '/teacher/publish', label: 'نشر درس / فرض / اختبار', iconKey: 'Upload' },
            { href: '/teacher/classroom', label: 'القسم الافتراضي', iconKey: 'MessagesSquare' },
            { href: '/teacher/announcements', label: 'الإشعارات', iconKey: 'Megaphone' },
            { href: '/forum', label: 'المنتدى', iconKey: 'MessageSquareText' },
            { href: '/teacher/assignments', label: t('nav.assignments'), iconKey: 'ClipboardList' },
            { href: '/teacher/quizzes', label: t('nav.quizzes'), iconKey: 'ListChecks' },
            { href: '/teacher/exams', label: 'الامتحانات', iconKey: 'FileText' },
            { href: '/teacher/bank', label: 'بنك الأسئلة', iconKey: 'Library' },
            { href: '/teacher/library', label: 'مكتبتي', iconKey: 'BookMarked' },
            { href: '/teacher/market', label: 'سوق الأساتذة', iconKey: 'Store' },
            { href: '/teacher/rubrics', label: t('rubrics.title'), iconKey: 'ClipboardCheck' },
            { href: '/teacher/drive', label: 'مكتبة Drive', iconKey: 'HardDrive' },
            { href: '/teacher/content', label: t('nav.content'), iconKey: 'BookOpen' },
            { href: '/teacher/files', label: t('nav.files'), iconKey: 'FolderOpen' },
            { href: '/teacher/reports', label: t('nav.reports'), iconKey: 'BarChart3' },
            { href: '/teacher/ai-insights', label: t('nav.aiInsights'), iconKey: 'Brain' }
          ]
        },
        {
          title: 'الحساب',
          items: [
            { href: '/teacher/notifications', label: t('common.notifications'), iconKey: 'BellRing' },
            { href: '/teacher/settings', label: t('nav.settings'), iconKey: 'Settings' }
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
    case 'SUPER_ADMIN':
      return [
        {
          items: [
            { href: '/admin', label: t('nav.dashboard'), iconKey: 'LayoutDashboard', exact: true },
            { href: '/admin/teachers', label: t('nav.teachers'), iconKey: 'GraduationCap' },
            { href: '/admin/students', label: t('nav.students'), iconKey: 'Users' },
            { href: '/admin/users', label: t('nav.users'), iconKey: 'UserRound' },
            { href: '/admin/groups', label: t('common.groups'), iconKey: 'UsersRound' }
          ]
        },
        {
          title: 'المنصة',
          items: [
            { href: '/admin/publish', label: 'نشر درس / فرض / اختبار', iconKey: 'Upload' },
            { href: '/admin/curriculum', label: 'المنهاج والمكتبة', iconKey: 'Network' },
            { href: '/admin/bac-bank', label: 'بنك البكالوريا', iconKey: 'Database' },
            { href: '/admin/play', label: 'MADRASADZ PLAY', iconKey: 'Gamepad2' },
            { href: '/admin/exam-engine', label: 'محرّك الامتحانات', iconKey: 'Cog' },
            { href: '/admin/educators', label: 'دليل الأساتذة', iconKey: 'PlayCircle' },
            { href: '/admin/content', label: t('nav.content'), iconKey: 'FileText' },
            { href: '/admin/store', label: 'المتجر', iconKey: 'ShoppingBag' },
            { href: '/admin/store/confirm', label: 'طابور التأكيد', iconKey: 'PhoneCall' },
            { href: '/admin/delivery', label: 'التوصيل', iconKey: 'Truck' },
            { href: '/admin/support', label: 'الشكاوى', iconKey: 'LifeBuoy' },
            { href: '/admin/live', label: 'البث المباشر', iconKey: 'Radio' },
            { href: '/admin/courses', label: 'الدورات المدفوعة', iconKey: 'GraduationCap' },
            { href: '/admin/market', label: 'سوق الأساتذة', iconKey: 'Store' },
            { href: '/admin/ai', label: t('nav.ai'), iconKey: 'Cpu' },
            { href: '/admin/storage', label: t('nav.storage'), iconKey: 'HardDrive' },
            { href: '/admin/security', label: t('nav.security'), iconKey: 'Shield' },
            { href: '/admin/logs', label: t('nav.logs'), iconKey: 'ScrollText' },
            { href: '/admin/settings', label: t('nav.settings'), iconKey: 'Settings' }
          ]
        },
        { title: 'الحساب', items: [{ href: '/admin/notifications', label: t('common.notifications'), iconKey: 'BellRing' }] }
      ]
    default:
      return []
  }
}
