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

/** أدوات الأستاذ التي خرجت من القائمة المبسّطة — تبقى كاملة في /teacher/tools وبمساراتها نفسها */
export const TEACHER_TOOLS: (NavItem & { group: string })[] = [
  { group: 'الأفواج الحضورية', href: '/teacher/overview', label: 'لوحة الأفواج والحصص الحضورية', iconKey: 'LayoutDashboard' },
  { group: 'الأفواج الحضورية', href: '/teacher/scanner', label: t('nav.scanner'), iconKey: 'ScanLine' },
  { group: 'الأفواج الحضورية', href: '/teacher/sessions', label: t('nav.sessions'), iconKey: 'CalendarCheck' },
  { group: 'الأفواج الحضورية', href: '/teacher/attendance', label: t('nav.attendance'), iconKey: 'ListChecks' },
  { group: 'الأفواج الحضورية', href: '/teacher/groups', label: t('common.groups'), iconKey: 'UsersRound' },
  { group: 'الأفواج الحضورية', href: '/teacher/students', label: t('nav.students'), iconKey: 'Users' },
  { group: 'الأفواج الحضورية', href: '/teacher/codes', label: t('nav.codes'), iconKey: 'KeyRound' },
  { group: 'الأفواج الحضورية', href: '/teacher/assistants', label: t('nav.assistants'), iconKey: 'UserCog' },
  { group: 'التقييم', href: '/teacher/assignments', label: t('nav.assignments'), iconKey: 'ClipboardList' },
  { group: 'التقييم', href: '/teacher/quizzes', label: t('nav.quizzes'), iconKey: 'ListChecks' },
  { group: 'التقييم', href: '/teacher/exams', label: 'الامتحانات', iconKey: 'FileText' },
  { group: 'التقييم', href: '/teacher/bank', label: 'بنك الأسئلة', iconKey: 'Library' },
  { group: 'التقييم', href: '/teacher/rubrics', label: t('rubrics.title'), iconKey: 'ClipboardCheck' },
  { group: 'المحتوى', href: '/teacher/files', label: t('nav.files'), iconKey: 'FolderOpen' },
  { group: 'المحتوى', href: '/teacher/library', label: 'مكتبتي', iconKey: 'BookMarked' },
  { group: 'المحتوى', href: '/teacher/drive', label: 'مكتبة Drive', iconKey: 'HardDrive' },
  { group: 'المحتوى', href: '/teacher/market', label: 'سوق الأساتذة', iconKey: 'Store' },
  { group: 'المحتوى', href: '/teacher/announcements', label: 'الإشعارات للتلاميذ', iconKey: 'Megaphone' },
  { group: 'المتابعة', href: '/teacher/reports', label: t('nav.reports'), iconKey: 'BarChart3' },
  { group: 'المتابعة', href: '/teacher/ai-insights', label: t('nav.aiInsights'), iconKey: 'Brain' }
]

export function navFor(role: UserRole): NavSection[] {
  switch (role) {
    case 'STUDENT':
      return [
        {
          items: [
            { href: '/student', label: t('nav.home'), iconKey: 'Home', exact: true },
            { href: '/student/attendance/card', label: t('nav.attendanceCard'), iconKey: 'QrCode' },
            { href: '/student/groups', label: t('nav.myGroups'), iconKey: 'UsersRound' },
            { href: '/student/attendance', label: t('nav.attendance'), iconKey: 'CalendarCheck', exact: true }
          ]
        },
        {
          title: 'التعلّم',
          // مجمّعات: الدورات (دوراتي + الكتالوج)، الدروس (دروسي + فيديوهات + ملفات)، تدرّب (PLAY + اختبارات أستاذي + تدريب حرّ)،
          // الفروض والاختبارات (المجانية + واجباتي)، تقدّمي (التقدم + العلامات). الصفحات القديمة تبقى بمساراتها كتبويبات.
          items: [hubItem('courses'), hubItem('lessons'), hubItem('train'), hubItem('exams'), hubItem('progress'), { href: '/student/classroom', label: 'القسم الافتراضي', iconKey: 'MessagesSquare' }]
        },
        {
          title: 'أقسام المنصة',
          // الأقسام العامة التي لها مقابل داخل «التعلّم» لا تتكرّر هنا؛ والمنتدى = القسم الافتراضي للتلميذ فلا يُعرض
          items: [...MAIN_SECTIONS.filter((s) => s.href === '/bac').map((s) => ({ href: s.href, label: s.label, iconKey: s.iconKey })), { href: '/store', label: 'المتجر', iconKey: 'ShoppingBag' }]
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
      // الواجهة المبسّطة (قرار المالك 2026-10-23): ستة مداخل فقط. بقية الأدوات لم تُحذف — في /teacher/tools.
      return [
        {
          items: [
            { href: '/teacher', label: 'لوحتي: المسجّلون والمداخيل', iconKey: 'LayoutDashboard', exact: true },
            { href: '/teacher/publish', label: 'رفع ملفات أو اختبار', iconKey: 'Upload' },
            { href: '/teacher/content', label: 'المحتوى والحصص السابقة', iconKey: 'BookOpen' },
            { href: '/teacher/classroom', label: 'القسم الافتراضي', iconKey: 'MessagesSquare' }
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
            { href: '/assistant/scanner', label: t('nav.scanner'), iconKey: 'ScanLine' },
            { href: '/assistant/sessions', label: t('nav.sessions'), iconKey: 'CalendarCheck' },
            { href: '/assistant/attendance', label: t('nav.attendance'), iconKey: 'ListChecks' },
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
